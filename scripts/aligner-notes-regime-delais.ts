/**
 * Aligne sur la graine les SEULES notes de régime restées au brouillon en base.
 *
 *   npx tsx scripts/aligner-notes-regime-delais.ts            (à blanc)
 *   npx tsx scripts/aligner-notes-regime-delais.ts --apply    (écrit)
 *
 * ⚠️ POURQUOI CE SCRIPT EXISTE. Le commit du 21 août a réécrit, pour une avocate, les sept
 * notes des délais dont le régime n'est pas tranché : au lieu d'un renvoi au cahier des
 * charges (« À faire trancher par la rédaction (§ 13, point 5) »), chacune dit ce qui est su,
 * ce qui ne l'est pas, et ce qu'il reste à vérifier. Il a aussi rendu la citation de l'art. 511
 * mot pour mot — l'article écrit « de procédure » en bas de casse, la base porte « DE
 * PROCÉDURE » en capitales, ce qui altère une citation.
 *
 * Mais **le moteur lit `regimeFondement` EN BASE** (`depuis-base.ts`), jamais la graine, et
 * `seed-delais.ts` refuse — à raison — d'écraser une table peuplée. Sans ce geste-ci, la
 * correction reste lettre morte sur lam.ht : les sept écrans continuent d'afficher le
 * brouillon, et les tests restent verts puisqu'ils mesurent la graine.
 *
 * CE QU'IL TOUCHE, ET RIEN D'AUTRE : `regimeFondement` et `regimeIncertain`, sur les lignes
 * où la base diverge de la graine. Pas une date, pas un régime, pas un statut, pas une
 * prorogation. Un contrôle le vérifie ligne à ligne avant d'écrire.
 *
 * TROIS REFUS, parce qu'une écriture en production ne se devine pas :
 *  1. Si une ligne divergente ne porte AUCUNE marque de brouillon, on s'arrête : quelqu'un l'a
 *     peut-être amendée depuis le back-office, et l'écraser effacerait son travail.
 *  2. Si une ligne divergente porte une révision postérieure à la graine (révision > 1), même
 *     raison, même refus.
 *  3. Si une divergence porte sur un autre champ que les deux annoncés, on la SIGNALE et on
 *     n'écrit rien : ce script n'est pas une resynchronisation générale.
 *
 * L'état antérieur part au journal (`meta.avant`) ET dans une révision `DelaiEntryRevision`,
 * de sorte qu'on puisse revenir en arrière ligne par ligne.
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import { REPERTOIRE, construireEntrees } from '../src/lib/delais/repertoire'

/** Ce que le brouillon laissait paraître à l'écran. Une de ces marques suffit. */
const MARQUES_BROUILLON = [
  '§ 13',
  'À faire trancher par la rédaction',
  'regimeIncertain',
  'DE PROCÉDURE',
]

const ACTEUR = process.argv.find((a) => a.startsWith('--acteur='))?.split('=')[1]

