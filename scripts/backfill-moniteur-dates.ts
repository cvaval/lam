/**
 * Renseigne la VRAIE date de publication des fascicules du Moniteur catalogués
 * (source MONITEUR_PDF_{année}) en la lisant sur la 1re page du scan par IA vision.
 * Le catalogue initial pose une date approximative (1er du mois) ; ce script la
 * remplace par la date imprimée en haut à droite de la page 1.
 *
 *   npx tsx scripts/backfill-moniteur-dates.ts --year 2021 [--limit 50] [--commit] [--force]
 *
 * Sans --commit : simulation (lit la date, n'écrit pas). Sans --year : toutes les
 * années cataloguées. Résumable : saute les fiches déjà datées par IA (metaJson
 * dateSource='ocr') sauf --force. Garde-fou : une date dont l'année diffère de
 * celle du fascicule est rejetée (probable date du corps de texte) — on conserve
 * alors la date approximative et on journalise.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { extractMoniteurDate } from '../src/lib/ai/extract'
import { isAiConfigured } from '../src/lib/ai/provider'

const prisma = new PrismaClient()

function yearOf(number: string | null): number | null {
  const m = (number ?? '').match(/^LM(\d{4})-/)
  return m ? Number(m[1]) : null
}

async function main() {
  const args = process.argv.slice(2)
  const year = args.indexOf('--year') >= 0 ? Number(args[args.indexOf('--year') + 1]) : null
  const limit = args.indexOf('--limit') >= 0 ? Number(args[args.indexOf('--limit') + 1]) : Infinity
  const commit = args.includes('--commit')
  const force = args.includes('--force')

  if (!isAiConfigured()) {
    console.error('Aucune clé IA configurée (GEMINI_API_KEY / ANTHROPIC_API_KEY) — impossible de lire les dates.')
    process.exit(1)
  }

  const where = year
    ? { source: `MONITEUR_PDF_${year}` }
    : { source: { startsWith: 'MONITEUR_PDF_' } }
  const docs = await prisma.document.findMany({
    where,
    select: { id: true, number: true, sourcePdfUrl: true, publicationDate: true, metaJson: true },
    orderBy: { number: 'asc' },
  })

  let processed = 0
  let updated = 0
  let skipped = 0
  let rejected = 0
  let failed = 0

  for (const d of docs) {
    if (processed >= limit) break
    let meta: any = {}
    try {
      meta = d.metaJson ? JSON.parse(d.metaJson) : {}
    } catch {
      meta = {}
    }
    if (meta.dateSource === 'ocr' && !force) {
      skipped++
      continue
    }
    if (!d.sourcePdfUrl) {
      console.warn(`⚠ ${d.number} : pas de chemin PDF`)
      failed++
      continue
    }
    processed++
    const docYear = yearOf(d.number)
    let bytes: Uint8Array
    try {
      bytes = new Uint8Array(readFileSync(d.sourcePdfUrl))
    } catch (e) {
      console.warn(`⚠ ${d.number} : PDF illisible (${d.sourcePdfUrl})`)
      failed++
      continue
    }

    let date: string | null = null
    try {
      date = await extractMoniteurDate(bytes)
    } catch (e) {
      console.warn(`⚠ ${d.number} : échec IA — ${(e as Error).message.slice(0, 100)}`)
      failed++
      continue
    }

    if (!date) {
      console.log(`·  ${d.number} : date illisible`)
      failed++
      continue
    }
    if (docYear && Number(date.slice(0, 4)) !== docYear) {
      console.log(`✗  ${d.number} : date lue ${date} ≠ année ${docYear} → rejetée (probable date du corps)`)
      rejected++
      continue
    }

    console.log(`✔  ${d.number} : ${d.publicationDate?.toISOString().slice(0, 10)} → ${date}`)
    if (commit) {
      meta.dateSource = 'ocr'
      await prisma.document.update({
        where: { id: d.id },
        data: { publicationDate: new Date(`${date}T00:00:00Z`), metaJson: JSON.stringify(meta) },
      })
    }
    updated++
  }

  console.log(
    `\n${commit ? '✅ ' : '(simulation) '}${updated} dates ${commit ? 'mises à jour' : 'lues'} · ${skipped} déjà faites · ${rejected} rejetées · ${failed} échecs · sur ${docs.length} fiches`,
  )
  if (!commit && updated) console.log('Relancer avec --commit pour écrire.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
