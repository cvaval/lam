/**
 * Téléversement du DÉCRET DU 29 NOVEMBRE 1978 SUR LE DROIT DE TIMBRE (Moniteur n° 89
 * du 18 décembre 1978), texte CONSOLIDÉ par les Lois de Finances 2011-2012 et
 * 2013-2014 (édition Joseph Paillant du Code Fiscal d'Haïti, 2018) — phase 2 fiscale.
 * Classé par COPIE dans `fiscalite` (PRINCIPAL) + `fiscalite-impots`. Le texte
 * d'origine (non consolidé) du corpus Vandal reste en place (copier, jamais déplacer).
 * Idempotent (upsert par source). Données : scripts/data/decret-timbre-1978/.
 *   npx tsx scripts/_import-decret-timbre.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/decret-timbre-1978'
const SOURCE = 'DECRET_TIMBRE_1978_CONSOLIDE'
const TITLE = 'Décret du 29 novembre 1978 sur le droit de timbre (consolidé)'

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
  console.log(`✓ segmentation : ${secs}/${ann.toc.length} · ${anchors.size} ancres · index ${ann.indexEntries.length} sujets, 0 mort`)

  const data = {
    type: 'LEGISLATION' as const,
    status: 'EN_VIGUEUR' as const,
    titleFr: TITLE,
    titleEn: 'Decree of November 29, 1978 on stamp duty (consolidated)',
    titleHt: 'Dekrè 29 novanm 1978 sou dwa tenb (konsolide)',
    number: 'Décret du 29 novembre 1978',
    matiere: 'fiscal',
    moniteurRef: 'Le Moniteur, N° 89 du 18 décembre 1978 — consolidé (LF 2011-2012, 2013-2014 ; éd. Paillant 2018)',
    publicationDate: new Date('1978-12-18'),
    effectiveDate: new Date('1978-12-18'),
    keywords:
      'droit de timbre; timbre fixe; timbre proportionnel; timbres spéciaux; oblitération; papiers timbrés; vignettes; ' +
      'chèques; banques; exemptions; Timbre Justice; Timbre Commerce et Industrie; affiches; pénalités; DGI',
    summaryFr:
      'Décret du 29 novembre 1978 sur le droit de timbre, 42 articles, tel que modifié par les Lois de Finances 2011-2012 ' +
      'et 2013-2014 (texte consolidé de l’édition Joseph Paillant du Code Fiscal d’Haïti, 2018) : définition et assiette ' +
      'de l’impôt du timbre, perception par les banques, oblitération, exemptions, quotité des droits fixes et ' +
      'proportionnels, timbres spéciaux, pénalités et amendes.',
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
