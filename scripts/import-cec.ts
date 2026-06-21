/**
 * Import des circulaires BRH de la série « Coopératives d'Épargne et de Crédit » (CEC)
 * — la filière prudentielle des caisses populaires, distincte de la série bancaire.
 * Fichiers téléchargés depuis brh.ht (dossier CIRCULAIRES-BRH/CEC).
 *
 *   npx tsx scripts/import-cec.ts            (simulation : lit, OCR, affiche — RIEN écrit)
 *   npx tsx scripts/import-cec.ts --commit   (upload Blob + upsert en base)
 *   npx tsx scripts/import-cec.ts --only 10  (un seul numéro)
 *
 * Choix d'archivage :
 *  - source = 'BRH-CEC' (DISTINCT de 'BRH') → NE sera PAS purgé par import-brh.ts --commit.
 *  - number = 'Circulaire CEC n° X' → aucune collision avec la série bancaire ni la
 *    Lettre-Circulaire n° 10-1 (banques) déjà en base.
 *  - type = CIRCULAIRE_BRH → visible dans le portail Circulaires BRH ; PDF téléchargeable.
 *  - bodyOriginal = OCR si le PDF est scanné (§02 : texte officiel, jamais traduit).
 * Idempotent : ré-exécution = upsert (pas de doublon).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PDFParse } from 'pdf-parse'
import { ocrDocument } from '../src/lib/ai/extract'
import { extractKeywords, joinKeywords, normalizeKeywords } from '../src/lib/ai/keywords'
import { buildSearchText } from '../src/lib/search/normalize'
import { uploadToBlob } from '../src/lib/storage/blob'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
for (const k of ['BLOB_READ_WRITE_TOKEN', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'LV_AI_PROVIDER']) {
  if (env[k]) process.env[k] = env[k]
}
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })

const DIR = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/CIRCULAIRES-BRH/CEC'
const COMMIT = process.argv.includes('--commit')
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i >= 0 ? process.argv[i + 1] : null })()
const MATIERE = "Droit bancaire - Coopératives d'épargne et de crédit (CEC)"

// Série CEC : numéro officiel → fichier local + intitulé autoritaire (page BRH « Normes
// Prudentielles – Caisse Populaire »).
const CEC = [
  { num: '01', file: 'CEC-01.pdf', title: "Norme relative à la gestion des liquidités des coopératives d'épargne et de crédit (CEC)" },
  { num: '02', file: 'CEC-02.pdf', title: "Norme relative à la gestion des placements des coopératives d'épargne et de crédit (CEC)" },
  { num: '03', file: 'CEC-03.pdf', title: 'Norme relative à la gestion des risques de crédit des CEC' },
  { num: '04', file: 'CEC-04.pdf', title: 'Norme relative à la capitalisation des CEC' },
  { num: '05', file: 'CEC-05.pdf', title: 'Norme relative au contrôle interne des CEC' },
  { num: '06', file: 'CEC-06.pdf', title: "Vérification externe des coopératives d'épargne et de crédit" },
  { num: '7-1', file: 'CEC-7-1.pdf', title: "Norme relative à la transmission des états financiers, rapports d'activités et statistiques générales des CEC" },
  { num: '08', file: 'CEC-08.pdf', title: 'Norme relative à l’ouverture de succursales ou points de service des CEC' },
  { num: '9-1', file: 'CEC-9-1.pdf', title: 'Charte comptable des CEC' },
  { num: '10', file: 'CEC-10.pdf', title: "Gouvernance des coopératives d'épargne et de crédit (CEC)" },
]

// Dates EXPLICITES et vérifiées (signature / entrée en vigueur lisibles dans le PDF).
// null = aucune date fiable dans le texte (les normes CEC 02-08 ont la ligne « entrent
// en vigueur le ____ » laissée EN BLANC) → on préfère null à une date erronée (§ base
// juridique). À compléter à la main si la BRH confirme les dates d'adoption d'origine.
const DATES: Record<string, { pub: string | null; eff: string | null }> = {
  '01': { pub: '2003-10-24', eff: '2003-10-24' }, // « le 24 octobre 2003 » dans le texte
  '02': { pub: null, eff: null },
  '03': { pub: null, eff: null },
  '04': { pub: null, eff: null },
  '05': { pub: null, eff: null },
  '06': { pub: null, eff: null }, // « ______ 2008 » : année seule, jour illisible
  '7-1': { pub: '2025-09-29', eff: '2026-01-05' }, // signée 29 sept. 2025, en vigueur 5 janv. 2026
  '08': { pub: null, eff: null },
  '9-1': { pub: '2016-03-01', eff: '2016-03-01' }, // « en vigueur le 1er mars 2016 »
  '10': { pub: '2024-10-09', eff: '2025-01-06' }, // signée 9 oct. 2024, en vigueur 6 janv. 2025
}
const toDate = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null)

async function readPdfText(path: string): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(readFileSync(path)) })
  try { return (await parser.getText()).text ?? '' } finally { await parser.destroy() }
}

async function main() {
  const targets = ONLY ? CEC.filter((c) => c.num === ONLY) : CEC
  console.log(`Série CEC — ${targets.length} circulaire(s) · ${COMMIT ? 'COMMIT (écriture)' : 'SIMULATION (rien écrit)'}\n`)
  let ok = 0
  for (const c of targets) {
    const path = join(DIR, c.file)
    const bytes = new Uint8Array(readFileSync(path))
    const layer = (await readPdfText(path).catch(() => '')).replace(/-- \d+ of \d+ --/g, '').trim()
    // Scan sans couche texte exploitable → OCR (vision). Sinon, couche texte du PDF.
    let body = layer
    let bodySrc = 'couche-texte'
    if (layer.length < 800) {
      body = (await ocrDocument(bytes)).text
      bodySrc = 'OCR'
    }
    const dd = DATES[c.num] ?? { pub: null, eff: null }
    const pub = toDate(dd.pub)
    const eff = toDate(dd.eff)
    const kw = await extractKeywords({ titleFr: c.title, matiere: MATIERE, body })
    const keywords = joinKeywords(normalizeKeywords([...kw.keywords, 'CEC', "coopératives d'épargne et de crédit", 'caisses populaires', 'supervision', 'BRH']))
    const number = `Circulaire CEC n° ${c.num}`
    const searchText = buildSearchText({ titleFr: c.title, number, bodyOriginal: body, matiere: MATIERE, keywords })

    console.log(`• ${number}`)
    console.log(`  titre   : ${c.title}`)
    console.log(`  corps   : ${body.length} c (${bodySrc}) · pub: ${pub ? pub.toISOString().slice(0, 10) : '—'} · vigueur: ${eff ? eff.toISOString().slice(0, 10) : '—'}`)
    console.log(`  mots-clés: ${keywords ?? '—'}`)

    if (COMMIT) {
      const sourcePdfUrl = await uploadToBlob(`source-pdf/CIRCULAIRE_BRH/cec-${c.num}.pdf`, bytes)
      const data = {
        type: 'CIRCULAIRE_BRH', status: 'EN_VIGUEUR', originalLang: 'fr',
        titleFr: c.title, bodyOriginal: body, number,
        publicationDate: pub, effectiveDate: eff,
        matiere: MATIERE, keywords, source: 'BRH-CEC', sourcePdfUrl, searchText,
      }
      const existing = await prisma.document.findFirst({ where: { type: 'CIRCULAIRE_BRH', number }, select: { id: true } })
      if (existing) {
        await prisma.document.update({ where: { id: existing.id }, data })
        console.log(`  ✓ mis à jour (${existing.id})`)
      } else {
        const d = await prisma.document.create({ data })
        console.log(`  ✓ créé (${d.id})`)
      }
      console.log(`  PDF Blob: ${sourcePdfUrl}`)
    }
    ok++
    console.log('')
  }
  console.log(`Terminé : ${ok}/${targets.length}${COMMIT ? ' écrites' : ' (simulation — relancer avec --commit pour écrire)'}`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
