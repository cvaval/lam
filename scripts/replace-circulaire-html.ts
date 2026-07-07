/**
 * Remplace le TEXTE (HTML + tableaux) d'une circulaire BRH par le contenu d'un .docx,
 * EN PLACE (même fiche : id, PDF, numéro, titre, date, favoris/exports conservés).
 * Conversion via le pipeline maison (wordToHtmlVersion) : bodyClean + richBlocks (tableaux).
 * Met aussi à jour bodyOriginal (texte brut) + searchText — lecture, export et recherche
 * restent cohérents. Journalise DOC_PUBLISHED (op replace_html).
 *
 *   npx tsx scripts/replace-circulaire-html.ts --number "Circulaire n° 129" --docx "/chemin/Circulaire-129.docx"            (simulation)
 *   npx tsx scripts/replace-circulaire-html.ts --number "Circulaire n° 129" --docx "/chemin/Circulaire-129.docx" --commit
 *
 * Utilisé : 87-1 (6 juil. 2026), 129 & 129-1 (6 juil. 2026).
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import mammoth from 'mammoth'
import { wordToHtmlVersion } from '../src/lib/doc/word'
import { buildSearchText } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const args = process.argv.slice(2)
const COMMIT = args.includes('--commit')
const NUMBER = args[args.indexOf('--number') + 1]
const DOCX = args[args.indexOf('--docx') + 1]
if (args.indexOf('--number') < 0 || args.indexOf('--docx') < 0 || !NUMBER || !DOCX) {
  console.error('Usage: npx tsx scripts/replace-circulaire-html.ts --number "Circulaire n° NNN" --docx "/chemin.docx" [--commit]')
  process.exit(1)
}

async function main() {
  console.log(`Remplacement texte ${NUMBER} ← ${DOCX.split('/').pop()} · ${COMMIT ? 'COMMIT' : 'SIMULATION'}\n`)

  const matches = await prisma.document.findMany({
    where: { type: 'CIRCULAIRE_BRH', number: NUMBER },
    select: { id: true, titleFr: true, number: true, matiere: true, keywords: true, moniteurRef: true, bodyClean: true, bodyOriginal: true },
  })
  if (matches.length !== 1) {
    console.error(matches.length === 0 ? `Fiche ${NUMBER} introuvable.` : `⚠ ${matches.length} fiches portent « ${NUMBER} » — préciser (ids: ${matches.map((m) => m.id).join(', ')}).`)
    process.exit(1)
  }
  const existing = matches[0]

  const buf = readFileSync(DOCX)
  const rawText = (await mammoth.extractRawText({ buffer: buf })).value.trim()
  const { bodyClean, richBlocks, warnings } = await wordToHtmlVersion(buf)
  const tables = richBlocks.filter((b) => b.type === 'table')
  const searchText = buildSearchText({
    titleFr: existing.titleFr, number: existing.number, moniteurRef: existing.moniteurRef,
    bodyOriginal: rawText, matiere: existing.matiere, keywords: existing.keywords,
  })

  console.log(`fiche : ${existing.id} — ${existing.titleFr?.slice(0, 60)}`)
  console.log(`AVANT : bodyClean ${existing.bodyClean?.length || 0}c · bodyOriginal ${existing.bodyOriginal?.length || 0}c`)
  console.log(`APRÈS : bodyClean ${bodyClean.length}c · bodyOriginal ${rawText.length}c · ${tables.length} tableaux${warnings.length ? ` · ${warnings.length} avert. (${warnings.slice(0, 3).join(' | ')})` : ''}`)
  console.log(`extrait: ${bodyClean.replace(/\s+/g, ' ').slice(0, 150)}…`)

  if (!COMMIT) { console.log('\nSimulation — relancer avec --commit pour écrire.'); await prisma.$disconnect(); return }

  await prisma.document.update({
    where: { id: existing.id },
    data: {
      bodyClean,
      richBlocksJson: richBlocks.length ? JSON.stringify(richBlocks) : null,
      bodyOriginal: rawText,
      searchText,
    },
  })
  await audit({
    action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: existing.id,
    meta: { op: 'replace_html', source: DOCX.split('/').pop(), number: NUMBER, tables: tables.length, bodyClean: bodyClean.length },
  }, prisma)
  console.log(`\n✓ Texte remplacé (${existing.id}). PDF, numéro, titre, date, favoris/exports conservés. Données LIVE.`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
