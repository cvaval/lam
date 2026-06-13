import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import { BRAND } from '../brand'
import { BRAND_COLORS, hexToRgb01 } from '../brand-colors'

// Palette dérivée de la source unique (brand-colors.ts).
const LANK = rgb(...hexToRgb01(BRAND_COLORS.lank))
const SITWON = rgb(...hexToRgb01(BRAND_COLORS.sitwon))

export interface SealInput {
  title: string
  badge: string
  status: string
  moniteurRef?: string | null
  number?: string | null
  bodyOriginal: string
  /** identité de l'exportateur — tatouée dans le filigrane (anti-scraping §09) */
  exporterEmail: string
  watermarkId: string
}

function wrap(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split(/\n/)) {
    if (paragraph.trim() === '') {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const trial = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(trial, fontSize) > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = trial
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

/** Produit un PDF scellé + filigrane dynamique embarquant l'identifiant du compte. */
export async function buildSealedPdf(input: SealInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(input.title)
  pdf.setProducer('Lam')
  pdf.setCreator(`Lam · ${BRAND.seal}`)

  const font = await pdf.embedFont(StandardFonts.TimesRoman)
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const mono = await pdf.embedFont(StandardFonts.Courier)

  const A4: [number, number] = [595.28, 841.89]
  const margin = 56
  const contentWidth = A4[0] - margin * 2
  const bodySize = 10.5
  const leading = 15

  const bodyLines = wrap(input.bodyOriginal, font, bodySize, contentWidth)

  let page = pdf.addPage(A4)
  let y = A4[1] - margin

  const header = (p: any) => {
    p.drawText(BRAND.wordmark, { x: margin, y: A4[1] - 40, size: 14, font: bold, color: LANK })
    p.drawText(BRAND.baseline.fr, { x: margin, y: A4[1] - 54, size: 8, font, color: LANK })
    p.drawRectangle({ x: A4[0] - margin - 96, y: A4[1] - 50, width: 96, height: 16, color: LANK })
    p.drawText(input.badge, { x: A4[0] - margin - 90, y: A4[1] - 46, size: 8, font: bold, color: rgb(1, 1, 1) })
  }

  const watermark = (p: any) => {
    // Filigrane diagonal répété : identité exportateur + identifiant unique.
    const tag = `Lam · ${input.exporterEmail} · ${input.watermarkId}`
    p.drawText(tag, {
      x: 70,
      y: 250,
      size: 11,
      font: mono,
      color: SITWON,
      opacity: 0.18,
      rotate: degrees(35),
    })
    p.drawText(tag, {
      x: 70,
      y: 520,
      size: 11,
      font: mono,
      color: SITWON,
      opacity: 0.18,
      rotate: degrees(35),
    })
  }

  const footer = (p: any, n: number) => {
    p.drawLine({
      start: { x: margin, y: 48 },
      end: { x: A4[0] - margin, y: 48 },
      thickness: 0.5,
      color: LANK,
      opacity: 0.4,
    })
    p.drawText(`${BRAND.seal}  ·  ${BRAND.verifiedBadge.fr}  ·  ${BRAND.domain}`, { x: margin, y: 36, size: 7, font, color: LANK })
    p.drawText(`p. ${n}`, { x: A4[0] - margin - 20, y: 36, size: 7, font, color: LANK })
    p.drawText(`Réf. export ${input.watermarkId}`, { x: margin, y: 26, size: 6.5, font: mono, color: LANK, opacity: 0.7 })
  }

  header(page)
  watermark(page)
  y = A4[1] - 96

  // Titre + métadonnées
  for (const tl of wrap(input.title, bold, 15, contentWidth)) {
    page.drawText(tl, { x: margin, y, size: 15, font: bold, color: LANK })
    y -= 20
  }
  const metaBits = [input.number, input.status, input.moniteurRef].filter(Boolean).join('  ·  ')
  if (metaBits) {
    page.drawText(metaBits, { x: margin, y, size: 9, font, color: LANK, opacity: 0.8 })
    y -= 22
  }
  page.drawLine({ start: { x: margin, y }, end: { x: A4[0] - margin, y }, thickness: 1, color: SITWON })
  y -= 18

  let pageNo = 1
  footer(page, pageNo)

  for (const line of bodyLines) {
    if (y < 70) {
      pageNo++
      page = pdf.addPage(A4)
      header(page)
      watermark(page)
      footer(page, pageNo)
      y = A4[1] - 96
    }
    page.drawText(line, { x: margin, y, size: bodySize, font, color: rgb(0.1, 0.12, 0.16) })
    y -= leading
  }

  return pdf.save()
}
