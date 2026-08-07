/**
 * Grammaire PROPOSÉE pour la clé 'cic', éprouvée :
 *  1. sur le corpus entier (rappel + faux positifs, occurrence par occurrence) ;
 *  2. sur des témoins positifs et négatifs écrits à la main ;
 *  3. contre les grammaires voisines (cpc, cp) et contre CIV_RE d'OfficialText.
 */
import { corpus, ctx } from './lib'
import { readFileSync } from 'node:fs'
const DIR = '/private/tmp/claude-501/-Users-cvaval-Library-CloudStorage-Dropbox-Lam-Veritab/b86c8ab9-626b-4ed6-9e9c-f6e8779c5980/scratchpad/cic'

/* ───────────────────────── 1. Les articles que le Code porte réellement ───────────────────────── */
type P = { t: string; style: string }
const J: P[] = JSON.parse(readFileSync(`${DIR}/texte.json`, 'utf8'))
const TETE = /^\s*(?:Art(?:icle)?s?)\.?\s*(\d{1,4})(?:\s*(?:er|ers|bis|ter))?\s*(?:\.|-|\.-|—|:)/i
const B1929 = 594, F1929 = 599 // ¶594 en-tête, ¶599 « LOI No. 5 » (mesuré : ruptures 313→2 puis 2→314)
const B1979 = 604, F1979 = 658 // ¶604 en-tête, ¶658 « Article 315 » (mesuré : ruptures 314→1 puis 24→315)
const dorsale = new Set<number>()
for (let i = 0; i < J.length; i++) {
  if ((i >= B1929 && i < F1929) || (i >= B1979 && i < F1979)) continue
  const m = TETE.exec(J[i].t)
  if (m) dorsale.add(Number(m[1]))
}
const MAX = Math.max(...dorsale)
const ABSENTS = [...Array(MAX).keys()].map((n) => n + 1).filter((n) => !dorsale.has(n))
console.log(`ARTICLES DU C.i.c. : ${dorsale.size} numéros, 1..${MAX}, absents = ${JSON.stringify(ABSENTS)}`)
const isCicArticle = (n: number) => Number.isInteger(n) && n >= 1 && n <= MAX && !ABSENTS.includes(n)

/* ───────────────────────── 2. La grammaire proposée ───────────────────────── */

/**
 * Abréviation du Code d'instruction criminelle.
 *
 * `C` · séparateur · `i` · séparateur · `c`, avec AU MOINS UN POINT dans l'ensemble.
 * Le corpus n'en connaît que deux graphies — « C. i. c. » (Code civil, 26×) et
 * « C.I.C. » (Code de procédure civile + son appendice, 3×) — mais la règle admet
 * l'espacement libre de l'OCR.
 *
 * SENTINELLES (chacune payée par un faux positif mesuré) :
 *  a) `(?<![\p{L}\d\-–'’])` — « celui-ci. C. civ., 1767 » : sans l'exclusion du trait
 *     d'union, « ci. C » est lu comme le sigle et vole au Code CIVIL son renvoi.
 *  b) `(?![\s.]*[\p{L}])` — même famille : le troisième terme ne peut être suivi d'une
 *     lettre. « ci. C. civ. » est rejeté deux fois plutôt qu'une.
 *  c) au moins un `.` — sans quoi « CIC » (société « Coles Immobilier Construction »),
 *     « CLC », « Cic(éron) », « CI CÔTE D'IVOIRE » (codes pays des circulaires BRH) et
 *     les colonnes ravagées des lois de finances entrent : 26 faux positifs mesurés.
 *  d) `[il1íÍ]` au milieu : la confusion i/l/1 de l'OCR est admise — mais la sentinelle
 *     (c) suffit à écarter « CL C », « Cl c ».
 */
const CIC_ABBREV_SRC = String.raw`(?<![\p{L}\d\-–'’])C(?=[^\p{L}\d]{0,4}[il1íÍ])[\s.,;:]{0,4}[il1íÍ][\s.,;:]{0,4}c\s*\.(?![\s.]*[\p{L}])`
// Le point FINAL est exigé (les deux graphies du corpus l'ont) ; le point médian est
// facultatif, mais le `.` final assure à lui seul la sentinelle (c).

const H = String.raw`[^\S\n]`
const NUM_LIST_SRC = String.raw`\d{1,4}(?:\s*(?:[-–]|à)\s*\d{1,4})?(?:\s*,?\s*(?:et\s+)?s\b\.?)?(?:\s*(?:,|et)\s*\d{1,4}(?:\s*(?:[-–]|à)\s*\d{1,4})?(?:\s*,?\s*(?:et\s+)?s\b\.?)?)*`

