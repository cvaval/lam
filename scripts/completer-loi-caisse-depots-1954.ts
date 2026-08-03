/**
 * Article 1043 du Code civil — la loi du 21 juillet 1954 sur la Caisse des Dépôts et
 * Consignations rétablie dans son intégralité, d'après le fac-similé (pages 219-220).
 *
 * Le recueil reproduit cette loi dans un encadré sous l'article 1043. La base n'en portait
 * que les articles 2 à 9, agglomérés en un paragraphe par article, et son ARTICLE 1er
 * manquait : le texte s'ouvrait sur « Art. 2 ». L'intitulé annonçait d'ailleurs des
 * « (extraits) ». Le fac-similé montre au contraire une loi complète, de l'article 1er à
 * l'article 9, avec ses alinéas séparés.
 *
 * Transcription faite sur l'IMAGE des pages, jamais sur la couche texte du PDF — celle-ci
 * est océrisée et fautive (c'est elle qui a produit « du 1*' au 15 », « II sera prélevé »,
 * « la signature du [_ greffier »).
 *
 * ⚠️ ANOMALIE DU RECUEIL PRÉSERVÉE. En page 220, l'alinéa « Le déposant ou la partie à qui
 * des offres ont été faites… » est imprimé DEUX FOIS : une première avec « Il sera inscrit
 * au jour le jour… » couru à la suite, une seconde s'arrêtant à « …sur lesdits objets,
 * valeurs ou titres », suivie du même « Il sera inscrit… » en alinéa autonome. C'est un
 * doublon de composition. Il est reproduit tel quel : on ne retranche pas du texte d'une loi
 * sans décision de la cliente.
 *
 *     npx tsx scripts/completer-loi-caisse-depots-1954.ts
 *     npx tsx scripts/completer-loi-caisse-depots-1954.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { parseAnnotations, type ConnexeBlock } from '../src/lib/legislation/annotated'
import { buildSearchText } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

const INTITULE = 'Loi du 21 juillet 1954 créant la Caisse des Dépôts et Consignations'

/** Un élément par ALINÉA, dans l'ordre du fac-similé (p. 219 puis p. 220). */
const ALINEAS = [
  "Art. 1. Il a été créé la Caisse des Dépôts et Consignations dont la gestion est confiée à l'administration générale des contributions.",
  "Art. 2. Il sera effectué dans la Caisse des Dépôts et Consignations contre récépissé, tout dépôt volontaire ou ordonné par la loi ou par la décision de justice; y seront également déposés contre récépissé tous objets, valeur, caution, cautionnement et titres destinés à libérer une ou plusieurs personnes ou à les habiliter, avec les sanctions de droit, à faire ou à ne pas faire un acte, ainsi que toutes amendes exigées à l'appui d'un recours devant les Cours et tribunaux de la République.",
  "Art. 3. L'administration générale des contributions tiendra un registre spécial sur lequel seront inscrits jour par jour, tous dépôts et consignations faits volontairement ou ordonnés par la Loi ou par décision de justice.",
  "Art. 4. Dans toutes les instances entraînant consignation de valeurs, le greffier sur la réquisition de la partie intéressée devra dresser les procès-verbaux sans préjudice du simple droit de greffe.",
  "Le récépissé délivré par l'administration générale des contributions devra être produit au plus tard dans les vingt-quatre heures de la date du procès-verbal et sera annexé au dossier du déposant pour tout délibéré du juge.",
  "Les amendes, en vue d'un recours, devront être versées à la Caisse des Dépôts et Consignations le jour qui précède le délibéré ordonné et le récépissé portera le visa du greffier, sans déroger à la Loi sur les demandes en récusation ou en dessaisissement;",
  "Art. 5. Les valeurs, objets, titres déposés ou consignés ne peuvent être retirés, remis, restitués ou versés qu'en vertu d'une décision de justice passée en force de chose jugée ou exécutoire par provision, sauf en cas de désistement ou transaction intervenue entre les parties litigieuses.",
  "Néanmoins, lorsque les valeurs, objets ou titres auront été déposés ou consignés volontairement et en dehors de toute contestation judiciaire, ou lorsqu'il y a désistement ou transaction mettant fin au litige, ils pourront être remis ou versés au bénéficiaire contre reçu, sur la présentation de l'acte à lui signifié par le déposant ou consignateur ou le procès-verbal consacrant la transaction ou le désistement.",
  "Le déposant ou la partie à qui des offres ont été faites et qui les avait refusées pourra également retirer de la Caisse des Dépôts et Consignations, sur la présentation du récépissé de l'administration générale des contributions, s'il s'agit de déposant ou sur la présentation de l'exploit contenant les offres réelles s'il s'agit de celle qui a refusé à moins, dans l'un ou l'autre cas, d'opposition de la part des tiers, sur lesdits objets, valeurs ou titres. Il sera inscrit au jour le jour, sur un registre spécial les remises de valeurs, objets ou titres déposés ou consignés volontairement ou par décision de justice faites soit au déposant soit au bénéficiaire.",
  "Le déposant ou la partie à qui des offres ont été faites et qui les avait refusées pourra également retirer de la Caisse des Dépôts et Consignations, sur la présentation du récépissé de l'administration générale des contributions, s'il s'agit de déposant ou sur la présentation de l'exploit contenant les offres réelles s'il s'agit de celle qui a refusé à moins, dans l'un ou l'autre cas, d'opposition de la part des tiers, sur lesdits objets, valeurs ou titres.",
  "Il sera inscrit au jour le jour, sur un registre spécial les remises de valeurs, objets ou titres déposés ou consignés volontairement ou par décision de justice faites soit au déposant soit au bénéficiaire.",
  "Art. 6. Lorsqu'une décision aura ordonné la restitution d'une amende déposée, la partie qui y aura droit remettra à l'administration générale des contributions, une copie certifiée, du dispositif de la décision délivrée par le greffe sur papier libre. La restitution se fera après un préavis de 24 heures.",
  "Art. 7. Il sera prélevé sur les dépôts et consignations de toutes sommes conformément à l'article 138 de la loi établissant le tarif judiciaire, et au profit du fonds de gestion 2% jusqu'à Gdes 500.00 et 1% sur le surplus, sans que le prélèvement puisse être moindre d'une gourde. Aucun droit ne sera prélevé sur les amendes pour cause d'appel et à l'occasion d'un recours en cassation.",
  "Art. 8. Dans les mois de la promulgation de la présente loi les greffiers des Cours et tribunaux de la République, feront remise avec l'état détaillé visé du Président, du doyen ou du juge suivant le cas, à l'administration générale des contributions, ou au Bureau des Contributions le plus proche, de tous objets, valeurs ou titres déposés ou consignés à leur greffe suivant une décision de justice ou en vertu de la loi. Le duplicata de l'état certifié conforme et signé par l'employé compétent des Contributions sera conservé dans les archives du greffe.",
  "Art. 9. Les greffiers des Cours et tribunaux y compris ceux des Justices de paix sont tenus, sous peine de révocation et sans préjudice des poursuites légales, de faire parvenir au Bureau des Contributions le plus proche, du 1er au 15 de chaque mois, l'état pour le mois précédent, de tous les procès-verbaux, actes, jugements etc. pour lesquels ils ont perçu des droits de greffe avec indication de la date de perception du montant du droit perçu et du numéro du récépissé à eux délivré.",
  "Cet état sera visé par les Présidents des Cours, les doyens et les juges de paix suivant le cas, ou par les juges qu'ils auront désigné ainsi que par le commissaire du Gouvernement.",
  "Conformément aux dispositions de la loi sur le tarif judiciaire, tout acte du greffe doit porter en marge l'indication détaillée des droits perçus et la signature du greffier.",
]

