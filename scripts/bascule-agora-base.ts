/**
 * Bascule Lam → Agora — LA PART DE LA BASE (lot 3 du prompt « rebranding Agora »).
 *
 *   npx tsx scripts/bascule-agora-base.ts            # simulation : compte, n'écrit rien
 *   npx tsx scripts/bascule-agora-base.ts --apply    # écrit, puis recompte
 *
 * ⚠️ À N'EXÉCUTER QUE LE JOUR DE LA BASCULE. La base est commune à lam.ht et à la préversion :
 * écrire avant ferait afficher « Agora » sur lam.ht, ce que le prompt interdit (§ 5).
 *
 * Deux écritures, et deux seulement — LE CORPUS N'EST PAS LA MARQUE (§ 0, règle 2) :
 *  1. `annotationsJson.annotationAuthor` « Lam Veritab » → « Agora » (5 documents mesurés le
 *     7 oct. 2026). C'est la signature de l'apparat éditorial, pas le texte officiel :
 *     `bodyOriginal`, `bodyClean`, `richBlocksJson` ne sont pas lus ici ;
 *  2. le texte de borne des jours « à surveiller » du calendrier des délais
 *     (`DelaiFerie.observationsBorneFr`) : « L’Index du Moniteur de Lam » → « d’Agora », comme
 *     `OBSERVATIONS_BORNE_FR` dans `src/lib/delais/feries.ts`. Le calculateur lit la BASE.
 *
 * `annotationsJson` est tantôt un objet JSON, tantôt une CHAÎNE JSON (leçon des marchés
 * publics) : on rend la même forme qu'on a lue. Réindexation HORS transaction, un document à
 * la fois (`SEARCH_PROVIDER=fts`).
 */
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'

const APPLY = process.argv.includes('--apply')
const ANCIEN_AUTEUR = 'Lam Veritab'
const NOUVEL_AUTEUR = 'Agora'
const ANCIENNE_BORNE = 'L’Index du Moniteur de Lam'
const NOUVELLE_BORNE = 'L’Index du Moniteur d’Agora'

type Annotations = Record<string, unknown> & { annotationAuthor?: unknown }

function lire(valeur: unknown): { objet: Annotations; chaine: boolean } | null {
  if (typeof valeur === 'string') {
    try {
      const o = JSON.parse(valeur)
      return o && typeof o === 'object' ? { objet: o as Annotations, chaine: true } : null
    } catch {
      return null
    }
  }
  return valeur && typeof valeur === 'object' ? { objet: valeur as Annotations, chaine: false } : null
}

async function compter() {
  const docs: { id: string }[] = await prisma.$queryRawUnsafe(
    `SELECT id FROM "Document" WHERE "annotationsJson"::text LIKE '%annotationAuthor%' AND "annotationsJson"::text LIKE '%${ANCIEN_AUTEUR}%'`,
  )
  const feries = await prisma.delaiFerie.count({ where: { observationsBorneFr: { contains: ANCIENNE_BORNE } } })
  return { docs: docs.map((d) => d.id), feries }
}

async function main() {
  const avant = await compter()
  console.log(`Documents signés « ${ANCIEN_AUTEUR} » : ${avant.docs.length}`)
  console.log(`Lignes du calendrier citant « ${ANCIENNE_BORNE} » : ${avant.feries}`)

  const aEcrire: { id: string; title: string; valeur: unknown }[] = []
  for (const id of avant.docs) {
    const doc = await prisma.document.findUnique({ where: { id }, select: { id: true, titleFr: true, annotationsJson: true } })
    const lu = doc && lire(doc.annotationsJson)
    if (!doc || !lu || lu.objet.annotationAuthor !== ANCIEN_AUTEUR) {
      console.log(`  ⚠ ${id} : annotationAuthor n'est pas exactement « ${ANCIEN_AUTEUR} » — laissé tel quel`)
      continue
    }
    const objet = { ...lu.objet, annotationAuthor: NOUVEL_AUTEUR }
    aEcrire.push({ id, title: doc.titleFr, valeur: lu.chaine ? JSON.stringify(objet) : objet })
    console.log(`  → ${id}  ${doc.titleFr.slice(0, 90)}`)
  }

  if (!APPLY) {
    console.log('\nSimulation : rien n’a été écrit. Relancer avec --apply le jour de la bascule.')
    return
  }

  await prisma.$transaction(async (tx) => {
    for (const d of aEcrire) {
      await tx.document.update({ where: { id: d.id }, data: { annotationsJson: d.valeur as never } })
    }
    const lignes = await tx.delaiFerie.findMany({
      where: { observationsBorneFr: { contains: ANCIENNE_BORNE } },
      select: { id: true, observationsBorneFr: true },
    })
    for (const l of lignes) {
      await tx.delaiFerie.update({
        where: { id: l.id },
        data: { observationsBorneFr: l.observationsBorneFr!.replace(ANCIENNE_BORNE, NOUVELLE_BORNE) },
      })
    }
  })

  // Hors transaction, un à un (règle de séance).
  for (const d of aEcrire) await reindexDocument(d.id)

  const apres = await compter()
  console.log(`\nAprès écriture : ${apres.docs.length} document(s) et ${apres.feries} ligne(s) citent encore Lam (attendu : 0 et 0).`)
  if (apres.docs.length || apres.feries) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
