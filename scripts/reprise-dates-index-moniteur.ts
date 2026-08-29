/**
 * INDEX DU MONITEUR — reprise des dates rabattues au 28 du mois.
 *
 *     npx tsx scripts/reprise-dates-index-moniteur.ts            # simulation
 *     npx tsx scripts/reprise-dates-index-moniteur.ts --apply    # Me Vaval, elle seule
 *
 * ⚠️ CE QUE CE SCRIPT RÉPARE. `parseFrenchDate` (scripts/import-moniteur.ts) écrivait
 * `Math.min(day || 1, 28)` : tout fascicule paru un 29, un 30 ou un 31 a reçu la date du 28.
 * Mesuré le 28 août 2026 sur les 27 238 entrées : 2 137 dates fausses, et pas UNE SEULE
 * entrée datée après le 28 dans toute la base (jour 27 → 944 entrées, jour 28 → 965,
 * jours 29/30/31 → 0). Le code est corrigé ; restent les données déjà écrites.
 *
 * ⚠️ L'ORACLE N'EST PAS DÉRIVÉ DU CHAMP. La date est relue dans `moniteurRef`, qui la porte
 * en toutes lettres (« Vendredi 29 Juin 2012 ») et que l'import n'a jamais recalculée. Deux
 * témoins indépendants la confirment :
 *   1. le quantième écrit — 2 137 fois différent du champ, toujours dans le même mois ;
 *   2. le JOUR DE LA SEMAINE nommé dans l'étiquette — sur les 2 024 entrées qui en portent
 *      un, il tombe juste sur la date de l'étiquette 2 005 fois et sur celle du champ
 *      ZÉRO fois. Un témoin qui ne soutient jamais la thèse adverse.
 *
 * ⚠️ CE QU'IL NE FAIT PAS.
 *  · Il ne touche qu'aux lignes portant la SIGNATURE exacte du rabattage : champ au 28,
 *    étiquette au-delà, MÊME mois et MÊME année. Une divergence de mois ou d'année n'est pas
 *    ce défaut-ci — elle est écartée et comptée, jamais « réparée ».
 *  · Il RETIENT (sans écrire) toute ligne dont le jour de semaine ne colle pas à sa propre
 *    étiquette : l'étiquette s'y contredit, on ne sait pas laquelle des deux mentions est
 *    fautive, et écrire reviendrait à trancher sans pièce. Elles sont listées.
 *  · Il ne réindexe pas : `buildSearchText` ne lit aucune date (vérifié dans
 *    src/lib/search/normalize.ts) — la reprise n'altère pas le texte de recherche. Les tris
 *    et filtres par date lisent la colonne, qui est désormais juste.
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'

const APPLY = process.argv.includes('--apply')

const MOIS: Record<string, number> = {
  janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, aout: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11,
}
const SEMAINE = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Relit la date DANS l'étiquette. Aller-retour obligatoire : un 30 février est refusé. */
function dateEtiquette(ref: string | null): Date | null {
  const m = fold(ref ?? '').match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/)
  if (!m) return null
  const mois = MOIS[m[2]]
  const jour = Number(m[1])
  const an = Number(m[3])
  if (mois == null || !jour || an < 1800 || an > 2100) return null
  const d = new Date(Date.UTC(an, mois, jour))
  return d.getUTCFullYear() === an && d.getUTCMonth() === mois && d.getUTCDate() === jour ? d : null
}

