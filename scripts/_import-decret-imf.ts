/**
 * Téléversement du DÉCRET PORTANT ORGANISATION ET FONCTIONNEMENT DES INSTITUTIONS DE
 * MICROFINANCE (IMF) — donné le 5 juin 2020, Le Moniteur, Spécial N° 24 du 25 août
 * 2020 — en « Législation annotée » → Droit économique & des affaires → Banques &
 * institutions financières (droit-bancaire), lecteur annoté (sommaire 32 en-têtes,
 * index client 224 entrées couverture 80/80, renvois inline « article N »,
 * table des textes cités en préambule, circulaires d'application BRH sous l'art. 80,
 * note sur la lacune de l'article 13 vérifiée au fac-similé).
 * Idempotent (upsert par source). Données : scripts/data/decret-imf-2020/.
 *   npx tsx scripts/_import-decret-imf.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/decret-imf-2020'
const SOURCE = 'DECRET_IMF_2020'
const TITLE = 'Décret portant organisation et fonctionnement des Institutions de Microfinance (IMF)'

async function main() {
  const body = readFileSync(`${DIR}/bodyOriginal.txt`, 'utf8').trimEnd()
  const ann = JSON.parse(readFileSync(`${DIR}/annotations.json`, 'utf8')) as Annotations & Record<string, any>
  ann.indexEntries = JSON.parse(readFileSync(`${DIR}/_imf_index.json`, 'utf8'))
  const labels = (ann.labels ?? {}) as Record<string, string>

  const blocks = segmentAnnotated(body, ann.toc)

  // Re-clé la note du transcripteur de l'art. 35 sur sa vraie jurisKey (sec|art).
  const byArt = (ann._commentaires_by_art ?? {}) as Record<string, string[]>
  ann.commentaires = {}
  for (const [artAnchor, notes] of Object.entries(byArt)) {
    const blk = blocks.find((b: any) => b.kind === 'body' && b.anchor === artAnchor && b.jurisKey)
    if (!blk) throw new Error(`article ${artAnchor} introuvable pour re-clé du commentaire — annulé`)
    ann.commentaires[(blk as any).jurisKey] = notes
  }
  delete ann._commentaires_by_art

  const secs = blocks.filter((b) => b.kind === 'section').length
  const anchors = new Set(blocks.filter((b: any) => b.kind === 'body' && b.anchor).map((b: any) => b.anchor))
  if (secs !== ann.toc.length) throw new Error(`segmentation ${secs}/${ann.toc.length} — annulé`)
  const missing = Object.keys(labels).filter((a) => !anchors.has(a))
  if (missing.length) throw new Error(`ancres sans bloc : ${missing.join(', ')} — annulé`)
  const dead = ann.indexEntries.flatMap((e: any) => e.ctRefs).filter((r: any) => !anchors.has(`art-${r}`))
  if (dead.length) throw new Error(`index : renvois morts ${[...new Set(dead)].join(', ')} — annulé`)
  const covered = new Set(ann.indexEntries.flatMap((e: any) => e.ctRefs))
  const uncovered = [...anchors].filter((a) => !covered.has((a as string).slice(4)))
  if (uncovered.length) throw new Error(`index : articles non couverts ${uncovered.join(', ')} — annulé`)
  // crossRefs & connexe : ancres existantes
  const deadX = (ann.crossRefs ?? []).filter((x: any) => !ann.toc.some((e: any) => e.anchor === x.anchor))
  if (deadX.length) throw new Error(`crossRefs : ancres inconnues ${deadX.map((x: any) => x.anchor).join(', ')} — annulé`)
  const deadC = Object.keys(ann.connexe ?? {}).filter((a) => !anchors.has(a))
  if (deadC.length) throw new Error(`connexe : ancres inconnues ${deadC.join(', ')} — annulé`)
  console.log(
    `✓ segmentation : ${secs}/${ann.toc.length} en-têtes · ${anchors.size} ancres · index ${ann.indexEntries.length} entrées ` +
    `(couverture intégrale, 0 mort) · crossRefs ${(ann.crossRefs ?? []).length} · connexe ${Object.keys(ann.connexe ?? {}).length} · commentaires ${Object.keys(ann.commentaires ?? {}).length}`
  )

  // Documents cités & circulaires liées existent bien
  const linked = [...(ann.crossRefs?.flatMap((x: any) => (x.docs ?? []).map((d: any) => d.id)) ?? []),
                  ...Object.values(ann.connexe ?? {}).flatMap((arr: any) => arr.map((c: any) => c.docId))]
  const found = new Set((await prisma.document.findMany({ where: { id: { in: linked } }, select: { id: true } })).map((d) => d.id))
  const orphan = linked.filter((id) => !found.has(id))
  if (orphan.length) throw new Error(`liens vers documents inexistants : ${orphan.join(', ')} — annulé`)
  console.log(`✓ ${linked.length} liens (textes cités + circulaires) résolus`)

  const theme = await prisma.theme.findFirst({ where: { slug: 'droit-bancaire' } })
  if (!theme) throw new Error('thème droit-bancaire introuvable')

  const data = {
    type: 'LEGISLATION' as const,
    status: 'EN_VIGUEUR' as const,
    titleFr: TITLE,
    titleEn: 'Decree on the organization and operation of Microfinance Institutions (MFIs)',
    titleHt: 'Dekrè sou òganizasyon ak fonksyònman Enstitisyon Mikwofinans (IMF) yo',
    number: 'Décret du 5 juin 2020',
    matiere: 'bancaire',
    moniteurRef: 'Le Moniteur, Spécial N° 24 du 25 août 2020',
    publicationDate: new Date('2020-08-25'),
    effectiveDate: new Date('2020-08-25'),
    keywords:
      'microfinance; IMF; institution de microfinance; microcrédit; BRH; agrément; société de microfinance; entreprise de ' +
      'microcrédit; épargne; gouvernance; contrôle interne; supervision; réglementation prudentielle; concurrence; protection ' +
      'de la clientèle; intermédiation; blanchiment; secret professionnel; sanctions; capital minimum; fonds de dotation',
    summaryFr:
      'Décret donné au Palais National le 5 juin 2020 (Le Moniteur, Spécial N° 24 du 25 août 2020) : 80 articles ' +
      '(numérotés 1 à 81, sans l’article 13, absent du Journal officiel) organisant les Institutions de Microfinance (IMF) — ' +
      'catégories, forme juridique, capital minimum et agrément par la BRH, gouvernance et contrôle interne, contrôle externe ' +
      'et supervision, réglementation financière, transformations, retrait d’agrément et liquidation, incitations fiscales, ' +
      'réglementation de la concurrence, protection de la clientèle, intermédiation, lutte contre le blanchiment, secret ' +
      'professionnel, infractions et sanctions administratives et pénales, dispositions transitoires et finales.',
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
