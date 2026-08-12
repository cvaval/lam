import { DOC_TYPE_META, TYPE_CHIP } from '@/lib/brand'
import type { DocType, Locale } from '@/lib/types'

/**
 * Pastilles de type — système « Klinik ».
 *
 * ⚠️ Le système v1.0 attribuait une TEINTE à chaque type (Lank pour Le Moniteur, Solèy pour
 * la BRH, Brim pour la jurisprudence…) et s'en servait pour naviguer : tuiles, filtres,
 * badges de résultats, admin. Klinik supprime ce codage chromatique — la couleur cesse
 * d'être un langage — et le remplace par un codage TYPOGRAPHIQUE : une pastille uniforme
 * portant un code de trois lettres en IBM Plex Mono.
 *
 * Toute la charge de distinction repose donc sur le MOT : ne jamais rendre le code moins
 * lisible qu'ici (10 px, approche +14 %, contraste Chabon sur Pil).
 */

/** Code de type — remplace la pastille de couleur du système v1. */
export function Pastille({ type, className = '' }: { type: DocType; className?: string }) {
  const meta = DOC_TYPE_META[type]
  return (
    <span className={`${TYPE_CHIP} ${className}`} title={meta.label.fr}>
      {meta.code}
    </span>
  )
}

/** Badge du type : le code, suivi de son libellé court. */
export function TypeBadge({ type }: { type: DocType }) {
  const meta = DOC_TYPE_META[type]
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={TYPE_CHIP}>{meta.code}</span>
      <span className="text-[11px] font-semibold tracking-wide text-grafit">{meta.badge}</span>
    </span>
  )
}

/** Étiquette code + libellé du type, dans la locale demandée. */
export function TypeLabel({ type, locale }: { type: DocType; locale: Locale }) {
  const meta = DOC_TYPE_META[type]
  return (
    <span className="inline-flex items-center gap-2">
      <span className={TYPE_CHIP}>{meta.code}</span>
      <span>{meta.label[locale]}</span>
    </span>
  )
}
