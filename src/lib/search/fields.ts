import type { SearchableDoc } from './normalize'

/**
 * SOURCE UNIQUE des champs cherchables d'un Document et de leur pondération.
 *
 * Consommée par :
 *  - buildSearchText()  (normalize.ts)      → concatène ces champs dans searchText
 *  - weightedFields()   (fts.ts)            → scoring du moteur intégré
 *  - le multi_match     (opensearch.ts)     → `field^weight`
 *  - serializeDoc()     (scripts/reindex.ts) via SEARCH_FIELD_NAMES
 *
 * Pour ajouter/retirer un champ cherchable ou changer un poids : MODIFIER ICI
 * UNIQUEMENT. Les quatre consommateurs restent automatiquement synchronisés.
 */
export const SEARCH_FIELD_WEIGHTS: { field: keyof SearchableDoc; weight: number }[] = [
  { field: 'titleFr', weight: 7 },
  { field: 'titleEn', weight: 6 },
  { field: 'titleHt', weight: 6 },
  { field: 'number', weight: 6 },
  { field: 'bhdaNumber', weight: 6 },
  { field: 'holder', weight: 5 },
  { field: 'author', weight: 4 },
  { field: 'keywords', weight: 4 },
  { field: 'themeLabels', weight: 4 }, // libellés des thèmes rattachés — recherche par thème
  { field: 'revue', weight: 3 },
  { field: 'matiere', weight: 3 },
  { field: 'juridiction', weight: 3 },
  { field: 'summaryFr', weight: 3 },
  { field: 'summaryEn', weight: 3 },
  { field: 'summaryHt', weight: 3 },
  { field: 'moniteurRef', weight: 2 },
  { field: 'bodyOriginal', weight: 1 },
]

/** Noms des champs cherchables, dans l'ordre canonique (pour la concaténation). */
export const SEARCH_FIELD_NAMES = SEARCH_FIELD_WEIGHTS.map((f) => f.field)

/**
 * Champs cherchables propres aux fiches Société (index OpenSearch `companies`),
 * distincts du Document. Le moteur intégré gère les sociétés séparément.
 */
export const COMPANY_FIELD_WEIGHTS: { field: string; weight: number }[] = [
  { field: 'name', weight: 7 },
  { field: 'address', weight: 1 },
]

/** Format `field^weight` attendu par multi_match d'OpenSearch (docs + sociétés). */
export function multiMatchFields(): string[] {
  return [...SEARCH_FIELD_WEIGHTS, ...COMPANY_FIELD_WEIGHTS].map(({ field, weight }) => `${field}^${weight}`)
}
