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
 *
 * ⚠️ 12 oct. 2026 : le PDF se lit aussi sur Blob. Le script ne lisait que des chemins
 * locaux : une fois les fiches migrées (`migrate-pdfs-to-blob`), chaque lecture échouait
 * en « PDF illisible » — d'où l'obligation de dater AVANT de migrer, fiches affichées entre-
 * temps sans PDF servable. `--concurrence N` (défaut 4) : lectures en parallèle.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { extractMoniteurDate } from '../src/lib/ai/extract'
import { isAiConfigured } from '../src/lib/ai/provider'
import { getPrivateBlob, isBlobUrl } from '../src/lib/storage/blob'

/** Octets du PDF, qu'il soit encore au Bureau (chemin local) ou déjà sur Blob (privé). */
async function lirePdf(url: string): Promise<Uint8Array> {
  if (!isBlobUrl(url)) return new Uint8Array(readFileSync(url))
  const blob = await getPrivateBlob(url)
  if (!blob?.stream) throw new Error('blob introuvable')
  return new Uint8Array(await new Response(blob.stream).arrayBuffer())
}

async function pool<T>(items: T[], n: number, fn: (it: T) => Promise<void>) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++])
  }))
}

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
  const concurrence = args.indexOf('--concurrence') >= 0 ? Number(args[args.indexOf('--concurrence') + 1]) : 4

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

  let updated = 0
  let skipped = 0
  let rejected = 0
  let failed = 0

  const metaDe = (d: (typeof docs)[number]): any => {
    try {
      return d.metaJson ? JSON.parse(d.metaJson) : {}
    } catch {
      return {}
    }
  }
  const aLire = docs.filter((d) => {
    if (metaDe(d).dateSource === 'ocr' && !force) {
      skipped++
      return false
    }
    return true
  })

  await pool(aLire.slice(0, limit === Infinity ? undefined : limit), concurrence, async (d) => {
    const meta = metaDe(d)
    if (!d.sourcePdfUrl) {
      console.warn(`⚠ ${d.number} : pas de chemin PDF`)
      failed++
      return
    }
    const docYear = yearOf(d.number)
    let bytes: Uint8Array
    try {
      bytes = await lirePdf(d.sourcePdfUrl)
    } catch (e) {
      console.warn(`⚠ ${d.number} : PDF illisible (${d.sourcePdfUrl})`)
      failed++
      return
    }

    let date: string | null = null
    try {
      date = await extractMoniteurDate(bytes)
    } catch (e) {
      console.warn(`⚠ ${d.number} : échec IA — ${(e as Error).message.slice(0, 100)}`)
      failed++
      return
    }

    if (!date) {
      console.log(`·  ${d.number} : date illisible`)
      failed++
      return
    }
    if (docYear && Number(date.slice(0, 4)) !== docYear) {
      console.log(`✗  ${d.number} : date lue ${date} ≠ année ${docYear} → rejetée (probable date du corps)`)
      rejected++
      return
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
  })

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
