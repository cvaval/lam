/**
 * Téléversement de la LOI SUR LES BANQUES ET AUTRES INSTITUTIONS FINANCIÈRES (votée
 * 13 mars / 14 mai 2012, promulguée 17 juillet 2012, Le Moniteur Spécial n° 4 du
 * 20 juillet 2012) en « Législation annotée » → NOUVELLE section « Droit bancaire &
 * financier » (créée sous Droit économique & des affaires, sœur de Droit commercial) —
 * lecteur annoté : sommaire (4 TITRES, 14 CHAPITRES, 8 SECTIONS), index alphabétique
 * de 96 sujets couvrant les 206 articles, renvois inline « article N ».
 *
 * L'édition Moniteur de la même loi (MONITEUR_MANUAL, Spécial n° 4 juillet 2012) reste
 * en place (règle cliente : copier, jamais déplacer).
 * Idempotent (upsert par source). Données : scripts/data/loi-banques-2012/.
 *   npx tsx scripts/_import-loi-banques.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/loi-banques-2012'
const SOURCE = 'LOI_BANQUES_2012'
const TITLE = 'Loi sur les banques et autres institutions financières'

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

  // ── Thème « Droit bancaire & financier » : créé s'il n'existe pas, sous economique ──
  const eco = await prisma.theme.findFirst({ where: { slug: 'economique' } })
  if (!eco) throw new Error('thème economique introuvable')
  let theme = await prisma.theme.findFirst({ where: { slug: 'droit-bancaire' } })
  if (!theme) {
    const maxPos = await prisma.theme.aggregate({ where: { parentId: eco.id }, _max: { position: true } })
    theme = await prisma.theme.create({
      data: {
        slug: 'droit-bancaire', parentId: eco.id, position: (maxPos._max.position ?? 0) + 1,
        labelFr: 'Droit bancaire & financier', labelEn: 'Banking & financial law', labelHt: 'Dwa bankè & finansye',
      },
    })
    console.log(`✓ thème créé : Droit économique & des affaires → ${theme.labelFr} (${theme.slug})`)
  } else console.log(`✓ thème existant : ${theme.labelFr}`)

  const data = {
    type: 'LEGISLATION' as const,
    status: 'EN_VIGUEUR' as const,
    titleFr: TITLE,
    titleEn: 'Act on banks and other financial institutions',
    titleHt: 'Lwa sou bank ak lòt enstitisyon finansye yo',
    number: 'Loi du 14 mai 2012',
    matiere: 'bancaire',
    moniteurRef: 'Le Moniteur, Spécial N° 4 du 20 juillet 2012',
    publicationDate: new Date('2012-07-20'),
    effectiveDate: new Date('2012-07-20'),
    keywords: 'banques; institutions financières; BRH; agrément; fonds propres; capital minimum; vérificateur indépendant; liquidation; administration provisoire; blanchiment; secret professionnel; dépôts bancaires',
    summaryFr:
      'Loi votée les 13 mars et 14 mai 2012, promulguée le 17 juillet 2012 (Le Moniteur, Spécial N° 4 du 20 juillet 2012) : ' +
      '206 articles régissant l’agrément, le fonctionnement, la réglementation, le contrôle, la restructuration et la liquidation ' +
      'des banques par la BRH, les autres institutions financières, la prévention du blanchiment, le secret professionnel, le ' +
      'crédit immobilier et les dépôts bancaires.',
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
