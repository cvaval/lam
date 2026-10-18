import Link from 'next/link'
import { notFound } from 'next/navigation'
import { dictFor } from '@/lib/i18n/server'
import { requireCapability } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { formatPhone, readPhones } from '@/lib/jurisdictions/coordonnees'
import { lectureNotairesImpossible } from '@/lib/jurisdictions/data'
import { LIBELLE_ROLE } from '@/lib/jurisdictions/notaires-demandes'
import { NotaryContactEditor, type NotaryContactInitial } from '@/components/jurisdictions/NotaryContactEditor'
import { NotaryConfirmationActions } from '@/components/jurisdictions/NotaryConfirmationActions'
import { LIBELLE_METHODE, badgeAffichable, empreinte, instantane, type MethodeVerification } from '@/lib/jurisdictions/notaires-confirmation'

export const dynamic = 'force-dynamic'

const ID_RE = /^[a-z0-9][a-z0-9-]{2,119}$/

const lireJson = <T,>(s: string | null | undefined, repli: T): T => {
  try { return s ? (JSON.parse(s) as T) : repli } catch { return repli }
}

/**
 * Fiche de coordonnées d'un notaire (chantier C). `?demande=<id>` (master admin) pré-remplit le
 * formulaire avec la déclaration d'un tiers : la rédaction la relit, la corrige au besoin, et
 * l'enregistrement ACCEPTE la demande. Rien n'est publié tant qu'on n'a pas enregistré.
 */
