/**
 * scripts/clean-body.ts — Correction orthographique/grammaticale du corpus
 *
 * Utilise l'IA (Gemini ou Anthropic selon LV_AI_PROVIDER) pour corriger les
 * erreurs OCR et de grammaire dans les textes officiels. Le résultat est stocké
 * dans `bodyClean` ; `bodyOriginal` reste intact (§02).
 *
 * Usage :
 *   npx tsx scripts/clean-body.ts                        # aperçu, LOI_FINANCES
 *   npx tsx scripts/clean-body.ts --commit               # écrit en base
 *   npx tsx scripts/clean-body.ts --type LEGISLATION     # autre type
 *   npx tsx scripts/clean-body.ts --type LOI_FINANCES,LEGISLATION
 *   npx tsx scripts/clean-body.ts --force                # re-nettoie bodyClean existants
 *   npx tsx scripts/clean-body.ts --limit 5              # plafond de documents
 *   npx tsx scripts/clean-body.ts --id <cuid>            # document précis
 */

import { prisma } from '../src/lib/db'
import { cleanBodyText } from '../src/lib/ai/clean'
import { isAiConfigured } from '../src/lib/ai/provider'

const args = process.argv.slice(2)
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
        // Ignore les documents sans texte exploitable
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

      // Vérifie que le résultat est cohérent (pas tronqué, pas vide)
      if (!cleaned || cleaned.length < doc.bodyOriginal.length * 0.5) {
        console.log('⚠️  résultat suspect (trop court), ignoré')
        skip++
        continue
      }

      // Calcule le taux de modification (pour la transparence)
      const changed = [...cleaned].filter((c, i) => c !== doc.bodyOriginal[i]).length
      const pct = ((changed / chars) * 100).toFixed(1)
      process.stdout.write(`${pct}% modifié `)

      if (COMMIT) {
        await prisma.document.update({ where: { id: doc.id }, data: { bodyClean: cleaned } })
        console.log('✔')
      } else {
        // Aperçu : affiche quelques corrections
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

/** Retourne un aperçu des premières différences entre original et corrigé. */
function findDiffs(original: string, cleaned: string, max = 3): string {
  const origWords = original.split(/\s+/)
  const cleanWords = cleaned.split(/\s+/)
  const diffs: string[] = []
  for (let i = 0; i < Math.min(origWords.length, cleanWords.length) && diffs.length < max; i++) {
    if (origWords[i] !== cleanWords[i]) {
      diffs.push(`"${origWords[i]}"→"${cleanWords[i]}"`)
    }
  }
  return diffs.length ? diffs.join(' ') : '(aucune diff détectée)'
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
