import { DOC_TYPE_META, COLOR_CLASSES } from '@/lib/brand'
import type { DocType, Locale } from '@/lib/types'

/** Pastille de couleur (§01). */
export function Pastille({ type, className = '' }: { type: DocType; className?: string }) {
  const meta = DOC_TYPE_META[type]
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${COLOR_CLASSES[meta.color].dot} ${className}`}
      title={meta.pastille}
    />
  )
}

/** Badge recoloré du type (§01). */
export function TypeBadge({ type }: { type: DocType }) {
  const meta = DOC_TYPE_META[type]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${COLOR_CLASSES[meta.color].badge}`}
    >
      {meta.badge}
    </span>
  )
}

/** Étiquette pastille + libellé du type, dans la locale demandée. */
export function TypeLabel({ type, locale }: { type: DocType; locale: Locale }) {
  const meta = DOC_TYPE_META[type]
  return (
    <span className="inline-flex items-center gap-2">
      <Pastille type={type} />
      <span className="text-sm font-medium text-lank">{meta.label[locale]}</span>
    </span>
  )
}
