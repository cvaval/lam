/**
 * Importation des coordonnées d'études de notaires (data/judicial-map/notaires-coordonnees-v1.json).
 *
 *   npx tsx scripts/import-coordonnees-notaires.ts              # SIMULATION (défaut)
 *   npx tsx scripts/import-coordonnees-notaires.ts --apply      # ⚠️ écrit en base
 *
 * ⚠️ `.env` POINTE SUR LA BASE DE PRODUCTION. `--apply` ne se lance que sur instruction
 * explicite de Me Vaval. La base visée est affichée en tête de rapport.
 *
 * Garanties (calquées sur scripts/import-notaires-mjsp.ts) :
 *  - validation Zod complète et contrôles (src/lib/jurisdictions/coordonnees.ts) AVANT toute
 *    transaction : entrée connue et ACTIVE, nom imprimé égal au nom attendu (verrou contre un
 *    décalage de numéros entre deux éditions), téléphones lisibles, courriel bien formé ;
 *  - idempotent (upsert par `contact-<notaryId>`) ; AUCUNE suppression implicite ;
 *  - `--apply` refusé sans la sécurité par ligne (RLS) sur « NotaryContact » ;
 *  - audit JUDICIAL_IMPORT (`targetType: 'NotaryContactSeed'`), recompté après coup.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]

import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import { buildContactPlan, contactSeedSchema, diffContacts, formatPhone, readPhones } from '../src/lib/jurisdictions/coordonnees'

function parseArgs() {
  const argv = process.argv.slice(2)
  const fileIx = argv.indexOf('--file')
  const file = fileIx >= 0 ? argv[fileIx + 1] : 'data/judicial-map/notaires-coordonnees-v1.json'
  const apply = argv.includes('--apply')
  if (apply && argv.includes('--dry-run')) throw new Error('--apply et --dry-run sont exclusifs')
  return { file, apply }
}

function cible(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '')
    return `${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname}`
  } catch { return '(DATABASE_URL illisible)' }
}

async function main() {
  const { file, apply } = parseArgs()
  console.log(`Import des coordonnées de notaires — ${apply ? 'APPLICATION' : 'SIMULATION (--dry-run)'}`)
  console.log(`  base    : ${cible()}`)
  console.log(`  fichier : ${file}`)

  const parsed = contactSeedSchema.safeParse(JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8')))
  if (!parsed.success) {
    console.error('✗ validation Zod refusée :')
    for (const i of parsed.error.issues.slice(0, 20)) console.error(`   ${i.path.join('.')} — ${i.message}`)
    process.exit(1)
  }
  const seed = parsed.data

  // Les entrées visées, telles qu'EN BASE (nom imprimé et statut).
  const ids = seed.entries.map((e) => e.notaryId)
  const notaries = await prisma.notary.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, displayName: true, active: true } })
  const plan = buildContactPlan(seed, notaries)
  for (const a of plan.anomalies) console.log(`  ${a.level === 'BLOQUANT' ? '✗' : '⚠'} ${a.message}`)
  const shown = new Map(notaries.map((n) => [n.id, n.displayName ?? n.fullName]))
  for (const r of plan.rows) {
    const tel = readPhones(r.phonesJson).map(formatPhone).join(' ; ') || '—'
    console.log(`  · ${shown.get(r.notaryId) ?? r.notaryId} — ${r.address ?? '—'} — ${tel} — ${r.email ?? '—'}`)
  }
  if (plan.anomalies.some((a) => a.level === 'BLOQUANT')) {
    console.error('✗ constat bloquant — import refusé.')
    await prisma.$disconnect()
    process.exit(1)
  }

  const etat: Array<{ rowsecurity: boolean }> = await prisma.$queryRawUnsafe(
    `select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'NotaryContact'`,
  )
  const tableAbsente = etat.length === 0
  const rls = etat[0]?.rowsecurity === true
  let existing: Awaited<ReturnType<typeof prisma.notaryContact.findMany>> = []
  if (tableAbsente) console.log('  ⚠ table « NotaryContact » absente : `prisma db push` puis `npm run db:rls` requis avant --apply')
  else {
    existing = await prisma.notaryContact.findMany()
    console.log(`  ${rls ? '✓' : '✗'} sécurité par ligne (RLS) sur « NotaryContact » : ${rls ? 'active' : 'INACTIVE — lancer `npm run db:rls`'}`)
  }

  const diff = diffContacts(plan.rows, existing)
  for (const o of diff.orphans) console.log(`  ⚠ en base mais absente du fichier (CONSERVÉE) : ${o}`)
  console.log(`\n  créations : ${diff.create.length} · modifications : ${diff.update.length} · inchangées : ${diff.unchanged} · orphelines conservées : ${diff.orphans.length}`)

  if (!apply) {
    console.log('\n(simulation — rien n’a été écrit ; relancer avec --apply, sur instruction explicite seulement)')
    await prisma.$disconnect()
    return
  }
  if (tableAbsente) { console.error('✗ --apply refusé : la table « NotaryContact » n’existe pas.'); process.exit(1) }
  if (!rls) { console.error('✗ --apply refusé : la table « NotaryContact » n’a pas la sécurité par ligne (RLS).'); process.exit(1) }

  const ops = [...diff.create, ...diff.update].map((row) =>
    prisma.notaryContact.upsert({ where: { id: row.id }, create: row, update: row }),
  )
  if (ops.length) await prisma.$transaction(ops)
  const avant = await prisma.auditLog.count({ where: { action: 'JUDICIAL_IMPORT', targetType: 'NotaryContactSeed' } })
  await audit({
    action: 'JUDICIAL_IMPORT',
    targetType: 'NotaryContactSeed',
    targetId: `notaires-coordonnees-v${seed.schemaVersion}`,
    meta: { file, created: diff.create.length, updated: diff.update.length, unchanged: diff.unchanged, orphansKept: diff.orphans.length },
  })
  // `audit()` avale ses erreurs : on RECOMPTE plutôt que de le croire.
  const [total, apres] = await Promise.all([
    prisma.notaryContact.count({ where: { active: true } }),
    prisma.auditLog.count({ where: { action: 'JUDICIAL_IMPORT', targetType: 'NotaryContactSeed' } }),
  ])
  console.log(`\n✓ import appliqué — ${total} fiche(s) active(s) en base ; audit ${apres > avant ? 'tracé' : 'NON TRACÉ (à vérifier)'}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
