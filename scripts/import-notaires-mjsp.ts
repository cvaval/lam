/**
 * Importation des notaires du MJSP (data/judicial-map/notaires-mjsp-v1.json).
 *
 *   npx tsx scripts/import-notaires-mjsp.ts                  # SIMULATION (défaut)
 *   npx tsx scripts/import-notaires-mjsp.ts --dry-run        # idem, explicite
 *   npx tsx scripts/import-notaires-mjsp.ts --apply          # ⚠️ écrit en base
 *   … --rapport docs/rapport.md                              # rapport complet en Markdown
 *
 * ⚠️ `.env` POINTE SUR LA BASE DE PRODUCTION. `--apply` ne se lance que sur instruction
 * explicite de Me Vaval. La base visée est affichée en tête de rapport.
 *
 * Garanties (calquées sur scripts/import-judicial-map.ts) :
 *  - validation Zod COMPLÈTE + contrôles de cohérence (src/lib/jurisdictions/notaires-plan.ts)
 *    AVANT toute transaction — le moindre constat BLOQUANT arrête tout ;
 *  - les totaux par TPI sont RECOMPTÉS sur les rattachements de la BASE : un écart avec
 *    l'amorçage veut dire que la production a divergé, et l'import s'arrête ;
 *  - idempotent (upsert par identifiant stable `mjsp-<édition>-<n>`) ; AUCUNE suppression
 *    implicite — une entrée en base absente du fichier est signalée, jamais retirée ;
 *  - rapport créations / modifications / inchangées / anomalies ;
 *  - un import appliqué écrit une entrée d'audit JUDICIAL_IMPORT (recomptée ensuite :
 *    `audit()` avale ses erreurs) ;
 *  - `--apply` REFUSE d'écrire dans une table `Notary` sans sécurité par ligne (RLS) ;
 *  - `--dry-run` et `--apply` sont exclusifs ; la simulation est le défaut.
 */
import { readFileSync, writeFileSync } from 'node:fs'
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
import { EDITION_TIERS } from '../src/lib/jurisdictions/notaires-demandes'
import {
  buildNotaryPlan, diffNotaries, notarySeedSchema, type CommuneRef, type NotaryPlan,
} from '../src/lib/jurisdictions/notaires-plan'

interface Args { file: string; apply: boolean; rapport: string | null }

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const fileIx = argv.indexOf('--file')
  const file = fileIx >= 0 ? argv[fileIx + 1] : 'data/judicial-map/notaires-mjsp-v1.json'
  const rapportIx = argv.indexOf('--rapport')
  const rapport = rapportIx >= 0 ? argv[rapportIx + 1] : null
  const apply = argv.includes('--apply')
  const dry = argv.includes('--dry-run')
  if (apply && dry) throw new Error('--apply et --dry-run sont exclusifs')
  return { file, apply, rapport }
}

/** Hôte de la base visée, sans identifiants — pour qu'on SACHE où l'on écrit. */
function cible(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '')
    return `${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname}`
  } catch { return '(DATABASE_URL illisible)' }
}

/** Le référentiel des communes tel qu'il est EN BASE (noms, alias, centroïdes, ressorts). */
async function communesEnBase(): Promise<CommuneRef[]> {
  const rows = await prisma.judicialCommune.findMany({
    select: {
      id: true, name: true, aliasesJson: true, centroidLat: true, centroidLng: true,
      department: { select: { name: true } },
      jurisdictions: {
        where: { relationship: { in: ['TPI_COMPETENT', 'APPEL_COMPETENT'] } },
        select: { relationship: true, court: { select: { id: true, name: true, active: true } } },
      },
    },
  })
  return rows.map((c) => {
    const rel = (r: string) => {
      const j = c.jurisdictions.find((x) => x.relationship === r && x.court.active)
      return j ? { id: j.court.id, name: j.court.name } : null
    }
    let aliases: string[] = []
    try { const a = JSON.parse(c.aliasesJson); if (Array.isArray(a)) aliases = a.filter((x): x is string => typeof x === 'string') } catch { /* alias illisibles → aucun */ }
    return {
      id: c.id, name: c.name, department: c.department.name, aliases,
      hasCentroid: c.centroidLat != null && c.centroidLng != null,
      tpi: rel('TPI_COMPETENT'), appeal: rel('APPEL_COMPETENT'),
    }
  })
}

