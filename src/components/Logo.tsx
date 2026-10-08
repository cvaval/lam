/**
 * Marque Agora (agora.ht) — kit de marque Agora v2 (`Dropbox/Lam Veritab/Agora/`).
 *
 *  - le SYMBOLE (deux arches) est vectoriel dans le kit (`symbole-*.svg`, 254 octets) : il est
 *    rendu ici en SVG en ligne, sans requête ;
 *  - le LOGOTYPE (symbole + « agora.ht ») n'existe qu'en PNG dans le kit — ses SVG horizontaux
 *    EMBARQUENT un PNG de 426 Ko. On sert donc `public/brand/agora/logo.png` et
 *    `logo-white.png`, réduits à 480 px de large (deux fois la plus grande taille d'affichage,
 *    5 Ko au lieu de 319). La vectorisation par un graphiste reste à faire avant tout dépôt de
 *    marque ou toute impression (D5).
 *
 * ⚠️ AUCUN LOGO NE PORTE SON PROPRE FOND : c'est la SURFACE qui le fournit (leçon Klinik).
 *
 * Les anciens fichiers `public/brand/Lam_*` restent en place six mois après la bascule :
 * d'anciens e-mails et caches peuvent encore les appeler.
 */

// Proportions du logotype du kit (2172 × 724) — évitent tout décalage de mise en page.
const LOGO_RATIO = 2172 / 724

/** Encre du symbole : encre Agora sur fond clair, blanc sur fond sombre (kit, § couleurs). */
const ENCRE = { light: '#152E38', dark: '#FFFFFF' } as const

/**
 * Symbole seul (barre admin, 2FA, écrans d'authentification). Le nom `FruitMark` est
 * conservé pour les appelants : c'était la marque seule de Lam.
 */
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
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M6 26V14a10 10 0 0 1 20 0v12M10 26V16a6 6 0 0 1 12 0v10"
        fill="none"
        stroke={ENCRE[tone]}
        strokeWidth={2.4}
        strokeLinecap="butt"
      />
    </svg>
  )
}

/** Logotype complet « symbole + agora.ht ». `size` garde le sens de l'ancienne API (hauteur de la marque). */
export function Logo({
  size = 28,
  withWordmark = true,
  tone = 'light',
  className = '',
}: {
  size?: number
  withWordmark?: boolean
  tone?: 'light' | 'dark'
  className?: string
}) {
  if (!withWordmark) return <FruitMark size={size} tone={tone} className={className} />
  // Le fichier du kit a des marges : le lettrage n'occupe qu'environ 60 % de sa hauteur. On
  // majore donc pour que « agora.ht » garde la présence qu'avait « lam » à la même taille.
  const height = Math.round(size * 1.6)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tone === 'dark' ? '/brand/agora/logo-white.png' : '/brand/agora/logo.png'}
      alt="agora.ht"
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      className={className}
    />
  )
}
