/**
 * Rattrapage des mots-clés thématiques sur le corpus DÉJÀ téléversé.
 *
 *   npx tsx scripts/backfill-keywords.ts                         → inventaire (dry-run)
 *   npx tsx scripts/backfill-keywords.ts --commit                → écrit en base
 *   npx tsx scripts/backfill-keywords.ts --commit --force        → recalcule aussi les documents déjà pourvus
 *   npx tsx scripts/backfill-keywords.ts --commit --type CIRCULAIRE_BRH --limit 20
 *   npx tsx scripts/backfill-keywords.ts --commit --model claude-haiku-4-5-20251001
 *
 * Cibles : les 6 types à texte intégral — l'Index du Moniteur (~28k références
 * sans texte) est volontairement exclu.
 * Moteur : IA si ANTHROPIC_API_KEY est configurée (modèle LV_AI_MODEL ou
 * claude-opus-4-8, surchargé par --model) ; LEXIQUE heuristique sinon — même
 * philosophie que l'extraction du CMS (src/lib/ai/keywords.ts).
 * Idempotent : saute les documents déjà pourvus (sauf --force). Recalcule
 * Document.searchText. Si SEARCH_PROVIDER=opensearch : lancer
 * `npm run search:reindex` après le --commit.
 */
import { PrismaClient } from '@prisma/client'
import { extractKeywords, isAiConfigured, joinKeywords } from '../src/lib/ai/keywords'
import { buildSearchText } from '../src/lib/search/normalize'
import { DOC_TYPES, type DocType } from '../src/lib/types'

const prisma = new PrismaClient()

const FULLTEXT_TYPES = DOC_TYPES.filter((t) => t !== 'INDEX')

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const COMMIT = process.argv.includes('--commit')
const FORCE = process.argv.includes('--force')
const TYPE = arg('type') as DocType | undefined
const LIMIT = Number(arg('limit')) || undefined
const MODEL = arg('model')

async function main() {
  if (TYPE && !(FULLTEXT_TYPES as string[]).includes(TYPE)) {
    console.error(`--type doit être l'un de : ${FULLTEXT_TYPES.join(', ')}`)
    process.exit(1)
  }

  const docs = await prisma.document.findMany({
    where: {
      type: TYPE ? TYPE : { in: [...FULLTEXT_TYPES] },
      ...(FORCE ? {} : { OR: [{ keywords: null }, { keywords: '' }] }),
    },
    orderBy: [{ type: 'asc' }, { publicationDate: 'asc' }],
    ...(LIMIT ? { take: LIMIT } : {}),
  })

  console.log(
    `${docs.length} document(s) à traiter — moteur : ${
      isAiConfigured() ? `IA (${MODEL ?? process.env.LV_AI_MODEL ?? 'claude-opus-4-8'})` : 'lexique heuristique (ANTHROPIC_API_KEY absente)'
    }${COMMIT ? '' : ' — DRY-RUN (ajoutez --commit pour écrire)'}`,
  )

  let written = 0
  let empty = 0
  let aiCount = 0
  for (const doc of docs) {
    const { keywords: list, ai } = await extractKeywords(
      { titleFr: doc.titleFr, matiere: doc.matiere, body: doc.bodyOriginal },
      MODEL ? { model: MODEL } : undefined,
    )
    if (ai) aiCount++
    const keywords = joinKeywords(list)
    if (!keywords) {
      empty++
      console.log(`  ∅ ${doc.type} | ${doc.titleFr.slice(0, 70)}`)
      continue
    }
    console.log(`  ${ai ? '✨' : '·'} ${doc.type} | ${doc.titleFr.slice(0, 60)} → ${keywords}`)
    if (COMMIT) {
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          keywords,
          searchText: buildSearchText({ ...doc, keywords }),
        },
      })
      written++
    }
  }

  console.log(
    `\nTerminé : ${docs.length} analysés, ${written} écrits${COMMIT ? '' : ' (dry-run)'}, ${empty} sans mot-clé détecté, ${aiCount} via IA.`,
  )
  if (COMMIT && process.env.SEARCH_PROVIDER === 'opensearch') {
    console.log('SEARCH_PROVIDER=opensearch : lancez `npm run search:reindex` pour propager.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
