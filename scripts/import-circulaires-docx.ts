/**
 * Téléversement de circulaires BRH à partir d'un .docx (version HTML : bodyClean +
 * tableaux richBlocks) et d'un .pdf (fichier original → Blob privé).
 *
 *   npx tsx scripts/import-circulaires-docx.ts            (simulation)
 *   npx tsx scripts/import-circulaires-docx.ts --commit   (écrit en base + Blob)
 *   npx tsx scripts/import-circulaires-docx.ts --only 95-5 --commit
 *
 * Règles :
 *  - NEW (create) : bodyOriginal = texte brut du docx (§02, texte officiel), bodyClean
 *    + richBlocks = rendu du docx, source = 'BRH-WEB' (hors pipeline import-brh → NON
 *    purgé par import-brh.ts qui ne purge que source='BRH').
 *  - UPDATE (existant) : on met à jour bodyClean (+ PDF) SANS toucher bodyOriginal
 *    (§02), titre, dates. PRÉSERVATION DES TABLEAUX : si le document a déjà des
 *    richBlocks en base, on NE les remplace PAS (consigne « ne pas modifier les
 *    tableaux existants »).
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
for (const k of ['BLOB_READ_WRITE_TOKEN', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'LV_AI_PROVIDER']) {
  if (env[k]) process.env[k] = env[k]
}
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i >= 0 ? process.argv[i + 1] : null })()
const DIR = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/CIRCULAIRES-BRH'
const toDate = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null)

interface Job {
  num: string                 // identifiant interne / slug PDF (« 87-1 », « IMF-2026-1 »)
  number?: string             // numéro affiché si ≠ « Circulaire n° {num} » (ex. « Circulaire BRH/IMF/2026/1 »)
  mode: 'create' | 'update'
  docx: string
  pdf: string
  title?: string              // requis pour create
  date?: string | null        // publicationDate (create)
  eff?: string | null         // effectiveDate (create)
  matiere?: string
  replaceTables?: boolean      // update : remplacer les tableaux existants par ceux du docx (choix explicite)
}

// 131 EXCLU pour l'instant : tableau existant en base ≠ tableaux du docx → à trancher.
const JOBS: Job[] = [
  {
    num: '87-1', mode: 'create',
    docx: 'CIRCULAIRE-87-1 - texte corrigé.docx', pdf: 'CIRCULAIRE-87-1.pdf',
    title: 'Circulaire BRH n° 87-1 — Classification des prêts et constitution des provisions',
    date: '2026-02-16', eff: '2026-02-16', matiere: 'Droit bancaire',
  },
  {
    num: '95-5', mode: 'create',
    docx: 'Circulaire-No.-95-5 (OCR).docx', pdf: 'Circulaire-No.-95-5.pdf',
    title: 'Circulaire BRH n° 95-5 — Conditions, modalités et seuils de déclaration des transactions (LBC/FT)',
    date: '2025-04-16', eff: '2025-04-16', matiere: 'Droit bancaire',
  },
  {
    num: '129-1', mode: 'update',
    docx: 'Circulaire-129-1-Aux-Institutions-FinancieEres-6-feevrier-2026-Lutte-contre-le-blanchiment-de-capitaux._0001.docx',
    pdf: 'Circulaire-129-1-Aux-Institutions-FinancieEres-6-feevrier-2026-Lutte-contre-le-blanchiment-de-capitaux._0001.pdf',
  },
  {
    // Choix utilisateur : remplacer le tableau partiel par la version docx complète (3 tableaux).
    num: '131', mode: 'update', replaceTables: true,
    docx: 'Circulaire 131 - texte corrigé.docx', pdf: 'Circulaire 131 - (OCR).pdf',
  },
  {
    num: '129', mode: 'update',
    docx: 'Circulaire-129.docx', pdf: 'Circulaire-129.pdf',
  },
  // Circulaires microfinance (IMF) — numérotation annuelle BRH/IMF/2026/N (16/02/2026 annoncé,
  // mais signature 11/02/2026 + entrée en vigueur 1er avril 2026 selon le texte).
  {
    num: 'IMF-2026-1', number: 'Circulaire BRH/IMF/2026/1', mode: 'create',
    docx: 'Circulaire - gestion du risque de crédit des IMF - texte corrigé.docx',
    pdf: 'Circulaire-portant-sur-la-gestion-du-risque-de-credit-des-Institutions-de-Microfinance.pdf',
    title: 'Circulaire BRH/IMF/2026/1 — Gestion du risque de crédit des institutions de microfinance (IMF)',
    date: '2026-02-11', eff: '2026-04-01', matiere: 'Droit bancaire - Microfinance (IMF)',
  },
  {
    num: 'IMF-2026-2', number: 'Circulaire BRH/IMF/2026/2', mode: 'create',
    docx: 'Circulaire - exigences minimales de liquidité des IMF - texte corrigé.docx',
    pdf: 'Circulaire-traitant-des-exigences-minimales-de-liquidite-a-respecter-par-les-Institutions-de-Microfinance.pdf',
    title: 'Circulaire BRH/IMF/2026/2 — Exigences minimales de liquidité des institutions de microfinance (IMF)',
    date: '2026-02-11', eff: '2026-04-01', matiere: 'Droit bancaire - Microfinance (IMF)',
  },
  {
    num: 'IMF-2026-3', number: 'Circulaire BRH/IMF/2026/3', mode: 'create',
    docx: 'Circulaire - exigences minimales de fonds propres des IMF - texte corrigé.docx',
    pdf: 'Circulaire-portant-sur-les-exigences-minimales-de-Fonds-Propres-des-Institutions-de-Microfinance.pdf',
    title: 'Circulaire BRH/IMF/2026/3 — Exigences minimales de fonds propres des institutions de microfinance (IMF)',
    date: '2026-02-11', eff: '2026-04-01', matiere: 'Droit bancaire - Microfinance (IMF)',
  },
]

async function main() {
  const onlySet = ONLY ? new Set(ONLY.split(',').map((s) => s.trim())) : null
  const jobs = onlySet ? JOBS.filter((j) => onlySet.has(j.num)) : JOBS
  console.log(`Téléversement docx+pdf — ${jobs.length} circulaire(s) · ${COMMIT ? 'COMMIT' : 'SIMULATION'}\n`)
  for (const j of jobs) {
    const number = j.number ?? `Circulaire n° ${j.num}`
    const buf = readFileSync(`${DIR}/${j.docx}`)
    const { bodyClean, richBlocks, warnings } = await wordToHtmlVersion(buf)
    const richJson = richBlocks.length ? JSON.stringify(richBlocks) : null
    console.log(`• ${number}  [${j.mode}]`)
    console.log(`  docx → bodyClean ${bodyClean.length}c · tableaux ${richBlocks.length}${warnings.length ? ` · ${warnings.length} avert.` : ''}`)

    if (j.mode === 'create') {
      const rawText = (await mammoth.extractRawText({ buffer: buf })).value.trim()
      const kw = await extractKeywords({ titleFr: j.title!, matiere: j.matiere, body: rawText })
      const keywords = joinKeywords(normalizeKeywords([...kw.keywords, 'BRH', 'circulaire']))
      const searchText = buildSearchText({ titleFr: j.title!, number, bodyOriginal: rawText, matiere: j.matiere, keywords })
      console.log(`  body(officiel)=${rawText.length}c · pub:${j.date ?? '—'} · vigueur:${j.eff ?? '—'}`)
      console.log(`  mots-clés: ${keywords ?? '—'}`)
      if (COMMIT) {
        const exists = await prisma.document.findFirst({ where: { type: 'CIRCULAIRE_BRH', number }, select: { id: true } })
        if (exists) { console.log(`  ⚠ existe déjà (${exists.id}) — ignoré (utiliser mode update)`); continue }
        const sourcePdfUrl = await uploadToBlob(`source-pdf/CIRCULAIRE_BRH/${j.num}.pdf`, new Uint8Array(readFileSync(`${DIR}/${j.pdf}`)))
        const d = await prisma.document.create({
          data: {
            type: 'CIRCULAIRE_BRH', status: 'EN_VIGUEUR', originalLang: 'fr',
            titleFr: j.title!, bodyOriginal: rawText, bodyClean, richBlocksJson: richJson,
            number, publicationDate: toDate(j.date ?? null), effectiveDate: toDate(j.eff ?? null),
            matiere: j.matiere ?? 'Droit bancaire', keywords, source: 'BRH-WEB', sealed: true,
            sourcePdfUrl, searchText,
          },
        })
        console.log(`  ✓ créé (${d.id}) · PDF ${sourcePdfUrl}`)
      }
    } else {
      // UPDATE : ne touche QUE bodyClean (+ PDF). Préserve tableaux existants.
      const ex = await prisma.document.findFirst({
        where: { type: 'CIRCULAIRE_BRH', number },
        select: { id: true, richBlocksJson: true, sourcePdfUrl: true },
      })
      if (!ex) { console.log(`  ⚠ introuvable en base — ignoré (utiliser mode create)`); continue }
      const hasTables = Boolean(ex.richBlocksJson && ex.richBlocksJson !== '[]')
      const data: Record<string, unknown> = { bodyClean }
      // Tableaux : remplacement explicite (replaceTables) → on impose ceux du docx ;
      // sinon on n'écrit que si le document n'en a pas (préservation de l'existant).
      if (j.replaceTables) data.richBlocksJson = richJson
      else if (!hasTables && richJson) data.richBlocksJson = richJson
      console.log(`  tableaux en base: ${hasTables ? 'OUI' : 'non'} → ${j.replaceTables ? `REMPLACÉS par ${richBlocks.length} du docx` : hasTables ? 'préservés (intact)' : richJson ? 'ajout des tableaux du docx' : 'aucun'}`)
      if (COMMIT) {
        const sourcePdfUrl = await uploadToBlob(`source-pdf/CIRCULAIRE_BRH/${j.num}.pdf`, new Uint8Array(readFileSync(`${DIR}/${j.pdf}`)))
        data.sourcePdfUrl = sourcePdfUrl
        await prisma.document.update({ where: { id: ex.id }, data })
        console.log(`  ✓ mis à jour (${ex.id}) · bodyClean MAJ · PDF ${sourcePdfUrl}`)
      }
    }
    console.log('')
  }
  console.log(COMMIT ? 'Terminé.' : 'Simulation — relancer avec --commit pour écrire.')
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
