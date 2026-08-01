/**
 * Renvois d'un code à un AUTRE code, dans le corps et les annotations.
 *
 * Le Code civil d'Haïti cite abondamment le Code de procédure civile : 366 renvois
 * relevés (321 dans le corps, 45 dans les annotations), sous onze graphies —
 * « C. p. c. », « C.p. c », « C.p.c. », « Cp. c. », « C. p.c », « C. P. c. »,
 * « C.p. civile »… L'OCR du recueil n'a pas normalisé l'abréviation.
 *
 * Ce module ne connaît NI la locale NI l'identifiant du document cible : il rend
 * des segments typés, et l'appelant fabrique les href. Le texte officiel n'est
 * jamais modifié (§02) — seul le RENDU porte les liens.
 *
 * Deux constructions coexistent dans le recueil :
 *   1. abréviation puis numéros — « C. p. c., 70, 470 », « C. p. c. 124 et s. » ;
 *   2. numéro puis abréviation — « l'art. 921 C. p. c. », « l'art. 930 du C. p. c. ».
 *
 * Faux amis ÉCARTÉS volontairement (vus dans le corpus) :
 *   - « C.P. Cass., 21 décembre 1914 » : « Cass. » n'est pas le troisième terme
 *     de l'abréviation — d'où la sentinelle « pas une lettre après » ;
 *   - « C. pén. » (Code pénal) et « Ci. c. » (Code d'instruction criminelle) ;
 *   - « C. civ. » lui-même, traité à part car ses renvois sont INTERNES.
 */

/**
 * Abréviation du Code de procédure civile.
 *
 * `C` · séparateur · `p` (éventuellement `pr`) · séparateur · `c` / `civ` / `civile`,
 * le tout suivi d'autre chose qu'une lettre. Insensible à la casse : le corpus
 * porte « cp. c. » en bas de casse.
 */
const ABBREV_SRC = String.raw`C\s*\.?\s*p\s*\.?\s*(?:r\s*\.?\s*)?c(?:iv(?:ile)?)?\s*\.?(?![\p{L}])`

/**
 * Une liste de numéros telle que le recueil l'écrit : « 70, 470 », « 124 et s. »,
 * « 258 et s, 989 ».
 *
 * Le pivot de la ponctuation du recueil : le POINT-VIRGULE sépare deux CODES
 * (« C. civ., 51, 88;-C.p. c. 809 »), il ne prolonge jamais la liste d'un même code.
 * L'admettre comme séparateur faisait happer, par-dessus la fin de ligne, le numéro de
 * l'énumération suivante — « C.p. c., 769;⏎3. Qu'il y ait eu procès-verbal… » créait un
 * renvoi à l'article 3 que le recueil n'a jamais écrit (deux cas, notes des art. 1043 et
 * 1675). Seules la virgule et « et » continuent une liste ; elles, en revanche, peuvent
 * franchir une fin de ligne, car l'OCR y coupe volontiers les longues énumérations
 * (46 renvois du Code civil sont dans ce cas).
 */
const H = String.raw`[^\S\n]` // espace horizontal (l'abréviation et son premier numéro restent sur la même ligne)
const NUM_LIST_SRC = String.raw`\d{1,4}(?:\s*(?:[-–]|à)\s*\d{1,4})?(?:\s*,?\s*(?:et\s+)?s\b\.?)?(?:\s*(?:,|et)\s*\d{1,4}(?:\s*(?:[-–]|à)\s*\d{1,4})?(?:\s*,?\s*(?:et\s+)?s\b\.?)?)*`

/**
 * 1. « C. p. c., 70, 470 » — l'abréviation, puis la liste de numéros.
 *
 * Le séparateur admet une SUITE de ponctuation, pas un seul signe : le recueil porte
 * « C. p. c,, 814 » et « C.p. c,, 121, 123 » — l'OCR a lu en virgule le point final de
 * l'abréviation, qui s'ajoute à celle de la liste. N'en accepter qu'un seul faisait
 * perdre 50 renvois. En revanche il ne franchit pas la fin de ligne (`H`).
 */
export const CPC_AFTER_RE = new RegExp(String.raw`(${ABBREV_SRC})((?:${H}|[,;:])*)(${NUM_LIST_SRC})?`, 'giu')

/**
 * 2. Le numéro, puis l'abréviation : « l'art. 921 C. p. c. », « l'art. 930 du C. p. c. ».
 *
 * Le mot « article » est FACULTATIF, parce que le recueil le met en facteur :
 * « Aux termes des arts. 1109 du C. p. c. et 164 du C. p. c. combinés » — le second
 * numéro n'a que sa liaison « du ». D'où la règle : sans le mot « article », il faut
 * un « du » / « de la » ; le contrôle est fait après coup (groupes 1 et 4).
 */
