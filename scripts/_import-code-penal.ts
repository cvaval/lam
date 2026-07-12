/**
 * Import du Code pénal d'Haïti (texte consolidé) en LÉGISLATION → Droit pénal général.
 * Lit la structure parsée (scripts/data/code-penal/parse_cp.py) + l'index thématique (IA, _cp_index.ts).
 * Idempotent (source=CODE_PENAL_ANNOTE → purge/recrée + désindexe OpenSearch). À lancer une fois.
 *
 *   npx tsx scripts/_import-code-penal.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'

const DATA = 'scripts/data/code-penal/parsed'
const SOURCE = 'CODE_PENAL_ANNOTE'
const TITLE = 'Code pénal d’Haïti'

async function main() {
  const body = readFileSync(`${DATA}/bodyOriginal.txt`, 'utf8')
  const struct = JSON.parse(readFileSync(`${DATA}/structure.json`, 'utf8'))
  struct.title = TITLE
  console.log(
    `Lu : ${(body.length / 1024) | 0} Ko · ${struct.toc.length} en-têtes · ${Object.keys(struct.labels).length} articles · ` +
      `${Object.keys(struct.status ?? {}).length} statuts · ${struct.indexEntries.length} sujets d'index`,
  )
  if (!struct.indexEntries.length) console.warn('⚠ indexEntries vide — lancer scripts/_cp_index.ts d’abord (onglet Index vide sinon).')

  // ── Thème « Droit pénal général » (existant dans la taxonomie, cf. scripts/seed-themes.ts) ──
  const theme = await prisma.theme.findUnique({ where: { slug: 'penal-general' }, select: { id: true, labelFr: true } })
  if (!theme) throw new Error('thème « penal-general » introuvable (seed manquant : npx tsx scripts/seed-themes.ts)')

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

  const searchText = buildSearchText({ titleFr: TITLE, matiere: 'penal', bodyOriginal: body })
  const doc = await prisma.document.create({
    data: {
      type: 'LEGISLATION',
      status: 'EN_VIGUEUR',
      titleFr: TITLE,
      number: 'Code pénal d’Haïti',
      originalLang: 'fr',
      matiere: 'penal',
      publicationDate: new Date('1835-08-11'),
      bodyOriginal: body,
      annotationsJson: JSON.stringify(struct),
      searchText,
      source: SOURCE,
      summaryFr:
        'Code pénal d’Haïti (promulgué en 1835) — version consolidée intégrant les décrets et lois modificateurs ' +
        '(citations « (Décret du …) », mentions d’abrogation et de modification dans le texte). Lois Nº 1 à 5, ' +
        'articles 1 à 413 (dispositions générales, peines, personnes punissables, crimes et délits, contraventions ' +
        'de police), avec table des matières hiérarchique (Titres, Chapitres, Sections, §) et index thématique dans ' +
        'le menu latéral, et renvois croisés entre articles apparentés.',
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
