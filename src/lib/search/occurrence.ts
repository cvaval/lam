/**
 * Où le terme cherché se trouve-t-il dans le document ? — fonctions PURES (occurrence.test.ts).
 *
 * La recherche ne disait que « ce document contient le terme ». Pour mener le lecteur AU passage
 * (recommandation R3 du 24 oct. 2026, docs/recommandations-recherche-html-pdf.md) :
 *  - la 1ʳᵉ occurrence est localisée dans le corps avec LE MÊME motif que le surlignage
 *    (`highlightRegex` : synonymes et accents repliés) — l'extrait et la page s'accordent ;
 *  - on remonte à l'EN-TÊTE D'ARTICLE qui la précède (la ligne même de l'occurrence comprise) ; son
 *    ancre suit la convention UNIQUE du lecteur (`articleAnchorFromHeading`, `#art-N`) ;
 *  - l'extrait est préfixé de la désignation (« Article 1382 — … ») : le résultat dit OÙ.
 * Sans en-tête (décision de justice, circulaire sans articles) : l'occurrence reste localisée,
 * sans ancre ni désignation.
 */
import { articleAnchorFromHeading } from '../doc/anchors'
import { escapeHtml, highlightRegex, makeSnippet } from './highlight'

export interface Occurrence {
  /** Position de la 1ʳᵉ occurrence dans le texte. */
  index: number
  /** Ancre de l'article qui la contient (`art-1382`), ou null. */
  ancre: string | null
  /** Désignation affichée (« Article 1382 », « Section 3 »), ou null. */
  article: string | null
}

/** « Article 1382.- Tout fait… » → « Article 1382 » ; « Art. 95 bis » → « Article 95 bis » ; sinon null. */
export function designationEntete(ligne: string): string | null {
  const m = ligne
    .trim()
    .match(/^(art(?:icle)?s?\.?|section)\s*((?:premier|\d{1,5}(?:\s*(?:er|ère))?)(?:\s*(?:bis|ter|quater))?(?:[.\-]\d+)*)/i)
  if (!m) return null
  return `${/^section/i.test(m[1]) ? 'Section' : 'Article'} ${m[2].replace(/\s+/g, ' ')}`
}

export function localiserOccurrence(texte: string | null | undefined, termes: string[]): Occurrence | null {
  if (!texte) return null
  const re = highlightRegex(termes)
  if (!re) return null
  re.lastIndex = 0
  const m = re.exec(texte)
  if (!m) return null
  const index = m.index
  // Ligne de l'occurrence, puis les précédentes, jusqu'au premier en-tête d'article.
  let debut = texte.lastIndexOf('\n', index - 1) + 1
  let fin = texte.indexOf('\n', index)
  if (fin < 0) fin = texte.length
  for (;;) {
    const ligne = texte.slice(debut, fin).trimStart()
    const ancre = articleAnchorFromHeading(ligne)
    if (ancre) return { index, ancre, article: designationEntete(ligne) }
    if (debut === 0) return { index, ancre: null, article: null }
    fin = debut - 1
    debut = texte.lastIndexOf('\n', fin - 1) + 1
  }
}

/**
 * Extrait (HTML échappé, termes en `<mark class="hl">`) centré sur la 1ʳᵉ occurrence du CORPS, préfixé
 * de l'article qui la contient ; et l'ancre de cet article. null si le terme n'est pas dans le corps
 * (il peut être dans le titre, le résumé ou les annotations : l'appelant garde alors son extrait).
 */
export function extraitLocalise(texte: string | null | undefined, termes: string[]): { snippet: string; ancre: string | null } | null {
  const o = localiserOccurrence(texte, termes)
  if (!o) return null
  const extrait = makeSnippet(texte!, termes)
  return {
    snippet: o.article ? `<strong class="font-semibold text-ank">${escapeHtml(o.article)}</strong> — ${extrait}` : extrait,
    ancre: o.ancre,
  }
}
