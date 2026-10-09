import Link from 'next/link'
import { dictFor } from '@/lib/i18n/server'
import { requireCapability } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { getNotaryIndex, lectureNotairesImpossible } from '@/lib/jurisdictions/data'
import { searchNotaries } from '@/lib/jurisdictions/search-notaries'
import { readPhones } from '@/lib/jurisdictions/coordonnees'

export const dynamic = 'force-dynamic'

/**
 * Coordonnées des notaires — écran de la rédaction (chantier C, `corpus.manage`).
 * Chercher un notaire de la liste, ouvrir sa fiche, saisir ou corriger. Les entrées de la liste
 * du MJSP ne se modifient pas ici : seule la seconde source (les coordonnées) se saisit.
 */
export default async function AdminNotairesPage({
  params, searchParams,
}: { params: { locale: string }; searchParams: { q?: string | string[] } }) {
  const { locale } = dictFor(params.locale)
  const user = await requireCapability(locale, 'corpus.manage')
  const rawQ = Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q
  const q = (rawQ ?? '').slice(0, 80)

  const index = await getNotaryIndex()
  const resultats = q ? searchNotaries(index, q).slice(0, 30) : []

  let fiches: Array<{ notaryId: string; nom: string; active: boolean; telephones: number; email: boolean; adresse: boolean; upToDateOn: string | null; updatedAt: Date }> = []
  let nouvelles = 0
  try {
    const rows = await prisma.notaryContact.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        notaryId: true, active: true, phonesJson: true, email: true, address: true, upToDateOn: true, updatedAt: true,
        notary: { select: { fullName: true, displayName: true } },
      },
    })
    fiches = rows.map((r) => ({
      notaryId: r.notaryId, nom: r.notary.displayName ?? r.notary.fullName, active: r.active,
      telephones: readPhones(r.phonesJson).length, email: Boolean(r.email), adresse: Boolean(r.address),
      upToDateOn: r.upToDateOn?.toISOString().slice(0, 10) ?? null, updatedAt: r.updatedAt,
    }))
    if (user.role === 'MASTER_ADMIN') nouvelles = await prisma.notaryRequest.count({ where: { status: 'NOUVELLE' } }).catch(() => 0)
  } catch (e) {
    if (!lectureNotairesImpossible(e)) throw e
  }

  return (
    <div className="p-6">
      <h1 className="font-serif text-2xl font-semibold text-ank">Notaires — coordonnées</h1>
      <p className="mt-1 max-w-2xl text-sm text-grafit">
        Les coordonnées sont une seconde source, distincte de la liste du MJSP : chaque fiche porte qui l’a
        communiquée, par quel canal et à quelle date. Elles ne s’affichent que sur la page du notaire.
      </p>
      {user.role === 'MASTER_ADMIN' && (
        <p className="mt-3 text-sm">
          <Link href={`/${locale}/admin/notaires/demandes`} className="font-semibold text-ank underline underline-offset-2">
            Demandes de tiers{nouvelles ? ` — ${nouvelles} nouvelle${nouvelles > 1 ? 's' : ''}` : ''}
          </Link>
        </p>
      )}

      <form method="get" className="mt-5 flex max-w-xl gap-2" role="search">
        <label htmlFor="q-notaire" className="sr-only">Chercher un notaire</label>
        <input id="q-notaire" name="q" type="search" defaultValue={q} placeholder="Nom du notaire (« Ceant », « Gemma Anglade »…)" className="w-full rounded-lg border border-chabon/15 bg-white px-3 py-2 text-sm" />
        <button type="submit" className="rounded-full bg-chabon px-4 py-2 text-xs font-semibold text-koton">Chercher</button>
      </form>

      {q && (
        <section className="mt-4" aria-label="Résultats">
          {resultats.length === 0 ? (
            <p className="text-sm text-grafit">Aucun notaire de la liste ne répond à « {q} ».</p>
          ) : (
            <ul className="flex max-w-2xl flex-col gap-1">
              {resultats.map((n) => (
                <li key={n.id}>
                  <Link href={`/${locale}/admin/notaires/${n.id}`} className="flex items-baseline justify-between gap-3 rounded-lg border border-chabon/10 bg-white px-3 py-2 text-sm hover:bg-koton">
                    <span className="font-medium text-ank">{n.name}{n.mention ? <span className="ml-1 font-mono text-[10px] text-grafit">({n.mention})</span> : null}</span>
                    <span className="text-xs text-grafit">{n.communeName ?? 'commune non reconnue'}{n.hasContact ? ' · fiche publiée' : ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-serif text-lg font-semibold text-ank">Fiches existantes ({fiches.length})</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border border-chabon/10 bg-white">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b border-chabon/10 bg-pil/50 font-mono text-[10px] uppercase tracking-wide text-ank/80">
              <tr>
                <th className="px-3 py-2">Notaire</th>
                <th className="px-3 py-2">Adresse</th>
                <th className="px-3 py-2">Téléphones</th>
                <th className="px-3 py-2">Courriel</th>
                <th className="px-3 py-2">À jour au</th>
                <th className="px-3 py-2">Publiée</th>
              </tr>
            </thead>
            <tbody>
              {fiches.map((f) => (
                <tr key={f.notaryId} className="border-b border-chabon/5">
                  <td className="px-3 py-2">
                    <Link href={`/${locale}/admin/notaires/${f.notaryId}`} className="font-medium text-ank underline-offset-2 hover:underline">{f.nom}</Link>
                  </td>
                  <td className="px-3 py-2">{f.adresse ? 'oui' : '—'}</td>
                  <td className="px-3 py-2">{f.telephones || '—'}</td>
                  <td className="px-3 py-2">{f.email ? 'oui' : '—'}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{f.upToDateOn ?? '—'}</td>
                  <td className="px-3 py-2">{f.active ? 'oui' : 'non'}</td>
                </tr>
              ))}
              {fiches.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-3 text-grafit">Aucune fiche.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
