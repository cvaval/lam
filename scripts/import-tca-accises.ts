/**
 * TCA + droits d'accise sur la table des tarifs douaniers (CustomsTariff).
 *
 *   npx tsx scripts/import-tca-accises.ts            (simulation : compte les lignes touchées)
 *   npx tsx scripts/import-tca-accises.ts --commit
 *
 * 1) TCA = « 10 % » sur TOUTES les lignes (règle générale ; exonérations éventuelles
 *    non reflétées — à fournir séparément).
 * 2) Droits d'accise À L'IMPORT depuis « Droits Accises_En vigueur only.xlsx » (AmCham,
 *    Budget 2025-2026 + LF rectificative). On n'applique QUE les taux à l'import liés à
 *    des positions tarifaires identifiables :
 *      - Tabac (chap. 24) ............ 60 %
 *      - Alcools (positions LF art.23) 30 %
 *      - Sauces tomate (art. 24) ..... 15 %
 *      - Véhicules ≥ 2200 cm³ ........ 15 %
 *    NON appliqués (hors périmètre table d'import / sans code précis, cf. rapport) :
 *    excise sur production LOCALE, boissons énergisantes (pas de sous-position dédiée),
 *    produits pétroliers (montants fixes en gourdes/gallon). Idempotent (reset puis ré-applique).
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')

// Véhicules de cylindrée ≥ 2200 cm³ (les lignes < 2200 plafonnent à « 2199 cm3 »).
const VEHICLES = ['87032314', '87032315', '87032316', '87032411', '87032412', '87032413', '87033214', '87033215', '87033216', '87033311', '87033312', '87033313']
const TOMATO = ['20029011', '20029019', '21032000']
const ALCOHOL_PREFIX = ['2203', '2204', '2206', '220830', '220840', '220850', '220870'] // + 22089011 (ex-2208.90.10)

type Where = Record<string, unknown>
const RULES: { label: string; rate: string; where: Where }[] = [
  { label: 'Tabac (chap. 24) 60 %', rate: '60 %', where: { chapter: '24' } },
  { label: 'Alcools 30 %', rate: '30 %', where: { OR: [...ALCOHOL_PREFIX.map((p) => ({ searchCode: { startsWith: p } })), { searchCode: '22089011' }] } },
  { label: 'Sauces tomate 15 %', rate: '15 %', where: { searchCode: { in: TOMATO } } },
  { label: 'Véhicules ≥ 2200 cm³ 15 %', rate: '15 %', where: { searchCode: { in: VEHICLES } } },
  // Boissons énergisantes : sous-position dédiée 2202.10 11 (créée plus bas).
  { label: 'Boissons énergisantes 30 %', rate: '30 %', where: { searchCode: '22021011' } },
  // Produits pétroliers (chap. 27) — codes confirmés via le tarif mis à jour ; montants
  // fixes/% selon « En vigueur » (gazoline = texte légal 90 % CIF ; mémo actuel ≈ 3,30 G/gallon).
  { label: 'Gazoline / essence', rate: '90 % CIF', where: { searchCode: '27101211' } },
  { label: 'Kérosène', rate: '23,00 G/gallon', where: { searchCode: '27101212' } },
  { label: 'Gas-oil (diesel)', rate: '25,00 G/gallon', where: { searchCode: '27101213' } },
  { label: 'Mazout / huiles lubrifiantes 2 %', rate: '2 %', where: { searchCode: { in: ['27101214', '27101219'] } } },
  { label: 'AV-JET 3 %', rate: '3 %', where: { searchCode: '27101215' } },
  { label: 'Propane importé', rate: '0,025 G/livre', where: { searchCode: '27111200' } },
]

async function main() {
  const total = await prisma.customsTariff.count()
  console.log(`Table : ${total} positions · ${COMMIT ? 'COMMIT' : 'SIMULATION'}\n`)
  console.log(`TCA « 10 % » → ${total} lignes (toutes)`)
  let touched = 0
  for (const r of RULES) {
    const n = await prisma.customsTariff.count({ where: r.where })
    touched += n
    console.log(`accises « ${r.rate} » · ${r.label} → ${n} ligne(s)`)
  }
  console.log(`\naccises renseignées : ${touched} · sans accise (null) : ${total - touched}`)

  if (!COMMIT) { console.log('\nSIMULATION — relancer avec --commit pour écrire.'); await prisma.$disconnect(); return }

  // Sous-position dédiée aux boissons énergisantes (le tarif n'a que 2202.10 00 générique).
  if (!(await prisma.customsTariff.findFirst({ where: { searchCode: '22021011' }, select: { id: true } }))) {
    await prisma.customsTariff.create({ data: { code: '2202.10 11', searchCode: '22021011', designation: '-- Boissons énergisantes', unite: 'l', dd: '20 %', chapter: '22', position: 22021011 } })
    console.log('  + créé 2202.10 11 — Boissons énergisantes')
  }

  await prisma.customsTariff.updateMany({ data: { tca: '10 %' } })
  await prisma.customsTariff.updateMany({ data: { accises: null } }) // reset (idempotent)
  const applied: Record<string, number> = {}
  for (const r of RULES) {
    const res = await prisma.customsTariff.updateMany({ where: r.where, data: { accises: r.rate } })
    applied[r.label] = res.count
  }
  await audit({ action: 'DOC_PUBLISHED', targetType: 'TARIFF', meta: { op: 'tca-accises', tca: '10 %', total, applied } }, prisma)
  console.log('\n✓ TCA + accises appliqués :', applied)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
