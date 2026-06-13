import type { BrhSerie } from '../brh/gaps'

/**
 * Liens croisés entre circulaires BRH (affichage de la fiche document).
 *
 * Détecte dans le texte officiel les renvois à d'autres circulaires
 * (« Circulaire n° 93 », « Lettre-Circulaire n° 05 », « circulaire 99-3 ») et
 * les renvois à un article d'une circulaire (« article 5 de la Circulaire 99-3 »,
 * « article 19 de la présente circulaire ») pour en faire des hyperliens vers la
 * fiche cible — ancre #art-N quand un article est cité.
 *
 * Pure et déterministe : la résolution numéro → document vit dans la page (DB).
 * bodyOriginal n'est jamais retouché (§02) ; seul le RENDU porte les liens.
 */

export interface CircRef {
  serie: BrhSerie
  /** numéro de base (0 si « présente circulaire » — cible = document courant) */
  base: number
  rev: number | null
  /** numéro d'article cité, sinon null */
  article: number | null
  /** true pour « (la) présente circulaire » : la cible est le document affiché */
  present: boolean
}

export type TextSegment = { text: string; href?: string }

// « article 5 de la Circulaire 99-3 », « article 19 de la présente circulaire »,
// « article 5, alinéa 2 de la Lettre-Circulaire n° 09-1 »
const ARTICLE_REF =
  /\barticle\s+(\d{1,3})(?:\s*,?\s*(?:alin[ée]as?|al\.?)\s*\d+)?\s+de\s+(?:la\s+|l['’]\s*)?(pr[ée]sente\s+)?(lettre[-\s])?circulaire(?:\s+(?:n[°ºo]?\s*\.?\s*)?(\d{1,3}(?:-\d{1,2})?))?/gi

// « Circulaire n° 93 », « Circulaire No. 72-3 », « circulaire 99-3 », « Lettre-Circulaire n° 05 »
const BARE_REF = /\b(lettre[-\s])?circulaire\s+(?:n[°ºo]?\s*\.?\s*)?(\d{1,3}(?:-\d{1,2})?)\b/gi

/** Numéro composé « 99-3 » → base 99, rév 3 (rév single digit 1-9, sinon null — comme parseCirculaireRef). */
function refKey(numStr: string): { base: number; rev: number | null } {
  const [b, r] = numStr.split('-')
  return { base: Number(b), rev: r && /^[1-9]$/.test(r) ? Number(r) : null }
}

export function scanRefs(text: string): { start: number; end: number; ref: CircRef }[] {
  const hits: { start: number; end: number; ref: CircRef }[] = []
  const consumed: Array<[number, number]> = []

  // 1) Renvois « article N de … » (les plus spécifiques) — consomment leur intervalle.
  for (const m of text.matchAll(ARTICLE_REF)) {
    const present = Boolean(m[2])
    const numStr = m[4]
    if (!present && !numStr) continue // « article 5 de la circulaire » sans cible : ambigu, ignoré
    const serie: BrhSerie = m[3] ? 'LETTRE' : 'CIRCULAIRE'
    const start = m.index ?? 0
    const end = start + m[0].length
    const { base, rev } = present || !numStr ? { base: 0, rev: null } : refKey(numStr)
    hits.push({ start, end, ref: { serie, base, rev, article: Number(m[1]), present } })
    consumed.push([start, end])
  }

  // 2) Renvois nus « Circulaire n° X » — ignorés s'ils chevauchent un renvoi d'article.
  for (const m of text.matchAll(BARE_REF)) {
    const start = m.index ?? 0
    const end = start + m[0].length
    if (consumed.some(([s, e]) => start < e && end > s)) continue
    const serie: BrhSerie = m[1] ? 'LETTRE' : 'CIRCULAIRE'
    const { base, rev } = refKey(m[2])
    hits.push({ start, end, ref: { serie, base, rev, article: null, present: false } })
  }

  return hits.sort((a, b) => a.start - b.start)
}

/**
 * Découpe un texte en segments, liant les renvois résolus par hrefFor.
 * hrefFor renvoie une URL (lien posé) ou null (renvoi laissé en texte brut —
 * cible absente du corpus).
 */
export function segmentText(text: string, hrefFor: (ref: CircRef) => string | null): TextSegment[] {
  const hits = scanRefs(text)
  if (!hits.length) return [{ text }]
  const segs: TextSegment[] = []
  let pos = 0
  for (const h of hits) {
    if (h.start < pos) continue // garde-fou : chevauchement résiduel
    if (h.start > pos) segs.push({ text: text.slice(pos, h.start) })
    const href = hrefFor(h.ref)
    segs.push(href ? { text: text.slice(h.start, h.end), href } : { text: text.slice(h.start, h.end) })
    pos = h.end
  }
  if (pos < text.length) segs.push({ text: text.slice(pos) })
  return segs
}
