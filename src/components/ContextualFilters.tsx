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

  if (type === 'LEGISLATION') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-lank/40">{t.search.status}:</span>
        {chip(t.statuses.EN_VIGUEUR, { status: 'EN_VIGUEUR' }, active.status === 'EN_VIGUEUR')}
        {chip(t.statuses.ABROGE, { status: 'ABROGE' }, active.status === 'ABROGE')}
      </div>
    )
  }
  if (type === 'JURISPRUDENCE') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-lank/40">{t.search.juridiction}:</span>
        {JURIDICTIONS.map((j) => chip(t.juridictions[j], { juridiction: j }, active.juridiction === j))}
      </div>
    )
  }
  if (type === 'LOI_FINANCES' && fiscalYears.length) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-lank/40">{t.search.fiscalYear}:</span>
        {fiscalYears.map((y) => chip(y, { fiscalYear: active.fiscalYear === y ? undefined : y }, active.fiscalYear === y))}
      </div>
    )
  }
  if (type === 'MARQUE' && niceClasses.length) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-lank/40">{t.search.niceClass}:</span>
        {niceClasses.map((c) => chip(c, { niceClass: active.niceClass === c ? undefined : c }, active.niceClass === c))}
      </div>
    )
  }
  if (type === 'CIRCULAIRE_BRH') {
    // Recherche par numéro (champ, formulaire GET) + par année (puces). Conserve
    // q/type/année dans le formulaire numéro, et q/type/numéro dans les puces année.
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <form method="get" action={`/${locale}/search`} className="flex items-center gap-1.5">
          {base.q ? <input type="hidden" name="q" value={base.q} /> : null}
          {base.type ? <input type="hidden" name="type" value={base.type} /> : null}
          {active.year ? <input type="hidden" name="year" value={active.year} /> : null}
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
            {brhYears.map((y) => chip(y, { year: active.year === y ? undefined : y }, active.year === y))}
          </div>
        )}
        {/* Tri : signature (défaut) / entrée en vigueur / numéro ↑↓ */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-lank/40">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 6h11M3 12h8M3 18h5" strokeLinecap="round" />
              <path d="M18 9l3-3 3 3M21 6v12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Trier:
          </span>
          {chip('Date de signature', { sort: 'sig' }, (active.sort ?? 'sig') === 'sig')}
          {chip('Entrée en vigueur', { sort: 'eff' }, active.sort === 'eff')}
          {chip('N° croissant', { sort: 'num-asc' }, active.sort === 'num-asc')}
          {chip('N° décroissant', { sort: 'num-desc' }, active.sort === 'num-desc')}
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
