/**
 * Recherche d'un notaire par son NOM — fonctions PURES (testées dans search-notaries.test.ts).
 *
 *  - index : les entrées ACTIVES de la liste (l'entrée retirée n° 37 n'y est jamais), avec le
 *    nom affiché, le nom imprimé (« Gemma » et « Gamma » trouvent toutes deux le n° 9) et les
 *    alias de leur fiche de coordonnées ;
 *  - normalisation `normalizePlaceName` : casse, accents, tirets (« Ceant » ≡ « CÉANT ») ;
 *  - TOUS les mots de la requête doivent se retrouver dans le nom ; le dernier peut n'être
 *    qu'un début de mot (saisie au fil de la frappe) ; tolérance d'une lettre (distance
 *    d'édition 1) sur les mots de 5 lettres et plus ;
 *  - la mention (« PDD », « PD/CMM ») n'est PAS cherchable : ce n'est pas un nom.
 *
 * Le module rend TOUS les résultats, classés ; c'est l'appelant qui tronque.
 */
import { normalizePlaceName, boundedEditDistance } from './normalize-place'

export interface NotaryIndexEntry {
  id: string
  /** Nom affiché (décision de la cliente le cas échéant). */
  name: string
  /** Nom imprimé par le MJSP, s'il diffère. */
  printedName: string | null
  mention: string | null
  communeId: string | null
  communeName: string | null
  aliases: string[]
  hasContact: boolean
}

interface Indexed extends NotaryIndexEntry { words: string[]; sortKey: string }
export interface NotaryIndex { entries: Indexed[] }

export interface NotaryHit extends NotaryIndexEntry { score: number }

const words = (s: string) => normalizePlaceName(s).split(' ').filter(Boolean)

export function buildNotaryIndex(entries: NotaryIndexEntry[]): NotaryIndex {
  return {
    entries: entries.map((e) => ({
      ...e,
      words: [...new Set([e.name, e.printedName ?? '', ...e.aliases].flatMap(words))],
      sortKey: normalizePlaceName(e.name),
    })),
  }
}

/** Qualité de la correspondance d'un mot de requête : 3 exact, 2 début de mot, 1 à une lettre près. */
function matchWord(q: string, candidats: string[], dernier: boolean): number {
  let best = 0
  for (const w of candidats) {
    if (w === q) return 3
    if (dernier && q.length >= 2 && w.startsWith(q)) best = Math.max(best, 2)
    else if (q.length >= 5 && w.length >= 5 && boundedEditDistance(q, w, 1) <= 1) best = Math.max(best, 1)
  }
  return best
}

export function searchNotaries(index: NotaryIndex, rawQuery: string): NotaryHit[] {
  const q = words(rawQuery.slice(0, 80))
  if (!q.length || q.join('').length < 2) return []
  const hits: Array<NotaryHit & { sortKey: string }> = []
  for (const e of index.entries) {
    let score = 0
    let ok = true
    for (let i = 0; i < q.length; i++) {
      const m = matchWord(q[i], e.words, i === q.length - 1)
      if (!m) { ok = false; break }
      score += m
    }
    if (ok) hits.push({ ...entree(e), score, sortKey: e.sortKey })
  }
  hits.sort((a, b) => b.score - a.score || a.sortKey.localeCompare(b.sortKey, 'fr'))
  return hits.map((h) => ({ ...entree(h), score: h.score }))
}

const entree = (e: NotaryIndexEntry): NotaryIndexEntry => ({
  id: e.id, name: e.name, printedName: e.printedName, mention: e.mention,
  communeId: e.communeId, communeName: e.communeName, aliases: e.aliases, hasContact: e.hasContact,
})
