/**
 * Téléversement individuel des 27 circulaires de réserves obligatoires : docx
 * RECONSTITUE (→ bodyClean + tableaux) + pdf ORIGINAL (→ Blob privé). La version
 * fournie PRÉVAUT (dédup en place). Remplace l'enrichissement groupé du 18 juin
 * (issu de CirculaireAuxBanques.docx) par des fichiers individuels plus fidèles.
 *
 *   npx tsx scripts/import-reserves-batch.ts            (simulation + validation du mapping)
 *   npx tsx scripts/import-reserves-batch.ts --commit
 *
 * UPDATE (24) : bodyClean + richBlocks ← docx, sourcePdfUrl ← pdf, source→'BRH-WEB'.
 *   INCHANGÉS : bodyOriginal (§02), numéro, titre, statut, dates. Recherche par numéro
 *   EXACT (suffixe « (réserves obligatoires) » conservé là où un homonyme non-réserves
 *   existe : 86-8, 86-12, 89, 90).
 * CREATE (3) : 87 réserves (distinct du gros recueil n° 87), CIRC-RES 95 (retirée lors
 *   de l'arbitrage de versions), « du 19 avril 1996 » (BRH/CIR/96 #78, convention date-titre).
 * PDF Blob : chemin dédié `source-pdf/CIRCULAIRE_BRH/res-<fichier>.pdf` (pas de collision
 * avec les PDF existants, ex. le gros n° 87).
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import mammoth from 'mammoth'
import { wordToHtmlVersion } from '../src/lib/doc/word'
import { extractKeywords, joinKeywords, normalizeKeywords } from '../src/lib/ai/keywords'
import { buildSearchText } from '../src/lib/search/normalize'
import { uploadToBlob } from '../src/lib/storage/blob'
import { audit } from '../src/lib/auth/audit'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
for (const k of ['BLOB_READ_WRITE_TOKEN', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'LV_AI_PROVIDER']) if (env[k]) process.env[k] = env[k]
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')
const DOCX = '/Users/cvaval/Downloads/files_circulaires'
const PDF = '/Users/cvaval/Downloads/files_circulairesPDF'
const toDate = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null)

interface Job {
  file: string                 // base sans suffixe (ex. « 01_CIRC-96-78 »)
  number: string               // numéro cible EXACT en base
  mode: 'update' | 'create'
  title?: string; date?: string; eff?: string   // requis pour create
}
const M = 'Droit bancaire'
const JOBS: Job[] = [
  { file: '01_CIRC-96-78', number: 'Circulaire du 19 avril 1996', mode: 'create', title: 'Circulaire BRH du 19 avril 1996 (BRH/CIR/96 #78) — Réserves obligatoires : modification de l’article 7', date: '1996-04-19', eff: '1996-04-01' },
  { file: '02_CIRC-86-5C', number: 'Circulaire n° 86-5C', mode: 'update' },
  { file: '03_CIRC-72-3', number: 'Circulaire n° 72-3', mode: 'update' },
  { file: '04_CIRC-86-8', number: 'Circulaire n° 86-8 (réserves obligatoires)', mode: 'update' },
  { file: '05_CIRC-78-1', number: 'Circulaire n° 78-1', mode: 'update' },
  { file: '06_CIRC-86-12', number: 'Circulaire n° 86-12 (réserves obligatoires)', mode: 'update' },
  { file: '07_CIRC-86-12-A', number: 'Circulaire n° 86-12-A', mode: 'update' },
  { file: '08_CIRC-86-12-C', number: 'Circulaire n° 86-12-C', mode: 'update' },
  { file: '09_CIRC-86-12-E', number: 'Circulaire n° 86-12-E', mode: 'update' },
  { file: '10_CIRC-86-12-G', number: 'Circulaire n° 86-12-G', mode: 'update' },
  { file: '11_CIRC-86-12-I', number: 'Circulaire n° 86-12-I', mode: 'update' },
  { file: '12_CIRC-86-12-J', number: 'Circulaire n° 86-12-J', mode: 'update' },
  { file: '13_CIRC-87', number: 'Circulaire n° 87 (réserves obligatoires)', mode: 'create', title: 'Circulaire BRH n° 87 (réserves obligatoires) — Coefficients de réserves obligatoires', date: '2009-03-16', eff: '2009-03-16' },
  { file: '14_CIRC-86-12-K', number: 'Circulaire n° 86-12-K', mode: 'update' },
  { file: '15_CIRC-86-12-L', number: 'Circulaire n° 86-12-L', mode: 'update' },
  { file: '16_CIRC-88-13-M', number: 'Circulaire n° 88-13-M', mode: 'update' },
  { file: '17_CIRC-89', number: 'Circulaire n° 89 (réserves obligatoires)', mode: 'update' },
  { file: '18_LC-01-14', number: 'Lettre-Circulaire n° 01-14', mode: 'update' },
  { file: '19_CIRC-90', number: 'Circulaire n° 90 (réserves obligatoires)', mode: 'update' },
  { file: '20_CIRC-RES-92', number: 'Circulaire CIRC-RES n° 92', mode: 'update' },
  { file: '21_CIRC-RES-93', number: 'Circulaire CIRC-RES n° 93', mode: 'update' },
  { file: '22_CIRC-RES-94', number: 'Circulaire CIRC-RES n° 94', mode: 'update' },
  { file: '23_CIRC-RES-95', number: 'Circulaire CIRC-RES n° 95', mode: 'create', title: 'Circulaire BRH CIRC-RES n° 95 — Coefficients de réserves obligatoires', date: '2015-07-16', eff: '2015-07-16' },
  { file: '24_CIRC-111', number: 'Circulaire n° 111', mode: 'update' },
  { file: '25_CIRC-RES-001-18', number: 'Circulaire CIRC-RES n° 001-18', mode: 'update' },
  { file: '26_CIRC-002-18', number: 'Circulaire n° 002-18', mode: 'update' },
  { file: '27_CIRC-01-19', number: 'Circulaire n° 01-19', mode: 'update' },
]

async function main() {
  console.log(`Réserves obligatoires — ${JOBS.length} circulaire(s) · ${COMMIT ? 'COMMIT' : 'SIMULATION'}\n`)
  let errors = 0
  for (const j of JOBS) {
    const buf = readFileSync(`${DOCX}/${j.file}_RECONSTITUE.docx`)
    const { bodyClean, richBlocks } = await wordToHtmlVersion(buf)
    const richJson = richBlocks.length ? JSON.stringify(richBlocks) : null
    const raw = (await mammoth.extractRawText({ buffer: buf })).value.trim()
    const ex = await prisma.document.findMany({ where: { type: 'CIRCULAIRE_BRH', number: j.number }, select: { id: true, source: true, richBlocksJson: true, bodyClean: true } })
    const tab0 = ex[0]?.richBlocksJson && ex[0].richBlocksJson !== '[]' ? (JSON.parse(ex[0].richBlocksJson) as unknown[]).length : 0
    console.log(`• [${j.mode}] ${j.number}  ←  ${j.file}`)
    console.log(`  docx: bodyClean ${ex[0]?.bodyClean?.length ?? 0}→${bodyClean.length}c · tableaux ${tab0}→${richBlocks.length} · raw ${raw.length}c`)

    // Validation du mapping
    if (j.mode === 'update' && ex.length !== 1) { errors++; console.log(`  ❌ ATTENDU 1 existant, trouvé ${ex.length} — STOP\n`); continue }
    if (j.mode === 'create' && ex.length !== 0) { errors++; console.log(`  ❌ existe déjà (${ex.length}) alors que create — STOP\n`); continue }

    if (!COMMIT) { console.log('') ; continue }
    const pdfUrl = await uploadToBlob(`source-pdf/CIRCULAIRE_BRH/res-${j.file}.pdf`, new Uint8Array(readFileSync(`${PDF}/${j.file}_ORIGINAL.pdf`)))
    if (j.mode === 'update') {
      await prisma.document.update({ where: { id: ex[0].id }, data: { bodyClean, richBlocksJson: richJson, sourcePdfUrl: pdfUrl, source: 'BRH-WEB' } })
      await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: ex[0].id, meta: { number: j.number, op: 'reserves-replace', tablesAfter: richBlocks.length, sourceWas: ex[0].source } }, prisma)
      console.log(`  ✓ remplacé (${ex[0].id})\n`)
    } else {
      let kwList: string[] = []
      try { kwList = (await extractKeywords({ titleFr: j.title!, matiere: M, body: raw })).keywords } catch { /* IA indispo → mots-clés de base */ }
      const keywords = joinKeywords(normalizeKeywords([...kwList, 'BRH', 'circulaire', 'réserves obligatoires', 'coefficients']))
      const searchText = buildSearchText({ titleFr: j.title!, number: j.number, bodyOriginal: raw, matiere: M, keywords })
      const d = await prisma.document.create({ data: {
        type: 'CIRCULAIRE_BRH', status: 'EN_VIGUEUR', originalLang: 'fr', titleFr: j.title!,
        bodyOriginal: raw, bodyClean, richBlocksJson: richJson, number: j.number,
        publicationDate: toDate(j.date ?? null), effectiveDate: toDate(j.eff ?? null),
        matiere: M, keywords, source: 'BRH-WEB', sealed: true, sourcePdfUrl: pdfUrl, searchText,
      } })
      await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: d.id, meta: { number: j.number, op: 'reserves-create', tables: richBlocks.length } }, prisma)
      console.log(`  ✓ créé (${d.id})\n`)
    }
  }
  console.log(errors ? `\n❌ ${errors} erreur(s) de mapping — RIEN à committer tant que non résolu.` : (COMMIT ? '\n✅ Terminé.' : '\n✅ Mapping validé — relancer avec --commit.'))
  await prisma.$disconnect()
  process.exit(errors ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
