/**
 * Téléversement du DÉCRET DU 9 AVRIL 2020 SUR LE BAIL À USAGE PROFESSIONNEL
 * (Le Moniteur, 175e Année, Spécial N° 4 du 11 mai 2020, pp. 1-8) en « Législation
 * annotée » → Droit commercial + Code de commerce & statut du commerçant.
 *
 * Le décret compte 11 articles propres et INSÈRE 33 articles au Code de commerce
 * (chapitre II du titre VII, livre 1er : 1721-1 → 1729-3), en 9 sections, plus une
 * renumérotation (art. 111 → 1710-1, libellé inchangé).
 *
 * ⚠️ Ce décret ne modifie PAS le Code civil. Son article 1729-3 ÉCARTE les dispositions
 * contraires du chapitre II de la Loi 23 du Code civil (louage des choses) POUR LE SEUL
 * bail à usage professionnel — ce n'est pas une abrogation : ces articles restent en
 * vigueur pour tous les autres baux. Cf. _apply-decret-bail-pro-ccom.ts (overlay Code de
 * commerce) et _apply-decret-bail-pro-cc.ts (signalisation au Code civil).
 *
 * Idempotent (upsert par source). Données : scripts/data/decret-bail-pro-2020/.
 *   npx tsx scripts/_import-decret-bail-pro.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/decret-bail-pro-2020'
const SOURCE = 'DECRET_BAIL_PRO_2020'
const TITLE = 'Décret sur le Bail à Usage Professionnel'

async function main() {
  const body = readFileSync(`${DIR}/bodyOriginal.txt`, 'utf8').trimEnd()
  const ann = JSON.parse(readFileSync(`${DIR}/annotations.json`, 'utf8')) as Annotations & Record<string, any>
  const labels = (ann.labels ?? {}) as Record<string, string>

  // ── Contrôles bloquants (aucune écriture si l'un échoue) ──
  const blocks = segmentAnnotated(body, ann.toc)
  const secs = blocks.filter((b) => b.kind === 'section').length
  const anchors = new Set(blocks.filter((b: any) => b.kind === 'body' && b.anchor).map((b: any) => b.anchor))
  if (secs !== ann.toc.length) throw new Error(`segmentation ${secs}/${ann.toc.length} — annulé`)
  const missing = Object.keys(labels).filter((a) => !anchors.has(a))
  if (missing.length) throw new Error(`ancres sans bloc : ${missing.join(', ')} — annulé`)
  const dead = ann.indexEntries.flatMap((e: any) => e.ctRefs).filter((r: any) => !anchors.has(`art-${r}`))
  if (dead.length) throw new Error(`index : renvois morts ${[...new Set(dead)].join(', ')} — annulé`)
  const inseres = [...anchors].filter((a) => /^art-17\d\d-/.test(a))
  if (inseres.length !== 33) throw new Error(`articles insérés : ${inseres.length}/33 — annulé`)
  console.log(`✓ segmentation : ${secs}/${ann.toc.length} en-têtes · ${anchors.size} articles (11 décret + 33 insérés) · index ${ann.indexEntries.length} entrées, 0 mort`)

  const themes = await prisma.theme.findMany({ where: { slug: { in: ['droit-commercial', 'code-de-commerce'] } } })
  if (themes.length !== 2) throw new Error(`thèmes attendus introuvables (${themes.map((t) => t.slug).join(', ')})`)

  const data = {
    type: 'LEGISLATION' as const,
    status: 'EN_VIGUEUR' as const,
    titleFr: TITLE,
    titleEn: 'Decree on the professional-use lease',
    titleHt: 'Dekrè sou bay a izaj pwofesyonèl',
    number: 'Décret du 9 avril 2020',
    matiere: 'commercial',
    moniteurRef: 'Le Moniteur, 175e Année, Spécial N° 4 du 11 mai 2020',
    publicationDate: new Date('2020-05-11'),
    effectiveDate: new Date('2020-05-11'),
    keywords:
      'bail à usage professionnel; bail commercial; louage; preneur; bailleur; loyer; renouvellement; ' +
      'congé; cession de bail; sous-location; résiliation; expulsion; grosses réparations; ' +
      'trouble de jouissance; indemnité d’occupation; clause résolutoire; Code de commerce; ' +
      'contrats commerciaux; locaux commerciaux; terrains nus; affaires sommaires',
    summaryFr:
      'Décret donné au Palais National le 9 avril 2020 (Le Moniteur, Spécial N° 4 du 11 mai 2020) : refonte du ' +
      'titre VII du livre 1er du Code de commerce, désormais « Des contrats commerciaux », et création d’un ' +
      'chapitre II « Du bail à usage professionnel » (33 articles, 1721-1 à 1729-3, en neuf sections) — champ ' +
      'd’application, conclusion et durée, obligations du bailleur et du preneur, loyer, cession et sous-location, ' +
      'renouvellement, résiliation et dispositions finales. L’article 111 devient l’article 1710-1 (libellé ' +
      'inchangé). L’article 1729-3 écarte, pour le seul bail à usage professionnel, les dispositions contraires ' +
      'du Code civil sur le louage des choses et des lois sur les loyers de 1947, 1948 et 1961 — ces textes ' +
      'demeurent applicables aux autres baux.',
    summaryEn:
      'Decree of 9 April 2020 restructuring Title VII, Book I of the Haitian Commercial Code into “Commercial ' +
      'contracts” and creating a chapter on the professional-use lease (33 articles, 1721-1 to 1729-3).',
    bodyOriginal: body,
    annotationsJson: JSON.stringify(ann),
    source: SOURCE,
  }

  const existing = await prisma.document.findFirst({ where: { source: SOURCE }, select: { id: true } })
  const doc = existing
    ? await prisma.document.update({ where: { id: existing.id }, data })
    : await prisma.document.create({ data: { ...data, originalLang: 'fr' } })

  for (const t of themes) {
    if (!(await prisma.documentTheme.findFirst({ where: { documentId: doc.id, themeId: t.id } })))
      await prisma.documentTheme.create({
        data: { documentId: doc.id, themeId: t.id, isPrimary: t.slug === 'droit-commercial', assignedBy: 'IMPORT' },
      })
  }
  await reindexDocument(doc.id)
  console.log(`✓ document ${existing ? 'mis à jour' : 'créé'} : ${doc.id} → ${themes.map((t) => `« ${t.labelFr} »`).join(' + ')}, réindexé`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
