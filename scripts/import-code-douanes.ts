/**
 * Téléverse le Décret portant Code des Douanes (Le Moniteur, Spécial N° 11 du 21 mars
 * 2023) dans la Législation haïtienne, depuis le .docx reconstitué (docx seul, pas de PDF).
 *
 *   npx tsx scripts/import-code-douanes.ts            (simulation)
 *   npx tsx scripts/import-code-douanes.ts --commit
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import mammoth from 'mammoth'
import { wordToHtmlVersion } from '../src/lib/doc/word'
import { extractKeywords, joinKeywords, normalizeKeywords } from '../src/lib/ai/keywords'
import { buildSearchText } from '../src/lib/search/normalize'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
for (const k of ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'LV_AI_PROVIDER']) if (env[k]) process.env[k] = env[k]
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')
const DOCX = '/Users/cvaval/Downloads/Code_des_Douanes_RECONSTITUE.docx'

const NUMBER = 'LM2023-SP11'
const TITLE = 'Le Moniteur — Édition spéciale n° 11 — 21 mars 2023 — Décret portant Code des Douanes'
const MONITEUR_REF = 'Le Moniteur — 178e Année, Spécial N° 11, mardi 21 mars 2023'

async function main() {
  const buf = readFileSync(DOCX)
  const rawText = (await mammoth.extractRawText({ buffer: buf })).value.trim()
  const { bodyClean, richBlocks, warnings } = await wordToHtmlVersion(buf)
  const arts = [...rawText.matchAll(/^\s*Article\s+(\d+)/gim)].length
  const kw = await extractKeywords({ titleFr: TITLE, matiere: 'Droit douanier', body: rawText }).catch(() => ({ keywords: [] as string[] }))
  const keywords = joinKeywords(normalizeKeywords([...kw.keywords, 'code des douanes', 'douane', 'droit douanier', 'Le Moniteur', 'législation']))
  const searchText = buildSearchText({ titleFr: TITLE, number: NUMBER, moniteurRef: MONITEUR_REF, bodyOriginal: rawText, matiere: 'Droit douanier', keywords })
  console.log(`• ${NUMBER} — Code des Douanes`)
  console.log(`  body ${rawText.length}c · bodyClean ${bodyClean.length}c · ~${arts} articles · ${richBlocks.length} tableaux${warnings.length ? ` · ${warnings.length} avert.` : ''}`)
  console.log(`  mots-clés: ${keywords?.slice(0, 120)}`)
  if (!COMMIT) { console.log('\nSIMULATION — relancer avec --commit.'); await prisma.$disconnect(); return }

  const exists = await prisma.document.findFirst({ where: { type: 'LEGISLATION', number: NUMBER }, select: { id: true } })
  if (exists) {
    await prisma.document.update({ where: { id: exists.id }, data: { bodyOriginal: rawText, bodyClean, titleFr: TITLE, searchText, keywords } })
    console.log(`  ✓ mis à jour (${exists.id})`)
  } else {
    const d = await prisma.document.create({
      data: {
        type: 'LEGISLATION', status: 'EN_VIGUEUR', originalLang: 'fr', titleFr: TITLE,
        bodyOriginal: rawText, bodyClean, richBlocksJson: richBlocks.length ? JSON.stringify(richBlocks) : null,
        number: NUMBER, publicationDate: new Date('2023-03-21T00:00:00Z'),
        moniteurRef: MONITEUR_REF, matiere: 'Droit douanier', source: 'MONITEUR_MANUAL', keywords, searchText,
      },
    })
    console.log(`  ✓ créé (${d.id})`)
  }
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
