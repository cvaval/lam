/**
 * Liste des articles d'un texte (pour le sélecteur d'amendement du back-office).
 * Détecte les en-têtes d'article via la source unique d'ancres (src/lib/doc/anchors.ts),
 * dédoublonne et conserve l'ordre du document.
 */
import { articleAnchorFromHeading } from '../doc/anchors'

export interface ArticleRef {
  anchor: string // "art-95-bis"
  label: string // "Article 95 bis"
}

export function labelFromAnchor(anchor: string): string {
  if (!/^art-/.test(anchor)) return anchor
  // « 95-bis » → « 95 bis » (Code) · « 12-1 » → « 12.1 », « 190-ter-5 » → « 190 ter.5 » (Constitution)
  const label = anchor
    .replace(/^art-/, '')
    .replace(/-(bis|ter|quater)/g, ' $1')
    .replace(/-/g, '.')
  return `Article ${label}`
}

export function listArticles(body: string): ArticleRef[] {
  const seen = new Set<string>()
  const out: ArticleRef[] = []
  for (const raw of body.split(/\r?\n/)) {
    const anchor = articleAnchorFromHeading(raw.trim())
    if (!anchor || seen.has(anchor)) continue
    seen.add(anchor)
    out.push({ anchor, label: labelFromAnchor(anchor) })
  }
  return out
}
