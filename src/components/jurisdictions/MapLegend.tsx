import type { Dictionary } from '@/lib/i18n/dictionaries'
import { LAYER_REGISTRY, type LayerRegistry } from '@/lib/jurisdictions/layers'
import { LayerMarkerIcon } from './LayerMarkerIcon'

/**
 * Légende visible en permanence — formes ET couleurs (jamais la couleur seule). Générée
 * depuis le REGISTRE : elle montre les couches AFFICHÉES, dans l'ordre du registre, plus
 * l'aplat de la commune sélectionnée.
 */
export function MapLegend({
  t, active, registry = LAYER_REGISTRY,
}: { t: Dictionary; active: readonly string[]; registry?: LayerRegistry }) {
  const j = t.judicial
  const items = registry.layers.filter((l) => active.includes(l.slug))
  return (
    <div className="mt-2 rounded-xl border border-chabon/10 bg-white px-3 py-2" aria-label={t.judicial.legend}>
      <span className="mr-3 font-mono text-[10px] uppercase tracking-wider text-ank/80">{t.judicial.legend}</span>
      <ul className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
        {items.map((l) => (
          <li key={l.slug} className="inline-flex items-center gap-1.5 text-xs text-grafit">
            <LayerMarkerIcon marker={l.marker} /> {j[l.legendKey]}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5 text-xs text-grafit">
          <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm border-2 border-liy bg-chabon/30" /> {t.judicial.commune}
        </li>
      </ul>
    </div>
  )
}
