/**
 * Benchmark du moteur de recherche intégré (FtsProvider) contre la base Supabase de
 * production. Mesure : RTT réseau, profil des données, construction du vocabulaire fuzzy
 * à froid (temps + mémoire), et latence médiane par type de requête.
 *
 * ⚠️ Exécuté depuis la machine locale → la latence réseau vers Supabase (us-east-1) est
 * PLUS ÉLEVÉE que depuis Vercel (même région). Les chiffres « réseau/transfert » sont
 * donc PESSIMISTES vs la production ; les chiffres « CPU » (vocab, scoring) sont
 * comparables (voire la prod serverless est un peu plus lente par vCPU).
 */
import { performance } from 'perf_hooks'
import { prisma } from '../src/lib/db'
import { FtsProvider } from '../src/lib/search/fts'
import { fuzzyExpand, resetVocab } from '../src/lib/search/fuzzy'
import type { Locale } from '../src/lib/types'

const provider = new FtsProvider()
const LOCALE: Locale = 'fr'
const mb = (b: number) => (b / 1024 / 1024).toFixed(0) + ' Mo'

function memSnap() {
  const m = process.memoryUsage()
  return { rss: m.rss, heap: m.heapUsed }
}

async function timed(label: string, fn: () => Promise<any>, runs = 3) {
  const ts: number[] = []
  let res: any
  for (let i = 0; i < runs; i++) {
    const t = performance.now()
    res = await fn()
    ts.push(performance.now() - t)
  }
  ts.sort((a, b) => a - b)
  const med = ts[Math.floor(ts.length / 2)]
  const total = res && typeof res.total === 'number' ? `  (${res.total} résultats)` : ''
  console.log(
    '  ' + label.padEnd(42) + 'médiane ' + Math.round(med).toString().padStart(6) + ' ms' +
    '   [' + ts.map((t) => Math.round(t)).join(' / ') + ']' + total,
  )
  return res
}

async function main() {
  console.log('\n══════════ BENCHMARK RECHERCHE FTS — Supabase (prod) ══════════\n')

  // ── 0) RTT réseau ──
  console.log('① Latence réseau vers Supabase (SELECT 1) :')
  await timed('aller-retour minimal', () => prisma.$queryRawUnsafe('SELECT 1'), 5)

  // ── 1) Profil des données ──
  console.log('\n② Profil des données :')
  const [docs, cos, pubs] = await Promise.all([
    prisma.document.count(),
    prisma.company.count(),
    prisma.companyPublication.count(),
  ])
  console.log(`  documents=${docs}  sociétés=${cos}  publications-sociétés=${pubs}`)
  const sz: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      round(avg(length("searchText")))::int                                            AS st_avg,
      max(length("searchText"))                                                        AS st_max,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY length("searchText"))::int          AS st_p95,
      round(avg(length("bodyOriginal")))::int                                          AS bo_avg,
      max(length("bodyOriginal"))                                                      AS bo_max,
      round(sum(length("searchText"))/1048576.0)::int                                  AS st_total_mb,
      count(*) FILTER (WHERE length("bodyOriginal") > 50000)                           AS heavy_bodies
    FROM "Document"`)
  const s = sz[0]
  console.log(`  searchText : moy ${s.st_avg} car. · p95 ${s.st_p95} · max ${s.st_max} car. · total ≈ ${s.st_total_mb} Mo`)
  console.log(`  bodyOriginal : moy ${s.bo_avg} car. · max ${s.bo_max} · documents « lourds » (>50k) : ${s.heavy_bodies}`)

  // termes réels pour des requêtes représentatives
  const topCos: any[] = await prisma.$queryRawUnsafe(
    `SELECT name FROM "Company" ORDER BY length(name) DESC LIMIT 3 OFFSET 50`,
  )
  const realCo = (topCos[0]?.name as string) || 'société agricole'
  console.log(`  société test : « ${realCo} »`)

  // ── 2) Construction du vocabulaire fuzzy À FROID (1er search après lambda froide) ──
  console.log('\n③ Construction du vocabulaire fuzzy (démarrage à froid) :')
  resetVocab()
  const before = memSnap()
  const tc = performance.now()
  const expanded = await fuzzyExpand('konesans') // 1er appel = lecture corpus + build + 1 expand
  const buildMs = performance.now() - tc
  const after = memSnap()
  console.log(`  build + 1er expand : ${Math.round(buildMs)} ms`)
  console.log(`  mémoire : heap +${mb(after.heap - before.heap)}  (rss ${mb(after.rss)})`)
  console.log(`  exemple d'expansion « konesans » → [${expanded.join(', ') || '∅'}]`)
  await timed('expand fuzzy (vocab chaud)', () => fuzzyExpand('expropriaton'), 3)

  // ── 3) Latence par type de requête (vocab chaud) ──
  console.log('\n④ Latence des recherches (vocabulaire chaud, médiane sur 3) :')
  await timed("navigation (filtre type=LOI_FINANCES, sans texte)", () =>
    provider.search({ q: '', types: ['LOI_FINANCES'] as any, locale: LOCALE, page: 1, size: 20 } as any))
  await timed('mot courant « loi »', () =>
    provider.search({ q: 'loi', locale: LOCALE, page: 1, size: 20 } as any))
  await timed('mot spécifique « expropriation »', () =>
    provider.search({ q: 'expropriation', locale: LOCALE, page: 1, size: 20 } as any))
  await timed('société (nom réel, multi-mots)', () =>
    provider.search({ q: realCo, locale: LOCALE, page: 1, size: 20 } as any))
  await timed("phrase « déclaration d'utilité publique »", () =>
    provider.search({ q: "déclaration d'utilité publique", locale: LOCALE, page: 1, size: 20 } as any))
  await timed('faute de frappe « expropriaton » (→ fuzzy)', () =>
    provider.search({ q: 'expropriaton', locale: LOCALE, page: 1, size: 20 } as any))

  // ── 4) Pire cas : 1ère recherche après lambda froide (vocab reconstruit) ──
  console.log('\n⑤ Pire cas — 1ère recherche après démarrage à froid (vocab reconstruit) :')
  resetVocab()
  await timed('recherche à froid « expropriation »', () =>
    provider.search({ q: 'expropriation', locale: LOCALE, page: 1, size: 20 } as any), 1)

  console.log('\n═══════════════════════════════════════════════════════════════\n')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
