/**
 * Marque officielle Lam — le fruit à pain (« lam veritab »), le fruit du savoir.
 * Les visuels viennent du kit de marque officiel (public/brand/, juin 2026) :
 *  - Lam_Logo_Principal.svg          logotype fruit + « lam » (fond clair)
 *  - Lam_Logo_FondFonce.svg          idem en crème (fond navy)
 *  - Lam_Logo_Principal_Baseline.svg logotype + « LE FRUIT DU SAVOIR »
 *  - Lam_Fruit(.svg|_FondFonce.svg)  fruit seul (extrait du logotype — favicon,
 *                                    barre admin, écran 2FA)
 * Le PNG (Lam_Logo_Principal.png) est servi dans public/brand/ pour les usages
 * hors interface (e-mails riches, documents) ; l'interface utilise les SVG
 * vectoriels du même kit.
 */

// Proportions des fichiers du kit (viewBox) — évitent tout décalage de mise en page.
const LOGO_RATIO = 315 / 140 // logotype principal
const BASELINE_RATIO = 315 / 150 // variante avec baseline (plus haute)
const FRUIT_RATIO = 92 / 124 // fruit seul

/** Fruit seul (favicon, barre admin, 2FA). tone="dark" = contour crème sur fond navy. */
export function FruitMark({
  size = 28,
  tone = 'light',
  className = '',
}: {
  size?: number
  tone?: 'light' | 'dark'
  className?: string
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tone === 'dark' ? '/brand/Lam_Fruit_FondFonce.svg' : '/brand/Lam_Fruit.svg'}
      alt=""
      aria-hidden
      width={Math.round(size * FRUIT_RATIO)}
      height={size}
      className={className}
    />
  )
}

/** Logotype complet « fruit + lam » ; baseline=true ajoute « LE FRUIT DU SAVOIR ». */
export function Logo({
  size = 28,
  withWordmark = true,
  baseline = false,
  tone = 'light',
  className = '',
}: {
  size?: number
  withWordmark?: boolean
  baseline?: boolean
  tone?: 'light' | 'dark'
  className?: string
}) {
  if (!withWordmark) return <FruitMark size={size} tone={tone} className={className} />
  const src = baseline
    ? '/brand/Lam_Logo_Principal_Baseline.svg'
    : tone === 'dark'
      ? '/brand/Lam_Logo_FondFonce.svg'
      : '/brand/Lam_Logo_Principal.svg'
  const ratio = baseline ? BASELINE_RATIO : LOGO_RATIO
  // Le fruit occupe ~88 % de la hauteur du logotype : on majore légèrement pour
  // garder la même présence visuelle que l'ancienne API (size = hauteur du fruit).
  const height = Math.round(size * 1.15)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Lam"
      width={Math.round(height * ratio)}
      height={height}
      className={className}
    />
  )
}
