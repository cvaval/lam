/**
 * Rendu enrichi du texte officiel : tableaux et encadrés colorés reconstruits du
 * RENDU VISUEL du PDF (la couche texte OCR aplatit cellules et couleurs). Produit
 * par l'IA vision (src/lib/ai/extract.ts) ou à la main, stocké en JSON dans
 * Document.richBlocksJson. AFFICHAGE seulement — bodyOriginal reste le texte
 * officiel brut (§02).
 *
 * Sécurité : aucune injection HTML. Les blocs sont des données structurées rendues
 * par React ; les couleurs sont validées (hex strict) avant d'atteindre un style.
 *
 * Pure et déterministe — testé par assertions (npx tsx -e).
 */

export interface RichCell {
  text: string
  header?: boolean
  colSpan?: number
  rowSpan?: number
  /** fond de cellule (hex validé), ex. en-tête ombré */
  bg?: string
  /** couleur du texte (hex validé) */
  color?: string
  align?: 'left' | 'center' | 'right'
  bold?: boolean
}

/**
 * afterText / untilText : extraits VERBATIM (tels qu'ils apparaissent dans
 * bodyOriginal) délimitant la zone que le tableau/encadré remplace. afterText =
 * texte juste AVANT (reste affiché) ; untilText = texte juste APRÈS (reste
 * affiché). La région aplatie par l'OCR entre les deux est retirée du flux et
 * remplacée par le rendu structuré — pas de doublon. Si les ancres ne sont pas
 * retrouvées, le bloc est ajouté en fin de document (sans rien retirer).
 */
export interface RichTable {
  type: 'table'
  /** légende / titre du tableau (ex. « II — Synthèse des gros risques ») */
  caption?: string
  afterText?: string
  untilText?: string
  rows: RichCell[][]
}

export interface RichNote {
  type: 'note'
  text: string
  afterText?: string
  untilText?: string
  bg?: string
  color?: string
}

export type RichBlock = RichTable | RichNote

// ── Validation / nettoyage ────────────────────────────────────────────────────

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g
const DIACRITICS = /[\u0300-\u036F]/g
const MAX_ROWS = 80
const MAX_COLS = 24
const MAX_CELL = 600
const MAX_TEXT = 4000

/** Couleur sûre : hex #rgb/#rrggbb uniquement, sinon undefined (jamais injectée telle quelle). */
export function safeColor(v: unknown): string | undefined {
  return typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toLowerCase() : undefined
}

function clampInt(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === 'number' ? Math.floor(v) : NaN
  if (!Number.isFinite(n) || n <= 1) return undefined
  return Math.min(Math.max(n, min), max)
}

function cleanStr(v: unknown, max: number): string {
  // Retire seulement les caractères de contrôle (garde texte, espaces, ponctuation).
  return typeof v === 'string' ? v.replace(CONTROL_CHARS, '').slice(0, max) : ''
}

function sanitizeCell(raw: unknown): RichCell {
  const c = (raw ?? {}) as Record<string, unknown>
  const align = c.align === 'center' || c.align === 'right' ? c.align : c.align === 'left' ? 'left' : undefined
  return {
    text: cleanStr(c.text, MAX_CELL),
    header: c.header === true || undefined,
    colSpan: clampInt(c.colSpan, 2, MAX_COLS),
    rowSpan: clampInt(c.rowSpan, 2, MAX_ROWS),
    bg: safeColor(c.bg),
    color: safeColor(c.color),
    align,
    bold: c.bold === true || undefined,
  }
}

function sanitizeBlock(raw: unknown): RichBlock | null {
  const b = (raw ?? {}) as Record<string, unknown>
  if (b.type === 'note') {
    const text = cleanStr(b.text, MAX_TEXT)
    if (!text) return null
    return {
      type: 'note',
      text,
      afterText: cleanStr(b.afterText, 160) || undefined,
      untilText: cleanStr(b.untilText, 160) || undefined,
      bg: safeColor(b.bg),
      color: safeColor(b.color),
    }
  }
  if (b.type === 'table') {
    const rowsRaw = Array.isArray(b.rows) ? b.rows.slice(0, MAX_ROWS) : []
    const rows = rowsRaw
      // tolère une ligne [{...}] ou { cells: [{...}] }
      .map((r) => (Array.isArray(r) ? r : (r as { cells?: unknown[] })?.cells))
      .map((r) => (Array.isArray(r) ? (r as unknown[]).slice(0, MAX_COLS).map(sanitizeCell) : []))
      .filter((r) => r.length > 0)
    if (!rows.length) return null
    return {
      type: 'table',
      caption: cleanStr(b.caption, 300) || undefined,
      afterText: cleanStr(b.afterText, 160) || undefined,
      untilText: cleanStr(b.untilText, 160) || undefined,
      rows,
    }
  }
  return null
}