/** Fautes d'OCR corrigées d'après l'image — chacune est déclarée, aucune n'est silencieuse. */
const CORRECTIONS = [
  ['art. 3', '« faits volontairement où ordonnés » → « ou ordonnés »'],
  ['art. 4', '« en dessaissement:; » → « en dessaisissement; »'],
  ['art. 5', '« ou lorsqu’il y a désistement où transaction » → « ou transaction »'],
  ['art. 7', '« II sera prélevé » (deux i majuscules) → « Il sera prélevé » ; tiret parasite en fin d’alinéa retiré'],
  ['art. 9', '« du 1*\' au 15 » → « du 1er au 15 » ; « la signature du [_ greffier » → « la signature du greffier. »'],
]

const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim().toLowerCase()
const mots = (s: string) => norm(s).replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim()

async function main() {
  const doc = await prisma.document.findFirst({ where: { source: 'CODE_CIVIL_ANNOTE' } })
  if (!doc) throw new Error('Code civil introuvable.')
  const ann = parseAnnotations(doc.annotationsJson)!
  const brut = JSON.parse(doc.annotationsJson!) as { connexe: Record<string, ConnexeBlock[]> }

  const blocs = brut.connexe['art-1043'] ?? []
  const i = blocs.findIndex((b) => /Caisse des D[ée]p[ôo]ts/.test(b.label))
  if (i < 0) throw new Error("aucun bloc « Caisse des Dépôts » sous l'article 1043")
  const avant = blocs[i]
  const texte = ALINEAS.join('\n')

  // ── INVARIANT : rien de ce que la base portait ne disparaît ─────────────────
  // Chaque mot d'au moins 6 lettres du bloc actuel doit se retrouver dans le nouveau —
  // sauf ceux que les corrections d'OCR font justement disparaître.
  const nouveaux = new Set(mots(`${INTITULE} ${texte}`).split(' '))
  const disparus = [...new Set(mots(`${avant.label} ${avant.text}`).split(' ').filter((w) => w.length >= 6))]
    .filter((w) => !nouveaux.has(w))
  const attendus = new Set(['extraits', 'dessaissement', 'greffier'])
  const inattendus = disparus.filter((w) => !attendus.has(w))

  console.log(`bloc « ${avant.label} »`)
  console.log(`  texte : ${avant.text.length} → ${texte.length} caractères`)
  console.log(`  alinéas : ${avant.text.split('\n').length} → ${ALINEAS.length}`)
  console.log(`  intitulé : ${avant.label === INTITULE ? 'inchangé' : `« ${avant.label} » → « ${INTITULE} »`}`)
  console.log(`\narticle 1er rétabli : ${nouveaux.has('creee') || /Art\. 1\./.test(texte) ? 'oui' : 'NON'}`)
  console.log('corrections d’OCR déclarées :')
  CORRECTIONS.forEach(([a, c]) => console.log(`  ${a} — ${c}`))
  console.log(`\nmots perdus non prévus : ${inattendus.length}${inattendus.length ? ' — ' + inattendus.join(', ') : ''}`)
  if (inattendus.length) throw new Error('la réécriture ferait disparaître du texte — aucune écriture')

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }
  blocs[i] = { ...avant, label: INTITULE, text: texte }
  brut.connexe['art-1043'] = blocs
  const annotationsJson = JSON.stringify({ ...JSON.parse(doc.annotationsJson!), connexe: brut.connexe })
  const searchText = buildSearchText({ ...doc, annotationsJson } as never)
  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: doc.id }, data: { annotationsJson, searchText } })
    await audit(
      { action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: doc.id,
        meta: { source: 'CODE_CIVIL_ANNOTE', motif: 'loi du 21 juillet 1954 (Caisse des Dépôts) rétablie en entier sous l’art. 1043',
                alineas: ALINEAS.length, corrections: CORRECTIONS.length } },
      tx,
    )
  }, { timeout: 120_000, maxWait: 30_000 })
  console.log('\n✓ Écrit, index de recherche recalculé, journalisé.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
