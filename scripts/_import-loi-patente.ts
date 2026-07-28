/**
 * Téléversement de la PATENTE — Loi du 10 juin 1996 (Moniteur n° 52 du 18 juillet
 * 1996, refonte du Décret du 28 septembre 1987), texte CONSOLIDÉ par les Lois de
 * Finances 2012-2013 et 2015-2016 (édition Joseph Paillant du Code Fiscal, 2018) —
 * phase 2 fiscale. Classé par COPIE dans `fiscalite` (PRINCIPAL) + `fiscalite-impots`.
 * Le décret de 1987 d'origine (corpus Vandal) reste en place.
 * Idempotent (upsert par source). Données : scripts/data/loi-patente-1996/.
 *   npx tsx scripts/_import-loi-patente.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/loi-patente-1996'
const SOURCE = 'LOI_PATENTE_1996_CONSOLIDE'
const TITLE = 'Loi du 10 juin 1996 relative à la patente (texte consolidé)'

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
  const keys = new Set(blocks.filter((b: any) => b.kind === 'body' && b.jurisKey).map((b: any) => b.jurisKey))
  const badKeys = Object.keys(ann.commentaires ?? {}).filter((k) => !keys.has(k))
  if (badKeys.length) throw new Error(`annotations orphelines : ${badKeys.join(', ')} — annulé`)
  console.log(`✓ segmentation : ${secs}/${ann.toc.length} · ${anchors.size} ancres · index ${ann.indexEntries.length} sujets, 0 mort`)

  const data = {
    type: 'LEGISLATION' as const,
    status: 'EN_VIGUEUR' as const,
    titleFr: TITLE,
    titleEn: 'Act of June 10, 1996 on the business license tax (patente, consolidated)',
    titleHt: 'Lwa 10 jen 1996 sou patant (konsolide)',
    number: 'Loi du 10 juin 1996',
    matiere: 'fiscal',
    moniteurRef: 'Le Moniteur, N° 52 du 18 juillet 1996 — consolidé (LF 2012-2013, 2015-2016 ; éd. Paillant 2018)',
    publicationDate: new Date('1996-07-18'),
    effectiveDate: new Date('1996-07-18'),
    keywords:
      'patente; droit fixe; droit variable; certificat de patente; déclaration de patente; DGI; communes; tarif de patente; ' +
      'nomenclature des secteurs; artisans; taxation d’office; masse salariale; chiffre d’affaires; code des investissements; ONG',
    summaryFr:
      'Patente — impôt réparti entre l’État et les communes : Décret du 28 septembre 1987 refondu par la Loi du 10 juin ' +
      '1996, 30 articles, tel que modifié par les Lois de Finances 2012-2013 et 2015-2016 (texte consolidé de l’édition ' +
      'Joseph Paillant, 2018) : personnes imposables et exonérées, droit fixe et droit variable, déclaration et certificat ' +
      'de patente, obligations comptables, sanctions, groupes de communes et tarif par secteur d’activité.',
    bodyOriginal: body,
    annotationsJson: JSON.stringify(ann),
    source: SOURCE,
  }
  const existing = await prisma.document.findFirst({ where: { source: SOURCE }, select: { id: true } })
  const doc = existing
    ? await prisma.document.update({ where: { id: existing.id }, data })
    : await prisma.document.create({ data: { ...data, originalLang: 'fr' } })
  for (const [slug, isPrimary] of [['fiscalite', true], ['fiscalite-impots', false]] as const) {
    const theme = await prisma.theme.findFirst({ where: { slug } })
    if (!theme) throw new Error(`thème ${slug} introuvable`)
    if (!(await prisma.documentTheme.findFirst({ where: { documentId: doc.id, themeId: theme.id } })))
      await prisma.documentTheme.create({ data: { documentId: doc.id, themeId: theme.id, isPrimary, assignedBy: 'IMPORT' } })
  }
  await reindexDocument(doc.id)
  console.log(`✓ document ${existing ? 'mis à jour' : 'créé'} : ${doc.id} → fiscalite (principal) + fiscalite-impots, réindexé`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
