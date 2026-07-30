/** AUDIT LECTURE SEULE — lentille 2 (c). Jetable. */
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
  }),
)
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL

import { prisma } from '../src/lib/db'
import { getCodeArticles, matchArticles } from '../src/lib/legislation/code-search'
import { parseCirculaireRef } from '../src/lib/brh/gaps'
import { scanRefs } from '../src/lib/doc/crossref'
import { parseRichBlocks } from '../src/lib/doc/richblocks'

const IDS = { '105-2': 'cms7lgd8l0000wtgzu7y3j8mt', '117-1': 'cms7lggvs0001wtgzvw937xyt' }

async function main() {
  // ── Recherche du menu latéral ──
  for (const [name, id] of Object.entries(IDS)) {
    const arts = await getCodeArticles(id)
    console.log(`\n### ${name} — code-search : ${arts.length} articles segmentés`)
    console.log('   ', arts.map((a) => `${a.anchor}="${a.label}"`).join(' | '))
    for (const q of ['amende', 'BIC', 'gouvernance', 'sanction', 'délai', 'confidentialité']) {
      const hits = matchArticles(arts, [q], null, null, 40, q)
      console.log(`   « ${q} » → ${hits.length} : ${hits.map((h) => h.label).join(', ')}`)
    }
    // Doublons de libellé (n dérivé de art-(\d+) — art-9-1..9-5 → n=9)
    const byN = new Map<number, string[]>()
    for (const a of arts) byN.set(a.n, [...(byN.get(a.n) ?? []), a.anchor])
    console.log('   numéros partagés par plusieurs ancres:', [...byN].filter(([, v]) => v.length > 1).map(([n, v]) => `${n}:{${v.join(',')}}`).join(' ') || 'aucun')
  }

  // ── hrefFor : renvois vers d'autres circulaires ──
  const refDocs = await prisma.document.findMany({ where: { type: 'CIRCULAIRE_BRH' }, select: { id: true, number: true, status: true } })
  const refIndex: Record<string, { id: string; number: string | null; status: string }> = {}
  for (const r of refDocs) {
    const p = parseCirculaireRef(r.number)
    if (p) refIndex[`${p.serie}|${p.base}|${p.rev ?? 0}`] = { id: r.id, number: r.number, status: r.status }
  }
  for (const [name, id] of Object.entries(IDS)) {
    const doc = await prisma.document.findUnique({ where: { id } })
    const body = doc!.bodyClean ?? doc!.bodyOriginal
    const hits = scanRefs(body)
    console.log(`\n### ${name} — renvois croisés détectés : ${hits.length}`)
    const seen = new Set<string>()
    for (const h of hits) {
      const key = `${h.ref.serie}|${h.ref.base}|${h.ref.rev ?? 0}|${h.ref.article ?? ''}|${h.ref.present}`
      if (seen.has(key)) continue
      seen.add(key)
      const txt = body.slice(h.start, h.end).replace(/\s+/g, ' ')
      const target = h.ref.present ? { id, number: name, status: 'self' } : refIndex[`${h.ref.serie}|${h.ref.base}|${h.ref.rev ?? 0}`]
      console.log(`   « ${txt} » → ${target ? `${target.number} [${target.status}]${h.ref.article ? ` #art-${h.ref.article}` : ''}` : 'AUCUNE CIBLE (texte mort)'}`)
    }
  }

  // ── Corpus : documents ayant des tableaux >80 rangées (effet MAX_ROWS 80→400) ──
  const docs = await prisma.document.findMany({ where: { NOT: { richBlocksJson: null } }, select: { id: true, number: true, source: true, titleFr: true, richBlocksJson: true } })
  console.log('\n### Effet du passage MAX_ROWS 80 → 400 sur les AUTRES documents')
  for (const d of docs) {
    const before = parseRichBlocksWith(d.richBlocksJson!, 80)
    const after = parseRichBlocks(d.richBlocksJson)
    let rb = 0, ra = 0, cb = 0, ca = 0
    for (const b of before) if (b.type === 'table') { rb += b.rows.length; for (const r of b.rows) cb += r.length }
    for (const b of after) if (b.type === 'table') { ra += b.rows.length; for (const r of b.rows) ca += r.length }
    if (ra !== rb) console.log(`   ${d.source} ${d.number ?? ''} : ${rb} → ${ra} rangées (+${ra - rb}), cellules ${cb} → ${ca}`)
  }
  await prisma.$disconnect()
}
// re-implémente la sanitisation avec un plafond paramétrable pour mesurer l'avant/après
function parseRichBlocksWith(json: string, maxRows: number) {
  const data = JSON.parse(json)
  const arr: any[] = Array.isArray(data) ? data : data?.blocks ?? []
  return arr.filter((b) => b?.type === 'table').map((b) => ({ type: 'table' as const, rows: (b.rows ?? []).slice(0, maxRows).map((r: any) => (Array.isArray(r) ? r : r?.cells ?? []).slice(0, 24)) }))
}
main()
