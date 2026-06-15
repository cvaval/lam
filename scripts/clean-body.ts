/**
 * scripts/clean-body.ts — Correction orthographique/grammaticale du corpus
 *
 * Utilise l'IA (Gemini ou Anthropic selon LV_AI_PROVIDER) pour corriger les
 * erreurs OCR et de grammaire dans les textes officiels. Le résultat est stocké
 * dans `bodyClean` ; `bodyOriginal` reste intact (§02).
 *
 * Usage :
 *   node --env-file=.env -e "require('tsx/cjs');require('./scripts/clean-body.ts')"
 *   # ou, si .env déjà dans le shell :
 *   npx tsx scripts/clean-body.ts
 *
 *   Flags (après "--" si appelé via -e) :
 *     --commit          écrit en base (sans : aperçu seulement)
 *     --type LOI_FINANCES,LEGISLATION   types ciblés (défaut : LOI_FINANCES)
 *     --force           re-nettoie les bodyClean existants
 *     --limit 5         plafond de documents
 *     --id <cuid>       document précis
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'
import { cleanBodyText } from '../src/lib/ai/clean'
import { isAiConfigured } from '../src/lib/ai/provider'

// Charge .env si les variables ne sont pas déjà dans le shell (tsx ne le fait pas).
try {
  const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(?:"([^"]*)"|'([^']*)'|(.*))$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = (m[2] ?? m[3] ?? m[4] ?? '').trim()
  }
} catch { /* .env optionnel */ }

const prisma = new PrismaClient()

// Quand appelé via `node -e "require('tsx/cjs');require('./scripts/clean-body.ts')"`,
// les flags utilisateur sont après "--" dans process.argv.
const rawArgs = process.argv.slice(2)
const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs

const COMMIT = args.includes('--commit')
const FORCE = args.includes('--force')
const LIMIT = (() => { const i = args.indexOf('--limit'); return i >= 0 ? parseInt(args[i + 1], 10) : 0 })()
const TYPES = (() => { const i = args.indexOf('--type'); return i >= 0 ? args[i + 1].split(',') : ['LOI_FINANCES'] })()
const SINGLE_ID = (() => { const i = args.indexOf('--id'); return i >= 0 ? args[i + 1] : null })()

if (!isAiConfigured()) {
  console.error('❌ Aucune clé IA configurée. Ajoute GEMINI_API_KEY ou ANTHROPIC_API_KEY dans .env')
  process.exit(1)
}

async function main() {
  const where = SINGLE_ID
    ? { id: SINGLE_ID }
    : {
        type: TYPES.length === 1 ? TYPES[0] : { in: TYPES },
        ...(FORCE ? {} : { bodyClean: null }),
        NOT: { bodyOriginal: { startsWith: '[Document numérisé' } },
      }

  const docs = await prisma.document.findMany({
    where,
    select: { id: true, titleFr: true, type: true, bodyOriginal: true, bodyClean: true },
    take: LIMIT || undefined,
    orderBy: { publicationDate: 'asc' },
  })

  if (docs.length === 0) {
    console.log('✔ Aucun document à traiter.')
    return
  }

  console.log(`\n${COMMIT ? '✏️  Correction' : '👁  Aperçu (--commit pour écrire)'} — ${docs.length} document(s) [${TYPES.join(', ')}]\n`)

  let ok = 0, skip = 0, err = 0

  for (const doc of docs) {
    const label = `[${doc.type}] ${doc.titleFr.slice(0, 60)}`
    const chars = doc.bodyOriginal.length

    if (chars < 50) {
      console.log(`  — ${label} (trop court, ignoré)`)
      skip++
      continue
    }

    process.stdout.write(`  → ${label} (${(chars / 1000).toFixed(1)}k chars)… `)

    try {
      const cleaned = await cleanBodyText(doc.bodyOriginal)

      if (!cleaned || cleaned.length < doc.bodyOriginal.length * 0.5) {
        console.log('⚠️  résultat suspect (trop court), ignoré')
        skip++
        continue
      }

      const changed = [...cleaned].filter((c, i) => c !== doc.bodyOriginal[i]).length
      const pct = ((changed / chars) * 100).toFixed(1)
      process.stdout.write(`${pct}% modifié `)

      if (COMMIT) {
        await prisma.document.update({ where: { id: doc.id }, data: { bodyClean: cleaned } })
        console.log('✔')
      } else {
        const preview = findDiffs(doc.bodyOriginal, cleaned)
        console.log(`(aperçu) ${preview}`)
      }
      ok++
    } catch (e) {
      console.log(`❌ ${(e as Error).message?.slice(0, 80)}`)
      err++
    }
  }

  console.log(`\n${COMMIT ? 'Écrit' : 'Aperçu'} : ${ok} ok · ${skip} ignorés · ${err} erreurs`)
  if (!COMMIT && ok > 0) console.log('Relance avec --commit pour persister les corrections.')
}

function findDiffs(original: string, cleaned: string, max = 3): string {
  const origWords = original.split(/\s+/)
  const cleanWords = cleaned.split(/\s+/)
  const diffs: string[] = []
  for (let i = 0; i < Math.min(origWords.length, cleanWords.length) && diffs.length < max; i++) {
    if (origWords[i] !== cleanWords[i]) diffs.push(`"${origWords[i]}"→"${cleanWords[i]}"`)
  }
  return diffs.length ? diffs.join(' ') : '(aucune diff détectée)'
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
