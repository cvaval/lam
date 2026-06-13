/**
 * Génération des ANNEXES téléchargeables d'une circulaire BRH.
 *
 * Les annexes sont les tableaux structurés (et encadrés associés) reconstruits
 * dans Document.richBlocksJson (src/lib/doc/richblocks.ts) :
 *   • formulaires / tableaux à compléter → Word (.docx)
 *   • tableaux de données                → Excel (.xlsx)
 *
 * Chaque fichier porte le filigrane (logo Lam, public/brand/Lam_Watermark.png)
 * et, en pied de page, la mention légale : le fichier a été téléchargé depuis
 * Lam et l'utilisateur a l'obligation de vérifier l'exactitude des informations.
 *
 * AFFICHAGE seulement : bodyOriginal reste le texte officiel (§02). On ne
 * télécharge QUE les annexes (tableaux + encadrés), pas le corps de la circulaire.
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HorizontalPositionAlign,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TextWrappingType,
  VerticalAlign,
  VerticalPositionAlign,
  VerticalPositionRelativeFrom,
  WidthType,
} from 'docx'
import ExcelJS from 'exceljs'
import type { RichBlock, RichCell, RichNote, RichTable } from '@/lib/doc/richblocks'
import { BRAND } from '@/lib/brand'
import { BRAND_COLORS } from '@/lib/brand-colors'
import { formatDate } from '@/lib/i18n/format'
import type { Locale } from '@/lib/types'

const LANK = BRAND_COLORS.lank.replace('#', '') // 1C1B3A
const SITWON = BRAND_COLORS.sitwon.replace('#', '') // BEF264
const HEADER_FILL = 'E8E7F0' // lank très clair pour les en-têtes sans couleur propre

/** Couleur hex 6 chiffres (sans #) pour docx/exceljs ; sinon `fallback`. */
function hx(v: string | undefined, fallback?: string): string | undefined {
  if (typeof v === 'string') {
    const m = v.trim().replace('#', '')
    if (/^[0-9a-fA-F]{6}$/.test(m)) return m.toUpperCase()
    if (/^[0-9a-fA-F]{3}$/.test(m)) return m.split('').map((c) => c + c).join('').toUpperCase()
  }
  return fallback
}

export interface AnnexeInput {
  number?: string | null
  titleFr: string
  rich: RichBlock[]
  /** identité du téléchargeur — tatouée dans le pied de page (traçabilité). */
  downloaderEmail: string
  locale: Locale
}

/** Y a-t-il au moins un tableau annexable ? (le bouton n'apparaît que si oui) */
export function hasAnnexes(rich: RichBlock[]): boolean {
  return rich.some((b) => b.type === 'table')
}

/** Mention légale de pied de page, par langue. */
function disclaimer(locale: Locale): { line1: string; line2: string } {
  if (locale === 'en') {
    return {
      line1: 'This file was downloaded from Lam.',
      line2: 'The user is required to verify and ensure the accuracy of the information it contains.',
    }
  }
  if (locale === 'ht') {
    return {
      line1: 'Fichye sa a te telechaje sou Lam.',
      line2: "Itilizatè a gen obligasyon pou l verifye e asire l de egzaktitid enfòmasyon ki ladan l.",
    }
  }
  return {
    line1: 'Ce fichier a été téléchargé depuis Lam.',
    line2: "L'utilisateur a l'obligation de vérifier et de s'assurer de l'exactitude des informations qu'il contient.",
  }
}

let _watermark: Buffer | null = null
/** Filigrane (logo Lam déjà aminci à ~10 % d'opacité). Lu une fois par process. */
function watermarkPng(): Buffer {
  if (!_watermark) {
    _watermark = fs.readFileSync(path.join(process.cwd(), 'public', 'brand', 'Lam_Watermark.png'))
  }
  return _watermark
}

function annexeLabel(locale: Locale, n: number): string {
  if (locale === 'en') return `Annex ${n}`
  if (locale === 'ht') return `Anèks ${n}`
  return `Annexe ${n}`
}

// ── Word (.docx) ────────────────────────────────────────────────────────────

function docAlign(a: RichCell['align']): (typeof AlignmentType)[keyof typeof AlignmentType] {
  if (a === 'center') return AlignmentType.CENTER
  if (a === 'right') return AlignmentType.RIGHT
  return AlignmentType.LEFT
}

