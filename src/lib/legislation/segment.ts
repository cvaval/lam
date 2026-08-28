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

/**
 * Découpe le corps en segments : préambule + un segment par article (à sa tête).
 *
 * `isBoundary` (optionnel) marque les lignes d'EN-TÊTE DE SECTION (libellés du sommaire des
 * textes annotés) : elles CLÔTURENT l'article courant et restent hors-article. Sans cette
 * borne, le segment du dernier article d'un chapitre engloutirait l'en-tête suivant — et un
 * overlay d'amendement le FERAIT DISPARAÎTRE du corps affiché (sommaire désappareillé).
 */
export function splitArticles(body: string, isBoundary?: (line: string) => boolean): Seg[] {
  const segs: Seg[] = []
  let cur: Seg = { anchor: null, lines: [] }
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (isBoundary?.(line)) {
      segs.push(cur)
      cur = { anchor: null, lines: [raw] }
      continue
    }
    const anchor = articleAnchorFromHeading(line)
    if (anchor) {
      segs.push(cur)
      cur = { anchor, lines: [raw] }
    } else cur.lines.push(raw)
  }
  segs.push(cur)
  return segs
}

/** Renvoie le corps où les articles amendés portent leur texte EN_VIGUEUR. */
export function applyAmendments(body: string, amendments: Map<string, ArticleOverlay>, isBoundary?: (line: string) => boolean): string {
  if (amendments.size === 0) return body
  // Une ancre peut apparaître PLUSIEURS fois (lois/annexes renumérotant depuis l'art. 1) :
  // on n'applique l'overlay qu'à la 1ʳᵉ occurrence — comme l'ancre #art-N du lecteur — sinon
  // amender « Article 2 » du Code écraserait tous les « Article 2 » des textes annexés (audit).
  const seen = new Set<string>()
  // Si la 1ʳᵉ ligne du corps est un en-tête de section, le segment initial est VIDE :
  // on l'écarte, sinon le corps effectif s'ouvre sur un saut de ligne et le lecteur
  // émet un premier bloc vide (constat d'audit, Code de commerce).
  const segs = splitArticles(body, isBoundary)
  if (segs.length && segs[0].anchor == null && segs[0].lines.length === 0) segs.shift()
  return segs
    .map((s) => {
      const first = s.anchor != null && !seen.has(s.anchor)
      if (s.anchor != null) seen.add(s.anchor)
      const ov = first ? amendments.get(s.anchor!) : undefined
      if (!s.anchor || !ov) return s.lines.join('\n')
      // ⚠️ UN ARTICLE SEULEMENT AJOUTÉ NE SE REMPLACE PAS. Sa rédaction est DÉJÀ dans le
      // corps, à son rang : la ligne d'overlay ne sert qu'à porter la pastille « Ajout — … »
      // du lecteur. Le segment sort tel quel.
      if (ov.added && !ov.inForce && !ov.abrogated) return s.lines.join('\n')
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
