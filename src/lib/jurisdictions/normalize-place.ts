/**
 * Normalisation des noms de lieux haïtiens (carte judiciaire).
 *
 * Module SÉPARÉ de src/lib/search/normalize.ts : mêmes principes (minuscules,
 * NFKD, sans diacritiques), mais règles propres aux toponymes — tirets et
 * apostrophes deviennent des espaces (« Port-au-Prince » ≡ « port au prince »),
 * et une forme COMPACTE sans espaces couvre « portauprince ».
 *
 * Fonctions PURES et déterministes — testées dans normalize-place.test.ts.
 */

const DIACRITICS = /[̀-ͯ]/g
// Apostrophes droites et typographiques, tirets de toute largeur → espace.
const SEPARATORS = /['’ʼ`\-–—_.,;:/\\]/g
const NON_ALNUM = /[^a-z0-9 ]/g

/** « Môle-Saint-Nicolas » → « mole saint nicolas ». */
export function normalizePlaceName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .replace(SEPARATORS, ' ')
    .replace(NON_ALNUM, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Forme compacte pour les noms composés : « port au prince » → « portauprince ». */
export function compactPlaceName(raw: string): string {
  return normalizePlaceName(raw).replace(/ /g, '')
}

/** Code postal haïtien « HT6110 » (insensible à la casse et aux espaces). */
export function normalizePostalCode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[\s-]/g, '')
  return /^HT\d{4}$/.test(s) ? s : null
}

/**
 * Distance d'édition bornée (Damerau–Levenshtein restreint, transposition
 * adjacente comprise). Renvoie `max + 1` dès que la borne est dépassée — on ne
 * calcule jamais plus loin que nécessaire (max ≤ 2 dans la recherche).
 */
export function boundedEditDistance(a: string, b: string, max: number): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  const la = a.length
  const lb = b.length
  let prev2: number[] | null = null
  let prev = Array.from({ length: lb + 1 }, (_, j) => j)
  for (let i = 1; i <= la; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1)
      }
      cur.push(v)
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev2 = prev
    prev = cur
  }
  return Math.min(prev[lb], max + 1)
}
