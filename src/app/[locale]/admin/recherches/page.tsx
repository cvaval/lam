import Link from 'next/link'
import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { formatInstant, debutDeJourneeHaiti } from '@/lib/i18n/format'
import { DOC_TYPE_META } from '@/lib/brand'
import type { DocType, Locale } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * LES RECHERCHES — le détail derrière le chiffre « Recherches aujourd'hui » de la vue d'ensemble.
 *
 * Qui a cherché quoi, quand, dans quelle rubrique, avec combien de résultats — et un cumul par
 * compte. Lecture seule de `SearchLog` (ce que la recherche écrit d'elle-même) : cette page
 * n'appelle jamais le moteur de recherche — rien n'y est écrit.
 *
 * ⚠️ « AUJOURD'HUI » EST LA JOURNÉE DE PORT-AU-PRINCE (`debutDeJourneeHaiti`), pas celle du
 * serveur : à 20 h à Port-au-Prince, Vercel est déjà demain et la vue d'ensemble affichait 0.
 * ⚠️ PAGINATION BORNÉE (200 lignes par page, 100 pages) — une page non bornée est un déni de
 * service. Aucune clé i18n nouvelle : libellés locaux.
 */
const L = {
  titre: { fr: 'Recherches', en: 'Searches', ht: 'Rechèch' },
  sousTitre: { fr: 'Qui a cherché quoi, quand, dans quelle rubrique — et avec combien de résultats.', en: 'Who searched what, when, in which section — and with how many results.', ht: 'Ki moun ki chèche kisa, ki lè, nan ki seksyon — ak konbyen rezilta.' },
  zone: { fr: 'Heures de Port-au-Prince', en: 'Port-au-Prince time', ht: 'Lè Pòtoprens' },
  periode: { fr: 'Période', en: 'Period', ht: 'Peryòd' },
  aujourdhui: { fr: 'aujourd’hui', en: 'today', ht: 'jodi a' },
  jours: { fr: 'derniers jours', en: 'last days', ht: 'dènye jou' },
  compte: { fr: 'Compte', en: 'Account', ht: 'Kont' },
  tousComptes: { fr: 'Tous les comptes', en: 'All accounts', ht: 'Tout kont' },
  visiteur: { fr: 'visiteur (sans compte)', en: 'visitor (no account)', ht: 'vizitè (san kont)' },
  filtrer: { fr: 'Filtrer', en: 'Filter', ht: 'Filtre' },
  parCompte: { fr: 'Par compte', en: 'By account', ht: 'Pa kont' },
  recherches: { fr: 'recherches', en: 'searches', ht: 'rechèch' },
  recherche: { fr: 'recherche', en: 'search', ht: 'rechèch' },
  sansResultat: { fr: 'sans résultat', en: 'with no result', ht: 'san rezilta' },
  heure: { fr: 'Heure', en: 'Time', ht: 'Lè' },
  requete: { fr: 'Requête', en: 'Query', ht: 'Demann' },
  rubrique: { fr: 'Rubrique', en: 'Section', ht: 'Seksyon' },
  toutes: { fr: 'toutes', en: 'all', ht: 'tout' },
  resultats: { fr: 'Résultats', en: 'Results', ht: 'Rezilta' },
  vide: { fr: 'Aucune recherche sur la période.', en: 'No search over the period.', ht: 'Pa gen rechèch sou peryòd la.' },
  page: { fr: 'page', en: 'page', ht: 'paj' },
  precedente: { fr: '← Précédente', en: '← Previous', ht: '← Anvan' },
  suivante: { fr: 'Suivante →', en: 'Next →', ht: 'Apre →' },
  retour: { fr: '← Vue d’ensemble', en: '← Overview', ht: '← Apèsi' },
} as const
const JOURS = [0, 7, 30, 90] as const
const PAR_PAGE = 200
const PAGE_MAX = 100

function lireFiltre(sp?: Record<string, string | string[] | undefined>) {
  const un = (k: string) => (typeof sp?.[k] === 'string' ? (sp![k] as string) : null)
  const jours = Number(un('jours'))
  const page = Number(un('page'))
  return {
    jours: (JOURS as readonly number[]).includes(jours) ? (jours as (typeof JOURS)[number]) : 0,
    compte: un('compte') || null,
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, PAGE_MAX) : 1,
  }
}