function docCell(cell: RichCell): TableCell {
  const isHeader = cell.header === true
  const fill = hx(cell.bg, isHeader ? HEADER_FILL : undefined)
  const textColor = hx(cell.color, isHeader ? LANK : '1A1F29')
  return new TableCell({
    columnSpan: cell.colSpan,
    rowSpan: cell.rowSpan,
    verticalAlign: VerticalAlign.CENTER,
    shading: fill ? { type: ShadingType.CLEAR, color: 'auto', fill } : undefined,
    margins: { top: 40, bottom: 40, left: 90, right: 90 },
    children: [
      new Paragraph({
        alignment: docAlign(cell.align),
        children: [new TextRun({ text: cell.text || ' ', bold: isHeader || cell.bold === true, color: textColor, size: 19 })],
      }),
    ],
  })
}

function docTable(table: RichTable): Table {
  const border = { style: BorderStyle.SINGLE, size: 3, color: 'B8B7C6' }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: table.rows.map((row) => new TableRow({ children: row.map(docCell) })),
  })
}

function docNote(note: RichNote): Paragraph {
  const fill = hx(note.bg, 'E1EFF4')
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill },
    children: [new TextRun({ text: note.text, italics: true, color: hx(note.color, '1A1F29'), size: 19 })],
  })
}

/** Construit le .docx des annexes (filigrane + mention légale en pied de page). */
export async function buildAnnexesDocx(input: AnnexeInput): Promise<Buffer> {
  const d = disclaimer(input.locale)
  const stampDate = formatDate(input.locale, new Date())

  const header = new Header({
    children: [
      new Paragraph({
        children: [
          new ImageRun({
            type: 'png',
            data: watermarkPng(),
            transformation: { width: 380, height: 169 },
            floating: {
              horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
              verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.CENTER },
              behindDocument: true,
              allowOverlap: true,
              wrap: { type: TextWrappingType.NONE },
            },
          }),
        ],
      }),
    ],
  })

  const footer = new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: LANK } },
        spacing: { before: 60 },
        children: [
          new TextRun({ text: d.line1 + ' ', bold: true, color: LANK, size: 14 }),
          new TextRun({ text: d.line2, color: LANK, size: 14 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `${BRAND.seal}  ·  ${input.downloaderEmail}  ·  ${stampDate}`, color: '6E6D8E', size: 13 }),
          new TextRun({ text: '    p. ', color: '6E6D8E', size: 13 }),
          new TextRun({ children: [PageNumber.CURRENT], color: '6E6D8E', size: 13 }),
        ],
      }),
    ],
  })

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: BRAND.name.toUpperCase(), bold: true, color: LANK, size: 22 })],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({ text: input.locale === 'en' ? 'Annexes — ' : input.locale === 'ht' ? 'Anèks — ' : 'Annexes — ', bold: true, color: LANK, size: 30 }),
        new TextRun({ text: input.number ? `${input.number}` : '', bold: true, color: LANK, size: 30 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: SITWON } },
      children: [new TextRun({ text: input.titleFr, color: '6E6D8E', size: 20 })],
    }),
  ]

  let tableNo = 0
  for (const block of input.rich) {
    if (block.type === 'note') {
      children.push(docNote(block))
    } else {
      tableNo += 1
      const headingBits = [annexeLabel(input.locale, tableNo), block.caption].filter(Boolean).join(' — ')
      children.push(
        new Paragraph({
          spacing: { before: 240, after: 80 },
          children: [new TextRun({ text: headingBits, bold: true, color: LANK, size: 22 })],
        }),
      )
      children.push(docTable(block))
    }
  }

  const doc = new Document({
    creator: BRAND.name,
    title: `${input.number ?? ''} — ${input.locale === 'en' ? 'Annexes' : 'Annexes'}`,
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 900, right: 900 } } },
        headers: { default: header },
        footers: { default: footer },
        children,
      },
    ],
  })

  return Packer.toBuffer(doc)
}

// ── Excel (.xlsx) ─────────────────────────────────────────────────────────────

function xlAlign(a: RichCell['align']): Partial<ExcelJS.Alignment> {
  const horizontal = a === 'center' ? 'center' : a === 'right' ? 'right' : 'left'
  return { horizontal, vertical: 'middle', wrapText: true }
}

