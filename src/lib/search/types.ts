import type { DocType, DocStatus, Locale } from '../types'

/** Taille de page des résultats — source unique (page, route API, providers). */
export const PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 50

/**
 * Analyse d'un paramètre d'année (« 1987 ») — SOURCE UNIQUE de la validation
 * (page de recherche + route API) : 4 chiffres ET plage plausible. La borne
 * basse évite le piège Date.UTC(99) → 1999 (remappage JS des années 0-99).
 */
export function parseYearParam(v: string | null | undefined): number | undefined {
  if (!v || !/^\d{4}$/.test(v)) return undefined
  const n = Number(v)
  return n >= 1800 && n <= 2100 ? n : undefined
}

/** Période « entre l'année X et Y » : bornes validées, remises dans l'ordre. */
export function parseYearRange(
  from: string | null | undefined,
  to: string | null | undefined,
): { yearFrom?: number; yearTo?: number } {
  let yearFrom = parseYearParam(from)
  let yearTo = parseYearParam(to)
  if (yearFrom != null && yearTo != null && yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom]
  return { yearFrom, yearTo }
}

export interface SearchQuery {
  q: string
  locale: Locale
  types?: DocType[]
  status?: DocStatus
  juridiction?: string
  matiere?: string
  fiscalYear?: number
  niceClass?: string
  /** sous-catégorie de l'Index du Moniteur (LOI, DECRET, ARRETE, AVIS, SOCIETE…) */
  category?: string
  /** année de publication (filtre circulaires BRH par année) */
  year?: number
  /** période de publication (recherche avancée) : bornes d'années incluses */
  yearFrom?: number
  yearTo?: number
  /** numéro contenu dans Document.number (filtre circulaires BRH par numéro) */
  num?: string
  includeCompanies?: boolean
  /** tri en mode navigation (sans requête texte) : date de signature (défaut),
   * date d'entrée en vigueur, numéro croissant/décroissant. */
  sort?: 'sig' | 'eff' | 'num-asc' | 'num-desc'
  page?: number
  size?: number
}

export interface SearchHit {
  kind: 'document' | 'company'
  id: string
  type?: DocType
  title: string
  /** extrait surligné (HTML, termes en <mark>) — surlignage Sitwon (§09) */
  snippet: string
  status?: DocStatus
  badge?: string
  number?: string | null
  moniteurRef?: string | null
  publicationDate?: string | null
  niceClasses?: string | null
  bhdaNumber?: string | null
  holder?: string | null
  imageUrl?: string | null
  score: number
  /**
   * Correspondance par orthographe proche (2ᵉ tier « résultats approchants »).
   * Renseigné par le moteur intégré (FTS) uniquement — OpenSearch traite le fuzzy
   * via fuzziness:AUTO dans la requête, sans le distinguer hit par hit.
   */
  fuzzy?: boolean
  /** nombre de publications au Moniteur (résultats société) */
  refCount?: number
}

export interface SearchResult {
  total: number
  hits: SearchHit[]
  /** termes effectivement recherchés après expansion translingue EN→FR */
  expandedTerms: string[]
  provider: 'fts' | 'opensearch'
}

export interface SearchProvider {
  readonly name: 'fts' | 'opensearch'
  search(query: SearchQuery): Promise<SearchResult>
}
