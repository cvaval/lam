import Link from 'next/link'
import { INDEX_CATEGORIES, JURIDICTIONS, type DocType } from '@/lib/types'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export type SP = Record<string, string | undefined>

/** Querystring fusionnée (les valeurs vides sont omises). */
export function qs(base: SP, patch: SP): string {
  const merged = { ...base, ...patch }
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v)
  return p.toString()
}

/**
 * Filtres contextuels du type sélectionné (§07) : statut (Législation),
 * juridiction (Jurisprudence), exercice fiscal (Lois de finances), classe de
 * Nice (Marques), sous-catégorie (Index). Les listes d'exercices et de classes
 * viennent des DONNÉES (props calculées par la page) — pas de liste codée en dur.
 */
export function ContextualFilters({
  type,
  locale,
  base,
  active,
  t,
  fiscalYears = [],
  niceClasses = [],
  brhYears = [],
}: {
  type: DocType
  locale: string
  base: SP
  active: SP
  t: Dictionary
  fiscalYears?: string[]
  niceClasses?: string[]
  brhYears?: string[]
}) {
  const chip = (label: string, patch: SP, on: boolean) => (
    <Link
      key={label}
      href={`/${locale}/search?${qs(base, patch)}`}
      className={`rounded-full border px-2.5 py-1 text-xs ${
        on ? 'border-sitwon-600 bg-sitwon-50 text-lank' : 'border-lank/15 bg-white text-lank/60 hover:border-lank/40'
      }`}
    >
      {label}
    </Link>
  )

  // Tri commun (mode navigation, §07) : date de publication/signature (défaut) ou
  // entrée en vigueur. Rendu pour TOUS les types — les circulaires BRH y ajoutent
  // le tri par numéro dans leur bloc dédié ci-dessous.
  const sortIcon = (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h11M3 12h8M3 18h5" strokeLinecap="round" />
      <path d="M18 9l3-3 3 3M21 6v12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  const sortRow = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-lank/40">
        {sortIcon}
        {t.search.sortLabel}:
      </span>
      {chip(t.search.sortPub, { sort: 'sig' }, (active.sort ?? 'sig') === 'sig')}
      {chip(t.search.sortEff, { sort: 'eff' }, active.sort === 'eff')}
    </div>
  )

  if (type === 'LEGISLATION') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-lank/40">{t.search.status}:</span>
          {chip(t.statuses.EN_VIGUEUR, { status: active.status === 'EN_VIGUEUR' ? undefined : 'EN_VIGUEUR' }, active.status === 'EN_VIGUEUR')}
          {chip(t.statuses.ABROGE, { status: active.status === 'ABROGE' ? undefined : 'ABROGE' }, active.status === 'ABROGE')}
        </div>
        {sortRow}
      </div>
    )
  }
  if (type === 'JURISPRUDENCE') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-lank/40">{t.search.juridiction}:</span>
          {JURIDICTIONS.map((j) => chip(t.juridictions[j], { juridiction: j }, active.juridiction === j))}
        </div>
        {sortRow}
      </div>
    )
  }
  if (type === 'LOI_FINANCES') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {fiscalYears.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-lank/40">{t.search.fiscalYear}:</span>
            {fiscalYears.map((y) => chip(y, { fiscalYear: active.fiscalYear === y ? undefined : y }, active.fiscalYear === y))}
          </div>
        )}
        {sortRow}
      </div>
    )
  }
  if (type === 'MARQUE') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {niceClasses.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-lank/40">{t.search.niceClass}:</span>
            {niceClasses.map((c) => chip(c, { niceClass: active.niceClass === c ? undefined : c }, active.niceClass === c))}
          </div>
        )}
        {sortRow}
      </div>
    )
  }
  if (type === 'CIRCULAIRE_BRH') {
    // Recherche par numéro (champ, formulaire GET) + par année (puces). Conserve
    // q/type/année dans le formulaire numéro, et q/type/numéro dans les puces année.
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <form method="get" action={`/${locale}/search`} className="flex items-center gap-1.5">
          {/* Tous les critères persistants (baseParams) voyagent avec la soumission —
              sans quoi chercher un n° effacerait silencieusement période/statut/tri. */}
          {Object.entries(base)
            .filter(([k, v]) => v && k !== 'num')
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          <span className="text-xs text-lank/40">{t.search.numberLabel}:</span>
          <input
            name="num"
            defaultValue={active.num ?? ''}
            placeholder={t.search.numberPh}
            className="w-24 rounded-full border border-lank/15 bg-white px-2.5 py-1 text-xs text-lank outline-none focus:border-sitwon"
          />
          <button type="submit" className="rounded-full border border-lank/15 bg-white px-2 py-1 text-xs text-lank/60 hover:border-lank/40">
            {t.search.numberGo}
          </button>
          {active.num ? (
            <Link href={`/${locale}/search?${qs(base, { num: undefined })}`} className="text-xs text-lank/40 hover:text-lank/70">
              ✕
            </Link>
          ) : null}
        </form>
        {brhYears.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-lank/40">{t.search.yearLabel}:</span>
            {/* Choisir une année exacte remplace la période avancée (sinon la puce
                serait active mais inerte, la période ayant précédence). */}
            {brhYears.map((y) =>
              chip(y, { year: active.year === y ? undefined : y, yearFrom: undefined, yearTo: undefined }, active.year === y),
            )}
          </div>
        )}
        {/* Tri : signature (défaut) / entrée en vigueur / numéro ↑↓ */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-lank/40">
            {sortIcon}
            {t.search.sortLabel}:
          </span>
          {chip(t.search.sortSig, { sort: 'sig' }, (active.sort ?? 'sig') === 'sig')}
          {chip(t.search.sortEff, { sort: 'eff' }, active.sort === 'eff')}
          {chip(t.search.sortNumAsc, { sort: 'num-asc' }, active.sort === 'num-asc')}
          {chip(t.search.sortNumDesc, { sort: 'num-desc' }, active.sort === 'num-desc')}
        </div>
      </div>
    )
  }
  if (type === 'INDEX') {
    // Sous-catégories de l'Index du Moniteur — re-cliquer une chip active la désélectionne.
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-lank/40">{t.search.categoryLabel}:</span>
        {INDEX_CATEGORIES.map((c) =>
          chip(t.search.indexCategories[c], { category: active.category === c ? undefined : c }, active.category === c),
        )}
      </div>
    )
  }
  return null
}
