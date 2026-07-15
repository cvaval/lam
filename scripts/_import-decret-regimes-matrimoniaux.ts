/**
 * Téléversement du DÉCRET PORTANT RÉFORME DES RÉGIMES MATRIMONIAUX (9 avril 2020,
 * Le Moniteur Spécial n° 6 du 13 mai 2020) en « Législation annotée » → Droit privé →
 * Personne et Famille — lecteur annoté (patron Code du travail / Code civil) :
 * Sommaire hiérarchique + Index alphabétique (CodeSidebar) + renvois inline « article N »
 * (linkArtRefs, anti-lien-mort par l'ensemble des ancres du document).
 *
 * LIAISON du Code civil (complète l'opération du 14 juil. — patron Loi Filiation) :
 *   - ArticleVersion du Décret : amendedByDocId → ce document ;
 *   - notes connexes des 151 articles : libellé CLIQUABLE vers ce document, à l'ancre
 *     du bon endroit (article cité homonyme pour les amendés ; article d'abrogation
 *     du décret pour les abrogés : art-3 (1249-1281), art-5 (1310-1324), art-7 (1902…)).
 *
 * Idempotent (upsert par source). Données : scripts/data/decret-regimes-matrimoniaux/.
 *   npx tsx scripts/_import-decret-regimes-matrimoniaux.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/decret-regimes-matrimoniaux'
const SOURCE = 'DECRET_REGIMES_MATRIMONIAUX'
const TITLE = 'Décret portant réforme des régimes matrimoniaux'
const REF = 'Décret sur les régimes matrimoniaux (Le Moniteur, Spécial n° 6 du 13 mai 2020)'

async function main() {
  const body = readFileSync(`${DIR}/bodyOriginal.txt`, 'utf8').trimEnd()
  const ann = JSON.parse(readFileSync(`${DIR}/annotations.json`, 'utf8')) as Annotations & Record<string, any>
  const labels = (ann.labels ?? {}) as Record<string, string>

  // Vérif de cohérence AVANT écriture (comme Code des Douanes) : appariement toc↔corps.
  const blocks = segmentAnnotated(body, ann.toc)
  const secs = blocks.filter((b) => b.kind === 'section').length
  const anchors = new Set(blocks.filter((b: any) => b.kind === 'body' && b.anchor).map((b: any) => b.anchor))
  if (secs !== ann.toc.length) throw new Error(`segmentation ${secs}/${ann.toc.length} — annulé`)
  const missing = Object.keys(labels).filter((a) => !anchors.has(a))
  if (missing.length) throw new Error(`ancres sans bloc : ${missing.join(', ')}`)
  console.log(`✓ segmentation : ${secs}/${ann.toc.length} en-têtes · ${anchors.size} ancres d'articles`)

  // Thème « Personne et Famille » (créé par l'import Filiation).
  const theme = await prisma.theme.findFirst({ where: { slug: 'personne-famille' } })
  if (!theme) throw new Error('thème personne-famille introuvable')

  const data = {
    type: 'LEGISLATION' as const,
    status: 'EN_VIGUEUR' as const,
    titleFr: TITLE,
    titleEn: 'Decree reforming matrimonial property regimes',
    titleHt: 'Dekrè ki refòme rejim matrimonyal yo',
    number: 'Décret du 9 avril 2020',
    matiere: 'civil',
    moniteurRef: 'Le Moniteur, Spécial N° 6 du 13 mai 2020',
    publicationDate: new Date('2020-05-13'),
    effectiveDate: new Date('2020-05-13'),
    keywords: 'régimes matrimoniaux; communauté légale; communauté conventionnelle; contrat de mariage; séparation de biens; logement familial; hypothèque légale',
    summaryFr:
      'Décret du 9 avril 2020 portant réforme des régimes matrimoniaux (Le Moniteur, Spécial N° 6 du 13 mai 2020) : ' +
      'réécrit le contrat de mariage (arts. 1174, 1181 + nouveaux 1181-1, 1184-1, 1184-2 : mutabilité encadrée, usufruit du ' +
      'logement familial au conjoint survivant), refond la communauté légale (arts. 1186-1248) et la communauté conventionnelle ' +
      '(arts. 1282-1309), abroge les arts. 1249-1281 et 1310-1324, modifie l’art. 1888 et supprime l’hypothèque légale de la femme mariée.',
    bodyOriginal: body,
    annotationsJson: JSON.stringify(ann),
    source: SOURCE,
  }
  const existing = await prisma.document.findFirst({ where: { source: SOURCE }, select: { id: true } })
  const doc = existing
    ? await prisma.document.update({ where: { id: existing.id }, data })
    : await prisma.document.create({ data: { ...data, originalLang: 'fr' } })
  if (!(await prisma.documentTheme.findFirst({ where: { documentId: doc.id, themeId: theme.id } })))
    await prisma.documentTheme.create({ data: { documentId: doc.id, themeId: theme.id, isPrimary: true, assignedBy: 'IMPORT' } })
  await reindexDocument(doc.id)
  console.log(`✓ document ${existing ? 'mis à jour' : 'créé'} : ${doc.id} → thème « ${theme.labelFr} », réindexé`)

  // ── Liaison du Code civil ──
  const cc = await prisma.document.findFirst({ where: { source: 'CODE_CIVIL_ANNOTE' } })
  if (!cc) throw new Error('Code civil introuvable')
  const upd = await prisma.articleVersion.updateMany({ where: { documentId: cc.id, amendedByNumber: REF }, data: { amendedByDocId: doc.id } })
  console.log(`✓ ArticleVersion liées au décret : ${upd.count}`)

  // Ancre cible par article du Code : amendé → article homonyme cité ; abrogé → article
  // d'abrogation du décret. (1888 : cité à l'art. 6 du décret → art-1888 existe.)
  const ccAnn = JSON.parse(cc.annotationsJson!)
  const decAnchors = new Set(Object.keys(labels))
  const targetFor = (n: string): string => {
    if (decAnchors.has(`art-${n}`)) return `art-${n}`
    const num = Number(n)
    if (num >= 1249 && num <= 1281) return 'art-3'
    if (num >= 1310 && num <= 1324) return 'art-5'
    return 'art-7' // hypothèques (1902…1962)
  }
  let linked = 0
  for (const [anchor, blocks2] of Object.entries(ccAnn.connexe as Record<string, any[]>)) {
    for (const b of blocks2) {
      if (typeof b.text === 'string' && b.text.includes('Décret portant réforme des régimes matrimoniaux') && !b.docId) {
        b.docId = doc.id
        b.anchor = targetFor(anchor.replace('art-', ''))
        b.label = TITLE + ' (Le Moniteur, Spécial n° 6 du 13 mai 2020)'
        linked++
      }
    }
  }
  await prisma.document.update({ where: { id: cc.id }, data: { annotationsJson: JSON.stringify(ccAnn) } })
  await reindexDocument(cc.id)
  console.log(`✓ notes connexes du Code civil rendues cliquables : ${linked} (ancres ciblées)`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
