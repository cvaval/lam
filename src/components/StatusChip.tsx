import type { Locale } from '@/lib/types'
import { situationDuStatutFiche } from '@/lib/legislation/situations'
import { PastilleEtat } from './PastilleEtat'

/**
 * Pastille de statut unique (constat d'audit : 4 implémentations identiques).
 * Couvre les statuts de Document (EN_VIGUEUR/ABROGE/MODIFIE/PUBLIE) et de compte
 * (ACTIVE/PENDING/SUSPENDED) ; le libellé traduit est passé par l'appelant.
 *
 * ⚠️ UN STATUT DE FICHE EST UNE SITUATION (registre, 17 oct. 2026) : « Abrogé » est la même pastille
 * — même gamme, même pictogramme — sur la fiche, dans les listes, dans la recherche et sous l'article.
 * Il avait jusque-là le fond attention (sitwon) ici et le fond neutre au lecteur. « Pas encore en
 * vigueur » distingue un texte PUBLIÉ dont l'entrée en vigueur est future (codes pénaux 2025).
 */
const CHIP = 'rounded-full px-2 py-0.5 text-[11px] font-medium'

const STATUS_STYLES: Record<string, string> = {
  // Document — en vigueur et publié restent neutres (ce ne sont pas des situations à signaler)
  EN_VIGUEUR: 'bg-pil text-chabon',
  PUBLIE: 'bg-pil text-ank/80',
  // Compte
  ACTIVE: 'bg-pil text-chabon',
  PENDING: 'bg-pil text-chabon',
  SUSPENDED: 'bg-pil text-ank',
  // Générique « inactif » (code promo désactivé…)
  INACTIVE: 'bg-pil text-ank/80',
}

export function StatusChip({
  status,
  label,
  effectiveDate,
  locale = 'fr',
}: {
  status: string
  label: string
  /** Entrée en vigueur : une date future fait d'un texte `PUBLIE` un texte « Pas encore en vigueur ». */
  effectiveDate?: Date | string | null
  locale?: Locale
}) {
  const situation = situationDuStatutFiche(status, effectiveDate)
  if (situation === 'abroge' || situation === 'amende') return <PastilleEtat situation={situation} locale={locale} label={label} />
  if (situation === 'a_venir') return <PastilleEtat situation="a_venir" locale={locale} />
  return <span className={`${CHIP} ${STATUS_STYLES[status] ?? STATUS_STYLES.PUBLIE}`}>{label}</span>
}
