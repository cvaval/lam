/**
 * Rétro-qualification du SENS DE L'ARRÊT sur les fiches déjà rédigées.
 *
 *   npx tsx scripts/requalifier-sens-arret.ts           → SIMULATION (rien n'est écrit)
 *   npx tsx scripts/requalifier-sens-arret.ts --apply   → écrit en base
 *
 * ⚠️ SIMULATION PAR DÉFAUT. La base est celle de PRODUCTION.
 *
 * Pourquoi ce script existe : `deduireSolution()` rendait CASSATION_AVEC_RENVOI par défaut
 * dès que le mot « cassation » apparaissait. Or la Cour d'Haïti casse le plus souvent SANS
 * renvoyer — elle retient la cause et juge « en vertu de l'article 116 de la Constitution ».
 * Cinq fiches portaient donc un renvoi qui n'a jamais eu lieu. La fonction corrigée les
 * relit ; ce script reporte sa lecture en base.
 *
 * ⚠️ IL NE TOUCHE PAS AU CHAMP `dispositif`. Celui-ci reproduit ce que la Cour a prononcé
 * et s'affiche tel quel : on ne réécrit jamais la parole de la Cour pour arranger un filtre.
 * Seule la clé de classement `solution` est recalculée, à partir de ce dispositif inchangé.
 *
 * ⚠️ IL PEUT ÉCRASER UN CHOIX HUMAIN. Au 18 août 2026 aucune fiche n'était qualifiée à la
 * main (stocké et déduit coïncidaient partout), mais ce ne sera plus vrai le jour où la
 * rédaction corrigera une déduction depuis l'écran d'admin. Relire la simulation AVANT
 * d'appliquer, et se demander pour chaque ligne si la valeur en base venait d'un humain.
 *
 * Aucune réindexation n'est nécessaire : `solution` n'est pas un champ indexé.
 */
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]

import { PrismaClient } from '@prisma/client'
import { deduireSolution, LIBELLE_SOLUTION } from '../src/lib/jurisprudence/constants'

const prisma = new PrismaClient()
const APPLIQUER = process.argv.includes('--apply')

async function main() {
  const docs = await prisma.document.findMany({
    where: { type: 'JURISPRUDENCE', NOT: { dispositif: null } },
    select: { id: true, number: true, chambre: true, titleFr: true, dispositif: true, solution: true, recueilRef: true },
    orderBy: [{ recueilRef: 'asc' }, { number: 'asc' }],
  })

  const aChanger = docs
    .filter((d) => (d.dispositif ?? '').trim())
    .map((d) => ({ d, neuf: deduireSolution(d.dispositif!) }))
    .filter(({ d, neuf }) => (d.solution ?? null) !== neuf)

  console.log(`${APPLIQUER ? '✍️  ÉCRITURE' : '🔍 SIMULATION'} — ${docs.length} fiches relues, ${aChanger.length} à requalifier\n`)

  for (const { d, neuf } of aChanger) {
    console.log(`• ${d.chambre} n° ${d.number} — ${d.titleFr.slice(0, 66)}`)
    console.log(`  « ${d.dispositif!.trim().replace(/\s+/g, ' ').slice(0, 108)} »`)
    console.log(`  ${d.solution ?? 'null'}  →  ${neuf ?? 'null'}${neuf ? `  (${LIBELLE_SOLUTION[neuf]})` : ''}`)
  }

  if (!aChanger.length) return console.log('Rien à faire.')
  if (!APPLIQUER) return console.log(`\nRien n'a été écrit. Relancer avec --apply pour appliquer ces ${aChanger.length} changements.`)

  for (const { d, neuf } of aChanger) {
    await prisma.document.update({ where: { id: d.id }, data: { solution: neuf } })
  }
  console.log(`\n✍️  ${aChanger.length} fiches mises à jour.`)
}

main().finally(() => prisma.$disconnect())
