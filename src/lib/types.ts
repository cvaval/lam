// Énumérations applicatives (SQLite ne supporte pas les enum Prisma — voir schema.prisma).
// Ces unions sont la source de vérité côté code.
import { DOC_TYPE_META } from './brand'

export const ROLES = ['SITWAYEN', 'PWOFESYONEL', 'ENSTITISYON', 'EDITEUR', 'MASTER_ADMIN'] as const
export type Role = (typeof ROLES)[number]

export const USER_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const LOCALES = ['fr', 'en', 'ht'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'fr'

// 7 services à texte intégral (§01) — Législation, Circulaires BRH, Jurisprudence, Doctrine,
// Lois de finances, Marques, Tarifs douaniers — + l'Index du Moniteur (références seules).
// Ordre canonique : 1→6, Index 7ᵉ, Tarifs douaniers 8ᵉ (referenceOnly = INDEX uniquement).
export const DOC_TYPES = [
  'LEGISLATION',
  'CIRCULAIRE_BRH',
  'JURISPRUDENCE',
  'DOCTRINE',
  'LOI_FINANCES',
  'MARQUE',
  'INDEX',
  'TARIF_DOUANIER',
] as const
export type DocType = (typeof DOC_TYPES)[number]

// Sous-catégories des entrées de l'Index du Moniteur (classées à l'import).
export const INDEX_CATEGORIES = [
  'LOI',
  'DECRET',
  'ARRETE',
  'AVIS',
  'SOCIETE',
  'MARQUE',
  'CIRCULAIRE',
  'AUTRE',
] as const
export type IndexCategory = (typeof INDEX_CATEGORIES)[number]

export function isIndexCategory(v: string): v is IndexCategory {
  return (INDEX_CATEGORIES as readonly string[]).includes(v)
}

export const DOC_STATUSES = ['EN_VIGUEUR', 'ABROGE', 'MODIFIE', 'PUBLIE'] as const
export type DocStatus = (typeof DOC_STATUSES)[number]

export const JURIDICTIONS = ['CASSATION', 'APPEL', 'PREMIERE_INSTANCE'] as const
export type Juridiction = (typeof JURIDICTIONS)[number]

// Mappe le slug d'URL (type 1–7 ou clé courte) vers le DocType canonique.
// Dérivé de DOC_TYPE_META (source unique du slug et du numéro, brand.ts) + alias
// historiques explicites. Un renommage de slug dans brand.ts se propage ici.
export const TYPE_SLUGS: Record<string, DocType> = {
  ...Object.fromEntries(
    (Object.entries(DOC_TYPE_META) as [DocType, { num: number; slug: string }][]).flatMap(([type, m]) => [
      [String(m.num), type],
      [m.slug, type],
    ]),
  ),
  brh: 'CIRCULAIRE_BRH',
  moniteur: 'INDEX',
  // ANCIENS slugs des rubriques renommées (URL alignées sur les noms affichés,
  // 22 juil. 2026) : conservés pour que les liens et favoris ?type=… résolvent encore.
  doctrine: 'DOCTRINE', // → legislationannotee
  legislation: 'LEGISLATION', // → editionsmoniteur
}

/**
 * Corpus visé par un slug de RUBRIQUE — c'est-à-dire les types qu'elle liste.
 *
 * ⚠️ Un slug de rubrique n'est pas un type. « legislationannotee » se résolvait en
 * l'unique DocType DOCTRINE, alors que la rubrique liste aussi la LEGISLATION : le lien
 * « Rechercher dans toute la législation annotée » cherchait donc dans 2 documents sur
 * 3 136 (mesuré le 17 août 2026). La recherche répondait — elle répondait à côté, ce qui
 * ne se voit pas : une page de résultats presque vide ressemble à une absence de résultats.
 *
 * Le corpus est déclaré une seule fois, dans `DOC_TYPE_META` (brand.ts), avec le reste de
 * l'identité de la rubrique. C'est la même source que celle qui borne l'affichage de la
 * rubrique : la recherche par rubrique et la rubrique elle-même ne peuvent plus diverger.
 *
 * UNE SEULE RÈGLE, sans exception : un type EST sa rubrique — il n'existe qu'une rubrique
 * par type, et aucun écran n'offre « la doctrine seule ». Le slug, le numéro et le DocType
 * en clair mènent donc tous au même corpus. Une règle qui ne vaudrait que pour le slug
 * ferait diverger la page (qui résout le slug avant d'interroger), l'API (qui reçoit le
 * slug) et les alertes (qui stockent le type) — c'est-à-dire refabriquer, ailleurs, le
 * défaut qu'on corrige ici.
 *
 * Ne borne AUCUN droit : l'appelant intersecte toujours avec les services accordés (§03).
 */
export function corpusForType(type: DocType): DocType[] {
  const corpus = DOC_TYPE_META[type].corpus
  return corpus ? [...corpus] : [type]
}

/** Idem, à partir d'un slug d'URL ou d'un numéro de rubrique. */
export function corpusForSlug(slug: string): DocType[] | undefined {
  const type = TYPE_SLUGS[slug]
  return type ? corpusForType(type) : undefined
}

export function isRole(v: string): v is Role {
  return (ROLES as readonly string[]).includes(v)
}
export function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v)
}
export function isDocType(v: string): v is DocType {
  return (DOC_TYPES as readonly string[]).includes(v)
}
