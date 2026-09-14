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
  // `--tout` : tous les arrêts du recueil ET tout document portant une notion (arrêts
  // existants rattachés, textes de loi liés) — après un changement de présentation ou de
  // liaisons. Sinon : seulement ce qui n'a pas encore de searchText.
  const tout = process.argv.includes('--tout')
  const crees = await prisma.document.findMany({ where: tout ? { source: 'RAEJH_SALES' } : { source: 'RAEJH_SALES', OR: [{ searchText: null }, { searchText: '' }] }, select: { id: true } })
  const rattaches = await prisma.$queryRaw<{ id: string }[]>`SELECT DISTINCT dt."documentId" AS id FROM "DocumentTheme" dt JOIN "Theme" t ON t.id = dt."themeId" JOIN "Document" d ON d.id = dt."documentId" WHERE t.slug LIKE 'jfs-%' AND d.source <> 'RAEJH_SALES'`
  const ids = [...new Set([...crees.map((d) => d.id), ...rattaches.map((d) => d.id)])]
  console.log(`à réindexer : ${crees.length} du recueil + ${rattaches.length} documents à notion = ${ids.length}`)
  let i = 0
  const t0 = Date.now()
  /**
   * ⚠️ UN SEUL FIL. L'URL du pooler porte `connection_limit=1` : quatre fils de front se
   * disputent une connexion, et une réindexation lourde (Code civil, 690 Ko) la garde plus
   * de 10 s — P2024, pool timeout, arrêt à 200. Le parallélisme n'était qu'une illusion.
   */
  const worker = async () => { while (i < ids.length) { const id = ids[i++]; await reindexDocument(id); if (i % 100 === 0) console.log(`  ${i}/${ids.length} · ${((Date.now() - t0) / 1000).toFixed(0)} s`) } }
  await worker()
  const reste = await prisma.document.count({ where: { source: 'RAEJH_SALES', OR: [{ searchText: null }, { searchText: '' }] } })
  console.log(`✅ ${ids.length} réindexés en ${((Date.now() - t0) / 1000).toFixed(0)} s · reste sans searchText : ${reste}`)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