function rapportMarkdown(plan: NotaryPlan, base: string, diff: ReturnType<typeof diffNotaries> | null): string {
  const r = plan.report
  const l: string[] = []
  l.push(`# Rapport d'import — notaires du MJSP`, '', `Base : \`${base}\``, '')
  l.push(`| mesure | valeur |`, `|---|---|`)
  l.push(`| entrées | ${r.entries} (inactive : n° ${r.inactive.join(', ') || '—'}) |`)
  l.push(`| communes dans la source | ${r.sourceCommunes} (${r.direct} directes, ${r.aliasesUsed.length} par alias, ${r.unresolved.length} non reconnue) |`)
  l.push(`| communes appariées | ${r.matchedCommunes} |`)
  l.push(`| entrées placées | ${r.placedEntries} (actives : ${r.placedActive}) |`)
  l.push(`| désaccords de département | ${r.disagreements.length} |`)
  l.push(`| communes sans notaire | ${r.communesWithoutNotary.length} |`)
  if (diff) l.push(`| plan | ${diff.create.length} créations · ${diff.update.length} modifications · ${diff.unchanged} inchangées · ${diff.orphans.length} orphelines conservées |`)
  l.push('', '## Totaux par TPI (recomptés sur les rattachements de la base)', '', '| TPI | notaires | communes |', '|---|---|---|')
  for (const t of r.tpiTotals) l.push(`| ${t.tpiName} | ${t.notaries} | ${t.communes} |`)
  l.push('', '## Par cour d’appel', '', '| cour d’appel | notaires |', '|---|---|')
  for (const a of r.appealTotals) l.push(`| ${a.appealName} | ${a.notaries} |`)
  l.push('', '## Alias déclarés (tous consommés)', '', '| imprimé | commune | entrées |', '|---|---|---|')
  for (const a of r.aliasesUsed) l.push(`| ${a.source} | ${a.communeName} | ${a.entries} |`)
  l.push('', '## Commune non reconnue', '')
  for (const u of r.unresolved) l.push(`- « ${u.source} » — entrée(s) n° ${u.ordinals.join(', ')}`)
  l.push('', `## Désaccords de département (${r.disagreements.length})`, '', '| n° | nom | commune | imprimé | référentiel |', '|---|---|---|---|---|')
  for (const d of r.disagreements) l.push(`| ${d.ordinal} | ${d.name} | ${d.commune} | ${d.printed} | ${d.actual} |`)
  l.push('', `## Noms en double (${r.duplicates.length} paires, rien de fusionné)`, '', '| n° | noms | communes | nature |', '|---|---|---|---|')
  for (const d of r.duplicates) l.push(`| ${d.ordinals.join(' / ')} | ${d.names.join(' / ')} | ${d.communes.join(' / ')} | ${d.kind} |`)
  l.push('', `## Marqueurs`, '', `« (PDD) » : ${r.mentions.PDD} noms (+ ${r.mentions.columnOverflow.length} dans la colonne Commune : n° ${r.mentions.columnOverflow.join(', ')}) · « PD/CMM » : ${r.mentions['PD/CMM']}`)
  l.push('', `## Tailles de marqueur`, '', `1-2 : ${r.sizeClasses.small} communes · 3-6 : ${r.sizeClasses.medium} · 7 et plus : ${r.sizeClasses.large} (${r.sizeClasses.largeCommunes.map((c) => `${c.name} ${c.count}`).join(', ')})`)
  l.push('', `## Communes sans notaire (${r.communesWithoutNotary.length})`, '', r.communesWithoutNotary.join(', '))
  if (plan.anomalies.length) {
    l.push('', '## Anomalies', '')
    for (const a of plan.anomalies) l.push(`- ${a.level} — ${a.message}`)
  }
  return `${l.join('\n')}\n`
}

