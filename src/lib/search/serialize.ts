import type { DecisionJudge, Document, Judge } from '@prisma/client'
import { SEARCH_FIELD_NAMES } from './fields'
import { extractAnnotationsText } from './normalize'
import { parseCirculaireRef } from '../brh/gaps'

/** Document éventuellement accompagné de sa formation de jugement. */
export type DocumentAIndexer = Document & {
  judges?: (DecisionJudge & { judge?: Judge | null })[]
  themes?: { themeId: string }[]
}

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
export function serializeDoc(d: DocumentAIndexer) {
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
    createdAt: d.createdAt,
    imageUrl: d.imageUrl, // rendu par ResultCard (vignette marque)
    // ⚠️ `judges` NON CHARGÉ ≠ `judges` VIDE. Sans la relation, on n'écrit pas les champs :
    // les remettre à [] effacerait la composition déjà indexée et ferait disparaître la
    // décision des recherches par magistrat, sans une ligne d'erreur.
    ...(d.judges
      ? {
          // Une ligne par participation — le magistrat ET son rôle appariés (cf. mappings).
          judges: d.judges.map((j) => ({ id: j.judgeId, key: j.judge?.matchKey ?? null, role: j.role })),
        }
      : {}),
    // Minuscules seulement : la parité avec `ILIKE` l'exige (cf. mappings).
    // ⚠️ `themes` NON CHARGÉ ≠ AUCUN THÈME (même règle que `judges`) : sans la relation,
    // on n'écrit pas le champ plutôt que d'effacer le classement déjà indexé.
    ...(d.themes ? { themeIds: d.themes.map((t) => t.themeId) } : {}),
    titleLower: d.titleFr?.toLowerCase() ?? null,
    matiereLower: d.matiere?.toLowerCase() ?? null,
  }
}
