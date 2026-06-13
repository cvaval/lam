import type { Document } from '@prisma/client'
import { SEARCH_FIELD_NAMES } from './fields'

/**
 * Sérialisation d'une ligne Document (Prisma) vers le corps indexé OpenSearch.
 * SOURCE UNIQUE consommée par :
 *  - scripts/reindex.ts            → réindexation complète (bulk par type)
 *  - api/admin/upload/route.ts     → indexation incrémentale à la publication
 */
export function serializeDoc(d: Document) {
  // Champs cherchables : dérivés de la source unique (search/fields.ts).
  const searchable = Object.fromEntries(SEARCH_FIELD_NAMES.map((f) => [f, d[f]]))
  // Champs d'affichage / de filtrage (non cherchables) ajoutés explicitement.
  return {
    ...searchable,
    type: d.type,
    status: d.status,
    category: d.category,
    niceClasses: d.niceClasses,
    fiscalYear: d.fiscalYear,
    publicationDate: d.publicationDate,
    imageUrl: d.imageUrl, // rendu par ResultCard (vignette marque)
  }
}
