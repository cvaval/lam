/**
 * Rattache à chaque circulaire BRH son PDF d'origine (téléchargeable) : téléverse les
 * PDF du dossier CIRCULAIRES-BRH vers le Blob privé et renseigne Document.sourcePdfUrl.
 *
 *   npx tsx scripts/attach-brh-pdfs.ts            # aperçu (rien écrit)
 *   npx tsx scripts/attach-brh-pdfs.ts --commit   # téléverse + met à jour
 *
 * Mapping (réutilise la logique d'import) : circulaires autonomes → leur PDF ;
 * circulaires éclatées du recueil → CirculaireAuxBanques.pdf (un seul blob partagé).
 * Idempotent : un PDF déjà téléversé (URL Blob) est sauté ; chaque fichier n'est
 * téléversé qu'une fois (les docs du recueil partagent la même URL).
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { parseName } from './import-brh'
import { RECUEIL_SEGMENTS, RECUEIL_SOURCE } from './recueil-reserves'
import { uploadToBlob, isBlobUrl } from '../src/lib/storage/blob'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
if (env.BLOB_READ_WRITE_TOKEN) process.env.BLOB_READ_WRITE_TOKEN = env.BLOB_READ_WRITE_TOKEN
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')
const DIR = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/CIRCULAIRES-BRH'

// Cas non standard (numéro DB ≠ convention de fichier) — relecture.
const MANUAL: Record<string, string> = {
  // Note additionnelle 99-3 (titre porte « Note additionnelle » mais le fichier n'a
  // pas le suffixe _NA → clé dérivée ≠ clé fichier ; on mappe directement).
  'Lettre-Circulaire n° 99-3': '99-3_Lettre-Circulaire.pdf',
  'Circulaire n° 99-3': '99-3_Lettre-Circulaire.pdf',
}

function sourceFileFor(number: string, titleFr: string, fileByKey: Map<string, string>, recueilNums: Set<string>): string | null {
  if (MANUAL[number]) return MANUAL[number]
  if (recueilNums.has(number)) return RECUEIL_SOURCE
  const m = number.match(/^(Circulaire|Lettre-Circulaire) n° (.+)$/)
  if (!m) return null
  const kind = number.startsWith('Lettre') ? 'LETTRE' : 'CIRCULAIRE'
  const num = m[2]
  const noteNo = /Note additionnelle n° (\d+)/.exec(titleFr)?.[1] ?? (/Note additionnelle/.test(titleFr) ? '1' : '')
  return fileByKey.get(`${kind}|${num}|${noteNo}`) ?? null
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) { console.error('❌ BLOB_READ_WRITE_TOKEN manquant'); process.exit(1) }

  const fileByKey = new Map<string, string>()
  for (const f of readdirSync(DIR)) {
    if (!f.toLowerCase().endsWith('.pdf')) continue
    const pn = parseName(f)
    if (!pn || pn === 'skip') continue
    const k = `${pn.kind}|${pn.num}|${pn.noteNo ?? ''}`
    // Garde le scan le plus volumineux (couche texte la plus riche, cf. import-brh).
    if (!fileByKey.has(k) || statSync(join(DIR, f)).size > statSync(join(DIR, fileByKey.get(k)!)).size) fileByKey.set(k, f)
  }
  // Numéros couverts par le recueil (+ 3 circulaires créées depuis le docx).
  const recueilNums = new Set([
    ...RECUEIL_SEGMENTS.filter((s) => !s.skip).map((s) => s.number),
    'Circulaire n° 86-12 (réserves obligatoires)', 'Circulaire n° 86-12-A', 'Circulaire n° 78-1 (réserves obligatoires)',
  ])

  const docs = await prisma.document.findMany({ where: { type: 'CIRCULAIRE_BRH' }, select: { id: true, number: true, titleFr: true, sourcePdfUrl: true } })
  const plan: { id: string; number: string; file: string }[] = []
  const unmapped: string[] = []
  for (const d of docs) {
    if (isBlobUrl(d.sourcePdfUrl)) continue // déjà fait
    const file = sourceFileFor(d.number!, d.titleFr, fileByKey, recueilNums)
    if (!file || !existsSync(join(DIR, file))) { unmapped.push(`${d.number} (${file ?? 'aucun fichier'})`); continue }
    plan.push({ id: d.id, number: d.number!, file })
  }

  const uniqueFiles = [...new Set(plan.map((p) => p.file))]
  const bytes = uniqueFiles.reduce((a, f) => a + statSync(join(DIR, f)).size, 0)
  console.log(`Circulaires : ${docs.length} · déjà avec PDF : ${docs.filter((d) => isBlobUrl(d.sourcePdfUrl)).length}`)
  console.log(`À rattacher : ${plan.length} docs · ${uniqueFiles.length} fichiers uniques · ${(bytes / 1e6).toFixed(0)} Mo`)
  if (unmapped.length) console.log(`⚠ Non mappées (${unmapped.length}) : ${unmapped.join(' · ')}`)

  if (!COMMIT) { console.log('\n(Aperçu — relancer avec --commit pour téléverser.)'); return }

  const urlByFile = new Map<string, string>()
  let done = 0, failed = 0
  for (const file of uniqueFiles) {
    try {
      const buf = readFileSync(join(DIR, file))
      const url = await uploadToBlob(`source-pdf/brh/${file}`, buf, 'application/pdf', { multipart: buf.length > 20_000_000 })
      urlByFile.set(file, url)
    } catch (e) { failed++; console.warn(`  ✗ upload ${file}: ${(e as Error).message.slice(0, 80)}`) }
    process.stdout.write(`\r  téléversé ${urlByFile.size}/${uniqueFiles.length} (échecs ${failed})   `)
  }
  for (const pp of plan) {
    const url = urlByFile.get(pp.file)
    if (!url) continue
    await prisma.document.update({ where: { id: pp.id }, data: { sourcePdfUrl: url } })
    done++
  }
  console.log(`\n✅ ${urlByFile.size} PDF téléversés · ${done} circulaires rattachées · ${failed} échecs.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
