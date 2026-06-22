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

// Les 6 services de textes intégraux (§01) + l'Index du Moniteur (références) + les
// Tarifs douaniers (corpus documentaire + table de tarifs). Ordre canonique 1→6,
// Index 7ᵉ, Tarifs douaniers 8ᵉ.
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
