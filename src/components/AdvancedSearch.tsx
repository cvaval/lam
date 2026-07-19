import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { TYPE_SLUGS, type DocType, type Locale } from '@/lib/types'
import { DOC_TYPE_LIST } from '@/lib/brand'
import { fieldCls } from './forms'

/** Sections où le statut EN_VIGUEUR/ABROGÉ existe réellement dans le corpus
 *  (l'Index et les marques sont en statut « PUBLIE » : proposer le filtre là
 *  ne produirait que des pages vides). */
const STATUS_TYPES: readonly DocType[] = ['LEGISLATION', 'DOCTRINE', 'CIRCULAIRE_BRH', 'LOI_FINANCES']

/**
 * Recherche avancée (§07) : panneau repliable au-dessus des résultats —
 * requête + SECTION (Législation annotée, Le Moniteur, Index, Marques… bornée
 * aux services accordés §03) + PÉRIODE « entre l'année X et Y » + numéro +
 * statut. Formulaire GET pur (aucun JavaScript requis) : les champs deviennent
 * des paramètres d'URL déjà compris par la page de recherche, donc partageables
 * et compatibles avec les puces de filtres existantes. Ouvert via ?adv=1 (lien
 * de la barre de recherche) ou dès qu'un critère avancé est actif.
 */
export function AdvancedSearch({
  locale,
  t,
  allowed,
  values,
  open,
}: {
  locale: Locale
  t: Dictionary
  allowed: DocType[]
  values: { q: string; type?: string; yearFrom?: string; yearTo?: string; num?: string; status?: string }
  open: boolean
}) {
  const sections = DOC_TYPE_LIST.filter((m) => allowed.includes(m.type))
  const currentType = values.type ? TYPE_SLUGS[values.type] : undefined
  const showStatus = !currentType || STATUS_TYPES.includes(currentType)
  const label = 'text-[11px] font-semibold uppercase tracking-wide text-lank/45'

  return (
    <details
      open={open}
      className="no-print rounded-2xl border border-lank/10 bg-white shadow-card open:pb-4"
    >
      <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-semibold text-lank">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-lank/45" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
        </svg>
        {t.search.advanced}
      </summary>
      <form method="get" action={`/${locale}/search`} className="flex flex-wrap items-end gap-x-5 gap-y-3 px-4 pt-1">
        {/* Reste ouvert après soumission. La REQUÊTE voyage en champ caché : la
            barre de recherche du haut est LA barre de la page — une seule barre
            par page (audit 17 juil.), le panneau ne porte que les critères. */}
        <input type="hidden" name="adv" value="1" />
        {values.q ? <input type="hidden" name="q" value={values.q} /> : null}
        <div className="flex flex-col gap-1">
          <label htmlFor="adv-type" className={label}>
            {t.search.section}
          </label>
          <select id="adv-type" name="type" defaultValue={values.type ?? ''} className={fieldCls}>
            <option value="">{t.search.allTypes}</option>
            {sections.map((m) => (
              <option key={m.type} value={m.slug}>
                {m.label[locale]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className={label}>{t.search.period}</span>
          <div className="flex items-center gap-1.5">
            <label htmlFor="adv-from" className="text-xs text-lank/50">
              {t.search.yearFrom}
            </label>
            <div className="w-24">
              <input
                id="adv-from"
                name="yearFrom"
                defaultValue={values.yearFrom ?? ''}
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                placeholder="1990"
                className={fieldCls}
              />
            </div>
            <label htmlFor="adv-to" className="text-xs text-lank/50">
              {t.search.yearTo}
            </label>
            <div className="w-24">
              <input
                id="adv-to"
                name="yearTo"
                defaultValue={values.yearTo ?? ''}
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                placeholder="2026"
                className={fieldCls}
              />
            </div>
          </div>
        </div>
        <div className="flex w-28 flex-col gap-1">
          <label htmlFor="adv-num" className={label}>
            {t.search.numberLabel}
          </label>
          <input id="adv-num" name="num" defaultValue={values.num ?? ''} maxLength={20} placeholder={t.search.numberPh} className={fieldCls} />
        </div>
        {showStatus && (
          <div className="flex flex-col gap-1">
            <label htmlFor="adv-status" className={label}>
              {t.search.status}
            </label>
            <select id="adv-status" name="status" defaultValue={values.status ?? ''} className={fieldCls}>
              <option value="">{t.common.all}</option>
              <option value="EN_VIGUEUR">{t.statuses.EN_VIGUEUR}</option>
              <option value="ABROGE">{t.statuses.ABROGE}</option>
            </select>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-lg bg-lank px-4 py-1.5 text-sm font-semibold text-white hover:bg-lank-600">
            {t.search.apply}
          </button>
          {/* Réinitialise les CRITÈRES ; la requête appartient à la barre du haut. */}
          <Link
            href={`/${locale}/search?adv=1${values.q ? `&q=${encodeURIComponent(values.q)}` : ''}`}
            className="text-xs text-lank/45 hover:text-lank/70 hover:underline"
          >
            {t.search.reset}
          </Link>
        </div>
      </form>
    </details>
  )
}
