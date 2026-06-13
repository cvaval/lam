import { prisma } from '../db'

/**
 * Détection des numéros manquants du Moniteur.
 *
 * Référentiel : Document.number au format `LM{année}-{SP?}{numéro}{suffixe?}`
 * (ex. LM2018-126, LM2000-SP3, LM1969-31A, LM1918-58b). Les éditions régulières
 * et spéciales forment deux séquences indépendantes par année.
 *
 * Règles (demande du 12 juin 2026) :
 *  1. numéros sautés — 125 puis 127 présents ⇒ 126 manquant (trous INTERNES :
 *     on n'extrapole pas au-delà du dernier numéro connu de l'année) ;
 *  2. suffixes sautés — 125-a et 125-c présents ⇒ 125-b manquant ; la séquence
 *     de suffixes commence toujours à « a » (125-c seul ⇒ a et b manquants).
 *
 * Les références non standard (LM1900-X1, 15bis…) sont ignorées par l'analyse :
 * elles n'appartiennent à aucune séquence dénombrable.
 */

export interface ParsedRef {
  year: number
  special: boolean
  num: number
  /** suffixe alphabétique normalisé en minuscule ('a'…'z'), sinon null */
  suffix: string | null
  /** casse d'origine du suffixe (pour réafficher les manquants dans la même casse) */
  suffixUpper: boolean
}

/** Analyse une référence LM ; null si non standard. */
export function parseEditionRef(ref: string | null | undefined): ParsedRef | null {
  const m = (ref ?? '').match(/^LM(\d{4})-(SP)?(\d+)([A-Za-z])?$/)
  if (!m) return null
  return {
    year: Number(m[1]),
    special: m[2] === 'SP',
    num: Number(m[3]),
    suffix: m[4] ? m[4].toLowerCase() : null,
    suffixUpper: m[4] ? m[4] === m[4].toUpperCase() : false,
  }
}

export interface MissingEdition {
  year: number
  special: boolean
  num: number
  suffix: string | null
  /** référence affichable, ex. LM2018-126 ou LM1969-31C */
  ref: string
  /** 'numero' = numéro entier sauté ; 'suffixe' = lettre sautée dans une série a/b/c */
  reason: 'numero' | 'suffixe'
}

export interface YearGaps {
  year: number
  missing: MissingEdition[]
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'

function formatRef(year: number, special: boolean, num: number, suffix: string | null, upper: boolean): string {
  const s = suffix ? (upper ? suffix.toUpperCase() : suffix) : ''
  return `LM${year}-${special ? 'SP' : ''}${num}${s}`
}

/**
 * Calcule les numéros manquants à partir d'une liste de références (toutes années
 * confondues). Pure et déterministe — la lecture de la base vit dans loadGaps().
 */
export function findMissingEditions(refs: (string | null | undefined)[]): YearGaps[] {
  // year → 'reg'|'sp' → num → Set<suffix> (set vide = numéro plein présent sans suffixe)
  const tree = new Map<number, Map<'reg' | 'sp', Map<number, { suffixes: Set<string>; upper: boolean }>>>()

  for (const ref of refs) {
    const p = parseEditionRef(ref)
    if (!p) continue
    const seqs = tree.get(p.year) ?? new Map()
    tree.set(p.year, seqs)
    const key = p.special ? 'sp' : 'reg'
    const nums = seqs.get(key) ?? new Map()
    seqs.set(key, nums)
    const entry = nums.get(p.num) ?? { suffixes: new Set<string>(), upper: false }
    if (p.suffix) {
      entry.suffixes.add(p.suffix)
      entry.upper = entry.upper || p.suffixUpper
    }
    nums.set(p.num, entry)
  }

  const result: YearGaps[] = []
  for (const [year, seqs] of [...tree.entries()].sort((a, b) => a[0] - b[0])) {
    const missing: MissingEdition[] = []
    for (const key of ['reg', 'sp'] as const) {
      const nums = seqs.get(key)
      if (!nums) continue
      const special = key === 'sp'
      const sorted = [...nums.keys()].sort((a, b) => a - b)

      // 1) Numéros entiers sautés (trous internes uniquement).
      for (let i = 1; i < sorted.length; i++) {
        for (let n = sorted[i - 1] + 1; n < sorted[i]; n++) {
          missing.push({ year, special, num: n, suffix: null, ref: formatRef(year, special, n, null, false), reason: 'numero' })
        }
      }

      // 2) Lettres sautées dans chaque série à suffixes (a..max).
      for (const n of sorted) {
        const { suffixes, upper } = nums.get(n)!
        if (!suffixes.size) continue
        const maxIdx = Math.max(...[...suffixes].map((s) => LETTERS.indexOf(s)))
        for (let i = 0; i <= maxIdx; i++) {
          const letter = LETTERS[i]
          if (!suffixes.has(letter)) {
            missing.push({ year, special, num: n, suffix: letter, ref: formatRef(year, special, n, letter, upper), reason: 'suffixe' })
          }
        }
      }
    }
    if (missing.length) {
      missing.sort((a, b) => Number(a.special) - Number(b.special) || a.num - b.num || (a.suffix ?? '').localeCompare(b.suffix ?? ''))
      result.push({ year, missing })
    }
  }
  return result
}

/** Charge les références du corpus et calcule les manquants (toutes années, ou une seule). */
export async function loadGaps(year?: number): Promise<YearGaps[]> {
  const rows = await prisma.document.findMany({
    where: {
      number: year ? { startsWith: `LM${year}-` } : { startsWith: 'LM' },
    },
    select: { number: true },
    distinct: ['number'],
  })
  return findMissingEditions(rows.map((r) => r.number))
}
