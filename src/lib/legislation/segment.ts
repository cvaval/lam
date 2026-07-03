/**
 * Construction du « corps en vigueur » d'un texte amendé : on remplace, dans le texte
 * affiché, le contenu de chaque article amendé par sa version EN_VIGUEUR (et on réduit
 * un article abrogé à une ligne). bodyOriginal reste canonique en base (§02) — ceci est
 * une transformation d'AFFICHAGE. Les anciennes versions restent lisibles via
 * AmendmentHistory (getAmendments). Cf. docs/architecture-legislation-themes.md §9.
 */
import { articleAnchorFromHeading } from '../doc/anchors'
import { labelFromAnchor } from './articles'
import type { ArticleOverlay } from './amendments'

interface Seg {
  anchor: string | null // null = préambule / hors-article
  lines: string[]
}

/** Découpe le corps en segments : préambule + un segment par article (à sa tête). */
export function splitArticles(body: string): Seg[] {
  const segs: Seg[] = []
  let cur: Seg = { anchor: null, lines: [] }
  for (const raw of body.split(/\r?\n/)) {
    const anchor = articleAnchorFromHeading(raw.trim())
    if (anchor) {
      segs.push(cur)
      cur = { anchor, lines: [raw] }
    } else cur.lines.push(raw)
  }
  segs.push(cur)
  return segs
}

/** Renvoie le corps où les articles amendés portent leur texte EN_VIGUEUR. */
export function applyAmendments(body: string, amendments: Map<string, ArticleOverlay>): string {
  if (amendments.size === 0) return body
  // Une ancre peut apparaître PLUSIEURS fois (lois/annexes renumérotant depuis l'art. 1) :
  // on n'applique l'overlay qu'à la 1ʳᵉ occurrence — comme l'ancre #art-N du lecteur — sinon
  // amender « Article 2 » du Code écraserait tous les « Article 2 » des textes annexés (audit).
  const seen = new Set<string>()
  return splitArticles(body)
    .map((s) => {
      const first = s.anchor != null && !seen.has(s.anchor)
      if (s.anchor != null) seen.add(s.anchor)
      const ov = first ? amendments.get(s.anchor!) : undefined
      if (!s.anchor || !ov) return s.lines.join('\n')
      const label = ov.label ?? labelFromAnchor(s.anchor)
      if (ov.abrogated) {
        const by = ov.history.find((v) => v.status === 'ABROGE')?.amendedByNumber
        return `${label}.- [Abrogé${by ? ' — ' + by : ''}]`
      }
      if (ov.inForce) {
        const txt = ov.inForce.body.trim()
        const prefix = /^(article|art)\b/i.test(txt) ? '' : `${label}.- `
        return prefix + txt
      }
      return s.lines.join('\n')
    })
    .join('\n')
}
