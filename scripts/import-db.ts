/**
 * Rechargement de la base exportée par export-db.ts dans la nouvelle base
 * PostgreSQL/Supabase. À LANCER APRÈS avoir basculé le schéma en postgresql et
 * créé les tables (prisma db push) avec DATABASE_URL/DIRECT_URL pointant Supabase.
 *
 *   npx tsx scripts/import-db.ts [--wipe]
 *
 * --wipe : vide d'abord les tables (réimport propre, idempotent).
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Chargement en masse : on privilégie la connexion DIRECTE (port 5432) plutôt que
// le pooler PgBouncer (6543), plus robuste pour de gros createMany.
const prisma = new PrismaClient(
  process.env.DIRECT_URL ? { datasources: { db: { url: process.env.DIRECT_URL } } } : undefined,
)
const DIR = join(process.cwd(), 'prisma', 'migration-dump')

// Ordre de dépendance (parents d'abord) pour respecter les clés étrangères.
const MODELS = [
  'organization', 'user', 'company', 'document',
  'promoCode', 'promoRedemption', 'session', 'trustedDevice', 'documentVersion',
  'citation', 'companyPublication', 'favorite', 'searchLog', 'exportRecord', 'auditLog', 'alert',
] as const

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/** Reviver JSON : les dates ISO (sortie Prisma) redeviennent des objets Date. */
function reviveDates(obj: any): any {
  for (const k in obj) if (typeof obj[k] === 'string' && ISO.test(obj[k])) obj[k] = new Date(obj[k])
  return obj
}

function readRows(name: string): any[] {
  const path = join(DIR, `${name}.ndjson`)
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => reviveDates(JSON.parse(l)))
}

async function chunked(rows: any[], size: number, fn: (c: any[]) => Promise<void>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size))
}

async function main() {
  const wipe = process.argv.includes('--wipe')
  if (wipe) {
    console.log('Purge des tables (ordre inverse)…')
    for (const m of [...MODELS].reverse()) {
      try { await (prisma as any)[m].deleteMany({}) } catch { /* table absente */ }
    }
  }

  for (const name of MODELS) {
    const rows = readRows(name)
    if (!rows.length) { console.log(`  ${name}: 0`); continue }
    const delegate = (prisma as any)[name]
    let done = 0
    // Utilisateurs : un seul createMany (la self-réf activatedById se résout dans
    // le même INSERT). Autres tables : lots de 500.
    const size = name === 'user' ? rows.length : 500
    await chunked(rows, size, async (c) => {
      await delegate.createMany({ data: c })
      done += c.length
    })
    console.log(`  ${name}: ${done}`)
  }
  console.log('✅  Import terminé.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
