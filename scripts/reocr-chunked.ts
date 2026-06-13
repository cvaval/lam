/**
 * Ré-OCR par TRANCHES de pages — pour les circulaires longues (> ~20 pages) que
 * l'IA ne peut transcrire en un seul appel (limite de sortie → troncature).
 *
 *   npx tsx scripts/reocr-chunked.ts --file 105-1_Circulaire.pdf --number "Circulaire n° 105-1" [--chunk 15] [--commit]
 *
 * Découpe le PDF en sous-PDF de `chunk` pages, OCR chaque tranche (Gemini/Anthropic
 * selon LV_AI_PROVIDER), concatène et écrit bodyOriginal + searchText. Nécessite
 * une clé IA. bodyOriginal reste le texte officiel (§02) ; on corrige l'OCR.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { PrismaClient } from '@prisma/client'
import { ocrDocument, isAiConfigured } from '../src/lib/ai/extract'
import { buildSearchText } from '../src/lib/search/normalize'

const prisma = new PrismaClient()
const DEFAULT_DIR = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/CIRCULAIRES-BRH'

async function subPdf(src: PDFDocument, from: number, to: number): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  const idx = Array.from({ length: to - from }, (_, i) => from + i)
  const copied = await out.copyPages(src, idx)
  for (const p of copied) out.addPage(p)
  return out.save()
}

async function main() {
  const args = process.argv.slice(2)
  const dir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : DEFAULT_DIR
  const file = args.includes('--file') ? args[args.indexOf('--file') + 1] : null
  const number = args.includes('--number') ? args[args.indexOf('--number') + 1] : null
  const chunk = args.includes('--chunk') ? Math.max(5, Number(args[args.indexOf('--chunk') + 1])) : 15
  const commit = args.includes('--commit')
  if (!file || !number) {
    console.error('Usage: --file <pdf> --number "Circulaire n° X" [--chunk 15] [--commit]')
    process.exit(1)
  }
  if (!isAiConfigured()) {
    console.error('⛔ Aucune clé IA configurée (.env).')
    process.exit(1)
  }

  const bytes = new Uint8Array(readFileSync(join(dir, file)))
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const total = src.getPageCount()
  const ranges: [number, number][] = []
  for (let i = 0; i < total; i += chunk) ranges.push([i, Math.min(i + chunk, total)])
  console.log(`${number} — ${total} pages → ${ranges.length} tranche(s) de ${chunk} :`)

  const parts: string[] = []
  for (const [from, to] of ranges) {
    const part = await subPdf(src, from, to)
    const { text, truncated } = await ocrDocument(part)
    console.log(`  pages ${from + 1}-${to} : ${text.length}c${truncated ? ' ⚠️ tronqué' : ''}`)
    if (truncated) console.log('    ↳ tranche encore tronquée — réduire --chunk.')
    parts.push(text)
  }
  const full = parts.join('\n\n').trim()
  console.log(`\nTexte complet reconstitué : ${full.length}c`)

  if (!commit) {
    console.log('(Essai — relancez avec --commit pour écrire.)')
    await prisma.$disconnect()
    return
  }
  const d = await prisma.document.findFirst({ where: { type: 'CIRCULAIRE_BRH', number }, select: { id: true, titleFr: true, matiere: true } })
  if (!d) {
    console.error('Document introuvable :', number)
    process.exit(1)
  }
  await prisma.document.update({
    where: { id: d.id },
    data: { bodyOriginal: full, searchText: buildSearchText({ titleFr: d.titleFr, number, bodyOriginal: full, matiere: d.matiere }) },
  })
  console.log(`✅ ${number} mise à jour. Lancez \`npm run search:reindex\`.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
