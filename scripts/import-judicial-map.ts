/**
 * Importation du référentiel de la carte judiciaire (data/judicial-map/seed-v1.json).
 *
 *   npx tsx scripts/import-judicial-map.ts --file data/judicial-map/seed-v1.json --dry-run
 *   npx tsx scripts/import-judicial-map.ts --file data/judicial-map/seed-v1.json --apply
 *
 * Garanties :
 *  - validation Zod COMPLÈTE + contrôles de cohérence (comptes de référence, clés
 *    dupliquées, code postal principal, TPI/cour d'appel par commune) AVANT toute
 *    transaction — le moindre constat BLOQUANT arrête tout ;
 *  - idempotent (upsert par identifiant stable) ; AUCUNE suppression implicite —
 *    les enregistrements en base absents du fichier sont signalés, jamais retirés ;
 *  - rapport créations / modifications / inchangés / anomalies ;
 *  - un import appliqué écrit une entrée d'audit JUDICIAL_IMPORT ;
 *  - aucun chemin absolu de la machine source n'est enregistré.
 */
import { readFileSync, existsSync } from 'node:fs'
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
import { seedSchema, validateSeed, EXPECTED_COUNTS } from '../src/lib/jurisdictions/seed-schema'
import { buildImportPlan, type GeoCorrespondence } from '../src/lib/jurisdictions/import-plan'

interface Args { file: string; apply: boolean }

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const fileIx = argv.indexOf('--file')
  const file = fileIx >= 0 ? argv[fileIx + 1] : 'data/judicial-map/seed-v1.json'
  const apply = argv.includes('--apply')
  const dry = argv.includes('--dry-run')
  if (apply && dry) throw new Error('--apply et --dry-run sont exclusifs')
  return { file, apply }
}

/** Comparaison superficielle sur les champs du plan (détection « inchangé »). */
function sameShallow(a: Record<string, unknown>, b: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((k) => {
    const va = a[k] ?? null
    const vb = b[k] ?? null
    return va === vb
  })
}

