/**
 * Téléversement du DÉCRET DU 29 SEPTEMBRE 2005 RELATIF À L'IMPÔT SUR LE REVENU
 * (texte CONSOLIDÉ par les lois de finances successives — reproduction de l'édition
 * Joseph Paillant du Code Fiscal d'Haïti, 2018, Livre I, Première partie) en
 * « Législation annotée », classé par COPIE dans les DEUX foyers fiscaux :
 * `fiscalite` (Droit économique — PRINCIPAL) et `fiscalite-impots` (Droit fiscal
 * & douanier / DGI). Phase 2 du chantier sous-thèmes
 * (docs/prompt-sous-themes-droit-economique.md).
 *
 * Lecteur annoté : sommaire 32 en-têtes (4 TITRES, 10 chapitres, 18 sections),
 * 191 ancres (189 articles + insertions 63-1/63-2), index alphabétique curé
 * (couverture intégrale, assertion bloquante), passages abrogés (barrés chez
 * Paillant) en annotations repliables par article.
 * Idempotent (upsert par source). Données : scripts/data/decret-ir-2005/.
 *   npx tsx scripts/_import-decret-ir.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/decret-ir-2005'
const SOURCE = 'DECRET_IMPOT_REVENU_2005'
const TITLE = 'Décret du 29 septembre 2005 relatif à l’Impôt sur le Revenu'

async function main() {
  const body = readFileSync(`${DIR}/bodyOriginal.txt`, 'utf8').trimEnd()
  const ann = JSON.parse(readFileSync(`${DIR}/annotations.json`, 'utf8')) as Annotations & Record<string, any>
  const idx = JSON.parse(readFileSync(`${DIR}/_ir_index.json`, 'utf8')) as { subject: string; ctRefs: string[] }[]
  ann.indexEntries = idx
  const labels = (ann.labels ?? {}) as Record<string, string>

  const blocks = segmentAnnotated(body, ann.toc)
  const secs = blocks.filter((b) => b.kind === 'section').length
  const anchored = blocks.filter((b: any) => b.kind === 'body' && b.anchor && !b.noAnchors)
  const anchors = new Set(anchored.map((b: any) => b.anchor))
  if (secs !== ann.toc.length) throw new Error(`segmentation ${secs}/${ann.toc.length} — annulé`)
  const missing = Object.keys(labels).filter((a) => !anchors.has(a))
  if (missing.length) throw new Error(`ancres sans bloc : ${missing.join(', ')} — annulé`)
  const dead = idx.flatMap((e) => e.ctRefs).filter((r) => !anchors.has(`art-${r}`))
  if (dead.length) throw new Error(`index : renvois morts ${[...new Set(dead)].join(', ')} — annulé`)
  const covered = new Set(idx.flatMap((e) => e.ctRefs))
  const uncovered = [...anchors].filter((a) => !covered.has((a as string).slice(4)))
  if (uncovered.length) throw new Error(`index : articles non couverts ${uncovered.join(', ')} — annulé`)
  // chaque clé d'annotation (passage barré) doit correspondre à un bloc réel
  const keys = new Set(blocks.filter((b: any) => b.kind === 'body' && b.jurisKey).map((b: any) => b.jurisKey))
  const badKeys = Object.keys(ann.commentaires ?? {}).filter((k) => !keys.has(k))
  if (badKeys.length) throw new Error(`annotations barrées orphelines : ${badKeys.join(', ')} — annulé`)
  console.log(
    `✓ segmentation : ${secs}/${ann.toc.length} en-têtes · ${anchors.size} ancres · index ${idx.length} sujets ` +
    `(couverture intégrale, 0 mort) · ${Object.keys(ann.commentaires ?? {}).length} articles annotés (barrés)`
  )

  const data = {
    type: 'LEGISLATION' as const,
    status: 'EN_VIGUEUR' as const,
    titleFr: TITLE,
    titleEn: 'Decree of September 29, 2005 on Income Tax (consolidated)',
    titleHt: 'Dekrè 29 septanm 2005 sou Enpo sou Revni (konsolide)',
    number: 'Décret du 29 septembre 2005',
    matiere: 'fiscal',
    // Référence de publication du fac-similé Paillant (constat d'audit : ne JAMAIS
    // renseigner une référence Moniteur sans appui dans la source).
    moniteurRef: 'Le Moniteur, Spécial N° 10 du 5 octobre 2005 — texte consolidé (éd. Paillant 2018)',
    publicationDate: new Date('2005-10-05'),
    effectiveDate: new Date('2005-10-05'),
    keywords:
      'impôt sur le revenu; IR; impôt sur les sociétés; DGI; déclaration définitive; retenue à la source; acompte ' +
      'provisionnel; bénéfices industriels et commerciaux; BIC; traitements et salaires; plus-value; capitaux mobiliers; ' +
      'taxation d’office; train de vie; barème; personnes physiques; personnes morales; vérification fiscale; prescription',
    summaryFr:
      'Décret du 29 septembre 2005 relatif à l’Impôt sur le Revenu, 189 articles, tel que modifié par les lois de ' +
      'finances successives (texte consolidé de l’édition Joseph Paillant du Code Fiscal d’Haïti, 2018) : impôt sur le ' +
      'revenu des personnes physiques (revenus fonciers, BIC, professions non commerciales, traitements et salaires, ' +
      'plus-values, capitaux mobiliers), impôt sur les sociétés, procédures administratives, vérification, prescription ' +
      'et dispositions transitoires.',
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
