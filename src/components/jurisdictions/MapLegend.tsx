import type { Dictionary } from '@/lib/i18n/dictionaries'
import { ShapeIcon } from './CourtCard'

/** Légende visible en permanence — formes ET couleurs (jamais la couleur seule). */
export function MapLegend({ t }: { t: Dictionary }) {
  const j = t.judicial
  const items = [
    { kind: 'PAIX' as const, label: j.peace },
    { kind: 'PREMIERE_INSTANCE' as const, label: j.firstInstance },
    { kind: 'APPEL' as const, label: j.appeal },
    { kind: 'CASSATION' as const, label: j.cassation },
  ]
  return (
    <div className="mt-2 rounded-xl border border-lank/10 bg-white px-3 py-2" aria-label={t.judicial.legend}>
      <span className="mr-3 font-mono text-[10px] uppercase tracking-wider text-lank/45">{t.judicial.legend}</span>
      <ul className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
        {items.map((it) => (
          <li key={it.kind} className="inline-flex items-center gap-1.5 text-xs text-lank/70">
            <ShapeIcon kind={it.kind} /> {it.label}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5 text-xs text-lank/70">
          <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm border-2 border-sitwon-600 bg-sitwon/30" /> {t.judicial.commune}
        </li>
      </ul>
    </div>
  )
}
