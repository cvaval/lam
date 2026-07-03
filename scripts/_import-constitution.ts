/**
 * Import de la Constitution de 1987 (consolidée, amendée 2011) en LÉGISLATION → Constitution.
 * Lit la structure parsée (parse_const.py) + l'index thématique (IA). Idempotent
 * (source=CONSTITUTION_1987 → purge/recrée + désindexe OpenSearch). À lancer une fois.
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'

const DATA = 'scripts/data/constitution/parsed' // données versionnées (rescapées de /tmp — audit 2 juil. 2026)
const SOURCE = 'CONSTITUTION_1987'
const TITLE = 'Constitution de 1987'
const DESC =
  'amendée par la Loi constitutionnelle portant amendement de la Constitution de 1987 — reproduction pour erreur matérielle, publiée dans Le Moniteur N° 96 du 19 juin 2012.'

async function main() {
  const body = readFileSync(`${DATA}/bodyOriginal.txt`, 'utf8')
  const struct = JSON.parse(readFileSync(`${DATA}/structure.json`, 'utf8'))
  struct.title = TITLE
  console.log(
    `Lu : ${(body.length / 1024) | 0} Ko · ${struct.toc.length} en-têtes · ${Object.keys(struct.oldVersions).length} anciennes versions · ${struct.indexEntries.length} sujets d'index`,
  )

  // ── Thème « Constitution » (existant dans la taxonomie) ──
  const theme = await prisma.theme.findUnique({ where: { slug: 'constitution' }, select: { id: true, labelFr: true } })
  if (!theme) throw new Error('thème « constitution » introuvable (seed manquant)')

  // ── Purge de l'ancien import (base + OpenSearch lam_legislation) ──
  const old = await prisma.document.findFirst({ where: { source: SOURCE }, select: { id: true } })
  if (old) {
    await prisma.documentTheme.deleteMany({ where: { documentId: old.id } })
    await prisma.crossRef.deleteMany({ where: { fromId: old.id } }).catch(() => {})
    await prisma.document.delete({ where: { id: old.id } })
    const os = process.env.OPENSEARCH_NODE
    if (os) {
      const auth = 'Basic ' + Buffer.from(`${process.env.OPENSEARCH_USERNAME ?? ''}:${process.env.OPENSEARCH_PASSWORD ?? ''}`).toString('base64')
      await fetch(`${os.replace(/\/$/, '')}/lam_legislation/_doc/${old.id}`, { method: 'DELETE', headers: { Authorization: auth } }).catch(() => {})
    }
    console.log('Ancien import purgé (base + OpenSearch).')
  }

  const searchText = buildSearchText({ titleFr: TITLE, matiere: 'constitutionnel', bodyOriginal: body })
  const doc = await prisma.document.create({
    data: {
      type: 'LEGISLATION',
      status: 'EN_VIGUEUR',
      titleFr: TITLE,
      number: 'Constitution du 29 mars 1987',
      originalLang: 'fr',
      matiere: 'constitutionnel',
      moniteurRef: 'Le Moniteur N° 96 du 19 juin 2012',
      publicationDate: new Date('1987-03-29'),
      bodyOriginal: body,
      annotationsJson: JSON.stringify(struct),
      searchText,
      source: SOURCE,
      summaryFr: `Constitution de la République d'Haïti du 29 mars 1987, ${DESC} Version consolidée : texte en vigueur (amendé) avec l'ancienne version de 1987 sous chaque article amendé, et index thématique.`,
    },
  })
  console.log(`Document créé : ${doc.id} (${(body.length / 1024) | 0} Ko de texte, annotationsJson ${(JSON.stringify(struct).length / 1024) | 0} Ko)`)

  await prisma.documentTheme.create({ data: { documentId: doc.id, themeId: theme.id, isPrimary: true, assignedBy: 'IMPORT' } })
  console.log(`Rattaché au thème « ${theme.labelFr} » (principal).`)

  await reindexDocument(doc.id)
  console.log('Réindexé (searchText + themeLabels + OpenSearch).')
  console.log(`\n✅ Import terminé : doc ${doc.id}`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
