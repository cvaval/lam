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
import { createTheme } from '../src/lib/legislation/themes'

const DATA = 'scripts/data/loi-filiation-2014'
const SOURCE = 'LOI_FILIATION_2014'
const TITLE = 'Loi sur la Paternité, la Maternité et la Filiation'
const REF = 'Loi du 28 mai 2014 sur la paternité, la maternité et la filiation (Le Moniteur N° 105 du 4 juin 2014)'
const EFFECTIVE = new Date('2014-06-04')

const MODIFIED = ['293', '311', '606']
const ABROGATED = ['294', '295', '302', '303', '304', '306', '308', '309', '313', '611']
// Article de la loi qui modifie / abroge chaque article du Code civil (pour la note « connexe »).
const MOD_BY: Record<string, string> = { '293': '3', '311': '9', '606': '11' }
const ABROG_BY: Record<string, string> = { '294': '4', '295': '4', '302': '8', '303': '8', '304': '8', '306': '8', '308': '8', '309': '8', '313': '10', '611': '12' }
// Dispositions générales de la loi (art. 1 et 2) affichées sous l'en-tête de la LOI Nº 8 (sec-41).
const LOI8_INSERTED = [
  {
    label: 'Article 1er — Loi sur la paternité, la maternité et la filiation',
    body:
      'L’article 1 du Décret du 27 janvier 1959 consacrant l’égalité des enfants naturels et des enfants légitimes est ainsi modifié :\n' +
      'Il est établi le principe de l’égalité des filiations légitime, naturelle, adoptive ou autres, impliquant nécessairement l’égalité entre tous les enfants qu’ils soient de couples mariés ou non.\n' +
      'La filiation engendre des droits et des obligations moraux et pécuniaires à la charge des parents et de leurs enfants.',
  },
  {
    label: 'Article 2 — Loi sur la paternité, la maternité et la filiation',
    body:
      'La filiation s’établit par l’inscription de la naissance sur les registres de l’officier de l’état civil ou sur ceux du Consul haïtien à l’étranger, sur comparution des parents ou de l’un d’eux muni d’un acte authentique ou d’une procuration spéciale donnée par l’autre parent, ou d’une décision de justice passée en force de chose souverainement jugée, résultant d’une action en recherche de paternité ou de maternité.\n' +
      'Dans le cas d’une décision de confirmation de paternité ou de maternité, le nom de famille du parent, qu’il soit marié ou non, et à quelque corps qu’il appartienne, sera entre autre dévolu à l’enfant.',
  },
]

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

  // ── 1) Document de la loi → thème « Personne et Famille » (sous Droit privé) ──
  const droitPrive = await prisma.theme.findUnique({ where: { slug: 'droit-prive' }, select: { id: true } })
  if (!droitPrive) throw new Error('thème « droit-prive » introuvable')
  const existing = await prisma.theme.findUnique({ where: { slug: 'personne-famille' }, select: { id: true, labelFr: true } })
  const theme = existing ?? (await createTheme({ slug: 'personne-famille', labelFr: 'Personne et Famille', labelEn: 'Persons & Family', labelHt: 'Moun & Fanmi', parentId: droitPrive.id }))
  if (!existing) console.log('Thème créé : « Personne et Famille » (personne-famille) sous Droit privé.')
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
  // Note « connexe » sous chaque article visé : intitulé cliquable (docId) vers la loi + article
  // de la loi en cause. APPEND (préserve la législation connexe propre au Code civil) ; idempotent
  // (retire d'abord toute note de CETTE loi, repérée par son intitulé).
  ann.connexe = ann.connexe ?? {}
  const addConnexe = (art: string, text: string) => {
    const kept = (ann.connexe[art] ?? []).filter((b: { label?: string }) => b.label !== TITLE)
    ann.connexe[art] = [...kept, { label: TITLE, text, docId: law.id }]
  }
  for (const n of MODIFIED) addConnexe(`art-${n}`, `Nouvelle rédaction de l’article issue de l’article ${MOD_BY[n]} de la Loi sur la paternité, la maternité et la filiation.`)
  for (const n of ABROGATED) addConnexe(`art-${n}`, `Abrogé en vertu de l’article ${ABROG_BY[n]} de la Loi sur la paternité, la maternité et la filiation.`)

  const note41 = 'Cette loi pose, sous la présente LOI Nº 8, deux dispositions générales — le principe de l’égalité des filiations (art. 1) et l’établissement de la filiation (art. 2) — et réécrit / abroge plusieurs articles du Code civil. Voir la'
  ann.crossRefs = (ann.crossRefs ?? []).filter((c: { anchor: string }) => c.anchor !== 'sec-41' && c.anchor !== 'sec-93')
  ann.crossRefs.push(
    { anchor: 'sec-41', articles: [], note: note41, docs: [{ label: TITLE + ' (2014)', id: law.id }], insertedArticles: LOI8_INSERTED },
    { anchor: 'sec-93', articles: [], note: 'Successions : article 606 modifié et article 611 abrogé par la', docs: [{ label: TITLE + ' (2014)', id: law.id }] },
  )
  await prisma.document.update({ where: { id: cc.id }, data: { annotationsJson: JSON.stringify(ann) } })
  console.log('annotationsJson : badges + anciennes versions + renvois LOI 8/LOI 16 à jour (EN PLACE).')

  console.log(`\n✅ Terminé — loi ${law.id} · Code civil ${cc.id} : ${MODIFIED.length} modifiés, ${ABROGATED.length} abrogés.`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