/** Parse + valide le JSON de richBlocksJson. Retourne [] si vide ou invalide. */
export function parseRichBlocks(json: string | null | undefined): RichBlock[] {
  if (!json) return []
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return []
  }
  const arr = Array.isArray(data)
    ? data
    : Array.isArray((data as { blocks?: unknown[] })?.blocks)
      ? (data as { blocks: unknown[] }).blocks
      : []
  return arr.map(sanitizeBlock).filter((b): b is RichBlock => b !== null)
}

// ── Découpage du corps : remplacement de zone ──────────────────────────────────

export type BodySegment = { kind: 'text'; text: string } | { kind: 'rich'; block: RichBlock; orphan?: boolean }

/** Légende courte d'un tableau (caption, sinon 1re cellule d'en-tête, sinon 1re cellule) — AFFICHAGE seul, jamais écrit en base (§02). */
export function tableShortCaption(t: RichTable): string {
  return (t.caption || t.rows[0]?.find((c) => c.header)?.text || t.rows[0]?.[0]?.text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 70)
}

/** Recherche tolérante aux espaces multiples / sauts de ligne de l'OCR. */
function looseIndexOf(hay: string, needle: string, from = 0): { start: number; end: number } | null {
  const i = hay.indexOf(needle, from)
  if (i >= 0) return { start: i, end: i + needle.length }
  // repli : compare en espaces normalisés
  const collapse = (s: string) => s.replace(/\s+/g, ' ').trim()
  const target = collapse(needle)
  if (target.length < 6) return null
  const re = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'), 'i')
  const m = re.exec(hay.slice(from))
  return m ? { start: from + m.index, end: from + m.index + m[0].length } : null
}

/**
 * Construit la séquence d'affichage : segments de texte (rendus tels quels) et
 * blocs enrichis insérés à la place de la zone aplatie qu'ils remplacent
 * (entre afterText et untilText dans bodyOriginal). Les blocs dont les ancres
 * sont introuvables sont ajoutés en fin (sans retirer de texte).
 */
export function buildBodySegments(body: string, rich: RichBlock[]): BodySegment[] {
  if (!rich.length) return [{ kind: 'text', text: body }]

  type Cut = { start: number; end: number; block: RichBlock }
  const cuts: Cut[] = []
  // orphan = le bloc AVAIT une ancre (afterText/untilText) qui n'a PAS été retrouvée
  // → placement par défaut en fin (à signaler), vs bloc volontairement sans ancre.
  const tail: { block: RichBlock; orphan: boolean }[] = []

  for (const b of rich) {
    const hadAnchor = Boolean((b.afterText && b.afterText.length >= 6) || (b.untilText && b.untilText.length >= 6))
    const after = b.afterText && b.afterText.length >= 6 ? looseIndexOf(body, b.afterText) : null
    const until = b.untilText && b.untilText.length >= 6 ? looseIndexOf(body, b.untilText, after ? after.end : 0) : null
    if (after && until && until.start > after.end) cuts.push({ start: after.end, end: until.start, block: b })
    else tail.push({ block: b, orphan: hadAnchor })
  }

  cuts.sort((a, b) => a.start - b.start)
  const clean: Cut[] = []
  let lastEnd = -1
  for (const c of cuts) {
    if (c.start >= lastEnd) {
      clean.push(c)
      lastEnd = c.end
    }
  }

  const segs: BodySegment[] = []
  let pos = 0
  for (const c of clean) {
    if (c.start > pos) segs.push({ kind: 'text', text: body.slice(pos, c.start) })
    segs.push({ kind: 'rich', block: c.block })
    pos = c.end
  }
  if (pos < body.length) segs.push({ kind: 'text', text: body.slice(pos) })
  for (const t of tail) segs.push({ kind: 'rich', block: t.block, orphan: t.orphan })
  return segs
}
