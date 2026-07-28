/**
 * Téléversement du DÉCRET RÉGISSANT LES ACTIVITÉS MINIÈRES (donné au Palais National
 * le 27 mars 2026, Le Moniteur Spécial N° 16 du 30 mars 2026) en « Législation
 * annotée » → NOUVELLE section « Droit minier & ressources minérales » (créée sous
 * Droit économique & des affaires, sœur de Droit commercial et Droit bancaire) —
 * lecteur annoté : sommaire (17 TITRES, 50 CHAPITRES — préparé par la cliente,
 * validé contre le corps), index alphabétique client (392 entrées, 124 sujets),
 * renvois inline « article N » (numérotation décimale 39.1 → ancre art-39-1).
 *
 * Corps = 306 articles (l'article 27 est imprimé « Articles 27.- », sic, au J.O.)
 * + 36 articles décimaux, reconstitué des DEUX moitiés transcrites (pages 1-32 et
 * 33-62 du Spécial N° 16) + tableau des redevances (art. 232.2) ligne-par-ligne.
 * Idempotent (upsert par source). Données : scripts/data/decret-minier-2026/.
 *   npx tsx scripts/_import-decret-minier.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/decret-minier-2026'
const SOURCE = 'DECRET_MINIER_2026'
const TITLE = 'Décret régissant les activités minières'

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
  const deadX = (ann.crossRefs ?? []).filter((x: any) => !ann.toc.some((e: any) => e.anchor === x.anchor))
  if (deadX.length) throw new Error(`crossRefs : ancres inconnues ${deadX.map((x: any) => x.anchor).join(', ')} — annulé`)
  console.log(`✓ segmentation : ${secs}/${ann.toc.length} en-têtes · ${anchors.size} ancres · index ${ann.indexEntries.length} entrées, 0 mort`)

  // ── Thème « Droit minier & ressources minérales » : créé s'il n'existe pas, sous economique ──
  const eco = await prisma.theme.findFirst({ where: { slug: 'economique' } })
  if (!eco) throw new Error('thème economique introuvable')
  let theme = await prisma.theme.findFirst({ where: { slug: 'droit-minier' } })
  if (!theme) {
    const maxPos = await prisma.theme.aggregate({ where: { parentId: eco.id }, _max: { position: true } })
    theme = await prisma.theme.create({
      data: {
        slug: 'droit-minier', parentId: eco.id, position: (maxPos._max.position ?? 0) + 1,
        labelFr: 'Droit minier & ressources minérales', labelEn: 'Mining & mineral resources law', labelHt: 'Dwa minye & resous mineral',
      },
    })
    console.log(`✓ thème créé : Droit économique & des affaires → ${theme.labelFr} (${theme.slug})`)
  } else console.log(`✓ thème existant : ${theme.labelFr}`)

  const data = {
    type: 'LEGISLATION' as const,
    status: 'EN_VIGUEUR' as const,
    titleFr: TITLE,
    titleEn: 'Decree governing mining activities',
    titleHt: 'Dekrè ki reglemante aktivite min yo',
    number: 'Décret du 27 mars 2026',
    matiere: 'minier',
    moniteurRef: 'Le Moniteur, Spécial N° 16 du 30 mars 2026',
    publicationDate: new Date('2026-03-30'),
    // Art. 305 : entrée en vigueur six (6) mois après la publication du 30 mars 2026.
    effectiveDate: new Date('2026-09-30'),
    keywords:
      'mines; carrières; décret minier; AMN; Autorité Minière Nationale; cadastre minier; titres miniers; permis d’exploration; ' +
      'permis d’exploitation; convention minière; prospection; or alluvionnaire; exploitation artisanale; redevance; royalty; ' +
      'droit superficiaire; obligations environnementales; EIES; zones interdites; zones réservées; renonciation; retrait',
    summaryFr:
      'Décret donné au Palais National le 27 mars 2026 (Le Moniteur, Spécial N° 16 du 30 mars 2026), en vigueur six mois après ' +
      'sa publication (art. 305) : 306 articles régissant la prospection, l’exploration et l’exploitation des mines et carrières — ' +
      'Autorité Minière Nationale (AMN), cadastre minier, titres miniers et Convention Minière, exploitation artisanale de l’or ' +
      'alluvionnaire, obligations environnementales et sociales, régime fiscal et douanier, police des mines, sanctions et ' +
      'dispositions transitoires. Remplace le régime du Décret minier du 3 mars 1976.',
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