export const CPC_BEFORE_RE = new RegExp(
  String.raw`(?:\b(arts?\.?|articles?)(\s+))?(\d{1,4})(\s*,?\s*(?:du\s+|de\s+la\s+)?)(${ABBREV_SRC})`,
  'giu',
)

/** Segment de rendu : texte brut, abréviation (lien vers le code) ou numéro d'article (lien ancré). */
export type CodeRefSegment =
  | { kind: 'text'; text: string }
  | { kind: 'abbrev'; text: string }
  | { kind: 'article'; text: string; article: number }

/**
 * Découpe `value` en segments, en ne transformant en lien d'article QUE les numéros
 * acceptés par `isArticle` — un renvoi que la cible ne porte pas reste du texte, jamais
 * un lien mort. (Le recueil cite par exemple « C. p. c. 4745 », séquelle d'OCR, et
 * « l'art. 1109 du C. p. c. », au-delà des 997 articles du Code.)
 *
 * Retourne `null` si le texte ne contient aucun renvoi — l'appelant garde alors son
 * rendu habituel sans allocation inutile.
 */
export function segmentCpcRefs(value: string, isArticle: (n: number) => boolean): CodeRefSegment[] | null {
  type Hit = { start: number; end: number; segs: CodeRefSegment[] }
  const hits: Hit[] = []

  // Construction 2 d'abord : elle englobe « art. 921 C. p. c. », dont l'abréviation
  // serait sinon happée par la construction 1 (qui prendrait le numéro SUIVANT).
  CPC_BEFORE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CPC_BEFORE_RE.exec(value))) {
    const [whole, mot, sp1, num, liaison, abbrev] = m
    // Sans le mot « article », seule une liaison « du » / « de la » rattache le numéro
    // à l'abréviation ; « … 1914 C. p. c. » (une date, p. ex.) n'est pas un renvoi.
    if (!mot && !/\bd(?:u|e\s+la)\b/i.test(liaison)) continue
    const n = Number(num)
    hits.push({
      start: m.index,
      end: m.index + whole.length,
      segs: [
        { kind: 'text', text: (mot ?? '') + (sp1 ?? '') },
        isArticle(n) ? { kind: 'article', text: num, article: n } : { kind: 'text', text: num },
        { kind: 'text', text: liaison },
        { kind: 'abbrev', text: abbrev },
      ],
    })
  }

  // Construction 1, en ignorant ce qui chevauche un résultat de la construction 2.
  CPC_AFTER_RE.lastIndex = 0
  while ((m = CPC_AFTER_RE.exec(value))) {
    const start = m.index
    if (hits.some((h) => start < h.end && start + m![0].length > h.start)) continue
    const [whole, abbrev, sep, nums] = m
    const segs: CodeRefSegment[] = [{ kind: 'abbrev', text: abbrev }]
    if (sep) segs.push({ kind: 'text', text: sep })
    if (nums) {
      // On coupe sur les nombres : « 258 et s, 989 » → ['', '258', ' et s, ', '989', '']
      for (const part of nums.split(/(\d+)/)) {
        if (!part) continue
        if (!/^\d+$/.test(part)) {
          segs.push({ kind: 'text', text: part })
          continue
        }
        const n = Number(part)
        segs.push(isArticle(n) ? { kind: 'article', text: part, article: n } : { kind: 'text', text: part })
      }
    }
    hits.push({ start, end: start + whole.length, segs })
  }

  if (!hits.length) return null
  hits.sort((a, b) => a.start - b.start)

  const out: CodeRefSegment[] = []
  let pos = 0
  for (const h of hits) {
    if (h.start < pos) continue // sécurité : jamais deux découpes sur le même intervalle
    if (h.start > pos) out.push({ kind: 'text', text: value.slice(pos, h.start) })
    out.push(...h.segs)
    pos = h.end
  }
  if (pos < value.length) out.push({ kind: 'text', text: value.slice(pos) })
  return out
}

/** Le Code de procédure civile d'Haïti porte les articles 1 à 997, sans trou (mesuré en
 *  base le 31 juillet 2026 : 1 040 ancres, dont les décimaux « 957-1 »…). Le prédicat par
 *  défaut s'appuie sur cette borne ; `scripts/verify-cpc-articles.ts` la revérifie. */
export const CPC_LAST_ARTICLE = 997
export const isCpcArticle = (n: number) => Number.isInteger(n) && n >= 1 && n <= CPC_LAST_ARTICLE
