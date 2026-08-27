/**
 * Loi CEC 2002 — LE LOT DU CORPS (feuille de route du 27 août 2026, §§ 7.4, 7.5, 7.6, 11) :
 *
 *   § 7.4 — recompléter les 3 libellés de TITRES tronqués (sec-4, sec-27, sec-43).
 *     Mécanique MESURÉE au pré-vol (maj2026-prevol.ts) : le corps porte chacun de ces
 *     en-têtes sur DEUX lignes ; `segmentAnnotated` apparie la 1ʳᵉ au toc et laisse la 2ᵉ
 *     tomber en bloc de corps SANS ancre (ligne orpheline). L'appariement étant ligne à
 *     ligne et à la lettre (normLine ne replie que les espaces), un libellé sur deux lignes
 *     ne PEUT pas s'apparier : la voie que la mesure impose est la FUSION — les deux lignes
 *     du corps deviennent une (l'unique \n remplacé par une espace, aucun caractère perdu),
 *     et le libellé fusionné se porte au toc ET au navToc. EN LETTRE DU CORPS (§ 4.1) —
 *     jamais la version normalisée du sommaire cliente. Les ancres ne changent pas.
 *   § 7.5 — ajouter à l'index les 2 sujets prouvés de la cliente (« Épargne »,
 *     « Supervision », maj2026-index-ajouts.json), au format des entrées existantes
 *     (ctRefs en chaînes), insérés à leur position de collation française (convention
 *     mesurée : liste triée sous Intl.Collator('fr'), zéro inversion). Chaque renvoi est
 *     RE-VÉRIFIÉ à l'exécution (radical à frontière de mot, accents pliés) — sinon refus.
 *   § 7.6 — les 48 plages d'articles (maj2026-base-ranges.json) en ASSERTIONS bloquantes,
 *     jointes par ORDRE et ANCRE, jamais par libellé.
 *   § 11 — toutes les vérifications bloquantes, rejouées sur l'état SIMULÉ avant toute
 *     écriture, dont l'oracle de l'index cliente (§ 8) contre sa baseline enregistrée.
 *
 * CE SCRIPT NE TOUCHE À RIEN D'AUTRE : ni titres, ni number, ni dates, ni CrossRef (le
 * renvoi entrant du décret sûretés doit ressortir INTACT — vérifié), ni création de
 * document (résolution par `source`, garde d'unicité § 10.7).
 *
 * SIMULATION PAR DÉFAUT — rapport chiffré, diff intégral, AUCUNE écriture.
 * `--apply` EST LANCÉ PAR ME VAVAL, ET PAR ELLE SEULE (§ 10.2).
 *
 *     npx tsx scripts/data/cec/maj2026-lot-corps.ts            # simulation
 *     npx tsx scripts/data/cec/maj2026-lot-corps.ts --apply    # écriture (Me Vaval)
 */
import { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TocEntry, NavGroup } from '../../../src/lib/legislation/annotated'
import { reindexDocument } from '../../../src/lib/search/reindex'
import { audit } from '../../../src/lib/auth/audit'
import { jouerOracle, cleEchec, comparerALaBaseline, textesParArticle, plier, radicalPresent, type EchecOracle } from './maj2026-oracle-index'
import { verifierSegmentation, mesurerPlages, comparerPlages, verifierIndex, verifierSentinelles, type Plage } from './maj2026-mesures'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const DOSSIER = __dirname
const SOURCE = 'LOI_CEC_2002'
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex')

interface LibelleTitre {
  anchor: string
  ligne1: string
  ligne2: string
  fusion: string
}
interface Ajout {
  subject: string
  ctRefs: string[]
  radical: string
}
interface AnnBrutes {
  toc: TocEntry[]
  labels: Record<string, string>
  commentaires?: Record<string, string[]>
  indexEntries: { subject: string; ctRefs: string[] }[]
  navToc: NavGroup[]
  [cle: string]: unknown
}

