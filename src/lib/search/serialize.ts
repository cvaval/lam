import type { Document } from '@prisma/client'
import { SEARCH_FIELD_NAMES } from './fields'
import { extractAnnotationsText } from './normalize'
import { parseCirculaireRef } from '../brh/gaps'

/**
 * Clé de tri numérique du numéro de circulaire (Document.number est une chaîne :
 * « Circulaire n° 131 », « Lettre-Circulaire n° 05-2 »…). Reproduit l'ordre du
 * moteur intégré (fts.ts, sortByCirculaireNumber) : série, puis base, puis révision.
 * Null (champ absent de l'index → missing:_last) pour les références non standard.
 */
function numberSortKey(number: string | null): number | null {
  const p = parseCirculaireRef(number)
  if (!p) return null
  const serieOrd = p.serie === 'CIRCULAIRE' ? 0 : 1
  return serieOrd * 10_000_000 + p.base * 1000 + (p.rev ?? 0)
}

/**
 * Sérialisation d'une ligne Document (Prisma) vers le corps indexé OpenSearch.
 * SOURCE UNIQUE consommée par :
 *  - scripts/reindex.ts            → réindexation complète (bulk par type)
 *  - api/admin/upload/route.ts     → indexation incrémentale à la publication
 */
export function serializeDoc(d: Document) {
  // Champs cherchables : dérivés de la source unique (search/fields.ts).
  const searchable = Object.fromEntries(SEARCH_FIELD_NAMES.map((f) => [f, d[f]]))
  // Texte des ANNOTATIONS (jurisprudence, commentaires, législation connexe, anciennes
  // versions, sujets d'index) — vit hors de bodyOriginal, donc sinon INTROUVABLE par un mot
  // d'un arrêt ou d'une annotation (Code du travail/civil…). Indexé comme champ à part pour
  // que le multi_match d'OpenSearch le cherche (poids dédié : voir multiMatchFields).
  const annotationsText = extractAnnotationsText(d.annotationsJson) || undefined
  // Champs d'affichage / de filtrage (non cherchables) ajoutés explicitement.
  return {
    ...searchable,
    annotationsText,
    type: d.type,
    status: d.status,
    category: d.category,
    niceClasses: d.niceClasses,
    fiscalYear: d.fiscalYear,
    publicationDate: d.publicationDate,
    // Tri en mode navigation (parité moteur intégré) : entrée en vigueur + n° de circulaire.
    effectiveDate: d.effectiveDate,
    numberSort: numberSortKey(d.number),
    imageUrl: d.imageUrl, // rendu par ResultCard (vignette marque)
  }
}
