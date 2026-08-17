import { can } from './rbac'
import type { Role } from './types'

/**
 * Destination d'une rubrique (§07) depuis son slug. Source UNIQUE partagée par les tuiles
 * du tableau de bord (lien DIRECT, sans saut de redirection) et par /type/[type] (accès par
 * URL directe). Éviter le saut `/type/{slug}` → redirection supprime une classe de bugs de
 * navigation client (notamment Safari, qui gère mal la préconnexion/navigation vers une
 * route qui ne fait que `redirect()`), et c'est plus rapide (un aller-retour de moins).
 */
const DEDICATED: Record<string, string> = {
  editionsmoniteur: 'editionsmoniteur',
  legislation: 'editionsmoniteur', // ancien slug → nouvelle page
  legislationannotee: 'legislationannotee',
  doctrine: 'legislationannotee', // ancien slug → nouvelle page
  circulaires: 'circulaires',
  brh: 'circulaires', // alias historique (TYPE_SLUGS)
  tarifs: 'tarifs',
}

export function sectionHref(locale: string, slug: string): string {
  return DEDICATED[slug] ? `/${locale}/${DEDICATED[slug]}` : `/${locale}/search?type=${encodeURIComponent(slug)}`
}

/**
 * Entrée de la console d'édition, selon le rôle — `null` si le compte n'y a pas accès.
 *
 * ⚠️ LA CAPACITÉ, PAS LE RÔLE, et la page où le compte peut RÉELLEMENT aller. Le lien
 * était gardé sur `role === 'MASTER_ADMIN'` alors que le layout `/admin` s'ouvre à
 * quiconque possède `upload.publish` : les éditeurs avaient les fonctions et aucun chemin
 * pour y accéder. Et « /admin » (vue d'ensemble) reste réservée au master admin — y
 * envoyer un éditeur l'aurait renvoyé au tableau de bord, ce qui se lit comme un refus.
 */
export function consoleHref(role: Role, locale: string): string | null {
  if (role === 'MASTER_ADMIN') return `/${locale}/admin`
  if (can(role, 'upload.publish')) return `/${locale}/admin/jurisprudence`
  return null
}
