/**
 * Loi CEC 2002 — PRÉ-VOL § 7.1 (feuille de route du 27 août 2026) : l'état témoin.
 *
 * LECTURE SEULE sur la base ; les seules écritures sont des FICHIERS de ce dossier :
 *   · `maj2026-etat-temoin-<horodatage>.json` — bodyOriginal + annotationsJson complets,
 *     empreintes md5, champs de la fiche (l'état antérieur du § 10.6, récupérable) ;
 *   · `maj2026-libelles-titres.json` — les 3 en-têtes de TITRES sur deux lignes (§ 7.4) :
 *     ligne du toc, ligne orpheline MESURÉE, libellé fusionné EN LETTRE DU CORPS ;
 *   · `maj2026-base-ranges.json` — les 48 plages jointes par ORDRE et ANCRE (§ 7.6),
 *     dérivées du relevé du 27 août (`maj2026-base-ranges-releve20260827.json`) et
 *     REVÉRIFIÉES contre le corps segmenté ;
 *   · `maj2026-oracle-baseline.json` — l'ensemble d'échecs bruts de l'oracle de l'index
 *     cliente sur le corps INTACT (§ 8) — LA baseline du rejeu de maj2026-lot-corps.ts.
 * Un fichier déjà présent n'est JAMAIS écrasé : il est vérifié, et toute divergence est
 * un défaut à investiguer (throw), pas une donnée à ajuster.
 *
 * Contrôles bloquants (§ 7.1) : garde d'unicité par `source` ; secs === toc.length ;
 * join === corps ; labels ↔ blocs ancrés ; les 48 plages mesurées == le relevé ; les
 * sentinelles des sics (§ 9.6). Compare des CONTENUS, jamais des horodatages.
 *
 *     npx tsx scripts/data/cec/maj2026-prevol.ts
 */
import { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TocEntry } from '../../../src/lib/legislation/annotated'
import { jouerOracle, cleEchec, comparerALaBaseline, type EchecOracle } from './maj2026-oracle-index'
import { verifierSegmentation, mesurerPlages, comparerPlages, verifierIndex, verifierSentinelles, norm, type Plage } from './maj2026-mesures'

const prisma = new PrismaClient()
const DOSSIER = __dirname
const SOURCE = 'LOI_CEC_2002'
/** Les 3 TITRES au libellé tronqué (§ 7.4) — relevé du 27 août, RE-MESURÉS ci-dessous. */
const ANCRES_TITRES = ['sec-4', 'sec-27', 'sec-43'] as const

const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex')

/** Écrit un fichier s'il n'existe pas ; sinon vérifie qu'il porte le MÊME contenu utile. */
function ecrireOuVerifier<T>(nom: string, contenu: T, comparer: (existant: T) => string | null): void {
  const chemin = join(DOSSIER, nom)
  if (!existsSync(chemin)) {
    writeFileSync(chemin, JSON.stringify(contenu, null, 1) + '\n', 'utf8')
    console.log(`  écrit : ${nom}`)
    return
  }
  const existant = JSON.parse(readFileSync(chemin, 'utf8')) as T
  const ecart = comparer(existant)
  if (ecart) throw new Error(`${nom} existe et DIVERGE (rien n'est écrasé — investiguer) : ${ecart}`)
  console.log(`  déjà présent, identique : ${nom}`)
}