const CIC_AFTER_RE = new RegExp(String.raw`(${CIC_ABBREV_SRC})((?:${H}|[,;:])*)(${NUM_LIST_SRC})?`, 'giu')
const CIC_BEFORE_RE = new RegExp(
  String.raw`(?:\b(arts?\.?|articles?)(\s+))?(\d{1,4})(\s*,?\s*(?:du\s+|de\s+la\s+)?)(${CIC_ABBREV_SRC})`,
  'giu',
)

/* Les grammaires voisines, copiées telles quelles depuis src/lib/doc/coderefs.ts */
const ABBREV_CPC = String.raw`C\s*\.?\s*p\s*\.?\s*(?:r\s*\.?\s*)?c(?:iv(?:ile)?)?\s*\.?(?![\p{L}])`
const ABBREV_CP = String.raw`C\s*\.?\s*p[ée]n(?:al)?\s*\.?(?![\p{L}])`
const CPC_AFTER_RE = new RegExp(String.raw`(${ABBREV_CPC})((?:${H}|[,;:])*)(${NUM_LIST_SRC})?`, 'giu')
const CP_AFTER_RE = new RegExp(String.raw`(${ABBREV_CP})((?:${H}|[,;:])*)(${NUM_LIST_SRC})?`, 'giu')
/* CIV_RE, copié tel quel depuis src/components/OfficialText.tsx (ligne 33) */
const CIV_RE =
  /(?<!\bproc[\wé]*\.\s{0,2})(?<!\bpr?\.\s{0,2})(?<![\w.])(?:C\.\s?)?civ\.[\s,]*((?:\d{1,6}(?:\s*(?:[-–]|à)\s*\d{1,6})?(?:\s+(?:et\s+)?s\b\.?)?)(?:\s*(?:,|;|et)\s*\d{1,6}(?:\s*(?:[-–]|à)\s*\d{1,6})?(?:\s+(?:et\s+)?s\b\.?)?)*)/gi

/* ───────────────────────── 3. Épreuve sur le CORPUS ───────────────────────── */
console.log('\n\n===== ÉPREUVE SUR LE CORPUS (29 227 documents) =====')
const C = corpus()
let nApres = 0, nAvant = 0
const numsCites: number[] = []
const horsBornes: string[] = []
console.log('\n--- CIC_AFTER_RE : toutes les correspondances')
for (const { doc, champ, texte } of C) {
  const r = new RegExp(CIC_AFTER_RE.source, CIC_AFTER_RE.flags)
  let m: RegExpExecArray | null
  while ((m = r.exec(texte))) {
    nApres++
    const nums = (m[3] ?? '').match(/\d{1,4}/g) ?? []
    nums.forEach((n) => { numsCites.push(Number(n)); if (!isCicArticle(Number(n))) horsBornes.push(`${n} (${doc.source}|${champ})`) })
    console.log(` ${String(nApres).padStart(3)}. [${doc.source ?? doc.type}|${champ}] «${m[0].replace(/\s+/g, ' ')}» → ${JSON.stringify(nums)}`)
  }
}
console.log('\n--- CIC_BEFORE_RE : toutes les correspondances (numéro AVANT le sigle)')
for (const { doc, champ, texte } of C) {
  const r = new RegExp(CIC_BEFORE_RE.source, CIC_BEFORE_RE.flags)
  let m: RegExpExecArray | null
  while ((m = r.exec(texte))) {
    const [, mot, , num, liaison] = m
    if (!mot && !/\bd(?:u|e\s+la)\b/i.test(liaison)) { console.log(`      (écarté, pas de « du » ni « article ») «${m[0].replace(/\s+/g, ' ')}»`); continue }
    nAvant++
    numsCites.push(Number(num))
    if (!isCicArticle(Number(num))) horsBornes.push(`${num} (${doc.source}|${champ})`)
    console.log(` ${String(nAvant).padStart(3)}. [${doc.source ?? doc.type}|${champ}] «${m[0].replace(/\s+/g, ' ')}»  ${ctx(texte, m.index, m[0].length, 35)}`)
  }
}
console.log(`\nTOTAL : ${nApres} (construction 1) + ${nAvant} (construction 2)`)
const uniq = [...new Set(numsCites)].sort((a, b) => a - b)
console.log(`NUMÉROS CITÉS (${numsCites.length} occurrences, ${uniq.length} distincts) : ${JSON.stringify(uniq)}`)
console.log(`HORS des articles réels du Code : ${horsBornes.length} → ${JSON.stringify(horsBornes)}`)

