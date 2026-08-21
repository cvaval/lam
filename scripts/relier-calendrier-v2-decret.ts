/**
 * Fait pointer les onze fêtes légales du calendrier v2 vers le DÉCRET, et non vers le fascicule.
 *
 *   npx tsx scripts/relier-calendrier-v2-decret.ts            (à blanc)
 *   npx tsx scripts/relier-calendrier-v2-decret.ts --apply    (écrit)
 *
 * ⚠️ POURQUOI CE SCRIPT EXISTE. `migrer-calendrier-v2.ts` a été écrit le 20 août, alors que le
 * décret du 11 décembre 2024 n'était pas encore au corpus. Faute de mieux, il a lié les onze
 * fêtes légales au **fascicule scanné** du Moniteur — un PDF. Le décret a été versé depuis, au
 * format lecteur annoté : sommaire, index des onze fêtes, renvois cliquables. C'est LUI que doit
 * ouvrir un clic sur « fête légale » dans le calculateur ; le fac-similé reste accessible depuis
 * la fiche du décret, où il a sa place.
 *
 * Ce script ne touche QUE `sourceDocId`, QUE sur la version 2, QUE sur les lignes qui pointent
 * aujourd'hui le fascicule. Les cinq fêtes nationales (Constitution) et les cinq jours à
 * surveiller ne sont pas concernés. La version 1 n'est pas touchée : elle est gelée, et un
 * permalien `c=1` doit rendre exactement ce qu'il rendait.
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'

const VERSION = 2

async function main() {
  const apply = process.argv.includes('--apply')

  // 1 · Le décret, retrouvé par sa désignation — jamais par un identifiant en dur.
  const decret = await prisma.document.findFirst({
    where: { type: 'LEGISLATION', number: 'Décret du 11 décembre 2024' },
    select: { id: true, titleFr: true, moniteurRef: true },
  })
  if (!decret) {
    console.error('✗ Le décret du 11 décembre 2024 n’est pas au corpus — RIEN n’a été fait.')
    console.error('  Versez-le d’abord :  npx tsx scripts/import-decret-fetes-2024.ts --apply')
    await prisma.$disconnect()
    process.exitCode = 1
    return
  }
  console.log(`Décret cible : ${decret.titleFr}`)
  console.log(`              ${decret.moniteurRef}`)
  console.log(`              [${decret.id}]\n`)

  // 2 · Les lignes à relier : version 2, permanentes, pointant autre chose que le décret.
  const permanentes = await prisma.delaiFerie.findMany({
    where: { versionCalendrier: VERSION, typeEntree: 'PERMANENT' },
    select: { id: true, cle: true, libelleFr: true, sourceDocId: true },
    orderBy: { cle: 'asc' },
  })
  const cibles = await prisma.document.findMany({
    where: { id: { in: [...new Set(permanentes.map((e) => e.sourceDocId).filter(Boolean) as string[])] } },
    select: { id: true, titleFr: true, number: true },
  })
  const parId = new Map(cibles.map((d) => [d.id, d]))

  // La Constitution fonde les cinq fêtes NATIONALES : on n'y touche pas.
  const constitution = cibles.find((d) => d.titleFr.includes('Constitution'))
  const aRelier = permanentes.filter(
    (e) => e.sourceDocId !== decret.id && e.sourceDocId !== constitution?.id,
  )

  console.log(`${permanentes.length} jours permanents en version ${VERSION} :`)
  for (const e of permanentes) {
    const d = e.sourceDocId ? parId.get(e.sourceDocId) : null
    const etat =
      e.sourceDocId === decret.id ? 'déjà relié au décret'
        : e.sourceDocId === constitution?.id ? 'Constitution — inchangé'
          : `→ à relier (pointe « ${d?.titleFr.slice(0, 44) ?? '—'} »)`
    console.log(`  ${e.libelleFr.padEnd(52)} ${etat}`)
  }

  if (aRelier.length !== 11) {
    console.error(`\n✗ ${aRelier.length} lignes à relier, 11 attendues — RIEN n’a été fait.`)
    console.error('  Le calendrier n’est pas dans l’état prévu : vérifiez avant d’insister.')
    await prisma.$disconnect()
    process.exitCode = 1
    return
  }

  if (!apply) {
    console.log(`\n(exécution à blanc — ${aRelier.length} lignes seraient reliées au décret)`)
    console.log('  Pour écrire :  npx tsx scripts/relier-calendrier-v2-decret.ts --apply')
    await prisma.$disconnect()
    return
  }

  // 3 · Une transaction, et l'état antérieur conservé au journal pour pouvoir défaire.
  const avant = aRelier.map((e) => ({ cle: e.cle, sourceDocId: e.sourceDocId }))
  await prisma.$transaction(
    aRelier.map((e) =>
      prisma.delaiFerie.update({ where: { id: e.id }, data: { sourceDocId: decret.id } }),
    ),
  )
  await audit({
    action: 'DELAI_CALENDAR_UPDATED',
    targetType: 'DelaiFerie',
    targetId: `calendrier-v${VERSION}`,
    meta: {
      via: 'scripts/relier-calendrier-v2-decret.ts',
      motif: 'les fêtes légales pointaient le fascicule scanné ; elles pointent le décret versé',
      decretId: decret.id,
      lignes: aRelier.length,
      avant, // ← l'état antérieur, pour pouvoir revenir en arrière
    },
  })
  console.log(`\n✓ ${aRelier.length} fêtes légales reliées au décret du 11 décembre 2024.`)
  console.log('  L’état antérieur est au journal (meta.avant), si l’on doit revenir en arrière.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC — transaction annulée :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
