/**
 * Import de la Loi sur la Paternité, la Maternité et la Filiation (28 mai 2014, Le Moniteur
 * N° 105 du 4 juin 2014) en LÉGISLATION → thème « Droit privé », PUIS application de ses
 * effets sur le Code civil annoté (overlay §02, bodyOriginal intact) :
 *   - modifie les articles 293, 311, 606 (textes de remplacement portés par la loi) ;
 *   - abroge les articles 294, 295, 302, 303, 304, 306, 308, 309, 313, 611 ;
 *   - badges (annotations.status), anciennes versions (annotations.oldVersions → pliable
 *     « Ancienne version & législation connexe ») et renvois croisés LOI 8 / LOI 16 → la loi.
 * Idempotent : purge la source LOI_FILIATION_2014 + les ArticleVersion qu'elle a créés.
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'
import { amendArticle, abrogateArticle } from '../src/lib/legislation/amendments'
import { splitArticles } from '../src/lib/legislation/segment'

const DATA = 'scripts/data/loi-filiation-2014'
const SOURCE = 'LOI_FILIATION_2014'
const TITLE = 'Loi sur la Paternité, la Maternité et la Filiation'
const REF = 'Loi du 28 mai 2014 sur la paternité, la maternité et la filiation (Le Moniteur N° 105 du 4 juin 2014)'
const EFFECTIVE = new Date('2014-06-04')

const MODIFIED = ['293', '311', '606']
const ABROGATED = ['294', '295', '302', '303', '304', '306', '308', '309', '313', '611']

async function main() {
  const body = readFileSync(`${DATA}/bodyOriginal.txt`, 'utf8')
  const newTexts = JSON.parse(readFileSync(`${DATA}/newtexts.json`, 'utf8')) as Record<string, string>

  // ── Code civil cible ──
  const cc = await prisma.document.findFirst({ where: { source: 'CODE_CIVIL_ANNOTE' }, select: { id: true, bodyOriginal: true, annotationsJson: true } })
  if (!cc) throw new Error('Code civil introuvable')

  // ── Purge idempotente (loi + overlay qu'elle avait posé) ──
  const old = await prisma.document.findFirst({ where: { source: SOURCE }, select: { id: true } })
  if (old) {
    await prisma.articleVersion.deleteMany({ where: { documentId: cc.id, OR: [{ amendedByDocId: old.id }, { amendedByNumber: REF }] } })
    // snapshots MODIFIE seq=0 posés par un run précédent (sans amendedBy) : retirés aussi
    await prisma.articleVersion.deleteMany({ where: { documentId: cc.id, anchor: { in: [...MODIFIED, ...ABROGATED].map((n) => `art-${n}`) }, amendedByDocId: null, amendedByNumber: null } })
    await prisma.documentTheme.deleteMany({ where: { documentId: old.id } })
    await prisma.document.delete({ where: { id: old.id } })
    const os = process.env.OPENSEARCH_NODE
    if (os) {
      const auth = 'Basic ' + Buffer.from(`${process.env.OPENSEARCH_USERNAME ?? ''}:${process.env.OPENSEARCH_PASSWORD ?? ''}`).toString('base64')
      await fetch(`${os.replace(/\/$/, '')}/lam_legislation/_doc/${old.id}`, { method: 'DELETE', headers: { Authorization: auth } }).catch(() => {})
    }
    console.log('Ancien import purgé (doc + overlay + OpenSearch).')
  }

  // ── 1) Document de la loi → thème droit-prive ──
  const theme = await prisma.theme.findUnique({ where: { slug: 'droit-prive' }, select: { id: true, labelFr: true } })
  if (!theme) throw new Error('thème « droit-prive » introuvable')
  const law = await prisma.document.create({
    data: {
      type: 'LEGISLATION',
      status: 'EN_VIGUEUR',
      titleFr: TITLE,
      number: 'Loi du 28 mai 2014',
      originalLang: 'fr',
      matiere: 'civil',
      moniteurRef: 'Le Moniteur N° 105 du 4 juin 2014',
      publicationDate: EFFECTIVE,
      bodyOriginal: body,
      searchText: buildSearchText({ titleFr: TITLE, matiere: 'civil', bodyOriginal: body }),
      source: SOURCE,
      summaryFr:
        'Loi consacrant l’égalité des filiations (légitime, naturelle, adoptive), organisant la recherche de paternité ' +
        'et de maternité (tests ADN) et harmonisant le Code civil : modifie les articles 293, 311 et 606 ; abroge les ' +
        'articles 294, 295, 302, 303, 304, 306, 308, 309, 313 et 611. Votée le 10 mai 2010 (Chambre) et le 12 avril 2012 ' +
        '(Sénat), promulguée le 28 mai 2014.',
    },
  })
  await prisma.documentTheme.create({ data: { documentId: law.id, themeId: theme.id, isPrimary: true, assignedBy: 'IMPORT' } })
  await reindexDocument(law.id)
  console.log(`Loi créée : ${law.id} → thème « ${theme.labelFr} » (principal), réindexée.`)

  // ── 2) Overlay d'amendements sur le Code civil ──
  // Textes d'origine, snapshotés depuis bodyOriginal (1ʳᵉ occurrence de chaque ancre).
  // Les libellés du sommaire BORNENT les segments (sinon le dernier article d'un chapitre
  // engloutirait l'en-tête suivant dans son snapshot ET dans l'overlay affiché).
  const annCc = JSON.parse(cc.annotationsJson!)
  const normHead = (s: string) => s.replace(/\s+/g, ' ').trim()
  const tocLabels = new Set<string>((annCc.toc as { label: string }[]).map((e) => normHead(e.label)))
  const orig = new Map<string, string>()
  for (const seg of splitArticles(cc.bodyOriginal, (line) => tocLabels.has(normHead(line)))) {
    if (seg.anchor && !orig.has(seg.anchor)) orig.set(seg.anchor, seg.lines.join('\n'))
  }
  for (const n of MODIFIED) {
    const anchor = `art-${n}`
    // Tête au format du Code (« Art. N … ») pour que l'ancre et le badge survivent à l'overlay.
    const newBody = `Art. ${n} (Loi du 28 mai 2014) ` + newTexts[n].replace(/^Article\s+\d+\s*\.?-?\s*/i, '')
    await amendArticle({
      documentId: cc.id, anchor, label: `Article ${n}`,
      originalBody: orig.get(anchor) ?? null, newBody,
      amendedByDocId: law.id, amendedByNumber: REF, effectiveDate: EFFECTIVE, origin: 'MANUAL',
    })
    console.log(`  modifié : art. ${n}`)
  }
  for (const n of ABROGATED) {
    const anchor = `art-${n}`
    await abrogateArticle({
      documentId: cc.id, anchor, label: `Article ${n}`,
      originalBody: orig.get(anchor) ?? null,
      amendedByDocId: law.id, amendedByNumber: REF, effectiveDate: EFFECTIVE,
    })
    console.log(`  abrogé  : art. ${n}`)
  }

  // ── 3) annotationsJson : badges + anciennes versions + renvois croisés LOI 8 / LOI 16 ──
  const ann = JSON.parse(cc.annotationsJson!)
  ann.status = ann.status ?? {}
  ann.oldVersions = ann.oldVersions ?? {}
  for (const n of MODIFIED) ann.status[`art-${n}`] = 'modifié'
  for (const n of ABROGATED) ann.status[`art-${n}`] = 'abrogé'
  for (const n of [...MODIFIED, ...ABROGATED]) {
    const t = orig.get(`art-${n}`)
    if (t) ann.oldVersions[`art-${n}`] = t.replace(/^Art\.?\s+\d+\s*/i, '') // texte d'avant la loi de 2014
  }
  const note = 'Paternité, maternité et filiation : articles modifiés (293, 311, 606) et abrogés (294, 295, 302–309, 313, 611) par la'
  ann.crossRefs = (ann.crossRefs ?? []).filter((c: { anchor: string }) => c.anchor !== 'sec-41' && c.anchor !== 'sec-93')
  ann.crossRefs.push(
    { anchor: 'sec-41', articles: [], note, docs: [{ label: TITLE + ' (2014)', id: law.id }] },
    { anchor: 'sec-93', articles: [], note: 'Successions : article 606 modifié et article 611 abrogé par la', docs: [{ label: TITLE + ' (2014)', id: law.id }] },
  )
  await prisma.document.update({ where: { id: cc.id }, data: { annotationsJson: JSON.stringify(ann) } })
  console.log('annotationsJson : badges + anciennes versions + renvois LOI 8/LOI 16 à jour (EN PLACE).')

  console.log(`\n✅ Terminé — loi ${law.id} · Code civil ${cc.id} : ${MODIFIED.length} modifiés, ${ABROGATED.length} abrogés.`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
