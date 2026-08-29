/**
 * MARCHÉS PUBLICS — la RÉFÉRENCE de chaque fiche prend le TITRE COMPLET.
 *
 *     npx tsx scripts/reference-titre-complet-marches.ts            # simulation
 *     npx tsx scripts/reference-titre-complet-marches.ts --apply    # Me Vaval, elle seule
 *
 * ⚠️ POURQUOI CE SCRIPT EXISTE. Les 25 fiches versées le 28 août portent `number = NULL`.
 * Or la règle de corpus arrêtée par Me Vaval le 26 août veut que **la référence soit le titre
 * complet** — c'est elle qui avait fait corriger 110 textes, parce que onze conventions
 * partageaient la référence « Convention » et trois réformes « Décret du 9 avril 2020 ».
 * Le reste du corpus l'applique : « Décret du 9 avril 2020 réformant le Droit des Sûretés »,
 * « Loi du 10 juillet 2002 sur les coopératives d'épargne et de crédit ».
 *
 * Ici le manque est plus grave qu'ailleurs, et c'est ce que Me Vaval a vu : DEUX arrêtés du
 * Spécial n° 8 partagent la même date de signature (9 déc. 2020), la même publication
 * (4 févr. 2021) et le même fascicule. Sans référence, rien ne les distingue dans une liste,
 * une recherche ou une citation. Six autres du 30 août 2017 sont dans le même cas.
 *
 * CE QU'IL ÉCRIT : `number = titleFr`, rien d'autre. Aucun corps, aucune annotation, aucune
 * date. La garde vérifie que le titre est non vide, que la référence est bien NULL au départ
 * (sinon quelqu'un est passé), et que les 25 titres sont DISTINCTS — une référence qui ne
 * distingue pas ne sert à rien.
 */
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const APPLY = process.argv.includes('--apply')

async function main() {
  const docs = await prisma.document.findMany({
    where: { source: { startsWith: 'MARCHES_' } },
    select: { id: true, source: true, titleFr: true, number: true },
    orderBy: { source: 'asc' },
  })
  if (docs.length !== 25) throw new Error(`${docs.length} documents MARCHES_*, 25 attendus — le lot n'est pas celui d'hier`)

  const dejaFaites = docs.filter((d) => d.number)
  if (dejaFaites.length && dejaFaites.some((d) => d.number !== d.titleFr))
    throw new Error(
      `${dejaFaites.length} fiche(s) portent déjà une référence différente de leur titre — ` +
        'quelqu’un est passé : relire avant d’écraser.\n  ' +
        dejaFaites.slice(0, 3).map((d) => `${d.source} : « ${d.number} »`).join('\n  '),
    )
  const aEcrire = docs.filter((d) => !d.number)

  // ⚠️ UNE RÉFÉRENCE QUI NE DISTINGUE PAS NE SERT À RIEN — c'est le motif même de la règle du
  // 26 août. On le VÉRIFIE plutôt que de l'espérer.
  const vus = new Map<string, string[]>()
  for (const d of docs) {
    if (!d.titleFr?.trim()) throw new Error(`${d.source} : titre vide — rien à porter en référence`)
    vus.set(d.titleFr, [...(vus.get(d.titleFr) ?? []), d.source ?? '(sans source)'])
  }
  const collisions = [...vus.entries()].filter(([, s]) => s.length > 1)
  if (collisions.length)
    throw new Error(
      `${collisions.length} titre(s) partagé(s) par plusieurs fiches — la référence ne les distinguerait pas :\n  ` +
        collisions.map(([t, s]) => `« ${t.slice(0, 60)}… » ← ${s.join(', ')}`).join('\n  '),
    )

  console.log(`${docs.length} fiches · ${aEcrire.length} sans référence · ${docs.length - aEcrire.length} déjà conformes`)
  console.log('titres tous distincts : oui — la référence distinguera chaque texte\n')
  for (const d of aEcrire.slice(0, 4)) console.log(`  ${(d.source ?? '').padEnd(36)} → « ${d.titleFr.slice(0, 74)} »`)
  if (aEcrire.length > 4) console.log(`  … et ${aEcrire.length - 4} autres`)
  console.log('\n  ⚠️ les deux arrêtés du Spécial n° 8, que rien ne distinguait :')
  for (const d of docs.filter((x) => (x.source ?? '').includes('227') || (x.source ?? '').includes('CMMP')))
    console.log(`    ${d.source} → « ${d.titleFr.slice(0, 82)}… »`)

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. --apply est réservé à Me Vaval.')
    await prisma.$disconnect()
    return
  }

  await prisma.$transaction(
    async (tx) => {
      for (const d of aEcrire) await tx.document.update({ where: { id: d.id }, data: { number: d.titleFr } })
      await audit(
        {
          action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'MARCHES_PUBLICS',
          meta: {
            motif:
              'Référence (`number`) = titre complet sur les 25 fiches des marchés publics : application ' +
              'de la règle de corpus du 26 août 2026 (« la référence est le titre complet »), que le ' +
              'versement du 28 août avait laissée de côté — les 25 fiches portaient `number = NULL`. ' +
              'Relevé par Me Vaval le 28 août sur les deux arrêtés du Spécial n° 8, que leur seule date ' +
              'ne distinguait pas. Aucun corps, aucune annotation, aucune date n’est touchée.',
            fiches: aEcrire.length,
          },
        },
        tx,
      )
    },
    { timeout: 120_000, maxWait: 30_000 },
  )

  const n = await prisma.auditLog.count({ where: { targetId: 'MARCHES_PUBLICS' } })
  for (const d of aEcrire) await reindexDocument(d.id)
  console.log(`\n✓ ${aEcrire.length} références écrites · AuditLog ${n} (recompté) · ${aEcrire.length} documents réindexés`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('ÉCHEC :', e instanceof Error ? e.message : e); await prisma.$disconnect(); process.exit(1) })
