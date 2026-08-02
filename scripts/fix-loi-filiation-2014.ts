/**
 * Corrections apportées à la loi du 28 mai 2014 (paternité, maternité, filiation)
 * d'après le fichier source fourni par l'éditrice.
 *
 *  - **le nom d'un signataire** restait en réserve : « Jos[…] JOHN [nom partiellement
 *    illisible] ». La source le donne en clair — « Joseph Joël JOHN », deuxième
 *    secrétaire du Sénat. Une loi promulguée n'a pas à porter la trace de nos doutes de
 *    lecture quand le texte existe.
 *  - **les visas** portaient « Loi N° : 8 » et « Loi N° : 16 » là où la loi écrit
 *    « Loi No 8 » et « Loi No 16 ».
 *
 * Ce que le rapprochement a CONFIRMÉ, et qui n'appelait donc aucune correction :
 * les articles 293, 311 et 606 du Code civil sont, dans l'overlay d'amendement,
 * identiques MOT À MOT au texte de la loi ; et les dix abrogations qu'elle prononce
 * (294, 295, 302, 303, 304, 306, 308, 309, 313, 611) sont exactement celles portées
 * en base — ni 305 ni 307, que la loi ne touche pas.
 *
 *     npx tsx scripts/fix-loi-filiation-2014.ts
 *     npx tsx scripts/fix-loi-filiation-2014.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

const CORRECTIONS = [
  { quoi: 'signataire du Sénat', de: 'Jos[…] JOHN [nom partiellement illisible]', vers: 'Joseph Joël JOHN' },
  { quoi: 'visa de la Loi No 8', de: 'Loi N° : 8 du Code Civil', vers: 'Loi No 8 du Code Civil' },
  { quoi: 'visa de la Loi No 16', de: 'Loi N° : 16 du Code Civil', vers: 'Loi No 16 du Code Civil' },
]

async function main() {
  const doc = await prisma.document.findFirst({
    where: { source: 'LOI_FILIATION_2014' },
    select: { id: true, titleFr: true, bodyOriginal: true },
  })
  if (!doc) throw new Error('Loi Filiation 2014 introuvable.')
  let corps = doc.bodyOriginal
  for (const c of CORRECTIONS) {
    const n = corps.split(c.de).length - 1
    if (n !== 1) throw new Error(`${c.quoi} : ${n} occurrence(s) de ${JSON.stringify(c.de)} (1 attendue).`)
    corps = corps.replace(c.de, c.vers)
    console.log(`  ${c.quoi}\n    ${JSON.stringify(c.de)}\n  → ${JSON.stringify(c.vers)}`)
  }
  console.log(`\ncorps : ${doc.bodyOriginal.length} → ${corps.length} caractères`)
  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }
  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: doc.id }, data: { bodyOriginal: corps } })
    await audit(
      { action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: doc.id,
        meta: { source: 'LOI_FILIATION_2014', motif: 'confrontation au fichier source de l’éditrice', corrections: CORRECTIONS.map((c) => c.quoi) } },
      tx,
    )
  })
  console.log('\n✓ Écrit et journalisé.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
