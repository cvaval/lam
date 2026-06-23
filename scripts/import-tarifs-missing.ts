/**
 * Complète la table CustomsTariff avec les positions du tarif NDP SH2022 « mis à jour »
 * absentes du premier CSV audité (651 lignes : chap. 29 chimie, 27 charbons, 30, 32, 33,
 * 86 ferroviaire, etc.). Données extraites de Tarif-NDP-SH-2022_mis_a_jour.xlsx (feuille
 * « Table 1 », colonnes fusionnées → heuristique « 2 dernières cellules = unité, DD »)
 * vers scripts/tarifs-missing.json. TCA « 10 % » comme toutes les lignes ; aucune accise
 * (aucune de ces positions n'est dans une catégorie d'accise). 23 lignes ont un DD non
 * déterminable (cellule vide/colonnes de suivi) → dd=null, à compléter au Master Admin.
 *
 *   npx tsx scripts/import-tarifs-missing.ts            (simulation)
 *   npx tsx scripts/import-tarifs-missing.ts --commit
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')

interface Item { code: string; searchCode: string; designation: string; unite: string | null; dd: string | null; chapter: string; position: number }

async function main() {
  const items = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'tarifs-missing.json'), 'utf8')) as Item[]
  // Garde-fou : ne réinsère que les codes RÉELLEMENT absents (idempotent).
  const existing = new Set((await prisma.customsTariff.findMany({ select: { searchCode: true } })).map((r) => r.searchCode))
  const toAdd = items.filter((it) => it.searchCode && !existing.has(it.searchCode))
  const noDd = toAdd.filter((it) => !it.dd).length
  console.log(`fichier : ${items.length} · déjà en base : ${items.length - toAdd.length} · à ajouter : ${toAdd.length} · sans DD : ${noDd} · ${COMMIT ? 'COMMIT' : 'SIMULATION'}`)
  console.log('échantillon :', toAdd.slice(0, 3).map((i) => `${i.code} ${i.dd ?? '—'} ${i.designation.slice(0, 30)}`))
  if (!COMMIT) { console.log('\nSIMULATION — relancer avec --commit.'); await prisma.$disconnect(); return }

  let created = 0
  for (let i = 0; i < toAdd.length; i += 500) {
    const batch = toAdd.slice(i, i + 500).map((it) => ({
      code: it.code, searchCode: it.searchCode, designation: it.designation,
      unite: it.unite, dd: it.dd, tca: '10 %', accises: null, note: null,
      chapter: it.chapter, position: it.position,
    }))
    created += (await prisma.customsTariff.createMany({ data: batch })).count
  }
  await audit({ action: 'DOC_PUBLISHED', targetType: 'TARIFF', meta: { op: 'bulk-import-missing', source: 'Tarif-NDP-SH-2022_mis_a_jour.xlsx', created, noDd } }, prisma)
  console.log(`\n✓ ${created} positions ajoutées.`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