export default async function AdminRecherchesPage({ params, searchParams }: { params: { locale: string }; searchParams?: Record<string, string | string[] | undefined> }) {
  const { locale } = dictFor(params.locale)
  await requireAdmin(locale)
  const lt = (o: { fr: string; en: string; ht: string }) => o[locale as Locale] ?? o.fr
  const f = lireFiltre(searchParams)
  const depuis = f.jours === 0 ? debutDeJourneeHaiti() : new Date(Date.now() - f.jours * 86_400_000)
  const where = {
    createdAt: { gte: depuis },
    ...(f.compte === 'visiteur' ? { userId: null } : f.compte ? { userId: f.compte } : {}),
  }
  const [total, lignes, parCompte, comptes] = await Promise.all([
    prisma.searchLog.count({ where }),
    prisma.searchLog.findMany({ where, select: { id: true, createdAt: true, query: true, type: true, resultsCount: true, locale: true, user: { select: { email: true, role: true } } }, orderBy: { createdAt: 'desc' }, take: PAR_PAGE, skip: (f.page - 1) * PAR_PAGE }),
    prisma.searchLog.groupBy({ by: ['userId'], where: { createdAt: { gte: depuis } }, _count: { _all: true }, orderBy: { _count: { userId: 'desc' } } }),
    prisma.user.findMany({ select: { id: true, email: true }, orderBy: { email: 'asc' } }),
  ])
  // Sans résultat, par compte — c'est ce qu'un éditeur lit pour savoir ce qui manque au fonds.
  const sansResultat = await prisma.searchLog.groupBy({ by: ['userId'], where: { createdAt: { gte: depuis }, resultsCount: 0 }, _count: { _all: true } })
  const zeroPar = new Map(sansResultat.map((s) => [s.userId ?? 'visiteur', s._count._all]))
  const emailDe = new Map(comptes.map((c) => [c.id, c.email]))
  const pages = Math.min(PAGE_MAX, Math.max(1, Math.ceil(total / PAR_PAGE)))
  const qs = (patch: Record<string, string | number | null>) => {
    const p = new URLSearchParams()
    const base: Record<string, string | number | null> = { jours: f.jours || null, compte: f.compte, page: f.page > 1 ? f.page : null, ...patch }
    for (const [k, v] of Object.entries(base)) if (v !== null && v !== '' && v !== undefined) p.set(k, String(v))
    const s = p.toString()
    return s ? `?${s}` : ''
  }
  const rubrique = (type: string | null) => (type && DOC_TYPE_META[type as DocType] ? DOC_TYPE_META[type as DocType].code : type ? type : lt(L.toutes))
  const th = 'px-3 py-2.5 font-semibold'
  const td = 'px-3 py-2 align-top'

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/${locale}/admin`} className="text-xs text-chabon hover:underline">{lt(L.retour)}</Link>
        <h1 className="mt-1 text-xl font-semibold text-ank">{lt(L.titre)}</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-ank/80">{lt(L.sousTitre)}</p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-grafit">{lt(L.zone)}</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1 text-xs text-ank/80">{lt(L.periode)}
          <select name="jours" defaultValue={String(f.jours)} className="rounded-lg border border-chabon/15 bg-white px-2 py-1.5 text-sm text-ank">
            {JOURS.map((j) => <option key={j} value={j}>{j === 0 ? lt(L.aujourdhui) : `${j} ${lt(L.jours)}`}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ank/80">{lt(L.compte)}
          <select name="compte" defaultValue={f.compte ?? ''} className="rounded-lg border border-chabon/15 bg-white px-2 py-1.5 text-sm text-ank">
            <option value="">{lt(L.tousComptes)}</option>
            <option value="visiteur">{lt(L.visiteur)}</option>
            {comptes.map((c) => <option key={c.id} value={c.id}>{c.email}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-chabon px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">{lt(L.filtrer)}</button>
      </form>

      {/* ── Par compte : le cumul, et ce qui n'a rien trouvé ── */}
      <section aria-labelledby="par-compte">
        <h2 id="par-compte" className="mb-2 text-sm font-semibold text-ank">{lt(L.parCompte)} <span className="ml-1 font-normal text-grafit">({total.toLocaleString('fr')} {total > 1 ? lt(L.recherches) : lt(L.recherche)})</span></h2>
        <ul className="flex flex-wrap gap-2">
          {parCompte.map((c) => {
            const id = c.userId ?? 'visiteur'
            const zero = zeroPar.get(id) ?? 0
            return (
              <li key={id}>
                <Link href={qs({ compte: id, page: null })} className={`inline-flex items-baseline gap-2 rounded-xl border bg-white px-3 py-2 text-sm hover:bg-koton ${f.compte === id ? 'border-chabon' : 'border-chabon/10'}`}>
                  <span className="font-medium text-ank">{c.userId ? emailDe.get(c.userId) ?? c.userId : lt(L.visiteur)}</span>
                  <span className="font-mono text-xs text-grafit">{c._count._all}</span>
                  {zero > 0 && <span className="text-[11px] text-ank/80">· {zero} {lt(L.sansResultat)}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ── Le journal ── */}
      <div className="overflow-x-auto rounded-2xl border border-chabon/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-chabon/10 bg-koton text-left text-[11px] uppercase tracking-wide text-ank/80">
              <th className={th}>{lt(L.heure)}</th><th className={th}>{lt(L.compte)}</th><th className={th}>{lt(L.requete)}</th><th className={th}>{lt(L.rubrique)}</th><th className={`${th} text-right`}>{lt(L.resultats)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-chabon/5">
            {lignes.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-ank/80">{lt(L.vide)}</td></tr>}
            {lignes.map((l) => (
              <tr key={l.id} className="hover:bg-koton/50">
                <td className={`${td} font-mono text-xs`}>{formatInstant(locale as Locale, l.createdAt, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td className={`${td} text-xs`}>{l.user?.email ?? <span className="text-ank/80">{lt(L.visiteur)}</span>}</td>
                <td className={td}><span className="text-ank">{l.query}</span><span className="ml-2 font-mono text-[10px] uppercase text-grafit">{l.locale}</span></td>
                <td className={`${td} font-mono text-xs`}>{rubrique(l.type)}</td>
                <td className={`${td} text-right font-mono text-xs ${l.resultsCount === 0 ? 'text-wouj' : ''}`}>{l.resultsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="flex items-center justify-between text-xs text-grafit" aria-label={lt(L.page)}>
          {f.page > 1 ? <Link href={qs({ page: f.page - 1 })} className="text-chabon hover:underline">{lt(L.precedente)}</Link> : <span />}
          <span>{lt(L.page)} {f.page} / {pages}</span>
          {f.page < pages ? <Link href={qs({ page: f.page + 1 })} className="text-chabon hover:underline">{lt(L.suivante)}</Link> : <span />}
        </nav>
      )}
    </div>
  )
}
