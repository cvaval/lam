import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import type { CourtView } from '@/lib/jurisdictions/data'
import type { CourtType } from '@/lib/jurisdictions/constants'

/** Couleur + FORME par type (l'information n'est jamais portée par la couleur seule). */
export const COURT_STYLE: Record<CourtType, { color: string; shape: 'circle' | 'triangle' | 'square' | 'diamond' }> = {
  PAIX: { color: '#BEF264', shape: 'circle' },
  PREMIERE_INSTANCE: { color: '#F4A823', shape: 'triangle' },
  APPEL: { color: '#4F8EF7', shape: 'square' },
  CASSATION: { color: '#7C6F9B', shape: 'diamond' },
}

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
      <g fill={color} stroke="#1C1B3A" strokeWidth="1">{path}</g>
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
    <div className="rounded-xl border border-lank/10 bg-white p-4 shadow-card">
      <div className="flex items-center gap-2">
        <ShapeIcon kind={kind} />
        <h4 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-lank">{court.name}</h4>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-lank/70">
        {court.seatCity && (
          <>
            {/* Un tribunal de paix siège dans une SECTION, pas dans une ville : le
                libellé « Ville-siège » ne vaut que pour les juridictions supérieures. */}
            <dt className="text-lank/45">{kind === 'PAIX' ? j.seat : j.seatCity}</dt>
            <dd>{court.seatCity}</dd>
          </>
        )}
        {court.address && (
          <>
            <dt className="text-lank/45">{j.address}</dt>
            <dd>{court.address}</dd>
          </>
        )}
        {court.postalCode && (
          <>
            <dt className="text-lank/45">{j.primaryPostalCode}</dt>
            <dd className="font-mono">{court.postalCode}</dd>
          </>
        )}
        {court.plusCode && (
          <>
            {/* Plus Code = champ DISTINCT, jamais présenté comme code postal. */}
            <dt className="text-lank/45">{j.plusCode}</dt>
            <dd className="font-mono">{court.plusCode} <span className="font-sans text-lank/40">({j.plusCodeNote})</span></dd>
          </>
        )}
        {court.operationalStatus && (
          <>
            <dt className="text-lank/45">{j.statusLabel}</dt>
            <dd>{court.operationalStatus}</dd>
          </>
        )}
      </dl>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {court.indicative && (
          <span className="rounded-full bg-lank-50 px-2 py-0.5 text-[10px] font-medium text-lank/60">📍 {j.indicativePosition}</span>
        )}
        {mapsHref && (
          <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="rounded-full bg-fey-50 px-2 py-0.5 text-[10px] font-medium text-fey underline-offset-2 hover:underline">
            {j.openInMaps} ↗
          </a>
        )}
      </div>
      {court.observation && <p className="mt-2 text-[11px] leading-relaxed text-lank/50">{court.observation}</p>}
      {(court.sources.length > 0 || court.verifiedAt) && (
        <p className="mt-2 truncate text-[10px] text-lank/40">
          {court.sources.length > 0 && (
            <>
              {j.sources} :{' '}
              {court.sources.slice(0, 2).map((s, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  {s.type === 'url' ? (
                    <a href={s.value} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-fey">
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
