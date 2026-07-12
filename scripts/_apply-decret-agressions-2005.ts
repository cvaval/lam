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
import { amendArticle, abrogateArticle } from '../src/lib/legislation/amendments'
import { splitArticles } from '../src/lib/legislation/segment'
import { createTheme } from '../src/lib/legislation/themes'

const DATA = 'scripts/data/decret-agressions-2005'
const SOURCE = 'DECRET_AGRESSIONS_2005'
const TITLE = 'Décret modifiant le régime des Agressions Sexuelles et éliminant en la matière les Discriminations contre la femme'
const REF = 'Décret du 6 juillet 2005 modifiant le régime des Agressions Sexuelles et éliminant en la matière les Discriminations contre la femme'
const REF_SHORT = 'Décret du 6 juillet 2005 (Agressions sexuelles) — publié au Moniteur le 11 août 2005'
const MONITEUR = 'Le Moniteur, 160ᵉ année, no 60 — 11 août 2005'
const EFFECTIVE = new Date('2005-07-06')

// Textes de remplacement AUTORITAIRES (transcrits du décret, art. 2–8 et 10–11). On affiche
// systématiquement ce texte via overlay : la version consolidée du Code portait des artefacts
// (art. 278 avec un alinéa périmé « outrage public… gourdes » collé à tort ; art. 282 amputé de
// son 2ᵉ alinéa) — l'overlay garantit le texte exact du décret (§02 : bodyOriginal reste intact).
const NEW_TEXT: Record<string, string> = {
  '269': 'Le meurtre par le conjoint de l’un ou de l’autre sexe sur son conjoint n’est pas excusable, si la vie du conjoint qui a commis le meurtre n’a pas été mise en péril dans le moment même où le meurtre a eu lieu.',
  '270': 'Le meurtre ou les blessures, s’ils ont été immédiatement provoqués en réaction à une agression sexuelle, seront considérés comme meurtre ou blessures excusables.',
  '278': 'Quiconque aura commis un crime de viol, ou sera coupable de toute autre agression sexuelle, consommée ou tentée avec violence, menaces, surprise ou pression psychologique contre la personne de l’un ou l’autre sexe, sera puni de dix ans de travaux forcés.',
  '279': 'Si le crime a été commis sur la personne d’un enfant au-dessous de l’âge de quinze ans accomplis, la personne coupable sera punie de quinze ans de travaux forcés.',
  '280': 'La peine sera celle de travaux forcés à perpétuité, si les coupables sont de la classe de ceux qui ont autorité sur la personne envers laquelle ils ont commis l’attentat ou qui abusent de l’autorité que leur confèrent leurs fonctions, ou si la personne coupable, quelle qu’elle soit, a été aidée dans son crime, par une ou plusieurs personnes, ou si la mort s’en est suivie.',
  '281': 'Quiconque aura attenté aux mœurs, en excitant, favorisant, ou facilitant habituellement la débauche ou la corruption de la jeunesse, de l’un ou de l’autre sexe au-dessous de l’âge de dix-huit ans, sera puni d’un emprisonnement de six mois à deux ans.\nSi la prostitution ou la corruption a été excitée, favorisée ou facilitée par leurs père, mère, tuteur ou autres personnes chargées de leur surveillance, la peine sera d’un an à trois ans d’emprisonnement.',
  '282': 'Les coupables du délit mentionné au précédent article seront interdits de toute tutelle ou curatelle et de toute participation au conseils de famille, savoir : les individus auxquels s’applique le premier paragraphe de cet article, pendant deux ans au moins et cinq ans au plus ; et ceux dont il est parlé au second paragraphe, pendant dix ans au moins et vingt au plus.\nSi le délit a été commis par le père ou la mère, la personne coupable sera de plus privée des droits et avantages à elle accordés, sur la personne et les biens de l’enfant, par le Code Civil et par le Décret du 8 octobre 1982 donnant un nouveau statut à la femme mariée.',
  '283': 'Toute personne qui aura commis un outrage public à la pudeur en commettant tous actes, attouchements ou autres actes semblables susceptibles de blesser la pudeur d’une personne de l’un ou de l’autre sexe, sera punie d’un emprisonnement de trois mois à un an.',
}
// 269/270 : le Code portait encore l'ANCIENNE version → overlay + ancienne version pliable authentique.
const OVERLAY_OLD = ['269', '270']
// 278–283 : la version consolidée portait déjà la nouvelle rédaction (avec artefacts) → overlay du
// texte AUTORITAIRE du décret, SANS ancienne version (le texte antérieur au décret n'est pas dans la source).
const OVERLAY_NOOLD = ['278', '279', '280', '281', '282', '283']
const MODIFIED = [...OVERLAY_OLD, ...OVERLAY_NOOLD]
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
      moniteurRef: MONITEUR,
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

  // Overlay du texte AUTORITAIRE (les 8 articles modifiés). 269/270 gardent leur ancienne version
  // (snapshot) ; 278–283 : pas de snapshot (l'ancienne version n'est pas dans la source).
  for (const n of MODIFIED) {
    const anchor = `art-${n}`
    const newBody = `Art. ${n} (D. 6 juillet 2005, art. ${DECREE_ART[n]}) ${NEW_TEXT[n]}`
    const withOld = OVERLAY_OLD.includes(n)
    await amendArticle({
      documentId: cp.id, anchor, label: `Article ${n}`,
      originalBody: withOld ? (orig.get(anchor) ?? null) : null, newBody,
      amendedByDocId: decree.id, amendedByNumber: REF, effectiveDate: EFFECTIVE, origin: 'MANUAL',
    })
    console.log(`  overlay (texte du décret affiché) : art. ${n}${withOld ? ' + ancienne version' : ''}`)
  }

  // Abrogés 284–287 : marqueur « [Abrogé — Décret du 6 juillet 2005] » dans le corps affiché
  // (comme le Code civil / loi de filiation) ; le texte d'origine reste dans le pliable « Ancienne
  // version ». Harmonise le rendu des articles abrogés entre les deux codes.
  for (const n of ABROGATED) {
    await abrogateArticle({
      documentId: cp.id, anchor: `art-${n}`, label: `Article ${n}`,
      originalBody: orig.get(`art-${n}`) ?? null,
      amendedByDocId: decree.id, amendedByNumber: 'Décret du 6 juillet 2005', effectiveDate: EFFECTIVE,
    })
    console.log(`  abrogé (marqueur [Abrogé]) : art. ${n}`)
  }

  // annotations : pastilles + pliables (connexe/oldVersions) + renvois de section (crossRefs.docs).
  ann.status = ann.status ?? {}
  ann.oldVersions = ann.oldVersions ?? {}
  ann.connexe = ann.connexe ?? {}
  const connexeMod = (n: string) => [{
    label: REF,
    text: `Nouvelle rédaction de l’article issue de l’article ${DECREE_ART[n]} du Décret du 6 juillet 2005 (publié au Moniteur le 11 août 2005).`,
    docId: decree.id,
  }]
  for (const n of MODIFIED) {
    ann.status[`art-${n}`] = 'modifié'
    ann.connexe[`art-${n}`] = connexeMod(n)
  }
  // Ancienne version pliable authentique : uniquement 269/270 (le Code l'avait conservée).
  for (const n of OVERLAY_OLD) {
    const t = orig.get(`art-${n}`)
    if (t) ann.oldVersions[`art-${n}`] = t.replace(/^Art\.?\s+\d+\s*[.\-–]*\s*/i, '')
  }
  // 284–287 : abrogés → pastille « abrogé » + ancienne version pliable (texte d'origine) + note
  // d'abrogation renvoyant (cliquable) au décret.
  for (const n of ABROGATED) {
    ann.status[`art-${n}`] = 'abrogé'
    const t = orig.get(`art-${n}`)
    if (t) ann.oldVersions[`art-${n}`] = t.replace(/^Art\.?\s+\d+\s*[.\-–]*\s*/i, '')
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

  console.log(`\n✅ Terminé — décret ${decree.id} · Code pénal ${cp.id} : ${MODIFIED.length} modifiés (dont ${OVERLAY_OLD.length} avec ancienne version), ${ABROGATED.length} abrogés.`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
