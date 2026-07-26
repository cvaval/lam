/**
 * Téléversement de la LOI N° 002-2018 PORTANT RÉFORME DU STATUT DU COMMERÇANT ET DES ACTES
 * DE COMMERCE ET ORGANISANT LE REGISTRE DU COMMERCE (23 avril 2018, Le Moniteur Spécial
 * n° 5 du 21 mai 2018) en « Législation annotée » → thème « Droit commercial » (à côté du
 * Code de commerce) — lecteur annoté (patron Décret sûretés) : sommaire, index, renvois
 * inline « article N » (anti-lien-mort).
 *
 * Idempotent (upsert par source). Données : scripts/data/loi-statut-commercant-2018/.
 *   npx tsx scripts/_import-loi-statut-commercant.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/loi-statut-commercant-2018'
const SOURCE = 'LOI_STATUT_COMMERCANT_2018'
const TITLE = 'Loi portant Réforme du statut du commerçant et des actes de commerce et organisant le registre du Commerce'

async function main() {
  const body = readFileSync(`${DIR}/bodyOriginal.txt`, 'utf8').trimEnd()
  const ann = JSON.parse(readFileSync(`${DIR}/annotations.json`, 'utf8')) as Annotations & Record<string, any>
  const labels = (ann.labels ?? {}) as Record<string, string>

  const blocks = segmentAnnotated(body, ann.toc)
  const secs = blocks.filter((b) => b.kind === 'section').length
  const anchors = new Set(blocks.filter((b: any) => b.kind === 'body' && b.anchor).map((b: any) => b.anchor))
  if (secs !== ann.toc.length) throw new Error(`segmentation ${secs}/${ann.toc.length} — annulé`)
  const missing = Object.keys(labels).filter((a) => !anchors.has(a))
  if (missing.length) throw new Error(`ancres sans bloc : ${missing.join(', ')} — annulé`)
  const dead = ann.indexEntries.flatMap((e: any) => e.ctRefs).filter((r: any) => !anchors.has(`art-${r}`))
  if (dead.length) throw new Error(`index : renvois morts ${dead.join(', ')} — annulé`)
  console.log(`✓ segmentation : ${secs}/${ann.toc.length} en-têtes · ${anchors.size} ancres · index ${ann.indexEntries.length} sujets, 0 mort`)

  const theme = await prisma.theme.findFirst({ where: { slug: 'droit-commercial' } })
  if (!theme) throw new Error('thème droit-commercial introuvable')

  const data = {
    type: 'LEGISLATION' as const,
    status: 'EN_VIGUEUR' as const,
    titleFr: TITLE,
    titleEn: 'Act reforming the status of merchants and commercial acts and organizing the Trade Register',
    titleHt: 'Lwa ki refòme estati komèsan yo ak zak komès yo epi ki òganize Rejis Komès la',
    number: 'Loi N° 002-2018 du 23 avril 2018',
    matiere: 'commercial',
    moniteurRef: 'Le Moniteur, Spécial N° 5 du 21 mai 2018',
    publicationDate: new Date('2018-05-21'),
    effectiveDate: new Date('2018-05-21'),
    keywords: 'commerçant; actes de commerce; registre du commerce; immatriculation; prescription commerciale; fichier national; capacité; CARICOM; voie électronique',
    summaryFr:
      'Loi N° 002-2018 du 23 avril 2018 (Le Moniteur, Spécial N° 5 du 21 mai 2018) : recompose le Titre 1er du Livre premier ' +
      'du Code de commerce — « Des Commerçants, des Actes de Commerce et du Registre du Commerce » (65 articles : statut du ' +
      'commerçant, capacité, égalité femme/homme et étrangers-CARICOM, prescription commerciale de 5 ans, Registre du Commerce, ' +
      'immatriculation, Fichier National, formalités électroniques, contentieux) et abroge toutes dispositions contraires.',
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
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
