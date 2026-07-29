/**
 * Téléversement de la LOI UCREF (votée le 4 mai 2017 par la Chambre et le 8 mai 2017
 * par le Sénat, promulguée le 12 mai 2017, Le Moniteur 172ᵉ Année, Spécial N° 16 du
 * 25 mai 2017) en « Législation annotée » → Banques & institutions financières.
 *
 * Fait AUSSI le lien RÉCIPROQUE : le Décret IMF 2020 cite cette loi au préambule ;
 * son entrée « textes cités » gagne le lien vers l'UCREF désormais en ligne.
 * Idempotent (upsert par source). Données : scripts/data/loi-ucref-2017/.
 *   npx tsx scripts/_import-loi-ucref.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/loi-ucref-2017'
const SOURCE = 'LOI_UCREF_2017'
const IMF_ID = 'cms5d6tp200002695mv8c5bdb'
const TITLE = "Loi portant organisation et fonctionnement de l'Unité Centrale de Renseignements Financiers (UCREF)"

async function main() {
  const body = readFileSync(`${DIR}/bodyOriginal.txt`, 'utf8').trimEnd()
  const ann = JSON.parse(readFileSync(`${DIR}/annotations.json`, 'utf8')) as Annotations & Record<string, any>
  ann.indexEntries = JSON.parse(readFileSync(`${DIR}/_ucref_index.json`, 'utf8'))
  const labels = (ann.labels ?? {}) as Record<string, string>

  const blocks = segmentAnnotated(body, ann.toc)
  const secs = blocks.filter((b) => b.kind === 'section').length
  const anchors = new Set(blocks.filter((b: any) => b.kind === 'body' && b.anchor).map((b: any) => b.anchor))
  if (secs !== ann.toc.length) throw new Error(`segmentation ${secs}/${ann.toc.length} — annulé`)
  const missing = Object.keys(labels).filter((a) => !anchors.has(a))
  if (missing.length) throw new Error(`ancres sans bloc : ${missing.join(', ')} — annulé`)
  const dead = ann.indexEntries.flatMap((e: any) => e.ctRefs).filter((r: any) => !anchors.has(`art-${r}`))
  if (dead.length) throw new Error(`index : renvois morts ${[...new Set(dead)].join(', ')} — annulé`)
  const covered = new Set(ann.indexEntries.flatMap((e: any) => e.ctRefs))
  const uncovered = [...anchors].filter((a) => !covered.has((a as string).slice(4)))
  if (uncovered.length) throw new Error(`index : non couverts ${uncovered.join(', ')} — annulé`)
  const deadX = (ann.crossRefs ?? []).filter((x: any) => !ann.toc.some((e: any) => e.anchor === x.anchor))
  if (deadX.length) throw new Error(`crossRefs : ancres inconnues — annulé`)
  const linked = (ann.crossRefs ?? []).flatMap((x: any) => (x.docs ?? []).map((d: any) => d.id))
  const found = new Set((await prisma.document.findMany({ where: { id: { in: linked } }, select: { id: true } })).map((d) => d.id))
  const orphan = linked.filter((id: string) => !found.has(id))
  if (orphan.length) throw new Error(`liens morts : ${orphan.join(', ')} — annulé`)
  console.log(`✓ segmentation ${secs}/${ann.toc.length} · ${anchors.size} ancres · index ${ann.indexEntries.length} entrées (32/32, 0 mort) · ${linked.length} liens résolus`)

  const theme = await prisma.theme.findFirst({ where: { slug: 'droit-bancaire' } })
  if (!theme) throw new Error('thème droit-bancaire introuvable')

  const data = {
    type: 'LEGISLATION' as const,
    status: 'EN_VIGUEUR' as const,
    titleFr: TITLE,
    titleEn: 'Act on the organization and operation of the Financial Intelligence Unit (UCREF)',
    titleHt: "Lwa sou òganizasyon ak fonksyònman Inite Santral Ransèyman Finansye (UCREF)",
    number: 'Loi du 8 mai 2017',
    matiere: 'bancaire',
    moniteurRef: 'Le Moniteur, 172ᵉ Année, Spécial N° 16 du 25 mai 2017',
    publicationDate: new Date('2017-05-25'),
    effectiveDate: new Date('2017-05-25'),
    keywords:
      'UCREF; Unité Centrale de Renseignements Financiers; cellule de renseignement financier; blanchiment; financement du ' +
      'terrorisme; CNLBA; déclarations de soupçon; Conseil d’Administration; Directeur Général; Comité des Directeurs; ' +
      'secret professionnel; BRH; Ministère de la Justice; loi du 4 mai 2017; loi du 8 mai 2017; promulguée le 12 mai 2017',
    summaryFr:
      'Loi votée par la Chambre des Députés le 4 mai 2017 et par le Sénat le 8 mai 2017, promulguée le 12 mai 2017 ' +
      '(Le Moniteur, 172ᵉ Année, Spécial N° 16 du 25 mai 2017) : 32 articles organisant l’Unité Centrale de Renseignements ' +
      'Financiers (UCREF), organisme autonome à caractère administratif chargé de recevoir, analyser et traiter les ' +
      'déclarations de soupçon — mission et siège, Conseil d’Administration, Direction Générale, Comité des Directeurs, ' +
      'Directions techniques, Comité National de Lutte contre le Blanchiment des Avoirs (CNLBA), personnel et secret ' +
      'professionnel, coopération internationale, budget et ressources, dispositions transitoires et finales.',
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
  console.log(`✓ document ${existing ? 'mis à jour' : 'créé'} : ${doc.id} → « ${theme.labelFr} », réindexé`)

  // ── Lien RÉCIPROQUE : la table des textes cités du Décret IMF 2020 ──────────────
  const imf = await prisma.document.findUnique({ where: { id: IMF_ID }, select: { annotationsJson: true } })
  if (!imf?.annotationsJson) throw new Error('Décret IMF introuvable — lien réciproque impossible')
  const a2 = JSON.parse(imf.annotationsJson)
  const docs = a2.crossRefs?.[0]?.docs
  if (!Array.isArray(docs)) throw new Error('table des textes cités du Décret IMF absente')
  if (!docs.some((d: any) => d.id === doc.id)) {
    docs.push({ label: "Loi du 8 mai 2017 portant organisation et fonctionnement de l'UCREF", id: doc.id })
    await prisma.document.update({ where: { id: IMF_ID }, data: { annotationsJson: JSON.stringify(a2) } })
    await reindexDocument(IMF_ID)
    console.log(`✓ lien réciproque ajouté : Décret IMF 2020 → UCREF (${docs.length} textes cités)`)
  } else console.log('  lien réciproque déjà en place')
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