async function main() {
  // § 10.7 — garde d'unicité : résolution par `source`, jamais par titre ni date.
  const n = await prisma.document.count({ where: { source: SOURCE } })
  if (n !== 1) throw new Error(`${n} fiches ${SOURCE} — il en faut exactement 1`)
  const doc = await prisma.document.findFirstOrThrow({
    where: { source: SOURCE },
    select: {
      id: true, source: true, type: true, titleFr: true, titleEn: true, titleHt: true, number: true,
      publicationDate: true, adoptionDate: true, effectiveDate: true, sourcePdfUrl: true,
      bodyOriginal: true, bodyClean: true, annotationsJson: true, richBlocksJson: true,
      themeIndexJson: true, updatedAt: true,
    },
  })
  const body = doc.bodyOriginal ?? ''
  const annStr = doc.annotationsJson ?? ''
  if (!body || !annStr) throw new Error('bodyOriginal ou annotationsJson vide — fiche inattendue, STOP')
  // Le lecteur affiche `bodyClean ?? bodyOriginal` : un bodyClean non NULL rendrait le
  // § 7.4 (fusion dans bodyOriginal) invisible à l'écran. Mesuré NULL le 27 août.
  if (doc.bodyClean !== null) throw new Error('bodyClean non NULL — le lecteur n’afficherait pas bodyOriginal, STOP')

  const md5Body = md5(body)
  const md5Ann = md5(annStr)
  console.log(`fiche ${doc.id} (${doc.source}) — ${doc.titleFr}`)
  console.log(`  publicationDate ${doc.publicationDate?.toISOString().slice(0, 10)} · adoptionDate ${doc.adoptionDate ? doc.adoptionDate.toISOString().slice(0, 10) : 'NULL'} · effectiveDate ${doc.effectiveDate ? doc.effectiveDate.toISOString().slice(0, 10) : 'NULL'} · sourcePdfUrl ${doc.sourcePdfUrl ?? 'NULL'}`)
  console.log(`  richBlocksJson ${doc.richBlocksJson === null ? 'NULL' : 'PRÉSENT'} · themeIndexJson ${doc.themeIndexJson === null ? 'NULL' : 'PRÉSENT'} · updatedAt ${doc.updatedAt.toISOString()} (informative — on compare des contenus)`)
  console.log(`  corps : ${body.split('\n').length} lignes, ${body.length} c., md5 ${md5Body}`)
  console.log(`  annotationsJson : ${annStr.length} c., md5 ${md5Ann}`)

  // Annotations BRUTES (jamais parseAnnotations : sa coercition réécrirait la forme).
  const ann = JSON.parse(annStr) as {
    toc: TocEntry[]
    labels: Record<string, string>
    commentaires?: Record<string, string[]>
    indexEntries: { subject: string; ctRefs: unknown[] }[]
    navToc: unknown
  }

  // ————— État témoin (§ 10.6) : l'état ANTÉRIEUR complet, horodaté, récupérable.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const nomTemoin = `maj2026-etat-temoin-${stamp}.json`
  writeFileSync(
    join(DOSSIER, nomTemoin),
    JSON.stringify(
      {
        mesureLe: new Date().toISOString(),
        id: doc.id,
        source: doc.source,
        titleFr: doc.titleFr,
        titleEn: doc.titleEn,
        titleHt: doc.titleHt,
        number: doc.number,
        publicationDate: doc.publicationDate,
        adoptionDate: doc.adoptionDate,
        effectiveDate: doc.effectiveDate,
        sourcePdfUrl: doc.sourcePdfUrl,
        md5BodyOriginal: md5Body,
        md5AnnotationsJson: md5Ann,
        bodyOriginal: body,
        annotationsJson: annStr,
      },
      null,
      1,
    ) + '\n',
    'utf8',
  )
  console.log(`  écrit : ${nomTemoin}`)

  // ————— Segmentation (§ 11.2-11.4) — le MÊME chemin que le rendu.
  const seg = verifierSegmentation(body, ann.toc, ann.labels, ann.commentaires)
  console.log(`  segmentation : ${seg.blocks.length} blocs, ${ann.toc.length} en-têtes appariés, join === corps, ${Object.keys(ann.labels).length} labels ancrés`)

  // ————— § 7.4 : les lignes orphelines, MESURÉES (jamais supposées).
  console.log(`  lignes orphelines (blocs de corps sans ancre après le 1er en-tête) : ${seg.orphelins.length}`)
  for (const o of seg.orphelins) console.log(`    après ${o.apresSection}, avant ${o.avantSection} : « ${o.texte} »`)
  const dejaFusionnes = ANCRES_TITRES.every((a) => {
    const e = ann.toc.find((t) => t.anchor === a)
    return e !== undefined && !seg.orphelins.some((o) => o.apresSection === a)
  })
  if (seg.orphelins.length === 0 && dejaFusionnes) {
    console.log('  ÉTAT POST-LOT détecté (aucune orpheline) : les libellés § 7.4 sont déjà fusionnés — rien à préparer.')
  } else {
    const libelles = ANCRES_TITRES.map((anchor) => {
      const entree = ann.toc.find((t) => t.anchor === anchor)
      if (!entree) throw new Error(`§ 7.4 — ${anchor} absent du toc`)
      const orphelines = seg.orphelins.filter((o) => o.apresSection === anchor)
      if (orphelines.length !== 1)
        throw new Error(`§ 7.4 — ${anchor} : ${orphelines.length} ligne(s) orpheline(s) mesurée(s), 1 attendue — la mécanique a changé, STOP`)
      const o = orphelines[0]
      if (o.avantSection === null) throw new Error(`§ 7.4 — ${anchor} : l'orpheline n'est pas bornée par l'en-tête suivant`)
      if (o.texte.includes('\n')) throw new Error(`§ 7.4 — ${anchor} : bloc orphelin multi-lignes, mécanique inattendue`)
      // La fusion se fait EN LETTRE DU CORPS (§ 4.1) : ligne du toc + espace + ligne orpheline.
      return { anchor, ligne1: entree.label, ligne2: o.texte, fusion: `${entree.label} ${o.texte}` }
    })
    const horsTitres = seg.orphelins.filter((o) => !ANCRES_TITRES.includes(o.apresSection as (typeof ANCRES_TITRES)[number]))
    if (horsTitres.length)
      throw new Error(`§ 7.4 — orphelines hors des 3 TITRES du relevé : ${horsTitres.map((o) => `${o.apresSection} « ${o.texte} »`).join(' ; ')} — STOP, investiguer`)
    ecrireOuVerifier('maj2026-libelles-titres.json', libelles, (ex) =>
      JSON.stringify(ex) === JSON.stringify(libelles) ? null : 'libellés mesurés ≠ fichier existant',
    )
  }

  // ————— § 7.6 : les 48 plages — mesure, jointure par ORDRE/ANCRE, fichier de référence.
  const mesurees = mesurerPlages(seg.blocks, ann.toc)
  const cheminRef = join(DOSSIER, 'maj2026-base-ranges.json')
  if (!existsSync(cheminRef)) {
    // Dérivation depuis le relevé du 27 août (48 × {level, label, from, to}, dans l'ordre
    // du toc) : la jointure de DÉRIVATION vérifie niveau ET libellé (état intact requis),
    // le fichier PRODUIT est joint par ordre/ancre seulement (les libellés changent, § 7.4).
    const releve = JSON.parse(readFileSync(join(DOSSIER, 'maj2026-base-ranges-releve20260827.json'), 'utf8')) as {
      level: number
      label: string
      from: number
      to: number
    }[]
    if (releve.length !== ann.toc.length)
      throw new Error(`§ 7.6 — relevé ${releve.length} plages, toc ${ann.toc.length} entrées`)
    const reference: (Plage & { label: string })[] = releve.map((r, i) => {
      const e = ann.toc[i]
      if (e.level !== r.level || norm(e.label) !== norm(r.label))
        throw new Error(`§ 7.6 — dérivation : entrée ${i + 1} du relevé « ${r.label} » (niv.${r.level}) ≠ toc « ${e.label} » (niv.${e.level})`)
      return { ordre: i + 1, anchor: e.anchor, level: r.level, from: r.from, to: r.to, label: e.label }
    })
    comparerPlages(mesurees, reference)
    writeFileSync(
      cheminRef,
      JSON.stringify(
        {
          _source: 'Sommaire de la cliente (Sommaire_Loi_CEC_2002.docx), plages vérifiées 48/48 contre le corps en base le 27 août 2026 (releve-sommaire-index.json). Dérivé de maj2026-base-ranges-releve20260827.json + les ancres du toc, REVÉRIFIÉ contre le corps segmenté par maj2026-prevol.ts.',
          _jointure: 'Par ORDRE et ANCRE (sec-N), JAMAIS par libellé — les libellés changent (§ 7.4 les complète, § 13.2 peut en changer un). Le champ label est informatif (état au 27 août 2026), il ne sert à aucune assertion.',
          plages: reference,
        },
        null,
        1,
      ) + '\n',
      'utf8',
    )
    console.log(`  écrit : maj2026-base-ranges.json (${reference.length} plages, jointes par ordre/ancre)`)
  } else {
    const ref = JSON.parse(readFileSync(cheminRef, 'utf8')) as { plages: Plage[] }
    comparerPlages(mesurees, ref.plages)
    console.log(`  déjà présent, plages revérifiées contre le corps : maj2026-base-ranges.json (${ref.plages.length})`)
  }
  console.log(`  plages : ${mesurees.length} mesurées == référence (jointure ordre/ancre)`)

  // ————— § 11.6 : l'index — renvois vivants, couverture intégrale, convention de type.
  verifierIndex(ann.indexEntries, ann.labels)
  const collator = new Intl.Collator('fr')
  let inversions = 0
  for (let i = 0; i < ann.indexEntries.length - 1; i++)
    if (collator.compare(ann.indexEntries[i].subject, ann.indexEntries[i + 1].subject) > 0) inversions++
  console.log(`  index : ${ann.indexEntries.length} sujets, couverture intégrale, 0 renvoi mort, ${inversions} inversion(s) sous Intl.Collator('fr')`)

  // ————— § 11.7 : sentinelles verbatim.
  verifierSentinelles(body)
  console.log('  sentinelles § 9.6 : toutes présentes, mot pour mot')

  // ————— § 8 : l'oracle de l'index cliente — LA baseline, sur le corps tel qu'il est.
  const resultat = jouerOracle(body, ann.toc)
  console.log(`  oracle : ${resultat.totalTermes} sujets cliente, ${resultat.totalPaires} renvois rejoués, ${resultat.echecs.length} échec(s) brut(s)`)
  for (const e of resultat.echecs) console.log(`    échec brut : ${cleEchec(e)}`)
  const baseline = {
    _protocole: 'Oracle § 8 — 600 renvois développés de l’index cliente rejoués par maj2026-oracle-index.ts (radicaux à frontière de mot, accents pliés, équivalences par terme) sur le corps segmenté. Les échecs bruts ci-dessous sont la BASELINE : après le lot, le MÊME script doit rendre exactement cet ensemble — un échec nouveau est une régression bloquante (§ 11.8).',
    mesureLe: new Date().toISOString(),
    md5BodyOriginal: md5Body,
    etatCorps: seg.orphelins.length ? 'intact (avant § 7.4)' : 'post-lot (§ 7.4 appliqué)',
    totalTermes: resultat.totalTermes,
    totalPaires: resultat.totalPaires,
    echecs: resultat.echecs,
  }
  ecrireOuVerifier('maj2026-oracle-baseline.json', baseline, (ex) => {
    const { nouveaux, disparus } = comparerALaBaseline(resultat, (ex as { echecs: EchecOracle[] }).echecs)
    if (nouveaux.length) return `échecs NOUVEAUX vs baseline enregistrée : ${nouveaux.map(cleEchec).join(' ; ')}`
    if (disparus.length) return `échecs DISPARUS vs baseline enregistrée : ${disparus.map(cleEchec).join(' ; ')}`
    return null
  })

  // ————— Renvois : l'état, pour le procès-verbal (le CrossRef sûretés doit rester INTACT).
  const entrants = await prisma.crossRef.findMany({
    where: { toId: doc.id },
    select: { id: true, kind: true, fromId: true, toLabel: true, note: true, from: { select: { source: true, titleFr: true } } },
  })
  const sortants = await prisma.crossRef.count({ where: { fromId: doc.id } })
  console.log(`  renvois : ${entrants.length} entrant(s), ${sortants} sortant(s)`)
  for (const r of entrants)
    console.log(`    entrant ${r.id} — ${r.kind} depuis ${r.from?.source ?? r.fromId} · toLabel « ${r.toLabel ?? ''} » · note md5 ${r.note ? md5(r.note) : 'NULL'}`)

  console.log('\nPRÉ-VOL § 7.1 : PASSÉ — état témoin archivé, baseline de l’oracle en place, aucune écriture en base.')
}

main()
  .catch((e) => {
    console.error('PRÉ-VOL : ÉCHEC —', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