async function main() {
  console.log(APPLY ? 'MODE : --apply (écriture)' : 'MODE : SIMULATION — aucune écriture en base.')

  // § 10.7 — garde d'unicité, résolution par `source`. Jamais de création de document.
  const n = await prisma.document.count({ where: { source: SOURCE } })
  if (n !== 1) throw new Error(`${n} fiches ${SOURCE} — il en faut exactement 1`)
  const doc = await prisma.document.findFirstOrThrow({
    where: { source: SOURCE },
    select: {
      id: true, titleFr: true, titleEn: true, titleHt: true, number: true,
      publicationDate: true, adoptionDate: true, effectiveDate: true,
      bodyOriginal: true, bodyClean: true, annotationsJson: true,
    },
  })
  const body = doc.bodyOriginal ?? ''
  const annStr = doc.annotationsJson ?? ''
  if (!body || !annStr) throw new Error('bodyOriginal ou annotationsJson vide — fiche inattendue, STOP')
  if (doc.bodyClean !== null) throw new Error('bodyClean non NULL — le lecteur n’afficherait pas bodyOriginal, STOP')
  console.log(`fiche ${doc.id} — corps ${body.split('\n').length} lignes / ${body.length} c. (md5 ${md5(body)}), annotations ${annStr.length} c. (md5 ${md5(annStr)})`)

  // Le corps de départ doit être CELUI de la baseline (§ 8) — première assertion : empreinte.
  const baseline = JSON.parse(readFileSync(join(DOSSIER, 'maj2026-oracle-baseline.json'), 'utf8')) as {
    md5BodyOriginal: string
    echecs: EchecOracle[]
  }
  const libelles = JSON.parse(readFileSync(join(DOSSIER, 'maj2026-libelles-titres.json'), 'utf8')) as LibelleTitre[]
  const ajouts = (JSON.parse(readFileSync(join(DOSSIER, 'maj2026-index-ajouts.json'), 'utf8')) as { ajouts: Ajout[] }).ajouts
  const reference = (JSON.parse(readFileSync(join(DOSSIER, 'maj2026-base-ranges.json'), 'utf8')) as { plages: Plage[] }).plages

  const ann = JSON.parse(annStr) as AnnBrutes
  // La réécriture doit être un diff EXACT : le sérialiseur doit restituer l'existant au byte.
  if (JSON.stringify(ann) !== annStr)
    throw new Error('annotationsJson ne survit pas au roundtrip JSON — la réécriture dépasserait le diff voulu, STOP')

  // Idempotence : lot déjà appliqué ? (les 3 libellés fusionnés ET les sujets présents)
  const dejaFusionnes = libelles.every((l) => ann.toc.find((t) => t.anchor === l.anchor)?.label === l.fusion)
  const dejaIndexes = ajouts.every((a) => ann.indexEntries.some((e) => e.subject === a.subject))
  if (dejaFusionnes && dejaIndexes) {
    console.log('Lot DÉJÀ APPLIQUÉ (libellés fusionnés, sujets à l’index) — rien à écrire.')
    verifierSegmentation(body, ann.toc, ann.labels, ann.commentaires)
    verifierSentinelles(body)
    console.log('Invariants § 11 revérifiés sur l’état en place. Fin.')
    return
  }
  if (dejaFusionnes !== dejaIndexes)
    throw new Error(`État MIXTE (fusion § 7.4 : ${dejaFusionnes} ; index § 7.5 : ${dejaIndexes}) — investiguer avant tout`)
  if (md5(body) !== baseline.md5BodyOriginal)
    throw new Error(`le corps en base (md5 ${md5(body)}) n'est plus celui de la baseline (${baseline.md5BodyOriginal}) — quelque chose a bougé : STOP, investiguer, re-passer maj2026-prevol.ts`)

  // ————— État de départ vérifié (les mêmes contrôles que le pré-vol, § 7.1).
  const segAvant = verifierSegmentation(body, ann.toc, ann.labels, ann.commentaires)
  comparerPlages(mesurerPlages(segAvant.blocks, ann.toc), reference)
  verifierIndex(ann.indexEntries, ann.labels)
  verifierSentinelles(body)
  const ancresAvant = new Set(segAvant.blocks.filter((b) => b.kind === 'body' && b.anchor).map((b) => (b.kind === 'body' ? b.anchor! : '')))
  console.log(`état de départ : ${ann.toc.length} en-têtes appariés, ${ancresAvant.size} articles ancrés, ${reference.length} plages conformes, index ${ann.indexEntries.length} sujets, sentinelles OK`)

  // ————— § 7.4 : la fusion des 3 en-têtes — corps, toc, navToc.
  console.log('\n§ 7.4 — fusion des libellés de TITRES (delta du corps, ligne par ligne, numéros du corps AVANT lot, 1-indexés) :')
  const lignes = body.split('\n')
  // Toutes les localisations se font sur le corps INTACT, puis les fusions s'exécutent de
  // la dernière à la première : les numéros annoncés sont ceux du corps de départ.
  const plan = libelles.map((l) => {
    const entree = ann.toc.find((t) => t.anchor === l.anchor)
    if (!entree) throw new Error(`§ 7.4 — ${l.anchor} absent du toc`)
    if (entree.label !== l.ligne1)
      throw new Error(`§ 7.4 — ${l.anchor} : label du toc « ${entree.label} » ≠ ligne 1 mesurée « ${l.ligne1} »`)
    const indices = lignes.flatMap((x, i) => (x === l.ligne1 ? [i] : []))
    if (indices.length !== 1)
      throw new Error(`§ 7.4 — ${l.anchor} : ${indices.length} occurrence(s) de la ligne 1 dans le corps, 1 attendue`)
    const i = indices[0]
    if (lignes[i + 1] !== l.ligne2)
      throw new Error(`§ 7.4 — ${l.anchor} : la ligne suivante « ${lignes[i + 1]} » ≠ ligne 2 mesurée « ${l.ligne2} »`)
    return { l, entree, i }
  })
  for (const { l, i } of plan) {
    console.log(`  ${l.anchor} — lignes ${i + 1}-${i + 2} fusionnées :`)
    console.log(`    avant l.${i + 1} : « ${l.ligne1} »`)
    console.log(`    avant l.${i + 2} : « ${l.ligne2} »`)
    console.log(`    après        : « ${l.fusion} »`)
  }
  for (const { l, entree, i } of [...plan].sort((a, b) => b.i - a.i)) {
    lignes.splice(i, 2, l.fusion)
    entree.label = l.fusion
  }
  const newBody = lignes.join('\n')
  if (newBody.length !== body.length)
    throw new Error(`§ 7.4 — la fusion a changé le compte de caractères (${body.length} → ${newBody.length}) : chaque \\n devait devenir UNE espace`)
  console.log(`  corps : ${body.split('\n').length} → ${lignes.length} lignes, ${newBody.length} c. (inchangé), md5 ${md5(newBody)}`)

  // navToc : les mêmes 3 libellés, aux mêmes ancres — et rien d'autre.
  let navChanges = 0
  const marcher = (items: { label: string; anchor: string; children?: unknown[] }[]): void => {
    for (const it of items) {
      const l = libelles.find((x) => x.anchor === it.anchor && it.label === x.ligne1)
      if (l) {
        it.label = l.fusion
        navChanges++
      }
      if (Array.isArray(it.children)) marcher(it.children as typeof items)
    }
  }
  marcher(ann.navToc as unknown as { label: string; anchor: string; children?: unknown[] }[])
  if (navChanges !== libelles.length)
    throw new Error(`§ 7.4 — navToc : ${navChanges} libellé(s) recomplété(s) pour ${libelles.length} attendus`)
  console.log(`  navToc : ${navChanges} libellés recomplétés (mêmes ancres, mêmes lettres)`)

  // ————— § 7.5 : les 2 sujets, re-vérifiés au corps puis insérés à leur place de collation.
  console.log('\n§ 7.5 — index : ajouts (« ' + ajouts.map((a) => a.subject).join(' », « ') + ' »)')
  const textesApres = textesParArticle(newBody, ann.toc)
  for (const a of ajouts) {
    if (ann.indexEntries.some((e) => e.subject === a.subject))
      throw new Error(`§ 7.5 — « ${a.subject} » déjà à l'index — état inattendu, STOP`)
    for (const ref of a.ctRefs) {
      const texte = textesApres.get(Number(ref))
      if (texte === undefined) throw new Error(`§ 7.5 — « ${a.subject} » → ${ref} : article introuvable à la segmentation`)
      if (!radicalPresent(a.radical, plier(texte)))
        throw new Error(`§ 7.5 — « ${a.subject} » → ${ref} : radical « ${a.radical} » absent à frontière de mot (accents pliés) — renvoi NON vérifié, refus`)
    }
  }
  const collator = new Intl.Collator('fr')
  const avantIndex = ann.indexEntries.map((e) => e.subject)
  for (const a of [...ajouts].sort((x, y) => collator.compare(x.subject, y.subject))) {
    let pos = ann.indexEntries.length
    for (let i = 0; i < ann.indexEntries.length; i++)
      if (collator.compare(ann.indexEntries[i].subject, a.subject) > 0) {
        pos = i
        break
      }
    ann.indexEntries.splice(pos, 0, { subject: a.subject, ctRefs: [...a.ctRefs] })
    console.log(`  « ${a.subject} » → arts ${a.ctRefs.join(', ')} — inséré en position ${pos + 1} (entre « ${ann.indexEntries[pos - 1]?.subject ?? '(début)'} » et « ${ann.indexEntries[pos + 1]?.subject ?? '(fin)'} »)`)
  }
  if (ann.indexEntries.length !== avantIndex.length + ajouts.length)
    throw new Error(`§ 7.5 — index : ${ann.indexEntries.length} sujets pour ${avantIndex.length} + ${ajouts.length} attendus`)
  const restants = ann.indexEntries.filter((e) => !ajouts.some((a) => a.subject === e.subject)).map((e) => e.subject)
  if (JSON.stringify(restants) !== JSON.stringify(avantIndex))
    throw new Error('§ 7.5 — les sujets existants ne sont plus dans leur ordre d’origine')
  for (let i = 0; i < ann.indexEntries.length - 1; i++)
    if (collator.compare(ann.indexEntries[i].subject, ann.indexEntries[i + 1].subject) > 0)
      throw new Error(`§ 7.5 — inversion de collation créée : « ${ann.indexEntries[i].subject} » > « ${ann.indexEntries[i + 1].subject} »`)
  console.log(`  index : ${avantIndex.length} + ${ajouts.length} = ${ann.indexEntries.length} sujets, ordre de collation conservé`)

  // ————— § 11 : TOUT se revérifie sur l'état SIMULÉ, avant d'écrire quoi que ce soit.
  console.log('\n§ 11 — vérifications bloquantes sur l’état simulé :')
  const segApres = verifierSegmentation(newBody, ann.toc, ann.labels, ann.commentaires)
  if (segApres.orphelins.length)
    throw new Error(`§ 11 — lignes orphelines restantes : ${segApres.orphelins.map((o) => `${o.apresSection} « ${o.texte} »`).join(' ; ')}`)
  const ancresApres = new Set(segApres.blocks.filter((b) => b.kind === 'body' && b.anchor).map((b) => (b.kind === 'body' ? b.anchor! : '')))
  if (ancresApres.size !== ancresAvant.size || [...ancresAvant].some((a) => !ancresApres.has(a)))
    throw new Error('§ 11 — l’ensemble des ancres d’articles a changé')
  for (const l of libelles) {
    const sec = segApres.blocks.find((b) => b.kind === 'section' && b.anchor === l.anchor)
    if (!sec || !sec.text.includes(l.ligne2))
      throw new Error(`§ 11 — ${l.anchor} : le libellé affiché ne contient pas la 2ᵉ ligne`)
  }
  comparerPlages(mesurerPlages(segApres.blocks, ann.toc), reference)
  verifierIndex(ann.indexEntries, ann.labels)
  verifierSentinelles(newBody)
  console.log(`  en-têtes ${ann.toc.length}/${ann.toc.length} appariés · join === corps · 0 orpheline · ancres inchangées · ${reference.length} plages conformes (jointure ordre/ancre) · index couvrant, 0 renvoi mort · sentinelles intactes`)

  // § 11.8 — l'oracle (§ 8) : le MÊME script que la baseline, sur l'état simulé.
  const rejeu = jouerOracle(newBody, ann.toc)
  const { nouveaux, disparus } = comparerALaBaseline(rejeu, baseline.echecs)
  if (nouveaux.length)
    throw new Error(`§ 11.8 — oracle : échec(s) NOUVEAU(X) — régression bloquante : ${nouveaux.map(cleEchec).join(' ; ')}`)
  if (disparus.length)
    throw new Error(`§ 11.8 — oracle : échec(s) DISPARU(S) alors qu'aucune réparation n'est attendue dans ce lot : ${disparus.map(cleEchec).join(' ; ')} — investiguer`)
  console.log(`  oracle : ${rejeu.totalPaires} renvois rejoués, échecs bruts == baseline (${rejeu.echecs.length}), aucun nouveau, aucun disparu`)

  const newAnnStr = JSON.stringify(ann)
  console.log(`\nà écrire : bodyOriginal ${newBody.length} c. (md5 ${md5(newBody)}) · annotationsJson ${newAnnStr.length} c. (md5 ${md5(newAnnStr)})`)
  console.log('champs NON touchés : titleFr/En/Ht, number, publicationDate, adoptionDate, effectiveDate, sourcePdfUrl, CrossRef.')

  if (!APPLY) {
    console.log('\nSIMULATION — aucune écriture. Me Vaval relance avec --apply (§ 10.2).')
    return
  }

  // ————— Écriture (§ 10) : état antérieur archivé, transaction, audit, recomptes, réindexation.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const nomAvant = `maj2026-etat-avant-apply-${stamp}.json`
  writeFileSync(
    join(DOSSIER, nomAvant),
    JSON.stringify({ archiveLe: new Date().toISOString(), id: doc.id, md5BodyOriginal: md5(body), md5AnnotationsJson: md5(annStr), bodyOriginal: body, annotationsJson: annStr }, null, 1) + '\n',
    'utf8',
  )
  console.log(`\nétat antérieur archivé : ${nomAvant}`)

  const entrantsAvant = await prisma.crossRef.findMany({
    where: { toId: doc.id },
    orderBy: { id: 'asc' },
    select: { id: true, kind: true, fromId: true, toLabel: true, note: true },
  })
  const auditAvant = await prisma.auditLog.count({ where: { targetType: 'Document', targetId: doc.id } })

  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: doc.id }, data: { bodyOriginal: newBody, annotationsJson: newAnnStr } })
    await audit(
      {
        action: 'DOC_PUBLISHED',
        targetType: 'Document',
        targetId: doc.id,
        meta: {
          op: 'maj2026-cec-corps-titres-index',
          feuilleDeRoute: 'Loi CEC 2002 — sommaire et index de la cliente, 27 août 2026, §§ 7.4-7.6',
          avant: { md5Body: md5(body), md5Annotations: md5(annStr), lignes: body.split('\n').length, sujetsIndex: avantIndex.length },
          apres: { md5Body: md5(newBody), md5Annotations: md5(newAnnStr), lignes: lignes.length, sujetsIndex: ann.indexEntries.length },
          fusions: libelles,
          indexAjouts: ajouts.map((a) => ({ subject: a.subject, ctRefs: a.ctRefs })),
          etatAnterieur: nomAvant,
        },
      },
      tx,
    )
  })

  // § 10.4 — audit() avale ses erreurs : on RECOMPTE après la transaction.
  const auditApres = await prisma.auditLog.count({ where: { targetType: 'Document', targetId: doc.id } })
  if (auditApres < auditAvant + 1)
    throw new Error(`écriture NON AUDITÉE : AuditLog ${auditAvant} → ${auditApres} (attendu ≥ ${auditAvant + 1}) — défaut à corriger`)
  if (auditApres > auditAvant + 1)
    console.warn(`  ⚠ AuditLog ${auditAvant} → ${auditApres} : plus d'une entrée nouvelle (écriture concurrente ?) — à vérifier au journal`)
  console.log(`écrit + audité (AuditLog ${auditAvant} → ${auditApres})`)

  // Relecture : les contenus écrits, les champs intouchés, le renvoi sûretés INTACT.
  const relu = await prisma.document.findUniqueOrThrow({
    where: { id: doc.id },
    select: { bodyOriginal: true, annotationsJson: true, titleFr: true, titleEn: true, titleHt: true, number: true, publicationDate: true, adoptionDate: true, effectiveDate: true },
  })
  if (md5(relu.bodyOriginal ?? '') !== md5(newBody) || md5(relu.annotationsJson ?? '') !== md5(newAnnStr))
    throw new Error('relecture : les contenus écrits ne correspondent pas — investiguer immédiatement')
  if (relu.titleFr !== doc.titleFr || relu.titleEn !== doc.titleEn || relu.titleHt !== doc.titleHt || relu.number !== doc.number)
    throw new Error('relecture : un titre ou le number a bougé — ce lot ne devait pas y toucher')
  if (relu.publicationDate?.toISOString() !== doc.publicationDate?.toISOString())
    throw new Error('relecture : publicationDate a bougé')
  if ((relu.adoptionDate?.toISOString() ?? null) !== (doc.adoptionDate?.toISOString() ?? null))
    throw new Error('relecture : adoptionDate a bougé — ce lot ne la touche pas (§ 7.2 est un lot distinct)')
  if (relu.effectiveDate !== null && doc.effectiveDate === null) throw new Error('relecture : effectiveDate a bougé')
  const entrantsApres = await prisma.crossRef.findMany({
    where: { toId: doc.id },
    orderBy: { id: 'asc' },
    select: { id: true, kind: true, fromId: true, toLabel: true, note: true },
  })
  if (JSON.stringify(entrantsApres) !== JSON.stringify(entrantsAvant))
    throw new Error('relecture : les CrossRef entrants ont changé pendant le lot — le renvoi sûretés devait rester intact')
  console.log(`relecture : contenus conformes, champs intouchés, ${entrantsApres.length} CrossRef entrant(s) intact(s)`)

  // § 10.5 — HORS transaction : cache de recherche + searchText.
  await reindexDocument(doc.id)
  console.log('reindexDocument : fait (hors transaction)')
  console.log('\nLOT DU CORPS : APPLIQUÉ.')
}

main()
  .catch((e) => {
    console.error('LOT DU CORPS : ÉCHEC —', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
