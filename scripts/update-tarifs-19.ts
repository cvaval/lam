/**
 * Renseigne le droit de douane des 19 positions qui en étaient dépourvues, d'après
 * « droits_de_douane_selection_produits.xlsx » (AGD). scripts/tarifs-dd19.json :
 * 6 taux certains, 4 fourchettes (varient selon la sous-position → note), 9 « À confirmer
 * (AGD) » (taux non imprimé sur la ligne). L'observation va dans note. Idempotent.
 *
 *   npx tsx scripts/update-tarifs-19.ts            (simulation)
 *   npx tsx scripts/update-tarifs-19.ts --commit
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

async function main() {
  const map = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'tarifs-dd19.json'), 'utf8')) as Record<string, { code: string; dd: string; statut: string; note: string }>
  let done = 0, miss = 0
  for (const [sc, v] of Object.entries(map)) {
    const ex = await prisma.customsTariff.findFirst({ where: { searchCode: sc }, select: { id: true, dd: true } })
    if (!ex) { miss++; console.log(`  ✗ absent: ${v.code}`); continue }
    console.log(`  ${v.code.padEnd(13)} ${(ex.dd ?? '—').padStart(6)} → ${v.dd}`)
    if (COMMIT) await prisma.customsTariff.update({ where: { id: ex.id }, data: { dd: v.dd, note: v.note || null } })
    done++
  }
  if (COMMIT) await audit({ action: 'DOC_PUBLISHED', targetType: 'TARIFF', meta: { op: 'dd19', source: 'droits_de_douane_selection_produits.xlsx', updated: done } }, prisma)
  console.log(`\n${done} mises à jour · ${miss} absents · ${COMMIT ? 'COMMIT' : 'SIMULATION'}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
