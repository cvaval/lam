import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import { ALL_LAYER_SLUGS, type LayerSlug } from '@/lib/jurisdictions/constants'
import { ShapeIcon } from './CourtCard'
import { LAYER_SLUGS } from '@/lib/jurisdictions/constants'

/**
 * Filtres de couches — des LIENS (fonctionnels sans JavaScript) avec l'état
 * pressé exposé (aria-pressed). Chaque lien bascule sa couche dans l'URL.
 */
export function JudicialFilters({
  locale, t, active, commune,
}: { locale: Locale; t: Dictionary; active: LayerSlug[]; commune: string | null }) {
  const j = t.judicial
  const labels: Record<LayerSlug, string> = { paix: j.layerPaix, tpi: j.layerTpi, appel: j.layerAppel, cassation: j.layerCassation }
  const href = (next: LayerSlug[]) => {
    const params = new URLSearchParams()
    if (commune) params.set('commune', commune)
    if (next.length && next.length !== ALL_LAYER_SLUGS.length) params.set('layers', next.join(','))
    const qs = params.toString()
    return `/${locale}/juridictions${qs ? `?${qs}` : ''}`
  }
  return (
    <div role="group" aria-label={j.filtersLabel} className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-medium text-ank/80">{j.filtersLabel}</span>
      {ALL_LAYER_SLUGS.map((slug) => {
        const isOn = active.includes(slug)
        const next = isOn ? active.filter((s) => s !== slug) : [...active, slug]
        return (
          <Link
            key={slug}
            href={href(next.length ? next : ALL_LAYER_SLUGS)}
            aria-pressed={isOn}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition ${
              isOn ? 'border-liy bg-chabon text-koton' : 'border-chabon/20 bg-white text-grafit hover:border-chabon/40'
            }`}
          >
            <ShapeIcon kind={LAYER_SLUGS[slug]} /> {labels[slug]}
          </Link>
        )
      })}
      <Link
        href={`/${locale}/juridictions`}
        className="inline-flex min-h-[44px] items-center rounded-full border border-chabon/20 bg-white px-3.5 py-2 text-xs font-medium text-grafit hover:border-chabon/40"
      >
        ↺ {j.reset}
      </Link>
    </div>
  )
}
