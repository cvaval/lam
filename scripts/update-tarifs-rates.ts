/**
 * Met à jour le droit de douane (dd) des positions vers leur DERNIER taux EN VIGUEUR,
 * d'après la feuille « Évolution tarifaire » du tarif NDP SH2022 mis à jour (dernier
 * exercice promulgué par position ; projets/propositions exclus). scripts/tarifs-latest-rates.json.
 *
 *   npx tsx scripts/update-tarifs-rates.ts            (simulation : liste les écarts)
 *   npx tsx scripts/update-tarifs-rates.ts --commit
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
  const map = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'tarifs-latest-rates.json'), 'utf8')) as Record<string, { pos: string; dd: string; ex: string; ref: string }>
  const changes: { code: string; from: string; to: string; ex: string }[] = []
  let same = 0, notFound = 0
  for (const [sc, v] of Object.entries(map)) {
    const row = await prisma.customsTariff.findFirst({ where: { searchCode: sc }, select: { id: true, code: true, dd: true } })
    if (!row) { notFound++; continue }
    if ((row.dd ?? '') === v.dd) { same++; continue }
    changes.push({ code: row.code, from: row.dd ?? '—', to: v.dd, ex: v.ex })
  }
  console.log(`Positions « Évolution tarifaire » en vigueur : ${Object.keys(map).length}`)
  console.log(`inchangées : ${same} · à mettre à jour : ${changes.length} · absentes : ${notFound}\n`)
  for (const c of changes) console.log(`  ${c.code.padEnd(12)} ${(c.from).padStart(9)} → ${(c.to).padEnd(10)} (${c.ex})`)
  if (!COMMIT) { console.log('\nSIMULATION — relancer avec --commit.'); await prisma.$disconnect(); return }
  for (const [sc, v] of Object.entries(map)) await prisma.customsTariff.updateMany({ where: { searchCode: sc }, data: { dd: v.dd, ddRef: v.ref } })
  await audit({ action: 'DOC_PUBLISHED', targetType: 'TARIFF', meta: { op: 'latest-dd', source: 'Évolution tarifaire', updated: changes.length, refsSet: Object.keys(map).length } }, prisma)
  console.log(`\n✓ ${changes.length} taux mis à jour.`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
