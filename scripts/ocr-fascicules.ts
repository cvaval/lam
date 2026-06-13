/**
 * OCR par LOT des fascicules scannés du Moniteur (type LEGISLATION, source
 * MONITEUR_PDF_{année}) dont le corps est encore un renvoi au PDF (pas de texte).
 *
 *   npx tsx scripts/ocr-fascicules.ts [--year 2021] [--limit 50] [--chunk 8] [--commit]
 *
 * Sans --commit : inventaire seul (combien restent à océriser).
 * Avec --commit  : océrise jusqu'à --limit fascicules, écrit bodyOriginal + searchText.
 *
 * Idempotent : saute les fascicules déjà océrisés (corps ≠ placeholder). Conçu pour
 * tourner en tâche planifiée quotidienne : il s'ARRÊTE proprement dès que le quota IA
 * est épuisé (reprend au prochain run). Le fournisseur suit .env (Gemini primaire +
 * repli Claude) ; le wrapper quotidien force Gemini seul (gratuit) en vidant
 * ANTHROPIC_API_KEY. Réindexer après (le wrapper s'en charge).
 */
import { readFileSync, existsSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { PrismaClient } from '@prisma/client'
import { ocrDocument } from '../src/lib/ai/extract'
import { isExhausted } from '../src/lib/ai/provider'
import { buildSearchText } from '../src/lib/search/normalize'

const prisma = new PrismaClient()
const PLACEHOLDER = /Fascicule scanné|non encore océrisé/

async function subPdf(src: PDFDocument, from: number, to: number): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, Array.from({ length: to - from }, (_, i) => from + i))
  for (const p of copied) out.addPage(p)
  return out.save()
}

/** OCR d'un fascicule par tranches de `chunk` pages (gros scans → un appel par tranche). */
async function ocrFascicule(pdfPath: string, chunk: number): Promise<string> {
  const bytes = new Uint8Array(readFileSync(pdfPath))
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const total = src.getPageCount()
  const parts: string[] = []
  for (let i = 0; i < total; i += chunk) {
    const part = await subPdf(src, i, Math.min(i + chunk, total))
    const { text } = await ocrDocument(part)
    parts.push(text)
  }
  return parts.join('\n\n').trim()
}

async function main() {
  const args = process.argv.slice(2)
  const year = args.includes('--year') ? Number(args[args.indexOf('--year') + 1]) : null
  const limit = args.includes('--limit') ? Math.max(1, Number(args[args.indexOf('--limit') + 1])) : 50
  const chunk = args.includes('--chunk') ? Math.max(4, Number(args[args.indexOf('--chunk') + 1])) : 8
  const commit = args.includes('--commit')

  const source = year ? { equals: `MONITEUR_PDF_${year}` } : { startsWith: 'MONITEUR_PDF_' }
  const all = await prisma.document.findMany({
    where: { source },
    select: { id: true, titleFr: true, number: true, moniteurRef: true, sourcePdfUrl: true, bodyOriginal: true },
    orderBy: { publicationDate: 'asc' },
  })
  const pending = all.filter((d) => PLACEHOLDER.test(d.bodyOriginal || ''))
  console.log(`Fascicules : ${all.length} total · ${all.length - pending.length} déjà océrisés · ${pending.length} en attente.`)

  if (!commit) {
    console.log(`(Inventaire seul — relancer avec --commit pour océriser jusqu'à ${limit}.)`)
    return
  }

  const batch = pending.slice(0, limit)
  console.log(`→ Traitement de ${batch.length} fascicule(s) (tranches de ${chunk} pages)…\n`)
  let done = 0
  let failed = 0
  let stoppedByQuota = false

  for (const d of batch) {
    if (!d.sourcePdfUrl || !existsSync(d.sourcePdfUrl)) {
      console.log(`  ⚠ ${d.number} : PDF introuvable (${d.sourcePdfUrl ?? 'aucun'}) — sauté.`)
      failed++
      continue
    }
    try {
      const text = await ocrFascicule(d.sourcePdfUrl, chunk)
      if (text.length < 50) {
        console.log(`  ⚠ ${d.number} : OCR trop court (${text.length}c) — conservé en l'état.`)
        failed++
        continue
      }
      await prisma.document.update({
        where: { id: d.id },
        data: {
          bodyOriginal: text,
          searchText: buildSearchText({ titleFr: d.titleFr, number: d.number, moniteurRef: d.moniteurRef, bodyOriginal: text }),
        },
      })
      done++
      console.log(`  ✓ ${d.number} : ${text.length}c`)
    } catch (e) {
      if (isExhausted(e)) {
        console.log(`  ⏸ ${d.number} : quota IA épuisé — arrêt propre, reprise au prochain run.`)
        stoppedByQuota = true
        break
      }
      console.log(`  ✗ ${d.number} : ${String((e as Error)?.message ?? e).slice(0, 100)}`)
      failed++
    }
  }

  const remaining = pending.length - done
  console.log(`\n${done} océrisé(s) · ${failed} échec(s) · ${remaining} encore en attente${stoppedByQuota ? ' (arrêt quota)' : ''}.`)
  if (done > 0) console.log('↳ Pense à réindexer (npm run search:reindex) pour rendre le nouveau texte cherchable.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