async function main() {
  const { file, apply } = parseArgs()
  const path = resolve(process.cwd(), file)
  console.log(`Import carte judiciaire — ${apply ? 'APPLICATION' : 'SIMULATION (--dry-run)'}`)
  console.log(`  fichier : ${file}`)

  // ── 1. Validation complète avant toute transaction ────────────────────────
  const rawText = readFileSync(path, 'utf8')
  const parsed = seedSchema.safeParse(JSON.parse(rawText))
  if (!parsed.success) {
    console.error('✗ validation Zod refusée :')
    for (const issue of parsed.error.issues.slice(0, 20))
      console.error(`   ${issue.path.join('.')} — ${issue.message}`)
    process.exit(1)
  }
  const seed = parsed.data
  const anomalies = validateSeed(seed)
  const blocking = anomalies.filter((a) => a.level === 'BLOQUANT')
  for (const a of anomalies) console.log(`  ${a.level === 'BLOQUANT' ? '✗' : '⚠'} ${a.message}`)
  if (blocking.length) {
    console.error(`✗ ${blocking.length} constat(s) bloquant(s) — import refusé.`)
    process.exit(1)
  }
  console.log(`  ✓ comptes de référence : ${Object.entries(EXPECTED_COUNTS).map(([k, v]) => `${k}=${v}`).join(' · ')}`)

  // ── 2. Correspondance cartographique (centroïdes documentés, clé COD-AB) ──
  let geo: GeoCorrespondence[] = []
  const metaPath = resolve(process.cwd(), 'public/maps/hti/metadata.json')
  if (existsSync(metaPath)) {
    geo = (JSON.parse(readFileSync(metaPath, 'utf8')) as { communeCorrespondence: GeoCorrespondence[] }).communeCorrespondence
    console.log(`  ✓ correspondance cartographique : ${geo.length} communes jointes`)
  } else {
    console.log('  ⚠ public/maps/hti/metadata.json absent — communes importées sans centroïde ni clé de géométrie')
  }

  const plan = buildImportPlan(seed, geo)
  for (const a of plan.anomalies) console.log(`  ⚠ ${a}`)
  const unmapped = plan.courts.filter((c) => c.verificationStatus === 'UNMAPPED')
  console.log(
    `  plan : ${plan.departments.length} départements · ${plan.arrondissements.length} arrondissements · ` +
      `${plan.communes.length} communes · ${plan.postalCodes.length} codes postaux · ` +
      `${plan.courts.length} juridictions (dont ${unmapped.length} UNMAPPED) · ${plan.jurisdictions.length} rattachements`,
  )

  // ── 3. Diff avec l'état actuel (créé / modifié / inchangé) ────────────────
  const [depts, arrs, communes, postals, courts, juris] = await Promise.all([
    prisma.judicialDepartment.findMany(),
    prisma.judicialArrondissement.findMany(),
    prisma.judicialCommune.findMany(),
    prisma.judicialPostalCode.findMany(),
    prisma.court.findMany(),
    prisma.courtCommuneJurisdiction.findMany(),
  ])
  // PrismaPromise hétérogène (upserts de 6 modèles) : $transaction(array) accepte
  // Prisma.PrismaPromise<unknown>[] — c'est exactement ce que nous accumulons.
  type Op = import('@prisma/client').Prisma.PrismaPromise<unknown>
  const stats = { created: 0, updated: 0, unchanged: 0 }
  const ops: Op[] = []
  const diff = <T extends { id: string }>(
    existing: Map<string, Record<string, unknown>>,
    rows: T[],
    keys: (keyof T & string)[],
    write: (row: T, exists: boolean) => Op,
  ) => {
    for (const row of rows) {
      const cur = existing.get(row.id)
      if (cur && sameShallow(cur, row as Record<string, unknown>, keys)) { stats.unchanged++; continue }
      if (cur) stats.updated++
      else stats.created++
      ops.push(write(row, Boolean(cur)) as unknown as Op)
    }
  }
  const asMap = (rows: { id: string }[]) => new Map(rows.map((r) => [r.id, r as unknown as Record<string, unknown>]))

  diff(asMap(depts), plan.departments, ['name', 'capital', 'arrondissementCount', 'communeCount'], (d) =>
    prisma.judicialDepartment.upsert({ where: { id: d.id }, create: d, update: d }),
  )
  diff(asMap(arrs), plan.arrondissements, ['name', 'departmentId'], (a) =>
    prisma.judicialArrondissement.upsert({ where: { id: a.id }, create: a, update: a }),
  )
  diff(
    asMap(communes), plan.communes,
    ['key', 'slug', 'name', 'city', 'departmentId', 'arrondissementId', 'geometryKey', 'centroidLat', 'centroidLng', 'aliasesJson', 'observation', 'sourceJson'],
    (c) => prisma.judicialCommune.upsert({ where: { id: c.id }, create: c, update: c }),
  )
  diff(
    asMap(postals), plan.postalCodes,
    ['communeId', 'code', 'label', 'isPrimary', 'verificationStatus', 'scopeNote', 'sourceJson'],
    (p) => prisma.judicialPostalCode.upsert({ where: { id: p.id }, create: p, update: p }),
  )
  diff(
    asMap(courts), plan.courts,
    ['type', 'name', 'normalizedName', 'scope', 'department', 'arrondissement', 'commune', 'city', 'address', 'postalCode', 'plusCode', 'latitude', 'longitude', 'locationPrecision', 'operationalStatus', 'verificationStatus', 'observation', 'sourceJson', 'active'],
    (c) => prisma.court.upsert({ where: { id: c.id }, create: c, update: c }),
  )
  diff(
    asMap(juris), plan.jurisdictions,
    ['courtId', 'communeId', 'relationship', 'scopeNote', 'legalBasisJson'],
    (j) => prisma.courtCommuneJurisdiction.upsert({ where: { id: j.id }, create: j, update: j }),
  )

  // Jamais de suppression implicite : les enregistrements absents du fichier sont signalés.
  const planIds = new Set([
    ...plan.departments.map((x) => x.id), ...plan.arrondissements.map((x) => x.id),
    ...plan.communes.map((x) => x.id), ...plan.postalCodes.map((x) => x.id),
    ...plan.courts.map((x) => x.id), ...plan.jurisdictions.map((x) => x.id),
  ])
  const orphans = [...depts, ...arrs, ...communes, ...postals, ...courts, ...juris].filter((r) => !planIds.has(r.id))
  for (const o of orphans.slice(0, 20)) console.log(`  ⚠ en base mais absent du fichier (CONSERVÉ) : ${o.id}`)
  if (orphans.length > 20) console.log(`  ⚠ … et ${orphans.length - 20} autres`)

  console.log(`\n  créations : ${stats.created} · modifications : ${stats.updated} · inchangés : ${stats.unchanged} · anomalies : ${plan.anomalies.length + anomalies.length} · orphelins conservés : ${orphans.length}`)

  if (!apply) {
    console.log('\n(simulation — rien n’a été écrit ; relancer avec --apply)')
    await prisma.$disconnect()
    return
  }

  // ── 4. Application transactionnelle (parents avant enfants, déjà ordonnés) ─
  const CHUNK = 200
  for (let i = 0; i < ops.length; i += CHUNK) {
    await prisma.$transaction(ops.slice(i, i + CHUNK))
  }
  await audit({
    action: 'JUDICIAL_IMPORT',
    targetType: 'JudicialSeed',
    targetId: `seed-v${seed.schemaVersion}`,
    meta: {
      file, // chemin RELATIF au dépôt — jamais le chemin absolu de la machine
      created: stats.created,
      updated: stats.updated,
      unchanged: stats.unchanged,
      anomalies: plan.anomalies.length + anomalies.length,
      orphansKept: orphans.length,
    },
  })
  console.log('\n✓ import appliqué (audit JUDICIAL_IMPORT tracé)')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
