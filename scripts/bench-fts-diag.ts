/**
 * Diagnostic : décompose le coût de la recherche FTS pour distinguer ce qui est
 *  (a) côté serveur Postgres (identique depuis Vercel) — via EXPLAIN ANALYZE,
 *  (b) transfert/scoring côté client (réduit en prod même-région).
 * Lecture seule — ne modifie pas la base.
 */
import { performance } from 'perf_hooks'
import { prisma } from '../src/lib/db'

function execTime(plan: any[]): number {
  const line = plan.map((r) => Object.values(r)[0] as string).find((s) => s.startsWith('Execution Time'))
  return line ? parseFloat(line.replace(/[^0-9.]/g, '')) : NaN
}
async function explain(label: string, sql: string) {
  const plan: any[] = await prisma.$queryRawUnsafe('EXPLAIN (ANALYZE, TIMING ON) ' + sql)
  const scan = plan.map((r) => Object.values(r)[0] as string).find((s) => /Seq Scan|Index Scan|Bitmap/.test(s)) || ''
  console.log('  ' + label.padEnd(46) + 'serveur ' + Math.round(execTime(plan)).toString().padStart(6) + ' ms   ' + scan.trim().slice(0, 60))
}
async function timed(label: string, fn: () => Promise<any>, runs = 3) {
  const ts: number[] = []
  for (let i = 0; i < runs; i++) { const t = performance.now(); await fn(); ts.push(performance.now() - t) }
  ts.sort((a, b) => a - b)
  console.log('  ' + label.padEnd(46) + 'total   ' + Math.round(ts[Math.floor(ts.length / 2)]).toString().padStart(6) + ' ms')
}

async function main() {
  console.log('\n══════════ DIAGNOSTIC FTS ══════════\n')

  console.log('① Coût SERVEUR pur (EXPLAIN ANALYZE — indépendant du réseau) :')
  await explain("LIKE '%expropriation%' (count)", `SELECT count(*) FROM "Document" WHERE "searchText" LIKE '%expropriation%'`)
  await explain("LIKE '%loi%' (count)", `SELECT count(*) FROM "Document" WHERE "searchText" LIKE '%loi%'`)
  await explain("navigation type=LOI_FINANCES (full *)", `SELECT * FROM "Document" WHERE type='LOI_FINANCES' ORDER BY "publicationDate" DESC LIMIT 20`)
  await explain("navigation type=LOI_FINANCES (projection)", `SELECT id,"titleFr","number","publicationDate" FROM "Document" WHERE type='LOI_FINANCES' ORDER BY "publicationDate" DESC LIMIT 20`)
  await explain("company searchName LIKE (count)", `SELECT count(*) FROM "Company" WHERE "searchName" LIKE '%alimentaires%'`)

  console.log('\n② Effet du TRANSFERT des gros champs (fetch réel, ma liaison) :')
  const whereLoi = { searchText: { contains: 'loi' } } as any
  await timed('fetch "loi" — lignes COMPLÈTES (body inclus), 1200', () =>
    prisma.document.findMany({ where: whereLoi, take: 1200, orderBy: { publicationDate: 'desc' } }))
  await timed('fetch "loi" — PROJECTION (sans body/searchText), 1200', () =>
    prisma.document.findMany({ where: whereLoi, take: 1200, orderBy: { publicationDate: 'desc' },
      select: { id: true, titleFr: true, titleEn: true, titleHt: true, number: true, summaryFr: true, publicationDate: true, type: true } }))

  console.log('\n③ Index existants sur Document :')
  const idx: any[] = await prisma.$queryRawUnsafe(
    `SELECT indexname, indexdef FROM pg_indexes WHERE tablename='Document'`)
  for (const i of idx) console.log('  ' + i.indexname + ' → ' + String(i.indexdef).replace(/.*USING /, 'USING '))

  console.log('\n④ pg_trgm disponible ? (extension pour indexer les LIKE) :')
  const ext: any[] = await prisma.$queryRawUnsafe(
    `SELECT name, installed_version FROM pg_available_extensions WHERE name='pg_trgm'`)
  console.log('  ', ext[0] ? `${ext[0].name} dispo=${ext[0].installed_version || 'non installée'}` : 'indisponible')

  console.log('\n════════════════════════════════════\n')
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
