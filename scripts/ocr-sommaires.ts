/**
 * Pré-OCR des SOMMAIRES (tables des matières) des éditions du Moniteur non encore
 * océrisées — pour que l'aperçu au clic (§07) soit instantané au lieu d'attendre
 * l'OCR à la demande. Ne transcrit QUE la 1re page de chaque PDF (où vit le
 * sommaire), via Gemini/Claude (withAiFallback) ; coût borné.
 *
 *   npx tsx scripts/ocr-sommaires.ts --audit                 (combien restent — sans IA)
 *   npx tsx scripts/ocr-sommaires.ts [--year 2024] [--limit 20] [--commit]
 *
 * Sans --commit : simulation (OCR de quelques éditions affiché, RIEN n'est stocké).
 * Avec --commit  : remplit Document.sommaireOcr (cache d'AFFICHAGE ; bodyOriginal
 * reste le texte officiel §02). Idempotent : saute les éditions déjà océrisées.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { ocrSommaire } from '../src/lib/ai/extract'
import { isAiConfigured } from '../src/lib/ai/provider'
import { isBlobUrl, getPrivateBlob } from '../src/lib/storage/blob'
import { extractSommaire } from '../src/lib/doc/sommaire'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
for (const k of ['BLOB_READ_WRITE_TOKEN', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'LV_AI_PROVIDER']) {
  if (env[k]) process.env[k] = env[k]
}
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })

const COMMIT = process.argv.includes('--commit')
const AUDIT = process.argv.includes('--audit')
const CONCURRENCY = 4
const arg = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null }
const YEAR = arg('--year')
const LIMIT = arg('--limit') ? Number(arg('--limit')) : null

// Corps « marque-page » d'un fascicule pas encore océrisé (cf. route sommaire).
const needsOcr = (body: string | null) => {
  const b = body || ''
  return b.length < 400 || /non encore océrisé|fascicule scanné|sans couche texte/i.test(b)
}

async function ocrOne(id: string, url: string): Promise<string | null> {
  const blob = await getPrivateBlob(url).catch(() => null)
  if (!blob?.stream) return null
  const bytes = new Uint8Array(await new Response(blob.stream).arrayBuffer())
  const raw = (await ocrSommaire(bytes)).trim()
  return raw || null
}

async function main() {
  const rows = await prisma.document.findMany({
    where: {
      type: 'LEGISLATION',
      sommaireOcr: null,
      ...(YEAR ? { number: { startsWith: `LM${YEAR}-` } } : {}),
    },
    select: { id: true, number: true, bodyOriginal: true, sourcePdfUrl: true },
    orderBy: { number: 'asc' },
  })
  // Cibles : non océrisées (corps marque-page) ET PDF disponible sur le Blob.
  let targets = rows.filter((r) => needsOcr(r.bodyOriginal) && isBlobUrl(r.sourcePdfUrl))
  const noPdf = rows.filter((r) => needsOcr(r.bodyOriginal) && !isBlobUrl(r.sourcePdfUrl)).length

  console.log(`Éditions LEGISLATION non océrisées${YEAR ? ` (${YEAR})` : ''} : ${targets.length} avec PDF Blob` + (noPdf ? ` · ${noPdf} sans PDF servable (ignorées)` : ''))
  if (AUDIT) { await prisma.$disconnect(); return }
  if (!isAiConfigured()) { console.error('Aucune clé IA (GEMINI_API_KEY / ANTHROPIC_API_KEY) — abandon.'); process.exit(1) }
  if (LIMIT) targets = targets.slice(0, LIMIT)
  if (!COMMIT) console.log('— SIMULATION (--commit pour stocker) —')

  let ok = 0, withSommaire = 0, fail = 0, done = 0
  const queue = [...targets]
  async function worker() {
    for (;;) {
      const t = queue.shift()
      if (!t) break
      done++
      const tag = `[${done}/${targets.length}] ${t.number}`
      try {
        const raw = await ocrOne(t.id, t.sourcePdfUrl!)
        if (!raw) { fail++; console.log(`${tag} — vide/PDF illisible`); continue }
        const som = extractSommaire(raw)
        if (som) withSommaire++
        ok++
        if (COMMIT) await prisma.document.update({ where: { id: t.id }, data: { sommaireOcr: raw } })
        console.log(`${tag} — OK (${raw.length} c${som ? ', SOMMAIRE détecté' : ''})${COMMIT ? ' ✓ stocké' : ''}`)
      } catch (e) {
        fail++
        console.log(`${tag} — ERREUR ${String((e as Error).message).slice(0, 80)}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker))
  console.log(`\nTerminé : ${ok} océrisées (${withSommaire} avec SOMMAIRE structuré), ${fail} échecs.` + (COMMIT ? '' : ' (simulation — rien stocké)'))
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