async function main() {
  const entrees = await prisma.document.findMany({
    where: { type: 'INDEX', source: 'MONITEUR' },
    select: { id: true, number: true, moniteurRef: true, publicationDate: true },
  })

  const aEcrire: { id: string; avant: Date; apres: Date }[] = []
  const retenues: string[] = []
  let horsSignature = 0, moisOuAnDifferent = 0, sansJourSemaine = 0
  const parAn = new Map<number, number>()

  for (const e of entrees) {
    const etq = dateEtiquette(e.moniteurRef)
    const champ = e.publicationDate
    if (!etq || !champ) continue
    if (iso(etq) === iso(champ)) continue

    // SIGNATURE du rabattage — tout le reste est écarté, pas corrigé.
    if (champ.getUTCFullYear() !== etq.getUTCFullYear() || champ.getUTCMonth() !== etq.getUTCMonth()) {
      moisOuAnDifferent++
      continue
    }
    if (champ.getUTCDate() !== 28 || etq.getUTCDate() <= 28) {
      horsSignature++
      continue
    }

    // TÉMOIN INDÉPENDANT : le jour de semaine nommé doit tomber sur la date de l'étiquette.
    const nomme = SEMAINE.find((j) => fold(e.moniteurRef ?? '').includes(j))
    if (!nomme) sansJourSemaine++
    else if (SEMAINE[etq.getUTCDay()] !== nomme) {
      retenues.push(`${e.number} — l’étiquette dit « ${nomme} ${etq.getUTCDate()} » mais ${iso(etq)} est un ${SEMAINE[etq.getUTCDay()]}`)
      continue
    }

    aEcrire.push({ id: e.id, avant: champ, apres: etq })
    const an = etq.getUTCFullYear()
    parAn.set(an, (parAn.get(an) ?? 0) + 1)
  }

  if (!aEcrire.length && !retenues.length) {
    console.log('Aucune entrée ne porte la signature du rabattage — reprise déjà faite, ou base inattendue.')
    await prisma.$disconnect()
    return
  }

  console.log(`entrées d’Index examinées : ${entrees.length}`)
  console.log(`  À REPRENDRE            : ${aEcrire.length}   (dont ${sansJourSemaine} sans jour de semaine à l’étiquette)`)
  console.log(`  RETENUES (étiquette qui se contredit, NON écrites) : ${retenues.length}`)
  console.log(`  écartées — mois ou année différents (autre cause)  : ${moisOuAnDifferent}`)
  console.log(`  écartées — hors signature du rabattage             : ${horsSignature}`)
  console.log('\nrépartition par décennie :')
  const parDec = new Map<number, number>()
  for (const [an, n] of parAn) parDec.set(Math.floor(an / 10) * 10, (parDec.get(Math.floor(an / 10) * 10) ?? 0) + n)
  for (const [d, n] of [...parDec].sort((a, b) => a[0] - b[0])) console.log(`  ${d}s → ${n}`)
  if (retenues.length) {
    console.log('\nRETENUES — à trancher sur le fac-similé, aucune n’est écrite :')
    for (const r of [...new Set(retenues)]) console.log('  ' + r)
  }
  console.log('\nexemples de reprise :')
  for (const a of aEcrire.slice(0, 5)) console.log(`  ${iso(a.avant)} → ${iso(a.apres)}`)

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. --apply est réservé à Me Vaval.')
    await prisma.$disconnect()
    return
  }

  // Par paquets : 2 137 updates dans une seule transaction dépassent le délai de Supabase.
  const PAQUET = 200
  let ecrites = 0
  for (let i = 0; i < aEcrire.length; i += PAQUET) {
    const lot = aEcrire.slice(i, i + PAQUET)
    // Forme TABLEAU : un seul aller-retour pour le paquet. Elle n'accepte pas `timeout` —
    // c'est justement pourquoi on découpe en paquets plutôt que de tout passer d'un bloc.
    await prisma.$transaction(
      lot.map((a) => prisma.document.update({ where: { id: a.id }, data: { publicationDate: a.apres } })),
    )
    ecrites += lot.length
    process.stdout.write(`\r  écrites : ${ecrites}/${aEcrire.length}`)
  }
  console.log()

  await audit({
    action: 'ARTICLE_AMENDED',
    targetType: 'Document',
    targetId: 'INDEX_MONITEUR_DATES',
    meta: {
      motif:
        'Reprise des dates de publication rabattues au 28 du mois par `Math.min(day || 1, 28)` ' +
        'dans parseFrenchDate (scripts/import-moniteur.ts). Oracle : la date en toutes lettres ' +
        'de `moniteurRef`, confirmée par le jour de semaine qu’elle nomme (2 005 concordances ' +
        'sur 2 024, zéro en faveur du champ). Signature exigée : champ au 28, étiquette au-delà, ' +
        'même mois et même année. Réversible : reposer le quantième à 28 dans le même mois.',
      reprises: ecrites,
      retenues: retenues.length,
      parDecennie: Object.fromEntries([...parDec].sort((a, b) => a[0] - b[0])),
    },
  })

  // ⚠️ audit() avale ses erreurs — on RECOMPTE plutôt que de croire l’appel.
  const journal = await prisma.auditLog.count({ where: { targetId: 'INDEX_MONITEUR_DATES' } })

  // Contrôle de sortie : plus AUCUNE entrée ne doit porter la signature.
  const apres = await prisma.document.findMany({
    where: { type: 'INDEX', source: 'MONITEUR' },
    select: { moniteurRef: true, publicationDate: true },
  })
  let reste = 0
  for (const e of apres) {
    const etq = dateEtiquette(e.moniteurRef)
    if (!etq || !e.publicationDate) continue
    if (
      e.publicationDate.getUTCFullYear() === etq.getUTCFullYear() &&
      e.publicationDate.getUTCMonth() === etq.getUTCMonth() &&
      e.publicationDate.getUTCDate() === 28 &&
      etq.getUTCDate() > 28
    ) reste++
  }
  const apres28 = apres.filter((e) => (e.publicationDate?.getUTCDate() ?? 0) > 28).length

  console.log(`\n✓ ${ecrites} dates reprises · AuditLog ${journal} (recompté)`)
  console.log(`  reste portant la signature : ${reste}  (attendu : ${retenues.length} retenues)`)
  console.log(`  entrées datées après le 28 : ${apres28}  (0 avant la reprise)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
