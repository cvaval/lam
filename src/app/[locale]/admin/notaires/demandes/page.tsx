import Link from 'next/link'
import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { estSchemaAbsent } from '@/lib/delais/service-base'
import { DEMANDE_STATUTS, LIBELLE_KIND, LIBELLE_STATUT, demandesOuvertes, destinatairesAlerte } from '@/lib/jurisdictions/notaires-demandes'

export const dynamic = 'force-dynamic'

/**
 * File des demandes des tiers (chantier D) — MASTER ADMIN seulement. Les demandes ouvertes
 * d'abord, les plus anciennes en tête : on traite dans l'ordre d'arrivée.
 */
export default async function DemandesNotairesPage({
  params, searchParams,
}: { params: { locale: string }; searchParams: { statut?: string | string[] } }) {
  const { locale } = dictFor(params.locale)
  await requireAdmin(locale)
  const brut = Array.isArray(searchParams.statut) ? searchParams.statut[0] : searchParams.statut
  const statut = (DEMANDE_STATUTS as readonly string[]).includes(brut ?? '') ? brut! : null

  let demandes: Array<{
    id: string; kind: string; status: string; requesterName: string; requesterRole: string; createdAt: Date; notifiedAt: Date | null; payloadJson: string
    notaryId: string | null
  }> = []
  let comptes: Record<string, number> = {}
  let indisponible = false
  try {
    const [rows, groupes] = await Promise.all([
      prisma.notaryRequest.findMany({
        where: statut ? { status: statut } : { status: { in: ['NOUVELLE', 'EN_COURS'] } },
        orderBy: { createdAt: statut === 'ACCEPTEE' || statut === 'REFUSEE' ? 'desc' : 'asc' },
        take: 200,
        select: { id: true, kind: true, status: true, requesterName: true, requesterRole: true, createdAt: true, notifiedAt: true, payloadJson: true, notaryId: true },
      }),
      prisma.notaryRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    ])
    demandes = rows
    comptes = Object.fromEntries(groupes.map((g) => [g.status, g._count._all]))
  } catch (e) {
    if (!estSchemaAbsent(e)) throw e
    indisponible = true
  }
  const noms = demandes.some((d) => d.notaryId)
    ? new Map((await prisma.notary.findMany({ where: { id: { in: demandes.flatMap((d) => (d.notaryId ? [d.notaryId] : [])) } }, select: { id: true, fullName: true, displayName: true } }))
        .map((n) => [n.id, n.displayName ?? n.fullName]))
    : new Map<string, string>()
  const cible = (d: (typeof demandes)[number]) => {
    if (d.notaryId) return noms.get(d.notaryId) ?? d.notaryId
    try { return `« ${(JSON.parse(d.payloadJson) as { notaryName?: string }).notaryName ?? '—'} »` } catch { return '—' }
  }

  return (
    <div className="p-6">
      <p className="text-xs"><Link href={`/${locale}/admin/notaires`} className="text-grafit underline underline-offset-2">← Notaires — coordonnées</Link></p>
      <h1 className="mt-2 font-serif text-2xl font-semibold text-ank">Demandes de tiers — notaires</h1>
      <p className="mt-1 max-w-2xl text-sm text-grafit">
        Formulaire public {demandesOuvertes() ? <strong className="text-ank">ouvert</strong> : <strong className="text-ank">fermé</strong>}
        {' '}(variable <code className="font-mono text-xs">NOTARY_REQUESTS_ENABLED</code>). Notification à : {destinatairesAlerte().join(', ') || '—'}.
        Une demande n’est qu’une déclaration : rien n’est publié avant votre décision.
      </p>

      <nav aria-label="Statut" className="mt-4 flex flex-wrap gap-2">
        <Link href={`/${locale}/admin/notaires/demandes`} aria-current={!statut ? 'page' : undefined} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${!statut ? 'border-chabon bg-chabon text-koton' : 'border-chabon/20 bg-white text-grafit'}`}>
          À traiter ({(comptes.NOUVELLE ?? 0) + (comptes.EN_COURS ?? 0)})
        </Link>
        {DEMANDE_STATUTS.map((s) => (
          <Link key={s} href={`/${locale}/admin/notaires/demandes?statut=${s}`} aria-current={statut === s ? 'page' : undefined} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${statut === s ? 'border-chabon bg-chabon text-koton' : 'border-chabon/20 bg-white text-grafit'}`}>
            {LIBELLE_STATUT[s]} ({comptes[s] ?? 0})
          </Link>
        ))}
      </nav>

      {indisponible ? (
        <p className="mt-4 text-sm text-grafit">La table des demandes n’existe pas encore dans cette base.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-chabon/10 bg-white">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-chabon/10 bg-pil/50 font-mono text-[10px] uppercase tracking-wide text-ank/80">
              <tr>
                <th className="px-3 py-2">Reçue</th>
                <th className="px-3 py-2">Objet</th>
                <th className="px-3 py-2">Notaire</th>
                <th className="px-3 py-2">Demandeur</th>
                <th className="px-3 py-2">Courriel à la rédaction</th>
                <th className="px-3 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {demandes.map((d) => (
                <tr key={d.id} className="border-b border-chabon/5">
                  <td className="px-3 py-2 font-mono text-[10px]">
                    <Link href={`/${locale}/admin/notaires/demandes/${d.id}`} className="underline underline-offset-2">{d.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</Link>
                  </td>
                  <td className="px-3 py-2">{LIBELLE_KIND[d.kind] ?? d.kind}</td>
                  <td className="px-3 py-2 font-medium text-ank">{cible(d)}</td>
                  <td className="px-3 py-2">{d.requesterName}</td>
                  <td className="px-3 py-2">{d.notifiedAt ? 'envoyé' : 'non envoyé'}</td>
                  <td className="px-3 py-2">{LIBELLE_STATUT[d.status] ?? d.status}</td>
                </tr>
              ))}
              {demandes.length === 0 && <tr><td colSpan={6} className="px-3 py-3 text-grafit">Aucune demande.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
