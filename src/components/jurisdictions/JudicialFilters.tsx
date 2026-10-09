import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import { LAYER_REGISTRY, type LayerRegistry, type MapLayerDef } from '@/lib/jurisdictions/layers'
import { LayerMarkerIcon } from './LayerMarkerIcon'

/**
 * Filtres de couches — des LIENS (fonctionnels sans JavaScript) avec l'état
 * pressé exposé (aria-pressed). Chaque lien bascule sa couche dans l'URL.
 *
 * Boutons, groupes et liens viennent du REGISTRE (`layers.ts`) : rien n'est câblé ici. Un
 * seul groupe pourvu ⇒ une rangée sous l'intitulé d'ensemble (sans sous-titre redondant) ;
 * plusieurs ⇒ un `role="group"` par groupe, chacun avec son intitulé visible.
 */
export function JudicialFilters({
  locale, t, active, commune, registry = LAYER_REGISTRY,
}: { locale: Locale; t: Dictionary; active: readonly string[]; commune: string | null; registry?: LayerRegistry }) {
  const j = t.judicial
  const href = (next: string[]) => {
    const params = new URLSearchParams()
    if (commune) params.set('commune', commune)
    // `null` : la sélection est le défaut, le paramètre est omis. `''` : aucune couche.
    const layers = registry.serialize(next)
    if (layers !== null) params.set('layers', layers)
    const qs = params.toString()
    return `/${locale}/juridictions${qs ? `?${qs}` : ''}`
  }
  const button = (layer: MapLayerDef) => {
    const isOn = active.includes(layer.slug)
    return (
      <Link
        key={layer.slug}
        href={href(registry.toggle(active, layer.slug))}
        aria-pressed={isOn}
        className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition ${
          isOn ? 'border-liy bg-chabon text-koton' : 'border-chabon/20 bg-white text-grafit hover:border-chabon/40'
        }`}
      >
        {/* Pastille blanche : sur le bouton actif (fond encre), le marqueur cerné d'encre
            disparaissait — le carré des cours d'appel était encre sur encre. */}
        <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white">
          <LayerMarkerIcon marker={layer.marker} />
        </span>{' '}
        {j[layer.labelKey]}
      </Link>
    )
  }
  const reset = (
    <Link
      href={`/${locale}/juridictions`}
      className="inline-flex min-h-[44px] items-center rounded-full border border-chabon/20 bg-white px-3.5 py-2 text-xs font-medium text-grafit hover:border-chabon/40"
    >
      ↺ {j.reset}
    </Link>
  )

  const sections = registry.sections()
  if (sections.length <= 1) {
    return (
      <div role="group" aria-label={j.filtersLabel} className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium text-ank/80">{j.filtersLabel}</span>
        {sections.flatMap((s) => s.layers.map(button))}
        {reset}
      </div>
    )
  }
  return (
    <div role="group" aria-labelledby="ag-layers-label" className="flex min-w-0 flex-col gap-2">
      <span id="ag-layers-label" className="text-xs font-medium text-ank/80">{j.filtersLabel}</span>
      {/* Mobile : les groupes s'empilent ; aucun défilement horizontal (flex-wrap partout). */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-5">
        {sections.map(({ group, layers }) => (
          <div key={group.id} role="group" aria-labelledby={`ag-layer-group-${group.id}`} className="flex min-w-0 flex-col gap-1.5">
            <span id={`ag-layer-group-${group.id}`} className="font-mono text-[10px] uppercase tracking-wider text-ank/80">
              {j[group.labelKey]}
            </span>
            <div className="flex flex-wrap items-center gap-2">{layers.map(button)}</div>
          </div>
        ))}
        <div className="flex items-end sm:self-end">{reset}</div>
      </div>
    </div>
  )
}
