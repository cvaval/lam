import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import type { CourtView } from '@/lib/jurisdictions/data'
import type { CourtType } from '@/lib/jurisdictions/constants'
import { BRAND_COLORS } from '@/lib/brand-colors'

/**
 * SOURCE UNIQUE du codage des ordres de juridiction — consommée par la légende, les
 * filtres de couche, les fiches et la toile MapLibre (`JudicialMap`), qui recopiait
 * ces teintes avant l'avenant AV-02.
 *
 * Gamme cartographique AV-02 : Wouj / Sitwon / Vèt / Ble. La FORME accompagne toujours
 * la couleur — la règle 5 de la charte interdit l'information portée par la teinte seule,
 * et Vèt/Wouj sont à 1,05:1 de luminance, indiscernables en daltonisme rouge-vert.
 *
 * ⚠️ Le contour Chabon est CONSTITUTIF, non décoratif : Sitwon n'est qu'à 1,2:1 de Koton,
 * un marqueur jaune sans contour disparaîtrait du fond de carte.
 */
export const COURT_STYLE: Record<CourtType, { color: string; shape: 'circle' | 'triangle' | 'square' | 'diamond' }> = {
  // Rotation demandée par la direction (16 août 2026) : les 185 tribunaux de paix passent en
  // Sitwon et les 5 cours d'appel en Wouj. Le degré le plus NOMBREUX prend la teinte la plus
  // légère, le plus rare la plus saillante — 185 points rouges saturaient la carte. La forme
  // reste le porteur primaire du sens (cercle/triangle/carré/losange) : la couleur ne porte
  // jamais seule, et Vèt/Wouj sont à 1,05:1 de luminance, indiscernables en daltonisme.
  PAIX: { color: BRAND_COLORS.sitwon, shape: 'circle' },
  PREMIERE_INSTANCE: { color: BRAND_COLORS.vet, shape: 'triangle' },
  APPEL: { color: BRAND_COLORS.wouj, shape: 'square' },
  CASSATION: { color: BRAND_COLORS.ble, shape: 'diamond' },
}

/** Contour de tout marqueur de juridiction — voir l'avertissement ci-dessus. */
export const MARKER_STROKE = BRAND_COLORS.chabon

export function ShapeIcon({ kind, size = 12 }: { kind: CourtType; size?: number }) {
  const { color, shape } = COURT_STYLE[kind]
  const s = size
  const path =
    shape === 'circle' ? <circle cx={s / 2} cy={s / 2} r={s / 2 - 1} />
    : shape === 'triangle' ? <polygon points={`${s / 2},1 ${s - 1},${s - 1} 1,${s - 1}`} />
    : shape === 'square' ? <rect x={1} y={1} width={s - 2} height={s - 2} />
    : <polygon points={`${s / 2},0 ${s},${s / 2} ${s / 2},${s} 0,${s / 2}`} />
  return (
    <svg aria-hidden="true" width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="shrink-0">
      <g fill={color} stroke={MARKER_STROKE} strokeWidth="2">{path}</g>
    </svg>
  )
}

/**
 * Carte d'un tribunal — un enregistrement = une carte (jamais condensé).
 * Adresse affichée seulement si vérifiée ; position au centroïde signalée
 * « position indicative » et JAMAIS accompagnée d'un itinéraire.
 */
export function CourtCard({ court, kind, t }: { court: CourtView; kind: CourtType; locale: Locale; t: Dictionary }) {
  const j = t.judicial
  const exactAddress = Boolean(court.address) && !court.indicative && court.locationPrecision === 'EXACT_ADDRESS'
  const mapsHref =
    exactAddress && court.latitude != null && court.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${court.latitude}%2C${court.longitude}`
      : null
  return (
    <div className="rounded-xl border border-chabon/10 bg-white p-4">
      <div className="flex items-center gap-2">
        <ShapeIcon kind={kind} />
        <h4 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-ank">{court.name}</h4>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-grafit">
        {court.seatCity && (
          <>
            {/* Un tribunal de paix siège dans une SECTION, pas dans une ville : le
                libellé « Ville-siège » ne vaut que pour les juridictions supérieures. */}
            <dt className="text-ank/80">{kind === 'PAIX' ? j.seat : j.seatCity}</dt>
            <dd>{court.seatCity}</dd>
          </>
        )}
        {court.address && (
          <>
            <dt className="text-ank/80">{j.address}</dt>
            <dd>{court.address}</dd>
          </>
        )}
        {court.postalCode && (
          <>
            <dt className="text-ank/80">{j.primaryPostalCode}</dt>
            <dd className="font-mono">{court.postalCode}</dd>
          </>
        )}
        {court.plusCode && (
          <>
            {/* Plus Code = champ DISTINCT, jamais présenté comme code postal. */}
            <dt className="text-ank/80">{j.plusCode}</dt>
            <dd className="font-mono">{court.plusCode} <span className="font-sans text-ank/80">({j.plusCodeNote})</span></dd>
          </>
        )}
        {court.operationalStatus && (
          <>
            <dt className="text-ank/80">{j.statusLabel}</dt>
            <dd>{court.operationalStatus}</dd>
          </>
        )}
      </dl>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {court.indicative && (
          <span className="rounded-full bg-pil px-2 py-0.5 text-[10px] font-medium text-grafit">📍 {j.indicativePosition}</span>
        )}
        {mapsHref && (
          <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="rounded-full bg-pil px-2 py-0.5 text-[10px] font-medium text-chabon underline-offset-2 hover:underline">
            {j.openInMaps} ↗
          </a>
        )}
      </div>
      {court.observation && <p className="mt-2 text-[11px] leading-relaxed text-ank/80">{court.observation}</p>}
      {(court.sources.length > 0 || court.verifiedAt) && (
        <p className="mt-2 truncate text-[10px] text-ank/80">
          {court.sources.length > 0 && (
            <>
              {j.sources} :{' '}
              {court.sources.slice(0, 2).map((s, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  {s.type === 'url' ? (
                    <a href={s.value} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-chabon">
                      {(() => { try { return new URL(s.value).hostname } catch { return s.value.slice(0, 40) } })()}
                    </a>
                  ) : (
                    s.value.slice(0, 44)
                  )}
                </span>
              ))}
            </>
          )}
          {court.verifiedAt && <> · {j.lastVerified} : {court.verifiedAt}</>}
        </p>
      )}
    </div>
  )
}
