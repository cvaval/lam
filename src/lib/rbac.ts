import type { Role } from './types'

/**
 * Matrice d'accès (§03). Le master admin active chaque compte et lui attribue son
 * type. Aucun compte n'accède au contenu payant sans activation.
 *
 * Valeurs : true | false | 'extracts' | 'read' | 'own' | 'sectoral'
 */
export type Capability =
  | 'search.basic' // recherche de base (quota mensuel)
  | 'read.full' // lecture intégrale des 6 types
  | 'index.companies' // index sociétés & antériorité marques
  | 'export.sealed' // export PDF scellé + citations
  | 'alerts' // alertes de veille
  | 'multiuser.api' // multi-utilisateurs / API
  | 'upload.publish' // téléverser / OCR / publier
  | 'admin.accounts' // activer/suspendre des comptes, rôles, logs

export type Grant = boolean | 'extracts' | 'read' | 'own' | 'sectoral' | 'unlimited'

export const ACCESS_MATRIX: Record<Role, Record<Capability, Grant>> = {
  SITWAYEN: {
    'search.basic': true, // quota mensuel
    'read.full': 'extracts',
    'index.companies': false,
    'export.sealed': false,
    alerts: false,
    'multiuser.api': false,
    'upload.publish': false,
    'admin.accounts': false,
  },
  PWOFESYONEL: {
    'search.basic': 'unlimited',
    'read.full': true,
    'index.companies': true,
    'export.sealed': true,
    alerts: true,
    'multiuser.api': false,
    'upload.publish': false,
    'admin.accounts': false,
  },
  ENSTITISYON: {
    'search.basic': 'unlimited',
    'read.full': true,
    'index.companies': true,
    'export.sealed': true,
    alerts: 'sectoral',
    'multiuser.api': true,
    'upload.publish': false,
    'admin.accounts': 'own', // gère ses sièges
  },
  EDITEUR: {
    'search.basic': 'unlimited',
    'read.full': true,
    'index.companies': 'read',
    'export.sealed': false,
    alerts: false,
    'multiuser.api': false,
    'upload.publish': true,
    'admin.accounts': false,
  },
  MASTER_ADMIN: {
    'search.basic': 'unlimited',
    'read.full': true,
    'index.companies': true,
    'export.sealed': true,
    alerts: true,
    'multiuser.api': true,
    'upload.publish': true,
    'admin.accounts': true,
  },
}

export function can(role: Role, cap: Capability): boolean {
  const g = ACCESS_MATRIX[role][cap]
  return g === true || g === 'unlimited' || g === 'sectoral' || g === 'own' || g === 'read'
}

/** Lecture intégrale ? (Sitwayen ne voit que des extraits) */
export function canReadFull(role: Role): boolean {
  return ACCESS_MATRIX[role]['read.full'] === true
}

/** Comptes sensibles — 2FA à chaque session, pas de fenêtre de 30 jours (§04). */
export function isSensitiveRole(role: Role): boolean {
  return role === 'EDITEUR' || role === 'MASTER_ADMIN'
}

/** Recherche illimitée ? (sinon quota mensuel Sitwayen) — lit la matrice. */
export function hasUnlimitedSearch(role: Role): boolean {
  return ACCESS_MATRIX[role]['search.basic'] === 'unlimited'
}
