/**
 * Application de l'arbitrage des écarts de version BRH (juin 2026) :
 *  - 106  : corps actuel CONFLATÉ (106 + 106-1) → ré-OCR depuis le PDF officiel
 *           « 106 seule » (zones_franches-1.pdf) ; date corrigée 11 déc. 2015 ; PDF recalé.
 *  - 106-1: CRÉÉE (octroi de crédits commerciaux aux zones franches, 7 juin 2016) depuis
 *           le PDF officiel credit_zones_franches.pdf.
 *  - 89-3 : CRÉÉE (normes minimales de contrôle interne, signée 20 nov. 2025) — abroge et
 *           remplace 89-2 + sa note (art. 16). PDF officiel Circulaire-89-3.pdf (39 p.).
 *  - 89-2 : les 2 fiches (circulaire + note additionnelle) → ABROGE, abrogatedByNumber 89-3.
 *
 * 106/106-1/89-3 en source='BRH-WEB' (hors purge import-brh). PDF dans CIRCULAIRES-BRH/web/.
 *   npx tsx scripts/apply-version-arbitrage.ts            (simulation)
 *   npx tsx scripts/apply-version-arbitrage.ts --commit
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { ocrDocument } from '../src/lib/ai/extract'
import { extractKeywords, joinKeywords, normalizeKeywords, splitKeywords } from '../src/lib/ai/keywords'
import { buildSearchText } from '../src/lib/search/normalize'
import { uploadToBlob } from '../src/lib/storage/blob'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
for (const k of ['BLOB_READ_WRITE_TOKEN', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'LV_AI_PROVIDER']) if (env[k]) process.env[k] = env[k]
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')
const WEB = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/CIRCULAIRES-BRH/web'
const MAT = 'Droit bancaire'
const d = (s: string) => new Date(`${s}T00:00:00Z`)
const ocr = async (file: string) => (await ocrDocument(new Uint8Array(readFileSync(`${WEB}/${file}`)))).text.trim()

async function main() {
  console.log(`Arbitrage versions BRH · ${COMMIT ? 'COMMIT' : 'SIMULATION'}\n`)

  // ── 106 : ré-OCR (106 seule) + date corrigée + PDF recalé ──
  {
    const ex = await prisma.document.findFirst({ where: { type: 'CIRCULAIRE_BRH', number: 'Circulaire n° 106' }, select: { id: true, titleFr: true, keywords: true } })
    const body = await ocr('106.pdf')
    const searchText = buildSearchText({ titleFr: ex!.titleFr, number: 'Circulaire n° 106', bodyOriginal: body, matiere: MAT, keywords: ex!.keywords })
    console.log(`• 106 [update] corps ré-OCR ${body.length}c (106 seule) · date→2015-12-11 · contient « 106-1 » : ${/106-1/.test(body)}`)
    if (COMMIT) {
      const url = await uploadToBlob('source-pdf/CIRCULAIRE_BRH/106.pdf', new Uint8Array(readFileSync(`${WEB}/106.pdf`)))
      await prisma.document.update({ where: { id: ex!.id }, data: { bodyOriginal: body, publicationDate: d('2015-12-11'), effectiveDate: d('2015-12-11'), source: 'BRH-WEB', sourcePdfUrl: url, searchText } })
      console.log(`  ✓ MAJ (${ex!.id}) · PDF ${url}`)
    }
  }

  // ── 106-1 : création ──
  await create({
    number: 'Circulaire n° 106-1', file: '106-1.pdf',
    title: 'Circulaire BRH n° 106-1 — Octroi de crédits commerciaux aux zones franches',
    pub: '2016-06-07', eff: '2016-06-15', extraKw: ['zones franches', 'crédits commerciaux', 'réserves obligatoires'],
  })

  // ── 89-3 : création (abroge 89-2 + note) ──
  await create({
    number: 'Circulaire n° 89-3', file: '89-3.pdf',
    title: 'Circulaire BRH n° 89-3 — Normes minimales de contrôle interne',
    pub: '2025-11-20', eff: '2025-01-05', extraKw: ['contrôle interne', 'normes minimales', 'gestion des risques', 'conformité'],
  })

  // ── 89-2 (circulaire + note additionnelle) → ABROGE par 89-3 ──
  console.log(`• 89-2 [×2 fiches] → ABROGE, abrogée par « Circulaire n° 89-3 »`)
  if (COMMIT) {
    const r = await prisma.document.updateMany({ where: { type: 'CIRCULAIRE_BRH', number: 'Circulaire n° 89-2' }, data: { status: 'ABROGE', abrogatedByNumber: 'Circulaire n° 89-3' } })
    console.log(`  ✓ ${r.count} fiche(s) abrogée(s)`)
  }

  console.log(COMMIT ? '\nTerminé.' : '\nSimulation — relancer avec --commit.')
  await prisma.$disconnect()
}

async function create(o: { number: string; file: string; title: string; pub: string; eff: string; extraKw: string[] }) {
  const body = await ocr(o.file)
  const kw = await extractKeywords({ titleFr: o.title, matiere: MAT, body })
  const keywords = joinKeywords(normalizeKeywords([...kw.keywords, ...o.extraKw, 'BRH']))
  const searchText = buildSearchText({ titleFr: o.title, number: o.number, bodyOriginal: body, matiere: MAT, keywords })
  console.log(`• ${o.number} [create] corps ${body.length}c · pub:${o.pub} · vigueur:${o.eff}`)
  console.log(`  mots-clés: ${keywords}`)
  if (!COMMIT) return
  const exists = await prisma.document.findFirst({ where: { type: 'CIRCULAIRE_BRH', number: o.number }, select: { id: true } })
  if (exists) { console.log(`  ⚠ existe déjà (${exists.id}) — ignoré`); return }
  const url = await uploadToBlob(`source-pdf/CIRCULAIRE_BRH/${o.number.replace(/\D+/g, '-').replace(/^-|-$/g, '')}.pdf`, new Uint8Array(readFileSync(`${WEB}/${o.file}`)))
  const doc = await prisma.document.create({
    data: {
      type: 'CIRCULAIRE_BRH', status: 'EN_VIGUEUR', originalLang: 'fr', titleFr: o.title,
      bodyOriginal: body, number: o.number, publicationDate: d(o.pub), effectiveDate: d(o.eff),
      matiere: MAT, keywords, source: 'BRH-WEB', sealed: true, sourcePdfUrl: url, searchText,
    },
  })
  console.log(`  ✓ créé (${doc.id}) · PDF ${url}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
