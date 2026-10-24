import type { ReactNode } from 'react'
import { highlightRegex } from '@/lib/search/highlight'

/**
 * Surlignage des termes cherchés dans un texte BRUT rendu en React — le même motif que le texte de
 * l'article (`OfficialText`) et que l'extrait des résultats (`highlightRegex` : synonymes, accents
 * repliés), la même marque `<mark class="hl">` que la navigation entre occurrences sait trouver.
 */
export function surligner(texte: string, re: RegExp | null): ReactNode {
  if (!re) return texte
  const parts = texte.split(re)
  if (parts.length <= 1) return texte
  return parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="hl">{p}</mark> : p))
}

/** Le motif de surlignage des termes, ou null. */
export const motifTermes = (terms?: string[]): RegExp | null => (terms && terms.length ? highlightRegex(terms) : null)

/**
 * Un repli contient-il une occurrence ? — pour l'OUVRIR d'office à l'arrivée depuis une recherche
 * (sinon le document est « trouvé » sans que rien soit visible). Motif non global : pas d'état.
 */
export function contientTerme(textes: Array<string | null | undefined>, terms?: string[]): boolean {
  const re = motifTermes(terms)
  if (!re) return false
  const simple = new RegExp(re.source, 'i')
  return textes.some((t) => Boolean(t) && simple.test(t!))
}
