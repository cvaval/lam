/**
 * Marque officielle Lam — le fruit à pain (« lam veritab »), le fruit du savoir.
 * Les visuels viennent du kit de marque officiel (public/brand/, août 2026 — système « Klinik ») :
 *  - Lam_Logo_Principal.svg          logotype fruit + « lam » (fond clair)
 *  - Lam_Logo_FondFonce.svg          idem en crème (fond navy)
 *  - Lam_Logo_Principal_Baseline.svg logotype + « LE FRUIT DU SAVOIR »
 *  - Lam_Marque_Klinik.svg           marque seule, encrée pour FOND CLAIR
 *  - Lam_Marque_Klinik_FondFonce.svg même marque, contours en Koton — FOND SOMBRE
 *  - Lam_AppIcon_Klinik.svg          marque sur carré Chabon arrondi — source vectorielle
 *                                    des icônes d'application (icon-192/512.png,
 *                                    apple-touch-icon.png). JAMAIS dans l'interface.
 * Le PNG (Lam_Logo_Principal.png) est servi dans public/brand/ pour les usages
 * hors interface (e-mails riches, documents) ; l'interface utilise les SVG
 * vectoriels du même kit.
 *
 * ⚠️ AUCUN LOGO NE PORTE SON PROPRE FOND. Les variantes « fond foncé » comportaient une
 * plaque opaque Chabon : invisible sur un bandeau Chabon, elle apparaissait en pavé dès
 * que la surface différait — carte Adwaz du héros, lien du back-office qui s'éclaircit au
 * survol. C'est la SURFACE qui fournit le fond ; le logo n'apporte que son encre.
 *
 * ⚠️ L'ICÔNE D'APPLICATION N'EST PAS UN LOGO D'INTERFACE. Son carré arrondi est un support
 * imposé par les systèmes d'exploitation (tuile d'accueil, écran de démarrage), pas un
 * élément de la marque. `tone="dark"` servait cette icône faute de marque encrée pour fond
 * sombre : c'est ce manque qui est comblé, l'icône retourne à son seul usage.
 */

// Proportions des fichiers du kit (viewBox) — évitent tout décalage de mise en page.
const LOGO_RATIO = 315 / 140 // logotype principal
const BASELINE_RATIO = 315 / 150 // variante avec baseline (plus haute)
// La marque « Klinik » est CARRÉE (viewBox 132×132), là où le fruit v1 était en 92×124.
const FRUIT_RATIO = 1 // marque seule

/** Fruit seul (favicon, barre admin, 2FA). tone="dark" = contours Koton, SANS plaque. */
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
      src={tone === 'dark' ? '/brand/Lam_Marque_Klinik_FondFonce.svg' : '/brand/Lam_Marque_Klinik.svg'}
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
