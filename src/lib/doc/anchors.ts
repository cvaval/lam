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
  // ⚠️ CINQ CHIFFRES, PAS QUATRE. Le Décret régissant l'insolvabilité numérote le Livre III du
  // Code de commerce en composé — Livre · Titre · Chapitre · Section · rang — et sa section 10
  // porte le total à cinq : « Article 33410-1.- Les tiers, créanciers ou non… ». À quatre
  // chiffres, la tête produisait `art-3341` quand `anchorFromDesignation('33410-1')`, que suit
  // l'index, produit `art-33410-1` : le renvoi mourait et l'article devenait introuvable.
  //
  // Innocuité MESURÉE sur toute la base — 31 301 documents, 78 312 têtes d'article reconnues :
  // l'élargissement ne change AUCUNE ancre existante.
  const m = textLine.match(
    /^(?:art(?:icle)?\.?|section)\s+(premier|\d{1,5}(?:\s*(?:er|ère))?(?:\s*(?:bis|ter|quater))?(?:[.\-]\d+)*)/i,
  )
  if (m) return anchorFromDesignation(m[1])
  // Forme PLURIELLE « Articles 27.- » : coquille du Journal officiel (Décret minier,
  // Spécial N° 16 du 30 mars 2026, p. 12) conservée VERBATIM dans le corps. Tolérée
  // UNIQUEMENT avec la ponctuation de tête « .- » — une citation en début de ligne
  // (« Articles 185 à 188 », « Articles 137, 138… ») ne devient jamais une tête.
  const p = textLine.match(/^articles\s+(\d{1,4}(?:[.\-]\d+)*)\.-/i)
  if (p) return anchorFromDesignation(p[1])
  return undefined
}
