import Link from 'next/link'
import { notFound } from 'next/navigation'
import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { estSchemaAbsent } from '@/lib/delais/service-base'
import { formatPhone } from '@/lib/jurisdictions/coordonnees'
import { getCommuneDirectory, getNotaryIndex } from '@/lib/jurisdictions/data'
import { searchNotaries } from '@/lib/jurisdictions/search-notaries'
import { LIBELLE_KIND, LIBELLE_ROLE, LIBELLE_STATUT } from '@/lib/jurisdictions/notaires-demandes'
import { NotaryRequestActions } from '@/components/jurisdictions/NotaryRequestActions'

export const dynamic = 'force-dynamic'

interface Payload {
  notaryName?: string | null; communeId?: string | null; address?: string | null; phones?: string[]
  email?: string | null; message?: string | null; requesterRoleOther?: string | null
}

/**
 * Une demande de tiers (chantier D), MASTER ADMIN. Le courriel du demandeur s'affiche ici pour
 * qu'on puisse lui répondre À LA MAIN : le site ne lui écrit jamais.
 */
export default async function DemandeNotairePage({ params }: { params: { locale: string; id: string } }) {
  const { locale } = dictFor(params.locale)
  await requireAdmin(locale)
  if (!/^[a-z0-9]{10,40}$/.test(params.id)) notFound()

  let d
  try {
    d = await prisma.notaryRequest.findUnique({ where: { id: params.id } })
  } catch (e) {
    if (estSchemaAbsent(e)) notFound()
    throw e
  }
  if (!d) notFound()

  const p = ((): Payload => { try { return JSON.parse(d.payloadJson) as Payload } catch { return {} } })()
  const [communes, notaire, decideur, historique] = await Promise.all([
    getCommuneDirectory(),
    d.notaryId ? prisma.notary.findUnique({ where: { id: d.notaryId }, select: { id: true, fullName: true, displayName: true, active: true } }) : Promise.resolve(null),
    d.decidedById ? prisma.user.findUnique({ where: { id: d.decidedById }, select: { email: true } }) : Promise.resolve(null),
    prisma.auditLog.findMany({
      where: { targetType: 'NotaryRequest', targetId: d.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, action: true, createdAt: true, metaJson: true, actor: { select: { email: true } } },
    }),
  ])
  const commune = p.communeId ? communes.find((c) => c.id === p.communeId) : null
  const ouverte = d.status === 'NOUVELLE' || d.status === 'EN_COURS'
  // Coordonnées sans entrée choisie : on propose les notaires de la liste qui portent ce nom.
  const candidats = d.kind === 'CONTACT' && !d.notaryId && p.notaryName ? searchNotaries(await getNotaryIndex(), p.notaryName).slice(0, 8) : []

  const ligne = (label: string, valeur: React.ReactNode) => (
    <>
      <dt className="text-ank/80">{label}</dt>
      <dd className="text-ank">{valeur || <span className="text-grafit">—</span>}</dd>
    </>
  )

  return (
    <div className="p-6">
      <p className="text-xs"><Link href={`/${locale}/admin/notaires/demandes`} className="text-grafit underline underline-offset-2">← Demandes de tiers</Link></p>
      <h1 className="mt-2 font-serif text-2xl font-semibold text-ank">
        Demande n° {d.id.slice(-8)} — {LIBELLE_KIND[d.kind] ?? d.kind}
      </h1>
      <p className="mt-1 text-sm text-grafit">
        {LIBELLE_STATUT[d.status] ?? d.status} · reçue le {d.createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC · langue {d.locale}
        {' · '}courriel à la rédaction : {d.notifiedAt ? 'envoyé' : 'non envoyé'}
      </p>

      <dl className="mt-4 grid max-w-2xl grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-chabon/10 bg-white p-4 text-sm">
        {ligne('Notaire visé', notaire
          ? <Link href={`/${locale}/admin/notaires/${notaire.id}`} className="underline underline-offset-2">{notaire.displayName ?? notaire.fullName}</Link>
          : p.notaryName ? `« ${p.notaryName} » (nom saisi)` : null)}
        {ligne('Commune déclarée', commune ? `${commune.name} (${commune.department})` : null)}
        {ligne('Adresse', p.address)}
        {ligne('Téléphones', p.phones?.length ? <span className="font-mono">{p.phones.map(formatPhone).join(' · ')}</span> : null)}
        {ligne('Courriel de l’étude', p.email)}
        {ligne('Précisions', p.message ? <span className="whitespace-pre-line">{p.message}</span> : null)}
        {ligne('Demandeur', `${d.requesterName} — ${d.requesterRole === 'AUTRE' ? `autre : ${p.requesterRoleOther ?? '?'}` : LIBELLE_ROLE[d.requesterRole] ?? d.requesterRole}`)}
        {ligne('Courriel du demandeur', <a href={`mailto:${d.requesterEmail}`} className="underline underline-offset-2">{d.requesterEmail}</a>)}
        {d.decidedAt && ligne('Décision', `${LIBELLE_STATUT[d.status]} le ${d.decidedAt.toISOString().slice(0, 10)} par ${decideur?.email ?? '?'}${d.decisionNote ? ` — ${d.decisionNote}` : ''}`)}
      </dl>

      {ouverte && d.kind === 'CONTACT' && (
        <section className="mt-6 max-w-2xl rounded-xl border border-chabon/10 bg-white p-4">
          <h2 className="font-serif text-lg font-semibold text-ank">Accepter les coordonnées</h2>
          <p className="mt-1 text-xs text-grafit">Ouvrez la fiche du notaire : elle est pré-remplie avec la demande ; relisez, corrigez au besoin, enregistrez.</p>
          {d.notaryId ? (
            <p className="mt-3">
              <Link href={`/${locale}/admin/notaires/${d.notaryId}?demande=${d.id}`} className="inline-flex rounded-full bg-chabon px-4 py-2 text-xs font-semibold text-koton">
                Ouvrir la fiche pré-remplie
              </Link>
            </p>
          ) : candidats.length ? (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {candidats.map((c) => (
                <li key={c.id}>
                  <Link href={`/${locale}/admin/notaires/${c.id}?demande=${d.id}`} className="underline underline-offset-2">
                    {c.name}{c.communeName ? ` — ${c.communeName}` : ''}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-grafit">
              Aucun notaire de la liste ne porte ce nom. Cherchez-le depuis <Link href={`/${locale}/admin/notaires`} className="underline underline-offset-2">l’écran des coordonnées</Link>,
              puis ajoutez <code className="font-mono text-xs">?demande={d.id}</code> à l’adresse de sa fiche — ou refusez la demande.
            </p>
          )}
        </section>
      )}

      <NotaryRequestActions
        locale={locale}
        requestId={d.id}
        kind={d.kind}
        status={d.status}
        prefill={{ fullName: p.notaryName ?? '', communeId: p.communeId ?? '' }}
        communes={communes.map((c) => ({ id: c.id, name: c.name, department: c.department }))}
      />

      <section className="mt-8 max-w-2xl">
        <h2 className="font-serif text-lg font-semibold text-ank">Historique</h2>
        <ul className="mt-2 flex flex-col gap-1 text-xs text-grafit">
          {historique.map((h) => (
            <li key={h.id} className="rounded-lg border border-chabon/10 bg-white px-3 py-2">
              <span className="font-mono text-[10px] text-ank/80">{h.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</span>{' '}
              <span className="font-semibold">{h.action}</span>
              {h.metaJson ? ` · ${h.metaJson}` : ''} · {h.actor?.email ?? 'formulaire public'}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