/** Construit le .xlsx des annexes : un onglet par tableau + filigrane + mention légale. */
export async function buildAnnexesXlsx(input: AnnexeInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = BRAND.name
  wb.created = new Date()
  const d = disclaimer(input.locale)
  const stampDate = formatDate(input.locale, new Date())

  // Filigrane : image positionnée derrière le contenu de chaque onglet.
  const wmId = wb.addImage({ buffer: watermarkPng() as unknown as ExcelJS.Buffer, extension: 'png' })

  // Encadrés précédant un tableau → texte d'introduction du tableau suivant.
  const pendingNotes: string[] = []
  let tableNo = 0

  for (const block of input.rich) {
    if (block.type === 'note') {
      pendingNotes.push(block.text)
      continue
    }
    tableNo += 1
    const sheet = wb.addWorksheet(annexeLabel(input.locale, tableNo).slice(0, 28), {
      pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.7, bottom: 0.9, header: 0.3, footer: 0.5 } },
      headerFooter: {
        oddFooter: `&C&8${d.line1} ${d.line2}\n${BRAND.seal} · ${input.downloaderEmail} · ${stampDate} · &P`,
      },
    })

    // Filigrane discret sur la zone visible.
    sheet.addImage(wmId, { tl: { col: 1, row: 2 }, ext: { width: 360, height: 160 } })

    let r = 1
    const titleCell = sheet.getCell(`A${r}`)
    titleCell.value = `${BRAND.name.toUpperCase()} · ${input.number ?? ''}`
    titleCell.font = { bold: true, size: 13, color: { argb: 'FF' + LANK } }
    r += 1
    const capCell = sheet.getCell(`A${r}`)
    capCell.value = [annexeLabel(input.locale, tableNo), block.caption].filter(Boolean).join(' — ')
    capCell.font = { bold: true, size: 11, color: { argb: 'FF' + LANK } }
    r += 1
    for (const note of pendingNotes) {
      const n = sheet.getCell(`A${r}`)
      n.value = note
      n.font = { italic: true, size: 9, color: { argb: 'FF1A1F29' } }
      n.alignment = { wrapText: true, vertical: 'top' }
      r += 1
    }
    pendingNotes.length = 0
    r += 1 // ligne de respiration

    // Grille du tableau.
    const colCount = Math.max(...block.rows.map((row) => row.reduce((acc, c) => acc + (c.colSpan ?? 1), 0)), 1)
    const startRow = r
    for (const row of block.rows) {
      let c = 1
      for (const cell of row) {
        const xc = sheet.getCell(r, c)
        xc.value = cell.text
        const fill = hx(cell.bg, cell.header ? HEADER_FILL : undefined)
        if (fill) xc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + fill } }
        xc.font = {
          bold: cell.header === true || cell.bold === true,
          size: 10,
          color: { argb: 'FF' + (hx(cell.color, cell.header ? LANK : '1A1F29') ?? '1A1F29') },
        }
        xc.alignment = xlAlign(cell.align)
        xc.border = {
          top: { style: 'thin', color: { argb: 'FFB8B7C6' } },
          bottom: { style: 'thin', color: { argb: 'FFB8B7C6' } },
          left: { style: 'thin', color: { argb: 'FFB8B7C6' } },
          right: { style: 'thin', color: { argb: 'FFB8B7C6' } },
        }
        const span = cell.colSpan ?? 1
        const rspan = cell.rowSpan ?? 1
        if (span > 1 || rspan > 1) {
          try {
            sheet.mergeCells(r, c, r + rspan - 1, c + span - 1)
          } catch {
            /* recouvrement éventuel — on ignore la fusion */
          }
        }
        c += span
      }
      r += 1
    }

    // Largeur de colonnes lisible.
    for (let cc = 1; cc <= colCount; cc += 1) {
      sheet.getColumn(cc).width = cc === 1 ? 32 : 18
    }
    void startRow
  }

  // Aucun tableau (théoriquement filtré en amont) : onglet d'information.
  if (tableNo === 0) {
    const sheet = wb.addWorksheet('Annexes')
    sheet.getCell('A1').value = `${BRAND.name} · ${input.number ?? ''}`
  }

  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out)
}
