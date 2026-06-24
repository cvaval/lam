/**
 * Ancres d'articles (#art-N) — source UNIQUE de normalisation, partagée par le rendu du
 * texte (OfficialText) et l'index thématique (CodeThemeBrowser), pour que les renvois
 * pointent toujours vers la bonne cible. Gère :
 *  - la forme ordinale « Article 1er » / « Article premier » → art-1 ;
 *  - les sous-articles « Article 95 bis » / « 174 ter » → art-95-bis / art-174-ter
 *    (préservés, sinon ils entraient en collision avec l'article de base — audit §14/§15).
 */

/** Numéro d'article du parseur d'index (« 1 », « 1-bis », « 95-bis ») → id d'ancre. */
export function articleAnchorFromNum(num: string): string {
  const m = String(num).trim().toLowerCase().match(/^(\d{1,3}|premier)(?:[-\s]?(bis|ter|quater))?/i)
  if (!m) return `art-${String(num).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const base = m[1] === 'premier' ? '1' : m[1]
  return `art-${base}${m[2] ? '-' + m[2] : ''}`
}

/**
 * Titre d'article (« Article 1er.- … », « Article 95 bis », « Section 12 ») → id d'ancre,
 * ou undefined si la ligne ne commence pas par un en-tête d'article/section reconnu.
 */
export function articleAnchorFromHeading(textLine: string): string | undefined {
  const m = textLine.match(/^(?:article|section)\s+(\d{1,3}|premier)\s*(?:er|ère|re|e|°)?\s*(bis|ter|quater)?\b/i)
  if (!m) return undefined
  const base = m[1].toLowerCase() === 'premier' ? '1' : m[1]
  return `art-${base}${m[2] ? '-' + m[2].toLowerCase() : ''}`
}
