/**
 * Export complet de la base (avant migration SQLite → PostgreSQL/Supabase).
 * Écrit un fichier NDJSON par modèle dans prisma/migration-dump/ (ignoré par git).
 * À LANCER TANT QUE LE SCHÉMA EST ENCORE EN SQLITE. Rechargé par import-db.ts.
 *
 *   npx tsx scripts/export-db.ts
 */
import { PrismaClient } from '@prisma/client'
import { mkdirSync, createWriteStream } from 'node:fs'
import { join } from 'node:path'

const prisma = new PrismaClient()
const OUT = join(process.cwd(), 'prisma', 'migration-dump')

// Ordre = ordre de dépendance (parents d'abord) — réutilisé tel quel à l'import.
const MODELS = [
  'organization', 'user', 'company', 'document',
  'promoCode', 'promoRedemption', 'session', 'trustedDevice', 'documentVersion',
  'citation', 'companyPublication', 'favorite', 'searchLog', 'exportRecord', 'auditLog', 'alert',
] as const

async function dumpModel(name: string) {
  const delegate = (prisma as any)[name]
  if (!delegate) {
    console.log(`  ${name}: (modèle absent, ignoré)`)
    return
  }
  const total = await delegate.count()
  const stream = createWriteStream(join(OUT, `${name}.ndjson`))
  const PAGE = 1000
  let written = 0
  // Pagination par curseur d'id (stable, mémoire bornée même pour 28k documents).
  let cursor: string | undefined
  for (;;) {
    const batch: any[] = await delegate.findMany({
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    })
    if (!batch.length) break
    for (const row of batch) stream.write(JSON.stringify(row) + '\n')
    written += batch.length
    cursor = batch[batch.length - 1].id
    if (batch.length < PAGE) break
  }
  await new Promise<void>((res) => stream.end(res))
  console.log(`  ${name}: ${written}/${total}`)
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  console.log('Export → prisma/migration-dump/')
  for (const m of MODELS) await dumpModel(m)
  console.log('✅  Export terminé.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
