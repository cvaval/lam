/**
 * RAEJH — RÉINDEXER LES ARRÊTS DU RÉPERTOIRE (FTS seul), à plusieurs de front.
 *
 *     SEARCH_PROVIDER=fts npx tsx scripts/reindexer-raejh.ts
 *
 * ⚠️ POURQUOI CE SCRIPT EXISTE. `verser-raejh.ts --apply` réindexe ses 1 282 arrêts un par un
 * avec `reindexDocument()`, qui pousse AUSSI dans OpenSearch quand `SEARCH_PROVIDER=opensearch`
 * — la valeur du `.env` LOCAL, pour le miroir de dev. Avec `refresh: true` à chaque appel,
 * l'OpenSearch local s'est effondré : 1,2 s/document au départ, 25 s/document après 400.
 * La production est en FTS ; le miroir local n'a rien à y voir. On force `fts` et on
 * parallélise — les réindexations sont indépendantes (4 de front, loin des 60 connexions).
 *
 * Idempotent : ne réindexe que ce qui n'a pas encore de `searchText` (arrêts créés) et les
 * arrêts existants rattachés à une notion (leurs `themeLabels` ont changé).
 */
import { PrismaClient } from '@prisma/client'
import { reindexDocument } from '../src/lib/search/reindex'
const prisma = new PrismaClient()
async function main() {
  if (process.env.SEARCH_PROVIDER === 'opensearch') { console.error('⛔ SEARCH_PROVIDER=opensearch — lancer avec SEARCH_PROVIDER=fts'); process.exit(1) }
  const crees = await prisma.document.findMany({ where: { source: 'RAEJH_SALES', OR: [{ searchText: null }, { searchText: '' }] }, select: { id: true } })
  const rattaches = await prisma.$queryRaw<{ id: string }[]>`SELECT DISTINCT d.id FROM "Document" d JOIN "JurisExtrait" e ON e."decisionId" = d.id WHERE d.source <> 'RAEJH_SALES'`
  const ids = [...new Set([...crees.map((d) => d.id), ...rattaches.map((d) => d.id)])]
  console.log(`à réindexer : ${crees.length} créés sans searchText + ${rattaches.length} existants rattachés = ${ids.length}`)
  let i = 0
  const t0 = Date.now()
  const worker = async () => { while (i < ids.length) { const id = ids[i++]; await reindexDocument(id); if (i % 100 === 0) console.log(`  ${i}/${ids.length} · ${((Date.now() - t0) / 1000).toFixed(0)} s`) } }
  await Promise.all([worker(), worker(), worker(), worker()])
  const reste = await prisma.document.count({ where: { source: 'RAEJH_SALES', OR: [{ searchText: null }, { searchText: '' }] } })
  console.log(`✅ ${ids.length} réindexés en ${((Date.now() - t0) / 1000).toFixed(0)} s · reste sans searchText : ${reste}`)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
