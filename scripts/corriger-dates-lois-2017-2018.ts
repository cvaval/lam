/**
 * LA DATE DU VISA FAIT FOI — décision de Me Vaval du 14 oct. 2026 (« la date du visa ; corriger sur
 * toute la plateforme »), relevée par la table des visas du Code fiscal de 2026 :
 *
 *   · « Loi du 16 février 2017 sur les échanges électroniques » — la fiche disait 14 février.
 *     Le 16 février 2017 est le vote du Sénat, que la fiche note elle-même (« vote du 16 février
 *     2017 »), et c'est la date que citent le Code des douanes et le Décret du 30 avril 2023.
 *     (La loi du 14 février 2017 sur la SIGNATURE électronique est une autre loi : intacte.)
 *   · « Loi du 3 avril 2018 portant Réforme du statut du commerçant… » — la fiche disait 23 avril.
 *     Le 3 avril 2018 est le vote du Sénat (« Donné au Sénat de la République, le mardi 3 avril
 *     2018 »), dernier vote ; le 23 avril est la promulgation. Règle du corpus : une LOI porte la
 *     date de son dernier vote.
 *
 *     npx tsx scripts/corriger-dates-lois-2017-2018.ts            # à blanc : liste chaque écriture
 *     npx tsx scripts/corriger-dates-lois-2017-2018.ts --commit   # écrit, sauvegarde l'état antérieur
 *
 * ⚠️ LE TEXTE OFFICIEL N'EST PAS TOUCHÉ. Seul l'appareil éditorial change : titres, référence,
 * résumé, date d'adoption, ligne de titre éditoriale du corps (la 1re ligne de la loi de 2017, que
 * le J.O. n'imprime pas — il commence à « LOI SUR LES ÉCHANGES ÉLECTRONIQUES ») et son entrée de
 * sommaire, marques « (L. du … 2018) » posées par notre intégration dans le Code de commerce, et la
 * référence d'amendement des `ArticleVersion`. Restent tels quels : « Donné au Palais National…
 * le 23 avril 2018 » (promulgation, dans le corps de la loi), les textes du J.O. qui citent ces
 * lois, les transcriptions des Éditions et l'Index du Moniteur (ajout seul — et aucune de ses
 * entrées ne porte ces dates).
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { parseAnnotations, segmentAnnotated } from '../src/lib/legislation/annotated'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')

const ECH_AVANT = 'Loi du 14 février 2017 sur les échanges électroniques'
const ECH_APRES = 'Loi du 16 février 2017 sur les échanges électroniques'
const LSC_AVANT = 'Loi du 23 avril 2018 portant Réforme du statut du commerçant et des actes de commerce et organisant le registre du Commerce'
const LSC_APRES = 'Loi du 3 avril 2018 portant Réforme du statut du commerçant et des actes de commerce et organisant le registre du Commerce'
const MARQUE_AVANT = '(L. du 23 avril 2018)'
const MARQUE_APRES = '(L. du 3 avril 2018)'
const AV_AVANT = 'Loi N° 002-2018 du 23 avril 2018 (Le Moniteur, Spécial n° 5 du 21 mai 2018)'
const AV_APRES = 'Loi N° 002-2018 du 3 avril 2018 (Le Moniteur, Spécial n° 5 du 21 mai 2018)'

const compter = (s: string | null | undefined, x: string) => (s ? s.split(x).length - 1 : 0)
const stop = (m: string): never => {
  throw new Error(`⛔ ${m} — rien n'est écrit`)
}

async function main() {
  const [ech] = await prisma.document.findMany({ where: { source: 'LOI_ECHANGES_ELECTRONIQUES_2017', type: 'LEGISLATION' } })
  const [lsc] = await prisma.document.findMany({ where: { source: 'LOI_STATUT_COMMERCANT_2018', type: 'LEGISLATION' } })
  const [ccom] = await prisma.document.findMany({ where: { source: 'CODE_COMMERCE_ANNOTE', type: 'LEGISLATION' } })
  if (!ech || !lsc || !ccom) stop('fiche introuvable')
  const avs = await prisma.articleVersion.findMany({ where: { amendedByNumber: AV_AVANT }, select: { id: true, documentId: true, anchor: true } })

  // ── Échanges électroniques ──
  if (ech.titleFr !== ECH_AVANT || ech.number !== ECH_AVANT) stop(`échanges : titre/référence inattendus (« ${ech.titleFr} »)`)
  const lignes = ech.bodyOriginal.split('\n')
  if (lignes[0] !== ECH_AVANT || lignes[1] !== 'LOI SUR LES ÉCHANGES ÉLECTRONIQUES') stop('échanges : la 1re ligne du corps n’est pas la ligne de titre éditoriale attendue')
  if (compter(ech.bodyOriginal, ECH_AVANT) !== 1) stop('échanges : la date figure ailleurs dans le corps')
  const echCorps = [ECH_APRES, ...lignes.slice(1)].join('\n')
  const echAnn = (ech.annotationsJson ?? '').split(ECH_AVANT).join(ECH_APRES)
  if (compter(ech.annotationsJson, ECH_AVANT) !== 4) stop(`échanges : ${compter(ech.annotationsJson, ECH_AVANT)} occurrences dans l’appareil au lieu de 4`)
  const a = parseAnnotations(echAnn)!
  const sec = segmentAnnotated(echCorps, a.toc, a.pointAnchors).filter((b) => b.kind === 'section').length
  if (sec !== a.toc.length) stop(`échanges : segmentation ${sec}/${a.toc.length} après correction`)
  if (ech.bodyClean) stop('échanges : bodyClean présent, non prévu')
  const echData = {
    titleFr: ECH_APRES,
    number: ECH_APRES,
    titleEn: 'Law of 16 February 2017 on electronic exchanges',
    titleHt: 'Lwa 16 fevriye 2017 sou echanj elektwonik',
    adoptionDate: new Date('2017-02-16T00:00:00Z'),
    bodyOriginal: echCorps,
    annotationsJson: echAnn,
  }

  // ── Statut du commerçant ──
  if (lsc.titleFr !== LSC_AVANT || lsc.number !== LSC_AVANT) stop(`statut du commerçant : titre/référence inattendus (« ${lsc.titleFr} »)`)
  if (compter(lsc.summaryFr, 'du 23 avril 2018') !== 1) stop('statut du commerçant : résumé inattendu')
  if (!lsc.bodyOriginal.includes('Donné au Sénat de la République, le mardi 3 avril 2018')) stop('statut du commerçant : le vote du Sénat du 3 avril 2018 n’est pas dans le corps')
  const lscData = {
    titleFr: LSC_APRES,
    number: LSC_APRES,
    summaryFr: lsc.summaryFr!.replace('du 23 avril 2018', 'du 3 avril 2018'),
    adoptionDate: new Date('2018-04-03T00:00:00Z'),
  }

  // ── Code de commerce : marques de notre intégration ──
  const nMarques = compter(ccom.bodyOriginal, MARQUE_AVANT)
  if (nMarques !== 65) stop(`Code de commerce : ${nMarques} marques au lieu de 65`)
  if (compter(ccom.bodyOriginal, '23 avril 2018') !== nMarques) stop('Code de commerce : « 23 avril 2018 » hors des marques')
  if (ccom.bodyClean && compter(ccom.bodyClean, '23 avril 2018')) stop('Code de commerce : bodyClean porte aussi la date')
  const ccomCorps = ccom.bodyOriginal.split(MARQUE_AVANT).join(MARQUE_APRES)
  const ccomAnn = parseAnnotations(ccom.annotationsJson)!
  const avantSeg = segmentAnnotated(ccom.bodyOriginal, ccomAnn.toc, ccomAnn.pointAnchors).map((b) => (b.kind === 'body' ? b.anchor : b.anchor)).join(',')
  const apresSeg = segmentAnnotated(ccomCorps, ccomAnn.toc, ccomAnn.pointAnchors).map((b) => (b.kind === 'body' ? b.anchor : b.anchor)).join(',')
  if (avantSeg !== apresSeg) stop('Code de commerce : la segmentation change')

  console.log(`échanges électroniques (${ech.id}) : titre, référence, titres en/ht, adoption 2017-02-16, 1re ligne du corps, 4 libellés d’appareil`)
  console.log(`statut du commerçant (${lsc.id}) : titre, référence, résumé, adoption 2018-04-03 — corps INTACT (promulgation du 23 avril)`)
  console.log(`Code de commerce (${ccom.id}) : ${nMarques} marques « ${MARQUE_AVANT} » → « ${MARQUE_APRES} », segmentation identique`)
  console.log(`ArticleVersion : ${avs.length} référence(s) d’amendement → « ${AV_APRES} »`)
  if (avs.length !== 8) stop(`${avs.length} ArticleVersion au lieu de 8`)
  if (!COMMIT) {
    console.log('\n(à blanc — --commit pour écrire)')
    return
  }

  const journal = join(process.cwd(), `docs/livraison-code-fiscal-2026/etat-anterieur-dates-lois-2017-2018-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(journal, JSON.stringify({ ech, lsc: { ...lsc, bodyOriginal: undefined }, ccomBodyOriginal: ccom.bodyOriginal, articleVersions: avs }, null, 1))
  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: ech.id }, data: echData })
    await tx.document.update({ where: { id: lsc.id }, data: lscData })
    await tx.document.update({ where: { id: ccom.id }, data: { bodyOriginal: ccomCorps } })
    await tx.articleVersion.updateMany({ where: { amendedByNumber: AV_AVANT }, data: { amendedByNumber: AV_APRES } })
  }, { timeout: 120_000 })
  for (const id of [ech.id, lsc.id, ccom.id]) await reindexDocument(id)
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: ech.id, meta: { via: 'corriger-dates-lois-2017-2018', correction: 'date du visa', docs: [ech.id, lsc.id, ccom.id], articleVersions: avs.length, decision: 'date du visa (14 oct. 2026)' } })

  // Recompte
  const reste = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) n FROM "Document" WHERE id IN (${ech.id}, ${lsc.id}, ${ccom.id})
      AND ("titleFr" LIKE '%23 avril 2018%' OR "titleFr" LIKE '%14 février 2017 sur les échanges%' OR "number" LIKE '%23 avril 2018%'
        OR "number" LIKE '%14 février 2017 sur les échanges%' OR "annotationsJson" LIKE '%14 février 2017 sur les échanges%' OR "bodyOriginal" LIKE '%(L. du 23 avril 2018)%')`
  const avReste = await prisma.articleVersion.count({ where: { amendedByNumber: AV_AVANT } })
  const relu = await prisma.document.findUnique({ where: { id: ech.id }, select: { adoptionDate: true, titleFr: true } })
  if (Number(reste[0].n) || avReste || relu?.titleFr !== ECH_APRES) stop(`recompte : ${reste[0].n} fiche(s), ${avReste} ArticleVersion encore à l’ancienne date`)
  console.log(`\n✅ écrit et recompté (0 ancienne date restante) — état antérieur : ${journal}`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
