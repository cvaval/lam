/**
 * Import du Code de commerce (édition Vandal) en LÉGISLATION → thème « Droit commercial ».
 * Lit la structure parsée (scripts/data/code-commerce/parse_cc0.py + parse_index.py).
 * Idempotent (source=CODE_COMMERCE_ANNOTE → purge/recrée + désindexe OpenSearch). À lancer une fois.
 *
 * Le thème « Droit commercial » (enfant de « Droit économique & des affaires ») est créé
 * s'il n'existe pas — À PLAT : le Code et les textes satellites y sont tous rattachés au
 * même niveau (décision cliente du 20 juil. 2026 — le Code est un texte parmi les autres).
 *
 *   npx tsx scripts/_import-code-commerce.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'

const DATA = 'scripts/data/code-commerce/parsed'
const SOURCE = 'CODE_COMMERCE_ANNOTE'
const TITLE = 'Code de commerce'

/** Thème « Droit commercial » sous « Droit économique & des affaires » (créé si absent). */
export async function ensureThemeCommercial(): Promise<{ id: string; labelFr: string }> {
  const existing = await prisma.theme.findUnique({ where: { slug: 'droit-commercial' }, select: { id: true, labelFr: true } })
  if (existing) return existing
  const root = await prisma.theme.findFirst({
    where: { parentId: null, labelFr: { contains: 'économique' } },
    select: { id: true, labelFr: true },
  })
  if (!root) throw new Error('racine « Droit économique & des affaires » introuvable')
  const siblings = await prisma.theme.count({ where: { parentId: root.id } })
  const t = await prisma.theme.create({
    data: {
      slug: 'droit-commercial',
      labelFr: 'Droit commercial',
      labelEn: 'Commercial law',
      labelHt: 'Dwa komèsyal',
      parentId: root.id,
      position: siblings,
      active: true,
    },
    select: { id: true, labelFr: true },
  })
  console.log(`Thème créé : « Droit commercial » (sous « ${root.labelFr} »).`)
  return t
}

async function main() {
  const body = readFileSync(`${DATA}/bodyOriginal.txt`, 'utf8')
  const struct = JSON.parse(readFileSync(`${DATA}/structure.json`, 'utf8'))
  console.log(
    `Lu : ${(body.length / 1024) | 0} Ko · ${struct.toc.length} en-têtes · ${Object.keys(struct.labels).length} articles · ` +
      `${Object.keys(struct.status ?? {}).length} statuts · ${struct.indexEntries.length} sujets d'index · ` +
      `${Object.keys(struct.jurisprudence).length} articles avec jurisprudence`,
  )
  if (!struct.indexEntries.length) throw new Error('indexEntries vide — lancer parse_index.py d’abord.')

  const theme = await ensureThemeCommercial()

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

  const searchText = buildSearchText({ titleFr: TITLE, matiere: 'commercial', bodyOriginal: body })
  const doc = await prisma.document.create({
    data: {
      type: 'LEGISLATION',
      status: 'EN_VIGUEUR',
      titleFr: TITLE,
      number: 'Code de commerce',
      originalLang: 'fr',
      matiere: 'commercial',
      publicationDate: new Date('1826-03-28'),
      bodyOriginal: body,
      annotationsJson: JSON.stringify(struct),
      searchText,
      source: SOURCE,
      summaryFr:
        'Code de commerce d’Haïti (promulgué en 1826) — édition Vandal consolidée : Livres I à IV ' +
        '(commerce en général ; commerce maritime ; faillites et banqueroutes ; juridiction commerciale), ' +
        '644 articles avec mentions de modification et d’abrogation (têtes « (L. / D. …) », marqueurs « mod »), ' +
        'jurisprudence annotée sous les articles, table des matières hiérarchique (Livres, Titres, Chapitres, ' +
        'Sections) et index alphabétique de l’édition dans le menu latéral. Les lois et décrets d’application ' +
        '(sociétés, institutions financières, propriété industrielle, commerce maritime et aérien, fiscalité) ' +
        'sont publiés en textes séparés dans le même thème « Droit commercial ».',
    },
  })
  console.log(`Document créé : ${doc.id} (${(body.length / 1024) | 0} Ko, annotationsJson ${(JSON.stringify(struct).length / 1024) | 0} Ko)`)

  await prisma.documentTheme.create({ data: { documentId: doc.id, themeId: theme.id, isPrimary: true, assignedBy: 'IMPORT' } })
  console.log(`Rattaché au thème « ${theme.labelFr} » (principal).`)

  await reindexDocument(doc.id)
  console.log('Réindexé (searchText + themeLabels + OpenSearch).')
  console.log(`\n✅ Import terminé : doc ${doc.id}`)
  await prisma.$disconnect()
}

const isMain = process.argv[1]?.endsWith('_import-code-commerce.ts')
if (isMain) main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
