/**
 * Accès au contenu PAR SERVICE, par utilisateur (§03).
 *
 * Remplace l'ancien drapeau binaire `indexOnly`. Le master admin active, pour chaque
 * compte, la liste des services à texte intégral (les 7 types non-référence : Législation,
 * Circulaires BRH, Jurisprudence, Doctrine, Lois de finances, Marques, Tarifs douaniers) ;
 * l'Index du Moniteur est TOUJOURS accessible (socle). Un service non accordé est invisible (recherche,
 * tableau de bord, fiche document → redirigés vers l'Index).
 *
 * Règles :
 *  - Un service accordé = lecture INTÉGRALE, quel que soit le rôle (décision produit).
 *    Le rôle ne gouverne plus que l'export, les alertes, le quota, l'upload, l'admin.
 *  - Le staff (ÉDITEUR / MASTER_ADMIN) voit TOUS les services + le PDF, indépendamment
 *    de sa liste — sinon il se verrouillerait lui-même.
 *  - Stockage : User.services = CSV de DocType ; User.canViewSourcePdf = booléen.
 */
import { DOC_TYPES, type DocType, type Role } from './types'
import { FULLTEXT_TYPE_LIST } from './brand'

/** Les services à texte intégral (tout sauf l'Index, soit 7 types). Source : registre (referenceOnly=false). */
export const FULLTEXT_TYPES: DocType[] = FULLTEXT_TYPE_LIST.map((m) => m.type)
const FULLTEXT = new Set<DocType>(FULLTEXT_TYPES)

/** Comptes internes : accès total au contenu, hors paliers clients. */
export function isStaff(role: Role): boolean {
  return role === 'EDITEUR' || role === 'MASTER_ADMIN'
}

/** CSV stocké → liste de DocType valides (ignore l'Index et les valeurs inconnues). */
export function parseServices(csv: string | null | undefined): DocType[] {
  return (csv ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is DocType => FULLTEXT.has(s as DocType))
}

/** Liste de DocType → CSV normalisé (dédupliqué, sans l'Index ni valeurs inconnues). */
export function serializeServices(types: readonly DocType[]): string {
  return [...new Set(types)].filter((t) => FULLTEXT.has(t)).join(',')
}

/** Types lisibles par l'utilisateur : l'Index toujours ; le staff voit tout. */
export function accessibleTypes(u: { role: Role; services: DocType[] }): DocType[] {
  if (isStaff(u.role)) return [...DOC_TYPES]
  return ['INDEX', ...u.services]
}

/** Cet utilisateur peut-il lire (le texte intégral d') un document de ce type ? */
export function canReadService(u: { role: Role; services: DocType[] }, type: DocType): boolean {
  return accessibleTypes(u).includes(type)
}

/** Le compte n'a accès qu'à l'Index (aucun service à texte intégral) ? */
export function isIndexOnly(u: { role: Role; services: DocType[] }): boolean {
  return !isStaff(u.role) && u.services.length === 0
}

/** Peut-il voir le lien vers le PDF original ? (staff toujours autorisé) */
export function canSeeSourcePdf(u: { role: Role; canViewSourcePdf: boolean }): boolean {
  return isStaff(u.role) || u.canViewSourcePdf
}

/**
 * Ordonne une liste de types selon la préférence de l'utilisateur (CSV de DocType, ex. issu
 * d'un glisser-déposer des onglets). Les types présents dans la préférence viennent en tête,
 * dans cet ordre ; les types absents (NOUVEAUX onglets ajoutés après coup, ou jamais rangés)
 * sont conservés à la fin dans l'ordre canonique reçu. Robuste aux valeurs inconnues/doublons.
 */
export function orderTypes(types: DocType[], orderCsv: string | null | undefined): DocType[] {
  const allowed = new Set(types)
  const seen = new Set<DocType>()
  const out: DocType[] = []
  for (const raw of (orderCsv ?? '').split(',')) {
    const t = raw.trim() as DocType
    if (allowed.has(t) && !seen.has(t)) { out.push(t); seen.add(t) }
  }
  for (const t of types) if (!seen.has(t)) { out.push(t); seen.add(t) }
  return out
}

/** Normalise une liste de types en CSV (dédupliqué, types valides uniquement) pour stockage. */
export function serializeSectionOrder(types: readonly DocType[]): string {
  const valid = new Set<DocType>(DOC_TYPES)
  return [...new Set(types)].filter((t) => valid.has(t)).join(',')
}
