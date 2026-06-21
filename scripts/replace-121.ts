/**
 * Remplacement complet de la Circulaire BRH n° 121 (demande utilisatrice) :
 *   1. EFFACER la fiche 121 existante (trace AuditLog DOC_DELETED, §audit).
 *   2. TÉLÉVERSER 121 depuis 121_Circulaire.docx (version HTML : bodyClean + tableaux
 *      richBlocks) et 121_Circulaire.pdf (fichier source → Blob privé).
 *   3. Tableaux reconstitués en HTML (richBlocks) ET exportables en Excel
 *      (buildAnnexesXlsx lit richBlocksJson) — vérifié par smoke-test.
 *
 *   npx tsx scripts/replace-121.ts            (simulation)
 *   npx tsx scripts/replace-121.ts --commit
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import mammoth from 'mammoth'
import { wordToHtmlVersion } from '../src/lib/doc/word'
import { extractKeywords, joinKeywords, normalizeKeywords } from '../src/lib/ai/keywords'
import { buildSearchText } from '../src/lib/search/normalize'
import { uploadToBlob } from '../src/lib/storage/blob'
import { audit } from '../src/lib/auth/audit'
import { buildAnnexesXlsx } from '../src/lib/annexes/generate'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
for (const k of ['BLOB_READ_WRITE_TOKEN', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'LV_AI_PROVIDER']) if (env[k]) process.env[k] = env[k]
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')
const DIR = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/CIRCULAIRES-BRH'
const NUMBER = 'Circulaire n° 121'
const MAT = 'Droit bancaire'

async function main() {
  console.log(`Remplacement ${NUMBER} · ${COMMIT ? 'COMMIT' : 'SIMULATION'}\n`)

  // 1) Conversion docx
  const buf = readFileSync(`${DIR}/121_Circulaire.docx`)
  const rawText = (await mammoth.extractRawText({ buffer: buf })).value.trim()
  const { bodyClean, richBlocks, warnings } = await wordToHtmlVersion(buf)
  const tables = richBlocks.filter((b) => b.type === 'table')
  console.log(`docx → bodyClean ${bodyClean.length}c · ${tables.length} tableaux${warnings.length ? ` · ${warnings.length} avert.` : ''}`)

  // 2) Smoke-test export Excel (les tableaux doivent produire un .xlsx valide)
  const xlsx = await buildAnnexesXlsx({ number: NUMBER, titleFr: 'Circulaire BRH n° 121', rich: richBlocks, downloaderEmail: 'verif@lam.ht', locale: 'fr' })
  console.log(`export Excel (smoke-test) → ${xlsx.length} octets, ${xlsx.length > 2000 ? 'OK' : '⚠ trop petit'}`)

  // 3) Fiche existante
  const existing = await prisma.document.findMany({ where: { type: 'CIRCULAIRE_BRH', number: NUMBER }, select: { id: true, titleFr: true, publicationDate: true } })
  console.log(`existant : ${existing.length} fiche(s) → ${existing.map((e) => e.id).join(', ') || '(aucune)'}`)
  const title = existing[0]?.titleFr ?? 'Circulaire BRH n° 121 — Fournisseurs de services de paiement'
  const pub = existing[0]?.publicationDate ?? new Date('2021-12-06T00:00:00Z')

  const kw = await extractKeywords({ titleFr: title, matiere: MAT, body: rawText })
  const keywords = joinKeywords(normalizeKeywords([...kw.keywords, 'BRH', 'circulaire']))
  const searchText = buildSearchText({ titleFr: title, number: NUMBER, bodyOriginal: rawText, matiere: MAT, keywords })
  console.log(`nouvelle fiche : titre="${title}" · pub=${pub.toISOString().slice(0, 10)} · body(officiel)=${rawText.length}c`)
  console.log(`mots-clés: ${keywords}`)

  if (!COMMIT) { console.log('\nSimulation — relancer avec --commit.'); await prisma.$disconnect(); return }

  // EFFACER (avec trace AuditLog DOC_DELETED)
  const ids = existing.map((e) => e.id)
  if (ids.length) {
    await prisma.document.deleteMany({ where: { id: { in: ids } } })
    await audit({
      action: 'DOC_DELETED', targetType: 'DOCUMENT', targetId: ids[0],
      meta: { actor: 'script:replace-121', reason: 'remplacement 121 (docx+pdf) demandé par l’utilisatrice', number: NUMBER, ids },
    }, prisma)
    console.log(`✓ effacé ${ids.length} fiche(s) (tracé AuditLog DOC_DELETED)`)
  }

  // TÉLÉVERSER (create)
  const sourcePdfUrl = await uploadToBlob('source-pdf/CIRCULAIRE_BRH/121.pdf', new Uint8Array(readFileSync(`${DIR}/121_Circulaire.pdf`)))
  const doc = await prisma.document.create({
    data: {
      type: 'CIRCULAIRE_BRH', status: 'EN_VIGUEUR', originalLang: 'fr', titleFr: title,
      bodyOriginal: rawText, bodyClean, richBlocksJson: JSON.stringify(richBlocks),
      number: NUMBER, publicationDate: pub, matiere: MAT, keywords,
      source: 'BRH', sealed: true, sourcePdfUrl, searchText,
    },
  })
  console.log(`✓ créé ${NUMBER} (${doc.id}) · ${tables.length} tableaux · PDF ${sourcePdfUrl}`)
  console.log('\nTerminé.')
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
