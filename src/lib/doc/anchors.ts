/**
 * Ancres d'articles (#art-N) — source UNIQUE de normalisation, partagée par le rendu du
 * texte (OfficialText/AnnotatedText) et les index/renvois, pour que les liens pointent
 * toujours vers la bonne cible. Gère :
 *  - la forme ordinale « Article 1er » / « Article premier » → art-1 ;
 *  - les sous-articles « Article 95 bis » / « 174 ter » → art-95-bis / art-174-ter ;
 *  - la numérotation CONSTITUTIONNELLE : « Article 12.1 » → art-12-1,
 *    « Article 1er-1 » → art-1-1, « Article 190ter.5 » → art-190-ter-5,
 *    « Article 31.1.1 » → art-31-1-1 (décimales et sous-numéros préservés, anti-collision).
 * Doit rester COHÉRENT avec les parseurs Python (parse_ct.py / parse_const.py).
 */

/** Normalise une désignation d'article (« 1er-1 », « 190ter.5 », « 95 bis ») en id d'ancre. */
export function anchorFromDesignation(desig: string): string {
  let s = String(desig).toLowerCase().trim()
  s = s.replace(/^premier\b/, '1') // « premier » → 1
  s = s.replace(/(\d)\s*(?:er|ère)(?=[\s.\-]|$)/g, '$1') // ordinal : 1er → 1
  s = s.replace(/(\d)\s*(bis|ter|quater)/g, '$1-$2') // 95 bis → 95-bis · 190ter → 190-ter
  s = s
    .replace(/[.\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return `art-${s}`
}

/** Numéro d'article d'un index (« 12 », « 1-bis », « 12.1 ») → id d'ancre. */
export function articleAnchorFromNum(num: string): string {
  const s = String(num).trim()
  if (!s) return 'art-'
  return anchorFromDesignation(s)
}

/**
 * Titre d'article (« Article 1er.- … », « Article 95 bis », « Article 190ter.5 », « Section 12 »,
 * « Art. 2047 » — forme abrégée du Code civil, numéros jusqu'à 4 chiffres)
 * → id d'ancre, ou undefined si la ligne ne commence pas par un en-tête d'article/section reconnu.
 */
export function articleAnchorFromHeading(textLine: string): string | undefined {
  const m = textLine.match(
    /^(?:art(?:icle)?\.?|section)\s+(premier|\d{1,4}(?:\s*(?:er|ère))?(?:\s*(?:bis|ter|quater))?(?:[.\-]\d+)*)/i,
  )
  if (!m) return undefined
  return anchorFromDesignation(m[1])
}
