/**
 * Téléversement du DÉCRET RÉFORMANT LE DROIT DES SÛRETÉS (9 avril 2020, Le Moniteur
 * Spécial n° 7 du 14 mai 2020) en « Législation annotée » → Droit privé →
 * Obligations, biens & sûretés — lecteur annoté (patron Décret régimes matrimoniaux) :
 * sommaire hiérarchique (3 TITRES, 6 CHAPITRES, 12 Sections), index alphabétique,
 * renvois inline « article N » (linkArtRefs, anti-lien-mort).
 *
 * Idempotent (upsert par source). Données : scripts/data/decret-suretes/.
 *   npx tsx scripts/_import-decret-suretes.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/decret-suretes'
const SOURCE = 'DECRET_SURETES'
const TITLE = 'Décret réformant le Droit des Sûretés'

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

  const theme = await prisma.theme.findFirst({ where: { slug: 'obligations-biens-suretes' } })
  if (!theme) throw new Error('thème obligations-biens-suretes introuvable')

  const data = {
    type: 'LEGISLATION' as const,
    status: 'EN_VIGUEUR' as const,
    titleFr: TITLE,
    titleEn: 'Decree reforming the law of security interests',
    titleHt: 'Dekrè ki refòme dwa garanti yo',
    number: 'Décret du 9 avril 2020',
    matiere: 'civil',
    moniteurRef: 'Le Moniteur, Spécial N° 7 du 14 mai 2020',
    publicationDate: new Date('2020-05-14'),
    effectiveDate: new Date('2020-05-14'),
    keywords: 'sûretés; gage; nantissement; cautionnement; garantie autonome; lettre de confort; réserve de propriété; antichrèse; privilèges; agent des sûretés; Registre des Sûretés Mobilières',
    summaryFr:
      'Décret du 9 avril 2020 réformant le Droit des Sûretés (Le Moniteur, Spécial N° 7 du 14 mai 2020) : crée la Loi 28-1 du ' +
      'Code civil (sûretés en général, agent des sûretés — arts. 1774-1 à 1774-10), refond les Lois 29 (sûretés personnelles : ' +
      'cautionnement, garantie autonome, lettre de confort), 32 (sûretés mobilières : gage, nantissement, propriété retenue — ' +
      'arts. 1838 à 1858-21) et 33 (privilèges et sûretés immobilières : droit de rétention, classement des privilèges, ' +
      'antichrèse) ; modifie le Code de commerce (arts. 1611-1, 1611-2, 600) et abroge la Loi du 27 novembre 2008 sur le gage sans dépossession.',
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