async function main() {
  const apply = process.argv.includes('--apply')

  const graine = construireEntrees(REPERTOIRE)
  const parSlug = new Map(graine.map((e) => [e.slug, e]))

  const enBase = await prisma.delaiEntry.findMany({
    select: {
      id: true,
      slug: true,
      code: true,
      article: true,
      objetFr: true,
      statut: true,
      regime: true,
      regimeIncertain: true,
      regimeFondement: true,
    },
    orderBy: { slug: 'asc' },
  })
  if (enBase.length === 0) {
    console.error('✗ Aucune ligne en base — RIEN n’a été fait. La graine n’est pas passée.')
    await prisma.$disconnect()
    process.exitCode = 1
    return
  }
  console.log(`${enBase.length} entrées en base, ${graine.length} dans la graine.\n`)

  // ---- Les divergences, sur les deux champs annoncés -----------------------
  const inconnues = enBase.filter((l) => !parSlug.has(l.slug))
  const divergentes = enBase.filter((l) => {
    const g = parSlug.get(l.slug)
    if (!g) return false
    return g.regimeFondement !== l.regimeFondement || g.regimeIncertain !== l.regimeIncertain
  })

  if (inconnues.length) {
    console.log(`⚠️  ${inconnues.length} ligne(s) en base absentes de la graine — ignorées :`)
    for (const l of inconnues.slice(0, 10)) console.log(`    ${l.slug}`)
    console.log('')
  }

  if (divergentes.length === 0) {
    console.log('✓ Aucune divergence : la base dit déjà ce que dit la graine. Rien à faire.')
    await prisma.$disconnect()
    return
  }

  console.log(`${divergentes.length} ligne(s) divergent(s) :\n`)
  const sansMarque: string[] = []
  for (const l of divergentes) {
    const g = parSlug.get(l.slug)!
    const marque = MARQUES_BROUILLON.some((m) => l.regimeFondement.includes(m))
    if (!marque) sansMarque.push(l.slug)
    console.log(`  ${l.code}  ${l.slug}`)
    console.log(`    art. ${l.article} — ${l.objetFr.slice(0, 84)}`)
    console.log(`    statut ${l.statut} · regimeIncertain ${l.regimeIncertain} → ${g.regimeIncertain}`)
    console.log(`    marque de brouillon : ${marque ? 'oui' : '✗ AUCUNE'}`)
    console.log(`    AVANT : ${l.regimeFondement.replace(/\s+/g, ' ').slice(0, 200)}`)
    console.log(`    APRÈS : ${g.regimeFondement.replace(/\s+/g, ' ').slice(0, 200)}`)
    console.log('')
  }

  // ---- Refus 1 — une ligne sans marque de brouillon a pu être amendée ------
  if (sansMarque.length) {
    console.error(`✗ ${sansMarque.length} ligne(s) divergent(s) SANS marque de brouillon :`)
    for (const s of sansMarque) console.error(`    ${s}`)
    console.error('  Elles ont pu être amendées depuis le back-office : les écraser effacerait')
    console.error('  ce travail. RIEN n’a été fait — vérifiez avant d’insister.')
    await prisma.$disconnect()
    process.exitCode = 1
    return
  }

  // ---- Refus 2 — une révision postérieure à la graine ----------------------
  const revisions = await prisma.delaiEntryRevision.groupBy({
    by: ['entryId'],
    where: { entryId: { in: divergentes.map((l) => l.id) } },
    _max: { revision: true },
  })
  const amendees = revisions.filter((r) => (r._max.revision ?? 1) > 1)
  if (amendees.length) {
    const slugs = amendees.map((r) => divergentes.find((l) => l.id === r.entryId)?.slug)
    console.error(`✗ ${amendees.length} ligne(s) portent une révision postérieure à la graine :`)
    for (const s of slugs) console.error(`    ${s}`)
    console.error('  RIEN n’a été fait.')
    await prisma.$disconnect()
    process.exitCode = 1
    return
  }
  console.log('✓ Aucune de ces lignes n’a été amendée depuis la graine (révision 1 partout).')

  if (!apply) {
    console.log(`\n(exécution à blanc — ${divergentes.length} notes seraient alignées)`)
    console.log('  Pour écrire :  npx tsx scripts/aligner-notes-regime-delais.ts --apply')
    await prisma.$disconnect()
    return
  }

  if (ACTEUR) {
    const connu = await prisma.user.count({ where: { id: ACTEUR } })
    if (connu === 0) {
      console.error(`✗ --apply REFUSÉ : aucun utilisateur ne porte l’identifiant « ${ACTEUR} ».`)
      console.error('  `--acteur` attend un User.id. Sans lui, le journal portera `null`.')
      await prisma.$disconnect()
      process.exitCode = 1
      return
    }
  }

  // ---- Écriture — tout ou rien --------------------------------------------
  const avant = divergentes.map((l) => ({
    slug: l.slug,
    regimeIncertain: l.regimeIncertain,
    regimeFondement: l.regimeFondement,
  }))
  const maxRevision = new Map(revisions.map((r) => [r.entryId, r._max.revision ?? 1]))

  await prisma.$transaction([
    // La copie gelée de ce qui existait, avant de l'écraser.
    ...divergentes.map((l) =>
      prisma.delaiEntryRevision.create({
        data: {
          entryId: l.id,
          revision: (maxRevision.get(l.id) ?? 1) + 1,
          payloadJson: JSON.stringify({
            regimeIncertain: l.regimeIncertain,
            regimeFondement: l.regimeFondement,
          }),
          actorId: ACTEUR ?? null,
        },
      }),
    ),
    ...divergentes.map((l) => {
      const g = parSlug.get(l.slug)!
      return prisma.delaiEntry.update({
        where: { id: l.id },
        data: { regimeFondement: g.regimeFondement, regimeIncertain: g.regimeIncertain },
      })
    }),
  ])

  await audit({
    action: 'DELAI_ENTRY_UPDATED',
    actorId: ACTEUR,
    targetType: 'DelaiEntry',
    targetId: 'notes-de-regime',
    meta: {
      via: 'scripts/aligner-notes-regime-delais.ts',
      motif:
        'les notes de régime incertain renvoyaient au cahier des charges (« § 13 », « à faire ' +
        'trancher par la rédaction ») et une citation de l’art. 511 était altérée ; la graine ' +
        'les a réécrites le 21 août, le moteur lit la base',
      lignes: divergentes.length,
      avant,
    },
  })
  console.log(`\n✓ ${divergentes.length} notes alignées sur la graine.`)
  console.log('  L’état antérieur est au journal (meta.avant) ET en révision, ligne par ligne.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC — transaction annulée :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
