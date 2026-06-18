/**
 * Migration des PDF originaux (chemins locaux) → store Blob privé Vercel.
 *
 *   npx tsx scripts/migrate-pdfs-to-blob.ts            # aperçu (rien écrit)
 *   npx tsx scripts/migrate-pdfs-to-blob.ts --commit   # téléverse + met à jour sourcePdfUrl
 *
 * Idempotent / reprenable : les documents dont sourcePdfUrl est DÉJÀ une URL Blob sont
 * sautés ; pathname déterministe `source-pdf/<type>/<id>.pdf` (allowOverwrite). Résout
 * le 404 : la fiche document sert ensuite le PDF via /api/doc/[id]/pdf.
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { uploadToBlob, isBlobUrl } from '../src/lib/storage/blob'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
for (const k of ['BLOB_READ_WRITE_TOKEN']) if (env[k]) process.env[k] = env[k]
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')
const CONCURRENCY = 6

async function pool<T>(items: T[], n: number, fn: (it: T, i: number) => Promise<void>) {
  let idx = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (idx < items.length) { const i = idx++; await fn(items[i], i) }
  }))
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) { console.error('❌ BLOB_READ_WRITE_TOKEN manquant (.env)'); process.exit(1) }

  const docs = await prisma.document.findMany({
    where: { sourcePdfUrl: { not: null } },
    select: { id: true, type: true, sourcePdfUrl: true },
  })
  const todo = docs.filter((d) => !isBlobUrl(d.sourcePdfUrl))
  const already = docs.length - todo.length
  const missing = todo.filter((d) => !existsSync(d.sourcePdfUrl!))
  const ready = todo.filter((d) => existsSync(d.sourcePdfUrl!))
  const bytes = ready.reduce((a, d) => a + statSync(d.sourcePdfUrl!).size, 0)

  console.log(`Documents avec PDF : ${docs.length}`)
  console.log(`  déjà sur Blob (sautés) : ${already}`)
  console.log(`  à migrer (fichier présent) : ${ready.length} · ${(bytes / 1e9).toFixed(2)} Go`)
  console.log(`  fichier local introuvable (ignorés) : ${missing.length}`)
  if (missing.length) for (const d of missing.slice(0, 5)) console.log(`    ⚠ ${d.id} ${d.sourcePdfUrl}`)

  if (!COMMIT) { console.log('\n(Aperçu — relancer avec --commit pour téléverser.)'); return }

  let done = 0, failed = 0, sent = 0
  await pool(ready, CONCURRENCY, async (d) => {
    try {
      const buf = readFileSync(d.sourcePdfUrl!)
      const url = await uploadToBlob(`source-pdf/${(d.type || 'doc').toLowerCase()}/${d.id}.pdf`, buf, 'application/pdf', { multipart: buf.length > 20_000_000 })
      await prisma.document.update({ where: { id: d.id }, data: { sourcePdfUrl: url } })
      done++; sent += buf.length
    } catch (e) {
      failed++
      console.warn(`  ✗ ${d.id} : ${(e as Error).message.slice(0, 100)}`)
    }
    if ((done + failed) % 25 === 0 || done + failed === ready.length) {
      process.stdout.write(`\r  migré ${done}/${ready.length} · ${(sent / 1e9).toFixed(2)} Go · échecs ${failed}   `)
    }
  })
  console.log(`\n✅ Migration : ${done} téléversés · ${failed} échecs · ${(sent / 1e9).toFixed(2)} Go.`)
  if (failed) console.log('   (relancer --commit pour reprendre les échecs — idempotent)')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
