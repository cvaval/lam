/**
 * Destination d'une rubrique (§07) depuis son slug. Source UNIQUE partagée par les tuiles
 * du tableau de bord (lien DIRECT, sans saut de redirection) et par /type/[type] (accès par
 * URL directe). Éviter le saut `/type/{slug}` → redirection supprime une classe de bugs de
 * navigation client (notamment Safari, qui gère mal la préconnexion/navigation vers une
 * route qui ne fait que `redirect()`), et c'est plus rapide (un aller-retour de moins).
 */
const DEDICATED: Record<string, string> = { legislation: 'legislation', doctrine: 'doctrine', tarifs: 'tarifs' }

export function sectionHref(locale: string, slug: string): string {
  return DEDICATED[slug] ? `/${locale}/${DEDICATED[slug]}` : `/${locale}/search?type=${encodeURIComponent(slug)}`
}