/* ───────────────────────── 4. Témoins positifs et négatifs ───────────────────────── */
console.log('\n\n===== TÉMOINS =====')
const POSITIFS: [string, number[]][] = [
  ['République.- C. i. c., 5, 7. Art. 6', [5, 7]],
  ['C. p. c. 215 et s;- C. i. c. 350 et s; C. pén., 107 et s', [350]],
  ['C. civ., 595, 596, 598 ;- C. i. c. 256-40.', [256]], // « 256-40 » : voir la note ci-dessous
  ['- C. i. c., 34; C. pén., 13, 304.', [34]],
  ['C. civ., 1829.- C. i. c., 67, 102, 139.- C. pén., 54', [67, 102, 139]],
  ['Il résulte des articles 448 C.P.C. et 443 C.I.C. que la communication', [443]],
  ['non une abrogation de l’art. 3 du C.I.C. auquel elle', [3]],
  ['en conformité de l’article 181 C.I.C. ; Ordonner', [181]],
  ['c. i. c., 12', [12]], // casse indifférente
  ['C.i.c., 12', [12]],   // point médian sans espace (non attesté, mais admis)
  ['C. l. c., 12', [12]], // confusion OCR i→l (non attestée, mais admise)
]
const NEGATIFS: string[] = [
  'notifiée à celui-ci. C. civ., 1767, 1768, 1769.',        // ⚠ le piège CIV_RE
  'pour l\'intérêt de celui-ci. C. civ., 926, 1159.',
  'et le contrôle exercé sur celles-ci ; c) Communiquer',
  'conservés dans celle-ci.\n\nc) Fonds propres',
  '"Coles Immobilier Construction, S.A." (CIC) - Acte constitutif',
  '"CLC Insurance Company S.A. / CLC S.A."',
  'Marcille Hector, Cicéron Jean-Jacques',
  'CR COSTA RICA BY BELARUS CI CÔTE D\'IVOIRE BE BELGIQUE',
  'CENTRAFRICAINE, RÉPUBLIQUE AQ ANTARCTIQUE CL CHILI',
  'BUDGET GENERAL DE L\' EXERCICE FISCAL 2025-2026',
  'C. civ., 969, 1102 et s.',                               // Code civil
  'C. p. c., 70, 470',                                      // Code de procédure civile
  'C. pén., 107 et s, 192 et s.',                           // Code pénal
  'C.P. Cass., 21 décembre 1914',                           // faux ami documenté du C.p.c.
  'C. com., 632',                                           // Code de commerce
  'l\'article 12 C. i. cr.',                                // graphie non retenue (aucune occurrence)
]
function tire(re: RegExp, s: string) {
  const r = new RegExp(re.source, re.flags); const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = r.exec(s))) out.push(m[0].replace(/\s+/g, ' '))
  return out
}
let ko = 0
console.log('\n-- POSITIFS (le sigle doit être reconnu, avec les bons numéros)')
for (const [s, attendus] of POSITIFS) {
  const a = tire(CIC_AFTER_RE, s), b = tire(CIC_BEFORE_RE, s)
  const nums = [...a, ...b].join(' ').match(/\d{1,4}/g)?.map(Number) ?? []
  const ok = a.length + b.length > 0 && attendus.every((n) => nums.includes(n))
  if (!ok) ko++
  console.log(`  ${ok ? 'OK ' : 'ÉCHEC'} «${s.slice(0, 62)}» → après=${JSON.stringify(a)} avant=${JSON.stringify(b)}`)
}
console.log('\n-- NÉGATIFS (aucune correspondance ne doit sortir)')
for (const s of NEGATIFS) {
  const a = tire(CIC_AFTER_RE, s), b = tire(CIC_BEFORE_RE, s).filter((x) => /\bd(?:u|e la)\b|\barts?\b|\barticles?\b/i.test(x))
  const ok = a.length === 0 && b.length === 0
  if (!ok) ko++
  console.log(`  ${ok ? 'OK ' : 'ÉCHEC'} «${s.replace(/\n/g, '⏎').slice(0, 62)}» → après=${JSON.stringify(a)} avant=${JSON.stringify(b)}`)
}

/* ───────────────────────── 5. Non-interférence avec les grammaires voisines ───────────────────────── */
console.log('\n\n===== NON-INTERFÉRENCE =====')
const CROISE = [
  'C. civ., 1168.- C. p. c. 215 et s;- C. i. c. 350 et s; C. pén., 107 et s, 192 et s.',
  'notifiée à celui-ci. C. civ., 1767, 1768, 1769.',
  'C. civ., 55, 184;- C. p. c. 809 et s; C. i. c., 3.',
  'C. p. c., 124 et s, 149 et s, 160. – C. i. c., 350 et s. – C. pén., 107 et s.',
]
for (const s of CROISE) {
  console.log(`\n «${s}»`)
  console.log(`   cic  → ${JSON.stringify(tire(CIC_AFTER_RE, s))}`)
  console.log(`   cpc  → ${JSON.stringify(tire(CPC_AFTER_RE, s))}`)
  console.log(`   cp   → ${JSON.stringify(tire(CP_AFTER_RE, s))}`)
  console.log(`   CIV_RE → ${JSON.stringify(tire(CIV_RE, s))}`)
}
console.log(`\n\nBILAN DES TÉMOINS : ${ko} échec(s)`)
