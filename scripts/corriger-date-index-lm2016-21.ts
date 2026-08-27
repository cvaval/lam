/**
 * Rend sa date aux quatre entrées d'Index du Moniteur n° 21 de 2016.
 *
 *   npx tsx scripts/corriger-date-index-lm2016-21.ts            (à blanc)
 *   npx tsx scripts/corriger-date-index-lm2016-21.ts --commit   (écrit)
 *
 * ⚠️ ELLES SONT DATÉES DU 1er JANVIER, ET C'EST FAUX. La manchette du fascicule dit
 * « 171e Année  No. 21 — PORT-AU-PRINCE — Lundi 1er Février 2016 ». Le voisinage le
 * confirme sans ambiguïté : le n° 20 est daté du 28 janvier, le n° 22 du 2 février. Un
 * n° 21 au 1er janvier serait paru AVANT le n° 20, quatre semaines plus tôt.
 *
 * Le 1er janvier est le repli de l'import d'origine quand la date n'a pas pu être lue.
 * ⚠️ IL TOUCHE 208 FASCICULES DE L'INDEX, dont 187 sont contredits par leur propre
 * prédécesseur. Ce script ne traite QUE le n° 21 de 2016 : les autres demandent qu'on
 * relève leur date à la source, un par un.
 */
import { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const NUMBER = 'LM2016-21'
const VRAIE_DATE = new Date('2016-02-01T00:00:00Z')
const REF = 'Le Moniteur · LM2016-21 · Lundi 1 février 2016'

async function main() {
  const commit = process.argv.includes('--commit')

  // Le voisinage fait foi : on vérifie AVANT d'écrire que la date choisie s'y insère.
  const bornes = await prisma.document.findMany({
    where: { type: 'INDEX', number: { in: ['LM2016-20', 'LM2016-22'] } },
    select: { number: true, publicationDate: true },
    distinct: ['number'],
    orderBy: { number: 'asc' },
  })
  const avant = bornes.find((x) => x.number === 'LM2016-20')?.publicationDate
  const apres = bornes.find((x) => x.number === 'LM2016-22')?.publicationDate
  console.log(`  n° 20 → ${avant?.toISOString().slice(0, 10)}`)
  console.log(`  n° 21 → ${VRAIE_DATE.toISOString().slice(0, 10)}  (corrigée)`)
  console.log(`  n° 22 → ${apres?.toISOString().slice(0, 10)}\n`)
  if (!avant || !apres || VRAIE_DATE <= avant || VRAIE_DATE >= apres) {
    console.error('⛔ ARRÊT — la date corrigée ne s’insère pas entre ses voisins.')
    process.exit(1)
  }

  const d = await prisma.document.findMany({
    where: { type: 'INDEX', number: NUMBER },
    select: { id: true, titleFr: true, publicationDate: true, moniteurRef: true },
  })
  console.log(`  ${d.length} entrées à corriger :`)
  for (const x of d) {
    console.log(`     ${x.publicationDate!.toISOString().slice(0, 10)} → 2016-02-01  « ${x.titleFr.slice(0, 66)} »`)
  }

  if (!commit) {
    console.log('\n(à blanc — ajouter --commit pour écrire)')
    await prisma.$disconnect()
    return
  }
  await prisma.document.updateMany({
    where: { type: 'INDEX', number: NUMBER },
    data: { publicationDate: VRAIE_DATE, moniteurRef: REF },
  })
  await audit({
    action: 'DOC_PUBLISHED',
    targetType: 'DOCUMENT',
    meta: { via: 'corriger-date-index-lm2016-21', de: '2016-01-01', vers: '2016-02-01', entrees: d.length },
  })
  console.log(`\n✅ ${d.length} entrées redatées au 1er février 2016 (audit écrit).`)
  await prisma.$disconnect()
}

main()
