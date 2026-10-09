import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { audit } from '@/lib/auth/audit'
import { getClientCtx } from '@/lib/auth/request'
import { guard, guardPersistent } from '@/lib/security/ratelimit'
import { estSchemaAbsent } from '@/lib/delais/service-base'
import { sendMail, notaryRequestEmail, notaryRequestVolumeEmail } from '@/lib/mail'
import { isLocale } from '@/lib/types'
import { ACTIONS_HUMAIN, CHAMP_JETON, jetonConsomme, verifierHumain } from '@/lib/security/turnstile'
import {
  DEMANDES_PAR_IP, PLAFOND_COURRIELS_JOUR, demandesOuvertes, destinatairesAlerte, lireDemande,
} from '@/lib/jurisdictions/notaires-demandes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Demande d'un TIERS (chantier D) — formulaire public, envoyé en `POST` classique : il fonctionne
 * sans JavaScript, et la réponse est toujours une redirection 303 vers la page du formulaire.
 *
 *   1. formulaire fermé (`NOTARY_REQUESTS_ENABLED` ≠ `true`, ou clés Turnstile absentes) → 404 ;
 *   2. frein mémoire ;
 *   3. champ piège ou envoi trop rapide → « envoyée » sans RIEN enregistrer ni appeler Cloudflare ;
 *   4. validation de la saisie — AVANT la vérification humaine : une faute de frappe ne consomme
 *      pas le jeton (`jetonConsomme: false`), la personne corrige sans refaire la vérification ;
 *   5. VÉRIFICATION HUMAINE (Turnstile, action `notary-request`) ; échec → audit
 *      HUMAN_CHECK_FAILED (IP, motif, codes — ni jeton ni contenu) et refus `humain` ;
 *   6. frein persistant par IP (3 par heure, sur l'audit) ;
 *   7. ENREGISTREMENT d'abord (avec `humanVerifiedAt`), audit NOTARY_REQUEST_CREATED SANS le
 *      contenu, PUIS courriel à la rédaction (jamais au demandeur), « au mieux » : un échec
 *      laisse `notifiedAt` vide et la demande visible dans la file ;
 *   8. même confirmation dans tous les cas : rien n'apprend qui a écrit quoi.
 *
 * Le formulaire, quand JavaScript est là, envoie `Accept: application/json` : mêmes étapes, mais
 * la réponse est `{ ok: true }` ou `{ ok: false, erreurs: [...], jetonConsomme }` — la saisie reste
 * à l'écran, et le widget se réinitialise si le jeton a été présenté à Cloudflare.
 */
export async function POST(req: NextRequest) {
  if (!demandesOuvertes()) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const ctx = getClientCtx(req)

  const form = await req.formData().catch(() => null)
  const champs: Record<string, string> = {}
  form?.forEach((v, k) => { if (typeof v === 'string') champs[k] = v })
  const locale = isLocale(champs.locale ?? '') ? champs.locale : 'fr'
  const notaireQs = champs.notaire && /^[a-z0-9][a-z0-9-]{2,119}$/.test(champs.notaire) ? `&notaire=${champs.notaire}` : ''
  const enJson = (req.headers.get('accept') ?? '').includes('application/json')
  const redirige = (qs: string) => NextResponse.redirect(new URL(`/${locale}/juridictions/notaires/demande?${qs}`, req.url), 303)
  const envoyee = () => (enJson ? NextResponse.json({ ok: true }) : redirige('envoyee=1'))
  const refus = (erreurs: string[], status: number, consomme = true) =>
    enJson ? NextResponse.json({ ok: false, erreurs, jetonConsomme: consomme }, { status }) : redirige(`erreur=${erreurs.join(',')}${notaireQs}`)

  if (!(await guard({ action: 'jur-notaires-demande', subject: ctx.ip ?? 'sans-ip', limit: 10, windowMs: 600_000 }, { ip: ctx.ip }))) {
    return refus(['frein'], 429, false)
  }

  const communes = await prisma.judicialCommune.findMany({ select: { id: true, name: true } })
  const lecture = lireDemande(champs, { maintenant: Date.now(), communesValides: new Set(communes.map((c) => c.id)) })
  if (lecture.kind === 'piege') return envoyee()
  if (lecture.kind === 'invalide') return refus(lecture.erreurs, 422, false)
  const d = lecture.valeur

  const humain = await verifierHumain({ jeton: champs[CHAMP_JETON], ip: ctx.ip, action: ACTIONS_HUMAIN.notaryRequest })
  if (!humain.ok) {
    await audit({ action: 'HUMAN_CHECK_FAILED', ip: ctx.ip, userAgent: ctx.userAgent, meta: { formulaire: 'notaires-demande', motif: humain.motif, codes: humain.codes } })
    const indispo = humain.motif === 'indisponible' || humain.motif === 'configuration'
    return refus([indispo ? 'verification' : 'humain'], indispo ? 503 : 403, jetonConsomme(humain))
  }

  const frein = await guardPersistent({ action: 'NOTARY_REQUEST_CREATED', ip: ctx.ip, ...DEMANDES_PAR_IP })
  if (!frein.ok) {
    await audit({ action: 'SCRAPING_ALERT', ip: ctx.ip, userAgent: ctx.userAgent, meta: { rule: 'notaires-demande', limit: DEMANDES_PAR_IP.limit } })
    return refus(['frein'], 429)
  }

  // L'entrée visée doit exister et être PUBLIÉE ; sinon la demande garde le nom saisi seul.
  let notaire: { id: string; fullName: string; displayName: string | null } | null = null
  if (d.notaryId) {
    notaire = await prisma.notary.findFirst({ where: { id: d.notaryId, active: true }, select: { id: true, fullName: true, displayName: true } }).catch(() => null)
  }

  let demande: { id: string; createdAt: Date }
  try {
    demande = await prisma.notaryRequest.create({
      data: {
        kind: d.kind,
        notaryId: notaire?.id ?? null,
        payloadJson: JSON.stringify({
          notaryName: d.notaryName, communeId: d.communeId, address: d.address, phones: d.phones,
          email: d.email, message: d.message, requesterRoleOther: d.requesterRoleOther,
        }),
        requesterName: d.requesterName,
        requesterRole: d.requesterRole,
        requesterEmail: d.requesterEmail,
        locale,
        humanVerifiedAt: humain.verifieLe,
      },
      select: { id: true, createdAt: true },
    })
  } catch (e) {
    if (estSchemaAbsent(e)) return refus(['indisponible'], 503)
    throw e
  }
  await audit({ action: 'NOTARY_REQUEST_CREATED', targetType: 'NotaryRequest', targetId: demande.id, ip: ctx.ip, userAgent: ctx.userAgent, meta: { kind: d.kind } })

  // Notification à la rédaction — au mieux, hors du chemin critique.
  try {
    const debutJour = new Date(); debutJour.setUTCHours(0, 0, 0, 0)
    const duJour = await prisma.notaryRequest.count({ where: { createdAt: { gte: debutJour } } })
    const commune = d.communeId ? communes.find((c) => c.id === d.communeId)?.name : null
    const cible = notaire
      ? `${notaire.displayName ?? notaire.fullName} (${notaire.id})`
      : `« ${d.notaryName ?? '—'} »${commune ? ` — commune déclarée : ${commune}` : ''} (aucune entrée de la liste)`
    const role = d.requesterRole === 'AUTRE' ? `autre : ${d.requesterRoleOther}` : d.requesterRole === 'ETUDE' ? 'son étude' : 'le notaire'
    let envoye = false
    if (duJour <= PLAFOND_COURRIELS_JOUR) {
      for (const to of destinatairesAlerte()) {
        if (await sendMail(notaryRequestEmail(to, { id: demande.id, kind: d.kind, requesterName: d.requesterName, requesterRole: role, cible, createdAt: demande.createdAt, humanVerifiedAt: humain.verifieLe }))) envoye = true
      }
    } else if (duJour === PLAFOND_COURRIELS_JOUR + 1) {
      for (const to of destinatairesAlerte()) await sendMail(notaryRequestVolumeEmail(to, duJour))
    }
    if (envoye) await prisma.notaryRequest.update({ where: { id: demande.id }, data: { notifiedAt: new Date() } })
  } catch {
    // La demande est enregistrée et visible dans la file : c'est elle qui compte.
  }

  return envoyee()
}
