/**
 * Import du Code du travail annoté (J.-F. Salès) — 1 Document, lois connexes en sections
 * internes + sous-thèmes ancrés. Lit la structure parsée (parse_ct.py). Idempotent
 * (source=CODE_TRAVAIL_ANNOTE → purge/recrée). À lancer une fois.
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'

const DATA = 'scripts/data/code-travail/parsed' // données versionnées (rescapées de /tmp — audit 2 juil. 2026)
const SOURCE = 'CODE_TRAVAIL_ANNOTE'

interface Connexe { title: string; anchor: string }
interface NavItem { label: string; anchor: string }
interface Structure {
  title: string
  annotationAuthor: string
  navToc: { label: string; anchor: string; children: NavItem[] }[]
  toc: { level: number; label: string; anchor: string; kind: string }[]
  connexes: Connexe[]
  jurisprudence: Record<string, { ref: string; excerpt: string }[]>
  indexEntries: { subject: string; ctRefs: number[] }[]
  crossRefs?: { anchor: string; articles: number[]; note?: string }[]
}

// Renvois croisés ÉDITORIAUX (section → articles du Code), résolus par libellé de section
// (résilient au renumérotage des ancres). Ajouter ici les renvois demandés par l'éditeur.
const CROSSREFS: { match: RegExp; articles: number[]; note?: string }[] = [
  { match: /LIBERT.* SYNDICAL/i, articles: [225] }, // Liberté syndicale (Conv. 87) ↔ art. 225
]

function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72)
}

async function main() {
  const body = readFileSync(`${DATA}/bodyOriginal.txt`, 'utf8')
  const struct = JSON.parse(readFileSync(`${DATA}/structure.json`, 'utf8')) as Structure
  console.log(`Lu : ${body.length} car. de texte · ${Object.keys(struct.jurisprudence).length} articles annotés · ${struct.connexes.length} connexes`)

  // Résout les renvois croisés éditoriaux par libellé de section → ancre courante.
  struct.crossRefs = []
  for (const cr of CROSSREFS) {
    const sec = struct.toc.find((e) => cr.match.test(e.label))
    if (sec) struct.crossRefs.push({ anchor: sec.anchor, articles: cr.articles, note: cr.note })
    else console.warn('⚠ Renvoi croisé non résolu :', cr.match.source)
  }
  console.log(`Renvois croisés résolus : ${struct.crossRefs.length}/${CROSSREFS.length}`)

  // ── Thèmes : Droit du travail › Code du travail › [connexes] ──
  const parent = await prisma.theme.findUnique({ where: { slug: 'droit-du-travail' } })
  if (!parent) throw new Error('thème droit-du-travail introuvable (seed manquant)')
  const codeTheme = await prisma.theme.upsert({
    where: { slug: 'code-du-travail' },
    update: { parentId: parent.id, color: '#F4A823' },
    create: { slug: 'code-du-travail', labelFr: 'Code du travail', labelEn: 'Labour Code', labelHt: 'Kòd travay', parentId: parent.id, position: 0, color: '#F4A823' },
  })
  // Sous-thèmes ancrés sous « Code du travail » : d'abord les chapitres (livres) du Code,
  // puis les lois connexes. Chacun pointe vers SA section interne du document (anchor sec-N).
  const anchored: { theme: { id: string }; anchor: string }[] = []
  let pos = 0
  const upsertSub = async (label: string, anchor: string) => {
    const slug = ('ct-' + slugify(label)).slice(0, 78)
    const th = await prisma.theme.upsert({
      where: { slug },
      update: { labelFr: label, parentId: codeTheme.id, position: pos },
      create: { slug, labelFr: label, parentId: codeTheme.id, position: pos },
    })
    anchored.push({ theme: th, anchor })
    pos++
  }
  const chapters = struct.navToc?.[0]?.children ?? [] // les 9 livres du Code
  for (const ch of chapters) await upsertSub(ch.label, ch.anchor)
  for (const c of struct.connexes) await upsertSub(c.title, c.anchor)
  console.log(`Thèmes : « Code du travail » + ${chapters.length} chapitres + ${struct.connexes.length} lois connexes`)

  // ── Document (purge l'ancien import s'il existe) ──
  const old = await prisma.document.findFirst({ where: { source: SOURCE }, select: { id: true } })
  if (old) {
    await prisma.documentTheme.deleteMany({ where: { documentId: old.id } })
    await prisma.articleVersion.deleteMany({ where: { documentId: old.id } }).catch(() => {})
    await prisma.crossRef.deleteMany({ where: { fromId: old.id } }).catch(() => {})
    await prisma.document.delete({ where: { id: old.id } })
    // DÉSINDEXE d'OpenSearch (DOCTRINE → lam_doctrine) : sinon l'ancien id reste dans la
    // recherche et un clic mène à un doc supprimé (notFound). Cf. incident « impossible d'ouvrir ».
    const osNode = process.env.OPENSEARCH_NODE
    if (osNode) {
      const auth = 'Basic ' + Buffer.from(`${process.env.OPENSEARCH_USERNAME ?? ''}:${process.env.OPENSEARCH_PASSWORD ?? ''}`).toString('base64')
      await fetch(`${osNode.replace(/\/$/, '')}/lam_doctrine/_doc/${old.id}`, { method: 'DELETE', headers: { Authorization: auth } }).catch(() => {})
    }
    console.log('Ancien import purgé (base + OpenSearch).')
  }

  const searchText = buildSearchText({ titleFr: struct.title, author: struct.annotationAuthor, matiere: 'social travail', bodyOriginal: body })
  const doc = await prisma.document.create({
    data: {
      type: 'DOCTRINE',
      status: 'EN_VIGUEUR',
      titleFr: struct.title,
      number: 'Décret du 24 février 1984',
      originalLang: 'fr',
      author: struct.annotationAuthor,
      matiere: 'social',
      moniteurRef: 'Le Moniteur — Décret du 24 février 1984',
      bodyOriginal: body,
      annotationsJson: JSON.stringify(struct),
      searchText,
      source: SOURCE,
      summaryFr: `Code du travail haïtien (décret du 24 février 1984), annoté de jurisprudence par ${struct.annotationAuthor}, avec ${struct.connexes.length} textes connexes et un index alphabétique des matières.`,
    },
  })
  console.log(`Document créé : ${doc.id} (${(body.length / 1024) | 0} Ko de texte)`)

  // ── Rattachements thématiques ──
  await prisma.documentTheme.create({ data: { documentId: doc.id, themeId: codeTheme.id, isPrimary: true, assignedBy: 'IMPORT' } })
  for (const a of anchored) {
    await prisma.documentTheme.create({ data: { documentId: doc.id, themeId: a.theme.id, isPrimary: false, assignedBy: 'IMPORT', anchor: a.anchor } })
  }
  console.log(`Rattaché à « Code du travail » (principal) + ${anchored.length} sous-thèmes ancrés (chapitres + connexes).`)

  await reindexDocument(doc.id)
  console.log('Réindexé (searchText + themeLabels + OpenSearch).')

  const themed = await prisma.documentTheme.count({ where: { documentId: doc.id } })
  console.log(`\n✅ Import terminé : doc ${doc.id}, ${themed} rattachements, annotationsJson ${(JSON.stringify(struct).length / 1024) | 0} Ko.`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