async function main() {
  const { file, apply, rapport } = parseArgs()
  const base = cible()
  console.log(`Import des notaires du MJSP — ${apply ? 'APPLICATION' : 'SIMULATION (--dry-run)'}`)
  console.log(`  base    : ${base}`)
  console.log(`  fichier : ${file}`)

  // ── 1. Validation complète avant toute transaction ────────────────────────
  const parsed = notarySeedSchema.safeParse(JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8')))
  if (!parsed.success) {
    console.error('✗ validation Zod refusée :')
    for (const issue of parsed.error.issues.slice(0, 20)) console.error(`   ${issue.path.join('.')} — ${issue.message}`)
    process.exit(1)
  }
  const seed = parsed.data

  // ── 2. Référentiel EN BASE, plan, contrôles bloquants ─────────────────────
  const communes = await communesEnBase()
  if (communes.length === 0) {
    console.error('✗ aucune commune en base : importer d’abord le référentiel de la carte (import-judicial-map).')
    process.exit(1)
  }
  const plan = buildNotaryPlan(seed, communes)
  for (const a of plan.anomalies) console.log(`  ${a.level === 'BLOQUANT' ? '✗' : '⚠'} ${a.message}`)
  const r = plan.report
  console.log(`  communes : ${r.sourceCommunes} dans la source · ${r.direct} directes · ${r.aliasesUsed.length} alias · ${r.unresolved.length} non reconnue · ${r.matchedCommunes} appariées (référentiel en base : ${communes.length})`)
  console.log(`  entrées  : ${r.entries} · placées ${r.placedEntries} · actives placées ${r.placedActive} · inactives n° ${r.inactive.join(', ')}`)
  console.log(`  désaccords de département : ${r.disagreements.length} · paires de noms : ${r.duplicates.length} · communes sans notaire : ${r.communesWithoutNotary.length}`)
  console.log(`  TPI (recomptés en base) : ${r.tpiTotals.map((t) => `${t.tpiName.replace(/^TPI (de la |de l’|des |du |de |d’)?/, '')} ${t.notaries}`).join(' · ')}`)
  const blocking = plan.anomalies.filter((a) => a.level === 'BLOQUANT')
  if (blocking.length) {
    console.error(`✗ ${blocking.length} constat(s) bloquant(s) — import refusé.`)
    if (rapport) writeFileSync(resolve(process.cwd(), rapport), rapportMarkdown(plan, base, null))
    await prisma.$disconnect()
    process.exit(1)
  }

  // ── 3. Table et sécurité par ligne ─────────────────────────────────────────
  // On interroge le catalogue AVANT la table : une table absente n'est pas une erreur ici,
  // c'est l'état attendu tant que `prisma db push` n'a pas été passé.
  const etat: Array<{ rowsecurity: boolean }> = await prisma.$queryRawUnsafe(
    `select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'Notary'`,
  )
  const tableAbsente = etat.length === 0
  const rls = etat[0]?.rowsecurity === true
  let existing: Awaited<ReturnType<typeof prisma.notary.findMany>> = []
  if (tableAbsente) {
    console.log('  ⚠ table « Notary » absente : `prisma db push` puis `npm run db:rls` requis avant --apply')
  } else {
    // Les entrées ajoutées par la rédaction (édition `tiers`) ne viennent pas de la liste :
    // elles ne sont ni comparées ni signalées comme orphelines.
    existing = await prisma.notary.findMany({ where: { edition: { not: EDITION_TIERS } } })
    console.log(`  ${rls ? '✓' : '✗'} sécurité par ligne (RLS) sur « Notary » : ${rls ? 'active' : 'INACTIVE — lancer `npm run db:rls`'}`)
  }

  // ── 4. Diff (créé / modifié / inchangé / orphelin) ─────────────────────────
  const diff = diffNotaries(plan.rows, existing)
  for (const o of diff.orphans.slice(0, 20)) console.log(`  ⚠ en base mais absent du fichier (CONSERVÉ) : ${o}`)
  if (diff.orphans.length > 20) console.log(`  ⚠ … et ${diff.orphans.length - 20} autres`)
  console.log(`\n  créations : ${diff.create.length} · modifications : ${diff.update.length} · inchangées : ${diff.unchanged} · anomalies : ${plan.anomalies.length} · orphelines conservées : ${diff.orphans.length}`)
  if (rapport) {
    writeFileSync(resolve(process.cwd(), rapport), rapportMarkdown(plan, base, diff))
    console.log(`  rapport : ${rapport}`)
  }

  if (!apply) {
    console.log('\n(simulation — rien n’a été écrit ; relancer avec --apply, sur instruction explicite seulement)')
    await prisma.$disconnect()
    return
  }
  if (tableAbsente) { console.error('✗ --apply refusé : la table « Notary » n’existe pas.'); process.exit(1) }
  if (!rls) { console.error('✗ --apply refusé : la table « Notary » n’a pas la sécurité par ligne (RLS).'); process.exit(1) }

  // ── 5. Application transactionnelle ────────────────────────────────────────
  const ops = [...diff.create, ...diff.update].map((row) =>
    prisma.notary.upsert({ where: { id: row.id }, create: row, update: row }),
  )
  const CHUNK = 200
  for (let i = 0; i < ops.length; i += CHUNK) await prisma.$transaction(ops.slice(i, i + CHUNK))
  const auditAvant = await prisma.auditLog.count({ where: { action: 'JUDICIAL_IMPORT', targetType: 'NotarySeed' } })
  await audit({
    action: 'JUDICIAL_IMPORT',
    targetType: 'NotarySeed',
    targetId: `notaires-mjsp-v${seed.schemaVersion}-${seed.edition}`,
    meta: {
      file, // chemin RELATIF au dépôt — jamais le chemin absolu de la machine
      edition: seed.edition,
      created: diff.create.length,
      updated: diff.update.length,
      unchanged: diff.unchanged,
      anomalies: plan.anomalies.length,
      orphansKept: diff.orphans.length,
    },
  })
  // `audit()` avale ses erreurs : on RECOMPTE plutôt que de le croire.
  const [total, actifs, auditApres] = await Promise.all([
    prisma.notary.count({ where: { edition: seed.edition } }),
    prisma.notary.count({ where: { edition: seed.edition, active: true, communeId: { not: null } } }),
    prisma.auditLog.count({ where: { action: 'JUDICIAL_IMPORT', targetType: 'NotarySeed' } }),
  ])
  console.log(`\n✓ import appliqué — en base : ${total} entrées, ${actifs} actives placées ; audit JUDICIAL_IMPORT ${auditApres > auditAvant ? 'tracé' : 'NON TRACÉ (à vérifier)'}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
