/**
 * SOURCE UNIQUE de la palette de marque Lam (constat d'audit : la palette était
 * recopiée dans tailwind.config.ts, Logo.tsx et pdf/seal.ts).
 *
 * Valeurs extraites du kit officiel (public/brand/Lam_Logo_*.svg, juin 2026).
 *
 * Module-feuille SANS import : peut être consommé partout, y compris par
 * tailwind.config.ts (chargé hors du bundle applicatif).
 *
 *   lank   navy   #1C1B3A  — texte, fonds sombres, sceau
 *   sitwon lime   #BEF264  — accent, logotype
 *   cream         #F6F4EE  — crème du logotype sur fond navy
 */
export const BRAND_COLORS = {
  lank: '#1C1B3A',
  sitwon: '#BEF264',
  cream: '#F6F4EE',
} as const

/** Convertit un hex `#RRGGBB` en triplet 0–1 (pour pdf-lib `rgb()`). */
export function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