export default async function AdminNotairePage({
  params, searchParams,
}: { params: { locale: string; id: string }; searchParams: { demande?: string | string[] } }) {
  const { locale } = dictFor(params.locale)
  const user = await requireCapability(locale, 'corpus.manage')
  if (!ID_RE.test(params.id)) notFound()
  const estMaster = user.role === 'MASTER_ADMIN'

  let n
  try {
    n = await prisma.notary.findUnique({
      where: { id: params.id },
      select: {
        id: true, ordinal: true, edition: true, fullName: true, displayName: true, mention: true, active: true,
        sourceCommune: true, sourceDepartment: true, communeId: true,
        commune: { select: { name: true } },
        contact: true,
      },
    })
  } catch (e) {
    if (lectureNotairesImpossible(e)) notFound()
    throw e
  }
  if (!n) notFound()

  const demandeId = Array.isArray(searchParams.demande) ? searchParams.demande[0] : searchParams.demande
  const demande = estMaster && demandeId && /^[a-z0-9]{10,40}$/.test(demandeId)
    ? await prisma.notaryRequest.findUnique({ where: { id: demandeId } }).catch(() => null)
    : null
  // Pré-remplissage : une demande « coordonnées » qui vise ce notaire, ou qui n'en vise aucun
  // (nom saisi — elle s'y rattachera à l'enregistrement). Une demande déjà ACCEPTÉE qui l'a
  // créé (inscription) pré-remplit encore la fiche, sans rien accepter de plus.
  const ouverte = (s: string) => s === 'NOUVELLE' || s === 'EN_COURS'
  const demandeOuverte = demande && demande.kind === 'CONTACT' && ouverte(demande.status) && (!demande.notaryId || demande.notaryId === n.id) ? demande : null
  const demandeSource = demandeOuverte ?? (demande && demande.status === 'ACCEPTEE' && demande.notaryId === n.id && !n.contact ? demande : null)

  const c = n.contact
  const source = lireJson<{ providedBy?: string; channel?: string }>(c?.sourceJson, {})
  const aujourdHui = new Date().toISOString().slice(0, 10)
  let initial: NotaryContactInitial = {
    address: c?.address ?? '',
    phones: readPhones(c?.phonesJson).map(formatPhone),
    email: c?.email ?? '',
    searchAliases: lireJson<string[]>(c?.searchAliasesJson, []),
    observation: c?.observation ?? '',
    upToDateOn: c?.upToDateOn?.toISOString().slice(0, 10) ?? aujourdHui,
    providedBy: source.providedBy ?? '',
    channel: source.channel ?? '',
    active: c?.active ?? true,
  }
  if (demandeSource) {
    const p = lireJson<{ address?: string | null; phones?: string[]; email?: string | null }>(demandeSource.payloadJson, {})
    initial = {
      ...initial,
      address: p.address ?? initial.address,
      phones: p.phones?.length ? p.phones.map(formatPhone) : initial.phones,
      email: p.email ?? initial.email,
      upToDateOn: demandeSource.createdAt.toISOString().slice(0, 10),
      providedBy: `${demandeSource.requesterName} (${LIBELLE_ROLE[demandeSource.requesterRole] ?? demandeSource.requesterRole})`,
      channel: `Formulaire du site, demande n° ${demandeSource.id.slice(-8)}`,
      active: true,
    }
  }

  const nom = n.displayName ?? n.fullName
  // Badge « Confirmé » : état et HISTORIQUE (validations, remplacements, invalidations, retraits).
  // Lecture à part : avant la migration, la table n'existe pas — la fiche reste servie.
  const confirmations = await prisma.notaryConfirmation.findMany({
    where: { notaryId: n.id },
    orderBy: { validatedAt: 'desc' },
    select: { id: true, status: true, snapshotHash: true, confirmedOn: true, validatedAt: true, validatedById: true, method: true, evidenceRef: true, note: true, requestId: true, endedAt: true, endedById: true, endReason: true },
  }).catch((e: unknown) => { if (lectureNotairesImpossible(e)) return null; throw e })
  const versionActuelle = empreinte(instantane(n, n.contact))
  const active = confirmations?.find((c) => c.status === 'ACTIVE') ?? null
  const auteurs = confirmations?.length
    ? new Map((await prisma.user.findMany({ where: { id: { in: [...new Set(confirmations.flatMap((c) => [c.validatedById, c.endedById]).filter((x): x is string => Boolean(x)))] } }, select: { id: true, email: true } })).map((u) => [u.id, u.email]))
    : new Map<string, string>()
  const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—')
  return (
    <div className="p-6">
      <p className="text-xs"><Link href={`/${locale}/admin/notaires`} className="text-grafit underline underline-offset-2">← Notaires — coordonnées</Link></p>
      <h1 className="mt-2 font-serif text-2xl font-semibold text-ank">{nom}</h1>
      <p className="mt-1 text-sm text-grafit">
        {n.edition === 'tiers' ? 'Ajouté après vérification par la rédaction' : `N° ${n.ordinal} de la liste du MJSP`}
        {n.mention ? ` · ${n.mention}` : ''} · {n.commune?.name ?? `${n.sourceCommune} (commune non reconnue)`}
        {n.displayName && n.displayName !== n.fullName ? ` · imprimé « ${n.fullName} »` : ''}
      </p>
      <p className="font-mono text-[10px] text-ank/80">{n.id}</p>
      {n.active && (
        <p className="mt-2 text-xs">
          <Link href={`/${locale}/juridictions/notaires/${n.id}`} className="text-grafit underline underline-offset-2">Voir la page publique</Link>
        </p>
      )}

      {!n.active ? (
        <p className="mt-4 max-w-2xl rounded-xl border border-chabon/10 bg-white p-4 text-sm text-grafit">
          Cette entrée est retirée de la liste publiée : elle n’a pas de page et ne reçoit pas de coordonnées.
        </p>
      ) : (
        <>
          {demandeSource && (
            <div className="mt-4 max-w-2xl rounded-xl border-l-2 border-sitwon bg-white p-4 text-sm text-grafit">
              <p className="font-semibold text-ank">Pré-rempli avec la demande n° {demandeSource.id.slice(-8)}</p>
              <p className="mt-1">
                Déclaration de {demandeSource.requesterName} ({LIBELLE_ROLE[demandeSource.requesterRole] ?? demandeSource.requesterRole}).
                {demandeOuverte
                  ? ' Vérifiez avant d’enregistrer : l’enregistrement publie les coordonnées et accepte la demande.'
                  : ' Vérifiez avant d’enregistrer : l’enregistrement publie les coordonnées.'}
              </p>
              <p className="mt-1"><Link href={`/${locale}/admin/notaires/demandes/${demandeSource.id}`} className="underline underline-offset-2">Revoir la demande</Link></p>
            </div>
          )}
          <NotaryContactEditor
            notaryId={n.id}
            initial={initial}
            existe={Boolean(c)}
            requestId={demandeOuverte?.id ?? null}
            peutSupprimer={estMaster}
          />

          <section className="mt-8 max-w-2xl rounded-xl border border-chabon/10 bg-white p-4">
            <h2 className="font-serif text-lg font-semibold text-ank">Confirmation par le notaire (badge « Confirmé »)</h2>
            {confirmations === null ? (
              <p className="mt-2 text-sm text-grafit">La table des confirmations n’existe pas encore dans cette base.</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-ank">
                  {active
                    ? badgeAffichable(active, versionActuelle)
                      ? `Badge affiché — confirmé le ${jour(active.confirmedOn)}, validé le ${jour(active.validatedAt)} par ${auteurs.get(active.validatedById) ?? '?'}.`
                      : 'Confirmation active mais DÉSYNCHRONISÉE : les informations ont changé depuis ; le badge n’est pas affiché.'
                    : 'Aucune confirmation active : pas de badge. Une confirmation ne se valide que depuis une demande « Confirmation » du notaire.'}
                </p>
                {active && estMaster && <NotaryConfirmationActions notaryId={n.id} />}
                {confirmations.length > 0 && (
                  <>
                    <h3 className="mt-4 text-sm font-semibold text-ank">Historique</h3>
                    <ul className="mt-1 flex flex-col gap-1 text-xs text-grafit">
                      {confirmations.map((x) => (
                        <li key={x.id} className="rounded-lg border border-chabon/10 px-3 py-2">
                          <span className="font-semibold text-ank">{x.status}</span> · confirmée le {jour(x.confirmedOn)} · validée le {jour(x.validatedAt)} par {auteurs.get(x.validatedById) ?? '?'}
                          {' '}· méthode : {LIBELLE_METHODE[x.method as MethodeVerification] ?? x.method}
                          {estMaster && <> · justificatifs : <span className="font-mono">{x.evidenceRef}</span></>}
                          {x.requestId && <> · <Link href={`/${locale}/admin/notaires/demandes/${x.requestId}`} className="underline underline-offset-2">demande</Link></>}
                          {x.note && <> · {x.note}</>}
                          {x.endedAt && <> · fin le {jour(x.endedAt)} ({x.endedById ? auteurs.get(x.endedById) ?? '?' : 'automatique'}) : {x.endReason}</>}
                          <span className="block font-mono text-[10px] text-ank/70">version {x.snapshotHash.slice(0, 12)}…{x.snapshotHash === versionActuelle ? ' (= version publiée)' : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
