/**
 * Pastille de statut unique (constat d'audit : 4 implémentations identiques).
 * Couvre les statuts de Document (EN_VIGUEUR/ABROGE/MODIFIE/PUBLIE) et de compte
 * (ACTIVE/PENDING/SUSPENDED) ; le libellé traduit est passé par l'appelant.
 */
const CHIP = 'rounded-full px-2 py-0.5 text-[11px] font-medium'

const STATUS_STYLES: Record<string, string> = {
  // Document
  EN_VIGUEUR: 'bg-fey-50 text-fey',
  ABROGE: 'bg-red-50 text-red-700',
  MODIFIE: 'bg-soley-50 text-soley-700',
  PUBLIE: 'bg-lank-50 text-lank/70',
  // Compte
  ACTIVE: 'bg-fey-50 text-fey',
  PENDING: 'bg-soley-50 text-soley-700',
  SUSPENDED: 'bg-red-50 text-red-700',
  // Générique « inactif » (code promo désactivé…)
  INACTIVE: 'bg-lank-50 text-lank/50',
}

export function StatusChip({ status, label }: { status: string; label: string }) {
  return <span className={`${CHIP} ${STATUS_STYLES[status] ?? STATUS_STYLES.PUBLIE}`}>{label}</span>
}
