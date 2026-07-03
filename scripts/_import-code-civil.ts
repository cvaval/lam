/**
 * Import du Code civil d'Haïti annoté (décrets intégrés) en LÉGISLATION → Droit civil.
 * Lit la structure parsée (scripts/data/code-civil/parse_cc.py) + l'index thématique (IA).
 * Idempotent (source=CODE_CIVIL_ANNOTE → purge/recrée + désindexe OpenSearch). À lancer une fois.
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'

const DATA = 'scripts/data/code-civil/parsed'
const SOURCE = 'CODE_CIVIL_ANNOTE'
const TITLE = 'Code civil d’Haïti'

async function main() {
  const body = readFileSync(`${DATA}/bodyOriginal.txt`, 'utf8')
  const struct = JSON.parse(readFileSync(`${DATA}/structure.json`, 'utf8'))
  struct.title = TITLE
  console.log(
    `Lu : ${(body.length / 1024) | 0} Ko · ${struct.toc.length} en-têtes · ${Object.keys(struct.labels).length} articles · ` +
      `${Object.keys(struct.connexe ?? {}).length} articles à connexe · ${Object.keys(struct.jurisprudence).length} clés de jurisprudence · ` +
      `${struct.indexEntries.length} sujets d'index`,
  )
  if (!struct.indexEntries.length) console.warn('⚠ indexEntries vide — lancer scripts/_cc_index.ts d’abord (onglet Index vide sinon).')

  // ── Thème « Droit civil » (existant dans la taxonomie) ──
  const theme = await prisma.theme.findUnique({ where: { slug: 'droit-civil' }, select: { id: true, labelFr: true } })
  if (!theme) throw new Error('thème « droit-civil » introuvable (seed manquant)')

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

  const searchText = buildSearchText({ titleFr: TITLE, matiere: 'civil', bodyOriginal: body })
  const doc = await prisma.document.create({
    data: {
      type: 'LEGISLATION',
      status: 'EN_VIGUEUR',
      titleFr: TITLE,
      number: 'Code civil du 27 mars 1825',
      originalLang: 'fr',
      matiere: 'civil',
      publicationDate: new Date('1825-03-27'),
      bodyOriginal: body,
      annotationsJson: JSON.stringify(struct),
      searchText,
      source: SOURCE,
      summaryFr:
        'Code civil d’Haïti (promulgué le 27 mars 1825, exécutoire le 1er mai 1826) — version consolidée avec les décrets ' +
        'modificateurs intégrés (les amendements prévalent dans le texte ; la législation connexe est repliée sous chaque ' +
        'article visé) et annotations : jurisprudence de la Cour de cassation et commentaires, repliés sous les articles. ' +
        'Lois Nº 1 à 35, articles 1 à 2047, avec index thématique.',
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
