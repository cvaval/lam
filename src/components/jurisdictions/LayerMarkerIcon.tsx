import type { LayerMarker } from '@/lib/jurisdictions/layers'
import { ShapeIcon } from './CourtCard'

/**
 * Le marqueur d'une couche, en HTML (bouton, légende) — le même signe que sur la carte.
 * Juridiction : la forme et la teinte de `COURT_STYLE`. Emoji : le caractère lui-même,
 * `aria-hidden` — il n'est JAMAIS la seule information, le libellé en clair le suit toujours.
 */
export function LayerMarkerIcon({ marker, size = 12 }: { marker: LayerMarker; size?: number }) {
  if (marker.kind === 'court') return <ShapeIcon kind={marker.courtType} size={size} />
  return (
    <span aria-hidden="true" className="shrink-0 leading-none" style={{ fontSize: size + 1 }}>
      {marker.glyph}
    </span>
  )
}
