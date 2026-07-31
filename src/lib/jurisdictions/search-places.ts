/**
 * Recherche locale sur les 149 communes (carte judiciaire) — index en mémoire,
 * AUCUN géocodeur externe, temps cible < 100 ms.
 *
 * Classement (§10.2 du cahier des charges), du plus fort au plus faible :
 *   1. nom canonique exact          2. alias exact
 *   3. code postal exact            4. correspondance compacte exacte
 *   5. préfixe                      6. correspondance par mots
 *   7. distance d'édition 1         8. distance d'édition 2
 *
 * Garde-fous : pas d'approximatif sous 3 caractères, distance ≤ 2, 8 suggestions
 * au plus, dédupliquées par commune. Fonctions pures — testées.
 */
import { normalizePlaceName, compactPlaceName, normalizePostalCode, boundedEditDistance } from './normalize-place'

export interface PlaceEntry {
  id: string
  name: string
  department: string
  arrondissement: string
  /** code postal principal (affiché dans la suggestion) */
  postalCode: string | null
  /** tous les codes de la commune (correspondance exacte) */
  postalCodes: string[]
  aliases: string[]
}

export type MatchType =
  | 'EXACT_NORMALIZED'
  | 'EXACT_ALIAS'
  | 'EXACT_POSTAL'
  | 'EXACT_COMPACT'
  | 'PREFIX'
  | 'WORDS'
  | 'FUZZY_1'
  | 'FUZZY_2'

export interface PlaceHit {
  id: string
  name: string
  department: string
  arrondissement: string
  postalCode: string | null
  matchType: MatchType
  score: number
}

interface Indexed extends PlaceEntry {
  norm: string
  compact: string
  words: string[]
  aliasNorms: string[]
  postalSet: Set<string>
}

export interface PlaceIndex {
  entries: Indexed[]
}

const SCORES: Record<MatchType, number> = {
  EXACT_NORMALIZED: 100,
  EXACT_ALIAS: 92,
  EXACT_POSTAL: 86,
  EXACT_COMPACT: 80,
  PREFIX: 70,
  WORDS: 60,
  FUZZY_1: 40,
  FUZZY_2: 25,
}

export function buildPlaceIndex(entries: PlaceEntry[]): PlaceIndex {
  return {
    entries: entries.map((e) => ({
      ...e,
      norm: normalizePlaceName(e.name),
      compact: compactPlaceName(e.name),
      words: normalizePlaceName(e.name).split(' ').filter(Boolean),
      aliasNorms: e.aliases.map(normalizePlaceName).filter(Boolean),
      postalSet: new Set(e.postalCodes.map((c) => c.toUpperCase())),
    })),
  }
}

const MAX_RESULTS = 8
const MIN_FUZZY_LEN = 3

export function searchPlaces(index: PlaceIndex, rawQuery: string, limit = MAX_RESULTS): PlaceHit[] {
  const capped = Math.max(1, Math.min(MAX_RESULTS, limit))
  const q = normalizePlaceName(rawQuery).slice(0, 80)
  if (!q) return []
  const qCompact = q.replace(/ /g, '')
  const qPostal = normalizePostalCode(rawQuery)
  const qWords = q.split(' ').filter((w) => w.length >= 2)

  const best = new Map<string, PlaceHit>() // dédupliqué par commune : meilleur score gagne
  const consider = (e: Indexed, matchType: MatchType, malus = 0) => {
    const score = SCORES[matchType] - malus
    const cur = best.get(e.id)
    if (cur && cur.score >= score) return
    best.set(e.id, {
      id: e.id,
      name: e.name,
      department: e.department,
      arrondissement: e.arrondissement,
      postalCode: e.postalCode,
      matchType,
      score,
    })
  }

  for (const e of index.entries) {
    if (e.norm === q) { consider(e, 'EXACT_NORMALIZED'); continue }
    if (e.aliasNorms.includes(q)) { consider(e, 'EXACT_ALIAS'); continue }
    if (qPostal && e.postalSet.has(qPostal)) { consider(e, 'EXACT_POSTAL'); continue }
    if (e.compact === qCompact && qCompact.length >= MIN_FUZZY_LEN) { consider(e, 'EXACT_COMPACT'); continue }
    if (q.length >= 2 && (e.norm.startsWith(q) || e.compact.startsWith(qCompact))) {
      consider(e, 'PREFIX', Math.min(9, e.norm.length - q.length)) // le plus court d'abord
      continue
    }
    if (qWords.length && qWords.every((w) => e.words.some((ew) => ew === w || ew.startsWith(w)))) {
      consider(e, 'WORDS', Math.min(9, e.words.length - qWords.length))
      continue
    }
    // Approximatif : jamais sous 3 caractères, distance bornée à 2.
    if (q.length < MIN_FUZZY_LEN) continue
    const d = Math.min(
      boundedEditDistance(q, e.norm, 2),
      boundedEditDistance(qCompact, e.compact, 2),
    )
    if (d === 1) consider(e, 'FUZZY_1')
    else if (d === 2) consider(e, 'FUZZY_2')
  }

  return [...best.values()]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'))
    .slice(0, capped)
}
