/**
 * Pastille de statut unique (constat d'audit : 4 implémentations identiques).
 * Couvre les statuts de Document (EN_VIGUEUR/ABROGE/MODIFIE/PUBLIE) et de compte
 * (ACTIVE/PENDING/SUSPENDED) ; le libellé traduit est passé par l'appelant.
 */
const CHIP = 'rounded-full px-2 py-0.5 text-[11px] font-medium'

const STATUS_STYLES: Record<string, string> = {
  // Document
  EN_VIGUEUR: 'bg-pil text-chabon',
  ABROGE: 'bg-pil text-wouj',
  MODIFIE: 'bg-pil text-chabon',
  PUBLIE: 'bg-pil text-ank/70',
  // Compte
  ACTIVE: 'bg-pil text-chabon',
  PENDING: 'bg-pil text-chabon',
  SUSPENDED: 'bg-pil text-wouj',
  // Générique « inactif » (code promo désactivé…)
  INACTIVE: 'bg-pil text-ank/50',
}

export function StatusChip({ status, label }: { status: string; label: string }) {
  return <span className={`${CHIP} ${STATUS_STYLES[status] ?? STATUS_STYLES.PUBLIE}`}>{label}</span>
}
