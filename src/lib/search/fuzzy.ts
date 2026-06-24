import { prisma } from '../db'
import { fold } from './normalize'

/**
 * Recherche « approchante » (orthographe proche). Construit un vocabulaire du corpus
 * (mots distincts folés) mis en cache, puis trouve les mots à distance d'édition ≤ 2
 * d'un terme — pour proposer, après les correspondances exactes, des résultats avec une
 * orthographe distincte (fautes de frappe, variantes).
 */
let VOCAB: { words: string[]; freq: Map<string, number> } | null = null
let buildPromise: Promise<void> | null = null

const WORD_RE = /[a-z0-9]{4,24}/g

async function buildVocab(): Promise<void> {
  const freq = new Map<string, number>()
  // Lecture par lots du texte de recherche (folé) de tout le corpus.
  const batchSize = 5000
  let cursor: string | undefined
  for (;;) {
    const rows: { id: string; searchText: string | null }[] = await prisma.document.findMany({
      select: { id: true, searchText: true },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    if (!rows.length) break
    for (const r of rows) {
      if (!r.searchText) continue
      const seen = new Set<string>()
      let m: RegExpExecArray | null
      WORD_RE.lastIndex = 0
      while ((m = WORD_RE.exec(r.searchText))) {
        const w = m[0]
        if (seen.has(w)) continue
        seen.add(w)
        freq.set(w, (freq.get(w) ?? 0) + 1)
      }
    }
    cursor = rows[rows.length - 1].id
    if (rows.length < batchSize) break
  }
  // Conserve les mots les plus fréquents (borne le coût de la distance d'édition).
  const words = [...freq.keys()].sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0)).slice(0, 60000)
  VOCAB = { words, freq }
}

async function ensureVocab(): Promise<void> {
  if (VOCAB) return
  if (!buildPromise) buildPromise = buildVocab().finally(() => (buildPromise = null))
  await buildPromise
}

/** Invalide le cache de vocabulaire (après un import). */
export function resetVocab(): void {
  VOCAB = null
}

/** Préchauffe le vocabulaire hors chemin de requête (à appeler après un déploiement/import). */
export function warmVocab(): void {
  void ensureVocab()
}

// Distance de Levenshtein bornée : abandonne dès que le minimum d'une ligne dépasse max.
function boundedLevenshtein(a: string, b: string, max: number): number {
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > max) return max + 1
  let prev = new Array(lb + 1)
  let curr = new Array(lb + 1)
  for (let j = 0; j <= lb; j++) prev[j] = j
  for (let i = 1; i <= la; i++) {
    curr[0] = i
    let rowMin = curr[0]
    const ca = a.charCodeAt(i - 1)
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
      if (curr[j] < rowMin) rowMin = curr[j]
    }
    if (rowMin > max) return max + 1
    ;[prev, curr] = [curr, prev]
  }
  return prev[lb]
}

/**
 * Renvoie jusqu'à `limit` mots du vocabulaire proches de `term` (distance ≤ maxDist),
 * triés par distance croissante puis fréquence décroissante. Exclut le terme exact.
 */
export async function fuzzyExpand(term: string, maxDist = 2, limit = 6): Promise<string[]> {
  const t = fold(term)
  if (t.length < 4) return []
  // Construction du vocabulaire coûteuse à froid (tout le corpus) : si pas encore prête, on
  // la lance EN ARRIÈRE-PLAN et on renvoie [] cette fois (résultats exacts seulement) pour ne
  // pas bloquer la requête (risque de timeout Vercel — audit §21). Le fuzzy suit dès qu'il est prêt.
  if (!VOCAB) {
    void ensureVocab()
    return []
  }
  const out: { w: string; d: number; f: number }[] = []
  for (const w of VOCAB.words) {
    if (w === t) continue
    if (Math.abs(w.length - t.length) > maxDist) continue
    // pré-filtre rapide : partage de la première lettre OU de la longueur exacte
    if (w[0] !== t[0] && w.length !== t.length) continue
    const d = boundedLevenshtein(t, w, maxDist)
    if (d <= maxDist) out.push({ w, d, f: VOCAB.freq.get(w) ?? 0 })
  }
  out.sort((a, b) => a.d - b.d || b.f - a.f)
  return out.slice(0, limit).map((x) => x.w)
}
