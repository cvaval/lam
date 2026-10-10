/**
 * FRISE DES MONUMENTS au bas des pages (Me Vaval, 9 oct. 2026) : « au bas de toutes les pages
 * internes de la plateforme, excepté la page d'accueil, qui l'a dans son héros ».
 *
 * Même image partout (dessin et ordre conservés : Marché en fer, Citadelle…). Mesures du dessin
 * dans l'image (2172 × 724) : lignes 209 à 584, soit 249 px de haut et 92 px de vide dessous à
 * 1 440 px d'affichage, 173 px et 64 px à 1 000 px. D'où les positions -91 / -63 px, qui posent la
 * ligne de sol AU BORD INFÉRIEUR, sans bande vide.
 *
 * Pages SANS la frise commune : l'accueil (frise du héros), la connexion (frise en filigrane sur
 * tout l'écran), la demande de coordonnées d'un notaire et le tableau de bord (frises propres,
 * pied de page devant) — jamais deux frises sur une page.
 */
export const FRISE_IMAGE = '/brand/agora/landmarks-haiti-market-first.png'

const SANS_FRISE: readonly RegExp[] = [
  /^\/(fr|en|ht)\/?$/, // accueil
  /^\/(fr|en|ht)\/login\/?$/, // connexion
  /^\/(fr|en|ht)\/juridictions\/notaires\/demande\/?$/, // demande de coordonnées d'un notaire
  /^\/(fr|en|ht)\/dashboard\/?$/, // tableau de bord (frise propre, dashboard.css)
]

/** La page reçoit-elle la frise commune ? Chemin inconnu ou racine : non. */
export function pageAvecFrise(chemin: string | null | undefined): boolean {
  if (!chemin || chemin === '/') return false
  return !SANS_FRISE.some((re) => re.test(chemin))
}
