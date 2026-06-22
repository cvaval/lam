/**
 * Remplacement (la nouvelle version prévaut) de circulaires BRH à partir d'un .docx
 * (version HTML : bodyClean + tableaux richBlocks) et d'un .pdf (original → Blob privé).
 *
 *   npx tsx scripts/import-circ-batch.ts            (simulation)
 *   npx tsx scripts/import-circ-batch.ts --commit   (écrit en base + Blob)
 *
 * Aucun doublon en base (1 doc par numéro) → remplacement EN PLACE (préserve id,
 * favoris, citations, liens d'abrogation par numéro). Règles :
 *  - bodyClean + richBlocks ← docx (la version fournie prévaut ; tableaux vérifiés
 *    ≥ existant en contenu, cf. scripts/_diff-121).
 *  - sourcePdfUrl ← nouveau .pdf si fourni (121 : pas de nouveau pdf → on conserve).
 *  - source → 'BRH-WEB' : immunise contre la purge d'import-brh (source='BRH').
 *  - INCHANGÉS : bodyOriginal (texte officiel §02), number, titre, statut, dates,
 *    abrogatedByNumber. 129 garde « Circulaire n° 129 » (99-4/100-4/107-3/128-1 y sont liés).
 *  - Audit DOC_PUBLISHED par document (traçabilité du remplacement).
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { wordToHtmlVersion } from '../src/lib/doc/word'
import { uploadToBlob } from '../src/lib/storage/blob'
import { audit } from '../src/lib/auth/audit'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
for (const k of ['BLOB_READ_WRITE_TOKEN']) if (env[k]) process.env[k] = env[k]
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')
const DIR = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/CIRCULAIRES-BRH'

interface Job { num: string; docx: string; pdf: string | null }
const JOBS: Job[] = [
  { num: '121', docx: '121_Circulaire.docx', pdf: null },
  { num: '126', docx: '126_Circulaire_RECONSTITUE.docx', pdf: '126_Circulaire.pdf' },
  { num: '129', docx: 'Circulaire-129.docx', pdf: 'Circulaire-129.pdf' },
  { num: '129-1', docx: 'Circulaire-129-1-Aux-Institutions-FinancieEres-6-feevrier-2026-Lutte-contre-le-blanchiment-de-capitaux._0001.docx', pdf: 'Circulaire-129-1-Aux-Institutions-FinancieEres-6-feevrier-2026-Lutte-contre-le-blanchiment-de-capitaux._0001.pdf' },
  { num: '131', docx: 'Circulaire 131.docx', pdf: 'Circulaire 131 - Aux-Institutions-Financieres-6-fevrier-2026-Protection-des-consommateurs-de-produits-et-services-financiers_0001.pdf' },
]

async function main() {
  console.log(`Remplacement docx+pdf — ${JOBS.length} circulaire(s) · ${COMMIT ? 'COMMIT' : 'SIMULATION'}\n`)
  for (const j of JOBS) {
    const number = `Circulaire n° ${j.num}`
    const ex = await prisma.document.findFirst({
      where: { type: 'CIRCULAIRE_BRH', number },
      select: { id: true, source: true, richBlocksJson: true, sourcePdfUrl: true, bodyClean: true, status: true, bodyOriginal: true },
    })
    console.log(`• ${number}`)
    if (!ex) { console.log('  ⚠ INTROUVABLE en base — ignoré\n'); continue }
    const { bodyClean, richBlocks, warnings } = await wordToHtmlVersion(readFileSync(`${DIR}/${j.docx}`))
    const richJson = richBlocks.length ? JSON.stringify(richBlocks) : null
    const tablesBefore = ex.richBlocksJson && ex.richBlocksJson !== '[]' ? (JSON.parse(ex.richBlocksJson) as unknown[]).length : 0
    console.log(`  bodyClean ${ex.bodyClean?.length ?? 0}c → ${bodyClean.length}c · tableaux ${tablesBefore} → ${richBlocks.length}${warnings.length ? ` · ${warnings.length} avert.` : ''}`)
    console.log(`  source ${ex.source} → BRH-WEB · statut ${ex.status} (inchangé) · bodyOriginal ${ex.bodyOriginal?.length ?? 0}c (inchangé §02)`)
    console.log(`  pdf: ${j.pdf ?? '— conserver l\'existant'}`)

    if (!COMMIT) { console.log(''); continue }
    const data: Record<string, unknown> = { bodyClean, richBlocksJson: richJson, source: 'BRH-WEB' }
    if (j.pdf) data.sourcePdfUrl = await uploadToBlob(`source-pdf/CIRCULAIRE_BRH/${j.num}.pdf`, new Uint8Array(readFileSync(`${DIR}/${j.pdf}`)))
    await prisma.document.update({ where: { id: ex.id }, data })
    await audit({
      action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: ex.id,
      meta: { number, op: 'replace-docx', bodyCleanLen: bodyClean.length, tablesBefore, tablesAfter: richBlocks.length, pdfReplaced: Boolean(j.pdf), sourceWas: ex.source },
    }, prisma)
    console.log(`  ✓ remplacé (${ex.id})${j.pdf ? ` · PDF ${data.sourcePdfUrl}` : ''}\n`)
  }
  console.log(COMMIT ? 'Terminé.' : 'Simulation — relancer avec --commit pour écrire.')
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
