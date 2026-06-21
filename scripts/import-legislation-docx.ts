/**
 * Téléversement d'une édition « Législation haïtienne » (Le Moniteur) à partir d'un
 * .docx (version HTML : bodyClean + tableaux) et d'un .pdf (texte original → Blob).
 *
 *   npx tsx scripts/import-legislation-docx.ts            (simulation)
 *   npx tsx scripts/import-legislation-docx.ts --commit
 *
 * Convention LEGISLATION : number « LM{année}-{NN} » (ou « LM{année}-SP{NN} » pour une
 * édition spéciale → affichée « Spécial » dans la liste). source='MONITEUR_MANUAL'
 * (DISTINCT de MONITEUR_PDF_{année} → non purgé par un futur import-moniteur-pdf).
 * status='EN_VIGUEUR'. bodyOriginal = texte officiel du docx (§02).
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import mammoth from 'mammoth'
import { wordToHtmlVersion } from '../src/lib/doc/word'
import { extractKeywords, joinKeywords, normalizeKeywords } from '../src/lib/ai/keywords'
import { buildSearchText } from '../src/lib/search/normalize'
import { uploadToBlob } from '../src/lib/storage/blob'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
for (const k of ['BLOB_READ_WRITE_TOKEN', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'LV_AI_PROVIDER']) if (env[k]) process.env[k] = env[k]
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')
const MONITEUR = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur'

interface Job { number: string; title: string; moniteurRef: string; year: number; pub: string; docx: string; pdf: string }

const JOBS: Job[] = [
  {
    number: 'LM2012-SP4', year: 2012, pub: '2012-07-20',
    title: 'Le Moniteur — Édition spéciale n° 4 — Juillet 2012 — Loi portant sur les banques et autres institutions financières',
    moniteurRef: 'Le Moniteur — Édition spéciale n° 4 de Juillet 2012 (167e Année)',
    docx: 'Loi sur les banque_20120720_No4.docx', pdf: 'Loi sur les banque_20120720_No4.pdf',
  },
]

async function main() {
  console.log(`Législation (docx+pdf) — ${JOBS.length} édition(s) · ${COMMIT ? 'COMMIT' : 'SIMULATION'}\n`)
  for (const j of JOBS) {
    const buf = readFileSync(`${MONITEUR}/${j.docx}`)
    const rawText = (await mammoth.extractRawText({ buffer: buf })).value.trim()
    const { bodyClean, richBlocks, warnings } = await wordToHtmlVersion(buf)
    const richJson = richBlocks.length ? JSON.stringify(richBlocks) : null
    const kw = await extractKeywords({ titleFr: j.title, body: rawText })
    const keywords = joinKeywords(normalizeKeywords([...kw.keywords, 'Le Moniteur', 'législation']))
    const searchText = buildSearchText({ titleFr: j.title, number: j.number, moniteurRef: j.moniteurRef, bodyOriginal: rawText, keywords })
    const hasSommaire = /^[ \t]*SOMMAIRE[ \t]*$/im.test(rawText)
    console.log(`• ${j.number}  ${j.title.slice(0, 60)}…`)
    console.log(`  docx → body ${rawText.length}c · bodyClean ${bodyClean.length}c · ${richBlocks.filter((b) => b.type === 'table').length} tableaux · SOMMAIRE détecté: ${hasSommaire}${warnings.length ? ` · ${warnings.length} avert.` : ''}`)
    console.log(`  pub:${j.pub} · mots-clés: ${keywords}`)
    if (!COMMIT) continue
    const exists = await prisma.document.findFirst({ where: { type: 'LEGISLATION', number: j.number }, select: { id: true } })
    if (exists) { console.log(`  ⚠ existe déjà (${exists.id}) — ignoré`); continue }
    const sourcePdfUrl = await uploadToBlob(`source-pdf/LEGISLATION/${j.number}.pdf`, new Uint8Array(readFileSync(`${MONITEUR}/${j.pdf}`)), 'application/pdf', { multipart: true })
    const d = await prisma.document.create({
      data: {
        type: 'LEGISLATION', status: 'EN_VIGUEUR', originalLang: 'fr',
        titleFr: j.title, bodyOriginal: rawText, bodyClean, richBlocksJson: richJson,
        number: j.number, publicationDate: new Date(`${j.pub}T00:00:00Z`),
        moniteurRef: j.moniteurRef, source: 'MONITEUR_MANUAL', keywords, sourcePdfUrl, searchText,
      },
    })
    console.log(`  ✓ créé (${d.id}) · PDF ${sourcePdfUrl}`)
  }
  console.log(COMMIT ? '\nTerminé.' : '\nSimulation — relancer avec --commit.')
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
