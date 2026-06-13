import { SEARCH_FIELD_NAMES } from './fields'

// Repli accentué + minuscules — base du préfiltrage SQL et du scoring en mémoire.
export function fold(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export interface SearchableDoc {
  titleFr: string
  titleEn?: string | null
  titleHt?: string | null
  number?: string | null
  bhdaNumber?: string | null
  holder?: string | null
  author?: string | null
  revue?: string | null
  keywords?: string | null
  matiere?: string | null
  juridiction?: string | null
  moniteurRef?: string | null
  summaryFr?: string | null
  summaryEn?: string | null
  summaryHt?: string | null
  bodyOriginal?: string | null
}

/**
 * Concatène les champs cherchables en un texte folé (stocké dans Document.searchText).
 * La liste des champs vient de SEARCH_FIELD_NAMES — source unique (search/fields.ts).
 */
export function buildSearchText(d: SearchableDoc): string {
  return fold(
    SEARCH_FIELD_NAMES.map((f) => d[f])
      .filter(Boolean)
      .join(' '),
  )
}
