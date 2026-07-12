/**
 * Décret du 6 juillet 2005 « modifiant le régime des Agressions Sexuelles et éliminant en la
 * matière les Discriminations contre la femme » : téléversement + effets sur le Code pénal.
 *
 *  1) Thèmes : penal → « Infractions contre les personnes » → « Agressions sexuelles ».
 *  2) Document LÉGISLATION (source DECRET_AGRESSIONS_2005) rattaché à « Agressions sexuelles ».
 *  3) Overlay du Code pénal (bodyOriginal canonique §02 — seuls des ERRATA de scan sont corrigés) :
 *       • errata : « 6 juillet 2008 » → « 6 juillet 2005 » (art. 279) ; « 200S » → « 2005 » (art. 287) ;
 *       • art. 269, 270 : nouvelle rédaction (amendArticle — le Code portait encore l'ancienne
 *         version) ; 278–283 portaient DÉJÀ la nouvelle rédaction consolidée (aucun overlay) ;
 *       • status : modifié (269, 270, 278–283) / abrogé (284–287) → pastilles ;
 *       • oldVersions + connexe → pliable « Ancienne version & législation connexe » sous chaque
 *         article, avec renvoi au décret (cliquable après déploiement de l'enrichissement RelatedLaw) ;
 *       • crossRefs.docs → renvoi cliquable (LIVE) au décret sous les sections concernées.
 *
 * Idempotent : purge la source DECRET_AGRESSIONS_2005 + les ArticleVersion qu'elle a posés,
 * puis recrée. À relancer si le Code pénal est ré-importé (nouvel id de document).
 *
 *   npx tsx scripts/_apply-decret-agressions-2005.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'
import { amendArticle } from '../src/lib/legislation/amendments'
import { splitArticles } from '../src/lib/legislation/segment'
import { createTheme } from '../src/lib/legislation/themes'

const DATA = 'scripts/data/decret-agressions-2005'
const SOURCE = 'DECRET_AGRESSIONS_2005'
const TITLE = 'Décret modifiant le régime des Agressions Sexuelles et éliminant en la matière les Discriminations contre la femme'
const REF = 'Décret du 6 juillet 2005 modifiant le régime des Agressions Sexuelles et éliminant en la matière les Discriminations contre la femme'
const REF_SHORT = 'Décret du 6 juillet 2005 (Agressions sexuelles)'
const EFFECTIVE = new Date('2005-07-06')

// Code pénal (art. → article du décret qui l'affecte). Textes de remplacement : décret art. 10/11.
const NEW_TEXT: Record<string, string> = {
  '269': 'Le meurtre par le conjoint de l’un ou de l’autre sexe sur son conjoint n’est pas excusable, si la vie du conjoint qui a commis le meurtre n’a pas été mise en péril dans le moment même où le meurtre a eu lieu.',
  '270': 'Le meurtre ou les blessures, s’ils ont été immédiatement provoqués en réaction à une agression sexuelle, seront considérés comme meurtre ou blessures excusables.',
}
const OVERLAY = ['269', '270'] // le Code portait encore l'ANCIENNE version → on affiche la nouvelle
const MODIFIED_ALREADY = ['278', '279', '280', '281', '282', '283'] // déjà consolidés (nouvelle rédaction en place)
const ABROGATED = ['284', '285', '286', '287']
const DECREE_ART: Record<string, string> = { '269': '10', '270': '11', '278': '2', '279': '3', '280': '4', '281': '6', '282': '7', '283': '8' }

async function ensureTheme(slug: string, labelFr: string, labelEn: string, labelHt: string, parentId: string | null) {
  const found = await prisma.theme.findUnique({ where: { slug }, select: { id: true, labelFr: true } })
  if (found) return found.id
  const t = await createTheme({ slug, labelFr, labelEn, labelHt, parentId })
  console.log(`  thème créé : « ${labelFr} » (${slug})`)
  return t.id
}

async function main() {
  const decreeBody = readFileSync(`${DATA}/bodyOriginal.txt`, 'utf8')

  // ── Code pénal cible ──
  const cp = await prisma.document.findFirst({ where: { source: 'CODE_PENAL_ANNOTE' }, select: { id: true, bodyOriginal: true, annotationsJson: true } })
  if (!cp) throw new Error('Code pénal introuvable (source CODE_PENAL_ANNOTE)')

  // ── Purge idempotente (décret + overlay qu'il avait posé) ──
  const old = await prisma.document.findFirst({ where: { source: SOURCE }, select: { id: true } })
  if (old) {
    await prisma.articleVersion.deleteMany({ where: { documentId: cp.id, OR: [{ amendedByDocId: old.id }, { amendedByNumber: REF }] } })
    await prisma.documentTheme.deleteMany({ where: { documentId: old.id } })
    await prisma.document.delete({ where: { id: old.id } })
    const os = process.env.OPENSEARCH_NODE
    if (os) {
      const auth = 'Basic ' + Buffer.from(`${process.env.OPENSEARCH_USERNAME ?? ''}:${process.env.OPENSEARCH_PASSWORD ?? ''}`).toString('base64')
      await fetch(`${os.replace(/\/$/, '')}/lam_legislation/_doc/${old.id}`, { method: 'DELETE', headers: { Authorization: auth } }).catch(() => {})
    }
    console.log('Ancien import purgé (décret + overlay + OpenSearch).')
  }

  // ── 1) Arborescence de thèmes : penal → Infractions contre les personnes → Agressions sexuelles ──
  const penal = await prisma.theme.findUnique({ where: { slug: 'penal' }, select: { id: true } })
  if (!penal) throw new Error('thème parent « penal » introuvable')
  const infractionsId = await ensureTheme('infractions-personnes', 'Infractions contre les personnes', 'Offences against persons', 'Enfraksyon kont moun', penal.id)
  const agressionsId = await ensureTheme('agressions-sexuelles', 'Agressions sexuelles', 'Sexual assault', 'Agresyon seksyèl', infractionsId)

  // ── 2) Document du décret → thème « Agressions sexuelles » ──
  const decree = await prisma.document.create({
    data: {
      type: 'LEGISLATION',
      status: 'EN_VIGUEUR',
      titleFr: TITLE,
      number: 'Décret du 6 juillet 2005',
      originalLang: 'fr',
      matiere: 'penal',
      publicationDate: EFFECTIVE,
      bodyOriginal: decreeBody,
      searchText: buildSearchText({ titleFr: TITLE, matiere: 'penal', bodyOriginal: decreeBody }),
      source: SOURCE,
      summaryFr:
        'Décret du 6 juillet 2005 réformant le régime des agressions sexuelles du Code pénal et supprimant les ' +
        'discriminations contre la femme. Renforce la répression du viol (dix ans de travaux forcés, quinze ans si la ' +
        'victime a moins de quinze ans), redéfinit les agressions sexuelles et les attentats aux mœurs, réécrit les ' +
        'articles 269, 270, 278, 279, 280, 281, 282 et 283, et abroge les articles 284, 285, 286 et 287 (adultère, ' +
        'concubinage) du Code pénal. Pris sous la présidence provisoire de Me Boniface Alexandre.',
    },
  })
  await prisma.documentTheme.create({ data: { documentId: decree.id, themeId: agressionsId, isPrimary: true, assignedBy: 'IMPORT' } })
  await reindexDocument(decree.id)
  console.log(`Décret créé : ${decree.id} → thème « Agressions sexuelles », réindexé.`)

  // ── 3) Overlay du Code pénal ──
  const ann = JSON.parse(cp.annotationsJson!)
  const normHead = (s: string) => s.replace(/\s+/g, ' ').trim()
  const tocLabels = new Set<string>((ann.toc as { label: string }[]).map((e) => normHead(e.label)))

  // Errata de scan (le décret documenté est bien celui du 6 juillet 2005).
  let body = cp.bodyOriginal!
  const before = body
  body = body.replace('(Décret du 6 juillet 2008, art. 3)', '(Décret du 6 juillet 2005, art. 3)')
  body = body.replace('(Abrogé par D. 6 juillet 200S, art. 9)', '(Abrogé par D. 6 juillet 2005, art. 9)')
  if (body !== before) {
    await prisma.document.update({ where: { id: cp.id }, data: { bodyOriginal: body, searchText: buildSearchText({ titleFr: 'Code pénal d’Haïti', matiere: 'penal', bodyOriginal: body }) } })
    console.log('Errata corrigés (art. 279 : 2008→2005 · art. 287 : 200S→2005).')
  }

  // Textes d'origine (bornés par les libellés du sommaire) pour l'overlay des art. 269/270.
  const orig = new Map<string, string>()
  for (const seg of splitArticles(body, (line) => tocLabels.has(normHead(line)))) {
    if (seg.anchor && !orig.has(seg.anchor)) orig.set(seg.anchor, seg.lines.join('\n'))
  }

  for (const n of OVERLAY) {
    const anchor = `art-${n}`
    const newBody = `Art. ${n} (D. 6 juillet 2005, art. ${DECREE_ART[n]}) ${NEW_TEXT[n]}`
    await amendArticle({
      documentId: cp.id, anchor, label: `Article ${n}`,
      originalBody: orig.get(anchor) ?? null, newBody,
      amendedByDocId: decree.id, amendedByNumber: REF, effectiveDate: EFFECTIVE, origin: 'MANUAL',
    })
    console.log(`  overlay (nouvelle rédaction affichée) : art. ${n}`)
  }

  // annotations : pastilles + pliables (connexe/oldVersions) + renvois de section (crossRefs.docs).
  ann.status = ann.status ?? {}
  ann.oldVersions = ann.oldVersions ?? {}
  ann.connexe = ann.connexe ?? {}
  const connexeMod = (n: string) => [{
    label: REF,
    text: `Nouvelle rédaction de l’article issue de l’article ${DECREE_ART[n]} du ${REF}.`,
    docId: decree.id,
  }]
  // 269/270 : nouvelle rédaction affichée + ancienne version pliable.
  for (const n of OVERLAY) {
    ann.status[`art-${n}`] = 'modifié'
    const t = orig.get(`art-${n}`)
    if (t) ann.oldVersions[`art-${n}`] = t.replace(/^Art\.?\s+\d+\s*[.\-–]*\s*/i, '') // ancienne version (avant le décret)
    ann.connexe[`art-${n}`] = connexeMod(n)
  }
  // 278–283 : nouvelle rédaction DÉJÀ en place (texte consolidé) → pastille + renvoi au décret.
  for (const n of MODIFIED_ALREADY) {
    ann.status[`art-${n}`] = 'modifié'
    ann.connexe[`art-${n}`] = connexeMod(n)
  }
  // 284–287 : abrogés → pastille « abrogé » + note d'abrogation pliable (texte conservé, visible).
  for (const n of ABROGATED) {
    ann.status[`art-${n}`] = 'abrogé'
    ann.connexe[`art-${n}`] = [{
      label: REF,
      text: `Abrogé en vertu de l’article 9 du ${REF}.`,
      docId: decree.id,
    }]
  }

  // Renvois de SECTION vers le décret (cliquables — LIVE via crossRefs.docs).
  ann.crossRefs = (ann.crossRefs ?? []).filter((c: { anchor: string }) => !['sec-65', 'sec-67', 'sec-69'].includes(c.anchor))
  ann.crossRefs.push(
    { anchor: 'sec-65', articles: [], note: 'Articles 269 et 270 : nouvelle rédaction (meurtre entre conjoints, excuse provoquée par une agression sexuelle) par le', docs: [{ label: REF_SHORT, id: decree.id }] },
    { anchor: 'sec-67', articles: [], note: 'Articles 278, 279 et 280 (viol et agressions sexuelles) : nouvelle rédaction par le', docs: [{ label: REF_SHORT, id: decree.id }] },
    { anchor: 'sec-69', articles: [], note: 'Articles 281, 282 et 283 modifiés ; articles 284, 285, 286 et 287 (adultère, concubinage) abrogés par le', docs: [{ label: REF_SHORT, id: decree.id }] },
  )

  await prisma.document.update({ where: { id: cp.id }, data: { annotationsJson: JSON.stringify(ann) } })
  await reindexDocument(cp.id)
  console.log('Code pénal : status + anciennes versions + connexe + renvois de section à jour (EN PLACE).')

  console.log(`\n✅ Terminé — décret ${decree.id} · Code pénal ${cp.id} : ${OVERLAY.length + MODIFIED_ALREADY.length} modifiés, ${ABROGATED.length} abrogés.`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
