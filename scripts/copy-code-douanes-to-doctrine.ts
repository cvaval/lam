/**
 * Crée (ou resynchronise) une COPIE du Code des Douanes dans la DOCTRINE, sans toucher à
 * l'original qui reste en Législation haïtienne (§01). Le document apparaît ainsi dans les
 * DEUX sections, avec le même texte intégral, le même index thématique IA (recherche par
 * thème, renvois) et les mêmes ancres #art-N.
 *
 * Re-exécutable : retrouve la copie par (type=DOCTRINE, number) et la met à jour ; sinon la
 * crée. La source canonique reste la Législation (maintenue par import-code-douanes.ts /
 * index-code-themes.ts) ; relancer ce script reporte ses enrichissements sur la copie.
 *
 *   npx tsx scripts/copy-code-douanes-to-doctrine.ts            (simulation)
 *   npx tsx scripts/copy-code-douanes-to-doctrine.ts --commit   (écriture)
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')
const NUMBER = 'LM2023-SP11'

// Champs de contenu à recopier (hors id/type/horodatage/relations et champs MARQUE).
const FIELDS = {
  status: true, abrogatedByNumber: true, titleFr: true, titleEn: true, titleHt: true,
  bodyOriginal: true, originalLang: true, summaryFr: true, summaryEn: true, summaryHt: true,
  meansFr: true, meansEn: true, meansHt: true, moniteurRef: true, publicationDate: true,
  effectiveDate: true, sourcePdfUrl: true, number: true, juridiction: true, matiere: true,
  author: true, revue: true, year: true, fiscalYear: true, keywords: true, metaJson: true,
  bodyClean: true, richBlocksJson: true, sommaireOcr: true, themeIndexJson: true,
  searchText: true, source: true, category: true, editionType: true,
} as const

async function main() {
  const src = await prisma.document.findFirst({ where: { type: 'LEGISLATION', number: NUMBER }, select: { id: true, ...FIELDS } })
  if (!src) { console.error('Source introuvable (LEGISLATION', NUMBER, ').'); process.exit(1) }
  const { id: srcId, ...content } = src
  // La Doctrine se classe volontiers par année — renseigner si absente, depuis la date de pub.
  const data = { ...content, type: 'DOCTRINE', year: content.year ?? content.publicationDate?.getFullYear() ?? 2023 }
  const idx = content.themeIndexJson ? JSON.parse(content.themeIndexJson).length : 0
  console.log(`Source LEGISLATION ${srcId} · body ${(content.bodyClean?.length || content.bodyOriginal?.length || 0)}c · themeIndex ${idx} art · matière ${content.matiere}`)

  const existing = await prisma.document.findFirst({ where: { type: 'DOCTRINE', number: NUMBER }, select: { id: true } })
  if (!COMMIT) {
    console.log(existing ? `\nSIMULATION — copie DOCTRINE existante (${existing.id}) serait MISE À JOUR.` : '\nSIMULATION — une copie DOCTRINE serait CRÉÉE.')
    console.log('Relancer avec --commit.'); await prisma.$disconnect(); return
  }
  let twinId: string
  if (existing) {
    await prisma.document.update({ where: { id: existing.id }, data })
    twinId = existing.id
    console.log(`✓ copie DOCTRINE mise à jour (${twinId})`)
  } else {
    const created = await prisma.document.create({ data })
    twinId = created.id
    console.log(`✓ copie DOCTRINE créée (${twinId})`)
  }
  await prisma.auditLog.create({ data: { action: 'DOC_PUBLISHED', targetType: 'Document', targetId: twinId, metaJson: JSON.stringify({ op: 'copy_section', from: 'LEGISLATION', fromId: srcId, to: 'DOCTRINE', number: NUMBER }) } }).catch((e) => console.warn('audit:', (e as Error).message))

  // Contrôles
  console.log('\n--- contrôles ---')
  console.log('LEGISLATION', NUMBER, '(original intact, =1):', await prisma.document.count({ where: { type: 'LEGISLATION', number: NUMBER } }))
  console.log('DOCTRINE', NUMBER, '(copie, =1):', await prisma.document.count({ where: { type: 'DOCTRINE', number: NUMBER } }))
  console.log('INDEX', NUMBER, '(catalogue intact, =1):', await prisma.document.count({ where: { type: 'INDEX', number: NUMBER } }))
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
