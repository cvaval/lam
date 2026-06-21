/**
 * Migration : scinde le recueil « réserves obligatoires » (importé à tort comme
 * « Circulaire n° 01-19 », cf. scripts/recueil-reserves.ts) en ses textes
 * constituants — une entrée Document par circulaire.
 *
 *   npx tsx scripts/split-recueil-reserves.ts            # aperçu (aucune écriture)
 *   npx tsx scripts/split-recueil-reserves.ts --commit   # applique
 *
 * Idempotent : si le monolithe est absent (déjà scindé), ne fait rien.
 * Après --commit : relancer `SEARCH_PROVIDER=opensearch npm run search:reindex`.
 */
import { PrismaClient } from '@prisma/client'
import { buildSearchText } from '../src/lib/search/normalize'
import { splitRecueil } from './recueil-reserves'

const prisma = new PrismaClient()

async function main() {
  const commit = process.argv.includes('--commit')

  // Le monolithe : « Circulaire n° 01-19 » dont le corps contient encore le 2ᵉ texte (002-18).
  const monolith = await prisma.document.findFirst({
    where: { type: 'CIRCULAIRE_BRH', source: 'BRH', number: 'Circulaire n° 01-19', bodyOriginal: { contains: '002-18' } },
  })
  if (!monolith) {
    console.log('Aucun monolithe à scinder (déjà fait, ou recueil absent). Rien à faire.')
    return
  }

  const rows = splitRecueil(monolith.bodyOriginal)
  console.log(`\nMonolithe id=${monolith.id} · ${monolith.bodyOriginal.length} car → ${rows.length} textes :\n`)
  for (const r of rows) {
    console.log(`  ${r.number.padEnd(40)} ${(r.date ? r.date.toISOString().slice(0, 10) : '—').padEnd(11)} ${String(r.body.length).padStart(6)}c  ${r.title.slice(0, 70)}`)
  }

  // Garde-fou : pas de collision de `number` avec un AUTRE document du corpus.
  const existing = await prisma.document.findMany({
    where: { number: { in: rows.map((r) => r.number) }, NOT: { id: monolith.id } },
    select: { number: true },
  })
  if (existing.length) {
    console.error(`\n⛔  Collision : ces numéros existent déjà ailleurs — ${existing.map((e) => e.number).join(', ')}`)
    process.exit(1)
  }

  if (!commit) {
    console.log('\n(Aperçu — relancer avec --commit pour appliquer.)')
    return
  }

  await prisma.$transaction([
    prisma.document.delete({ where: { id: monolith.id } }),
    ...rows.map((r) =>
      prisma.document.create({
        data: {
          type: 'CIRCULAIRE_BRH',
          status: 'EN_VIGUEUR',
          titleFr: r.title,
          bodyOriginal: r.body,
          number: r.number,
          publicationDate: r.date,
          matiere: 'Droit bancaire',
          source: 'BRH',
          sealed: true,
          searchText: buildSearchText({ titleFr: r.title, number: r.number, bodyOriginal: r.body, matiere: 'Droit bancaire' }),
        },
      }),
    ),
  ])
  console.log(`\n✅  Monolithe supprimé, ${rows.length} circulaires créées.`)
  console.log('→  Relancer : SEARCH_PROVIDER=opensearch npm run search:reindex')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
