import mammoth from 'mammoth'
import type { RichBlock, RichCell } from './richblocks'

/**
 * Conversion d'un document Word (.docx) en « version HTML » du corpus :
 *  - bodyClean : texte propre (titres, paragraphes, listes à puces) — rendu tel quel ;
 *  - richBlocks : les TABLEAUX du Word, convertis en RichTable (rendus en HTML par React).
 *
 * Déterministe (aucune IA) : on lit le HTML produit par mammoth et on le transforme
 * fidèlement — le texte n'est jamais réécrit, seulement remis en forme. Les tableaux
 * sont ancrés (afterText) juste après le texte qui les précède, sinon ajoutés en fin.
 */

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
}

/** HTML d'une cellule → texte plat (gras conservé en métadonnée). */
function cellText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function parseTable(tableHtml: string): RichBlock | null {
  const rows: RichCell[][] = []
  for (const rowM of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: RichCell[] = []
    for (const cellM of rowM[1].matchAll(/<(t[dh])\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const header = cellM[1].toLowerCase() === 'th'
      const bold = /<(strong|b)\b/i.test(cellM[2]) || undefined
      cells.push({ text: cellText(cellM[2]), header: header || undefined, bold })
    }
    if (cells.length) rows.push(cells)
  }
  if (!rows.length) return null
  // Tableau dégénéré à 1 colonne (liste enveloppée dans un tableau Word) → pas un vrai
  // tableau : on le laisse rejoindre le texte (null) plutôt que de le rendre en grille.
  if (Math.max(...rows.map((r) => r.length)) < 2) return null
  // Première ligne en en-tête si aucune cellule <th> explicite (présentation par défaut).
  if (!rows[0].some((c) => c.header)) rows[0] = rows[0].map((c) => ({ ...c, header: true }))
  return { type: 'table', rows }
}

/** Bloc HTML hors-tableau → lignes de texte propres (puces, titres, paragraphes). */
function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<li\b[^>]*>/gi, '\n• ')
      .replace(/<\/(p|div|h[1-6]|tr|ul|ol)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export interface WordVersion {
  bodyClean: string
  richBlocks: RichBlock[]
  warnings: string[]
}

export async function wordToHtmlVersion(buffer: Buffer): Promise<WordVersion> {
  const { value: html, messages } = await mammoth.convertToHtml({ buffer })
  const richBlocks: RichBlock[] = []

  // Extrait chaque <table> ; remplace par un texte d'ancrage pour le placement.
  const parts: string[] = []
  let last = 0
  for (const m of html.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    const before = html.slice(last, m.index)
    parts.push(before)
    last = m.index! + m[0].length
    const tbl = parseTable(m[0])
    if (tbl) {
      // Ancre : derniers mots du texte qui précède (rendu du tableau à sa place).
      const beforeText = htmlToText(before)
      const anchor = beforeText.split('\n').filter(Boolean).pop()?.slice(-60)
      richBlocks.push(anchor && anchor.length >= 6 ? { ...tbl, afterText: anchor } : tbl)
    } else {
      // Tableau dégénéré (≤1 colonne) : son contenu reste dans le texte (pas perdu).
      parts.push('\n' + htmlToText(m[0]) + '\n')
    }
  }
  parts.push(html.slice(last))

  const bodyClean = htmlToText(parts.join('\n'))
  return { bodyClean, richBlocks, warnings: messages.map((m) => m.message).slice(0, 10) }
}
