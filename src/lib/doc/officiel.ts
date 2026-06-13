/**
 * Mise en forme D'AFFICHAGE du texte officiel (fiche document).
 *
 * Le texte officiel n'est JAMAIS retouché en base (§02) : bodyOriginal reste la
 * source brute (export scellé, recherche, éditeur du CMS). Ce module structure
 * uniquement le RENDU à partir des artefacts de l'OCR du corpus importé :
 *  - puces (« ß », « • », « - »…) → vraies listes à puces ;
 *  - numérotations (« 1- », « 1. », « 4.0 », « a) »…) → listes numérotées, en
 *    conservant le marqueur ORIGINAL tel quel (jamais renuméroté) ;
 *  - lignes coupées en milieu de phrase (retours à la ligne durs de l'OCR : la
 *    suite commence en minuscule) → paragraphes recousus ;
 *  - lignes courtes sans ponctuation finale (termes définis, en-têtes) → intertitres.
 *
 * Pure et déterministe — testée par assertions (npx tsx -e).
 */

export type OfficialBlock =
  | { kind: 'p'; text: string; heading: boolean }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: { marker: string; text: string }[] }

// Puces : symboles usuels + artefacts OCR fréquents du corpus BRH (ß, , ).
const BULLET_RE = /^([•·▪‣◦●ß*]|[-–—])\s+(.+)$/
// Numérotations : « 1. », « 2) », « 1- », « (3) », « 4.0 », « 2.1.3 », « a) », « b. »
const NUMBER_RE = /^(\(?\d{1,3}\)|\d{1,3}(?:\.\d{1,3})+\.?|\d{1,3}\s?[-–]|\d{1,3}[.)°]|[a-z][.)])\s+(.+)$/i

/** Ligne « numéro de page » isolée par l'OCR (1 à 3 chiffres, rien d'autre). */
function isPageNumber(line: string): boolean {
  return /^\d{1,3}$/.test(line)
}

/** Suite d'une ligne coupée par l'OCR : reprend en minuscule (ou ponctuation ouvrante). */
function isContinuation(line: string): boolean {
  return /^[a-zà-öø-ÿ(«"']/.test(line)
}

/** Intertitre : ligne courte d'origine, sans ponctuation de fin de phrase. */
function isHeading(line: string): boolean {
  return line.length <= 64 && !/[.,;:!?]$/.test(line)
}

export function parseOfficialText(raw: string): OfficialBlock[] {
  const blocks: OfficialBlock[] = []
  // Bloc paragraphe en cours : on mémorise s'il est resté une seule ligne (→ intertitre).
  let para: { text: string; single: boolean } | null = null

  function flushPara() {
    if (!para) return
    blocks.push({ kind: 'p', text: para.text, heading: para.single && isHeading(para.text) })
    para = null
  }

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.replace(/\s+/g, ' ').trim()
    if (!line) {
      flushPara()
      continue
    }

    const bullet = line.match(BULLET_RE)
    if (bullet) {
      flushPara()
      const last = blocks[blocks.length - 1]
      if (last?.kind === 'ul') last.items.push(bullet[2])
      else blocks.push({ kind: 'ul', items: [bullet[2]] })
      continue
    }

    const numbered = line.match(NUMBER_RE)
    if (numbered) {
      flushPara()
      const item = { marker: numbered[1].replace(/\s+/g, ''), text: numbered[2] }
      const last = blocks[blocks.length - 1]
      if (last?.kind === 'ol') last.items.push(item)
      else blocks.push({ kind: 'ol', items: [item] })
      continue
    }

    if (isContinuation(line)) {
      // Recoud la ligne à l'unité ouverte (paragraphe ou dernier élément de liste) —
      // sauf après un numéro de page isolé, qui n'est la suite de rien.
      if (para && !isPageNumber(para.text)) {
        para = { text: `${para.text} ${line}`, single: false }
        continue
      }
      const last = blocks[blocks.length - 1]
      if (!para && last?.kind === 'ul') {
        last.items[last.items.length - 1] += ` ${line}`
        continue
      }
      if (!para && last?.kind === 'ol') {
        last.items[last.items.length - 1].text += ` ${line}`
        continue
      }
    }

    flushPara()
    para = { text: line, single: true }
  }
  flushPara()
  return blocks
}
