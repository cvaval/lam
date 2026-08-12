import type { Role } from '../types'

/**
 * RÈGLES DES NOTES DE LECTEURS — un seul endroit, parce qu'elles sont appliquées à trois :
 * la route qui enregistre, la file de modération, et la fiche qui affiche.
 */

export const STATUTS_NOTE = ['EN_ATTENTE', 'PUBLIEE', 'REFUSEE'] as const
export type StatutNote = (typeof STATUTS_NOTE)[number]

/** La rédaction : elle modère, et elle ne peut jamais écrire sous le couvert de l'anonymat. */
export function estRedaction(role: Role | string): boolean {
  return role === 'MASTER_ADMIN' || role === 'EDITEUR'
}

/**
 * ⚠️ L'ANONYMAT EST RÉSERVÉ AUX LECTEURS. « L'éditeur ne peut pas être anonyme, c'est
 * l'utilisateur de la plateforme qui pourra l'être » : la parole d'un éditeur engage Lam,
 * elle doit donc porter un nom. Cette fonction est le seul juge — la route s'y remet, et
 * ne se contente pas de masquer la case à cocher côté navigateur.
 */
export function peutEtreAnonyme(role: Role | string): boolean {
  return !estRedaction(role)
}

/** Qui peut approuver ou refuser une note. */
export function peutModerer(role: Role | string): boolean {
  return estRedaction(role)
}

/**
 * Nom affiché sous une note.
 *
 * ⚠️ Une note anonyme ne doit RIEN laisser filtrer : ni le nom, ni l'adresse, ni un
 * identifiant. L'auteur reste connu de la rédaction en base, jamais du lecteur.
 */
export function signature(
  note: { anonymous: boolean; author: { name: string | null; email: string } },
  libelleAnonyme = 'Contribution anonyme',
): string {
  if (note.anonymous) return libelleAnonyme
  return note.author.name?.trim() || note.author.email
}

export const LONGUEUR_MAX_NOTE = 5000
