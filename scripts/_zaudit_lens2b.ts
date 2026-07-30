/** AUDIT LECTURE SEULE — lentille 2 (suite). Jetable. */
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
  }),
)
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL

import { prisma } from '../src/lib/db'
import { parseAnnotations, segmentAnnotated } from '../src/lib/legislation/annotated'
import { parseRichBlocks, buildBodySegments } from '../src/lib/doc/richblocks'

async function main() {
  // ── 1. Corpus : quels documents ANNOTÉS ont des richBlocks ? (régression `rich`) ──
  const docs = await prisma.document.findMany({
    where: { NOT: { richBlocksJson: null } },
    select: { id: true, source: true, number: true, titleFr: true, richBlocksJson: true, annotationsJson: true, bodyClean: true, bodyOriginal: true },
  })
  console.log(`\n### Documents avec richBlocksJson : ${docs.length}`)
  let maxTable = { rows: 0, doc: '', cap: '' }
  let over80 = 0, over400 = 0, totalTables = 0
  const annotatedWithRich: any[] = []
  for (const d of docs) {
    const raw = (() => { try { const j = JSON.parse(d.richBlocksJson!); return Array.isArray(j) ? j : j.blocks ?? [] } catch { return [] } })()
    for (const b of raw) {
      if (b?.type !== 'table') continue
      totalTables++
      const n = b.rows?.length ?? 0
      if (n > 80) over80++
      if (n > 400) over400++
      if (n > maxTable.rows) maxTable = { rows: n, doc: `${d.source} ${d.number ?? ''}`, cap: b.caption ?? '' }
    }
    const ann = parseAnnotations(d.annotationsJson)
    if (ann) annotatedWithRich.push({ id: d.id, source: d.source, number: d.number, ann, d })
  }
  console.log(`tableaux total ${totalTables} | >80 rangées : ${over80} | >400 rangées : ${over400}`)
  console.log('plus gros tableau du corpus :', maxTable)
  console.log(`\n### Documents ANNOTÉS (lecteur AnnotatedText) AVEC richBlocks : ${annotatedWithRich.length}`)
  for (const a of annotatedWithRich) {
    const body = a.d.bodyClean ?? a.d.bodyOriginal
    const rich = parseRichBlocks(a.d.richBlocksJson)
    const blocks = segmentAnnotated(body, a.ann.toc ?? [], a.ann.pointAnchors)
    const LEAD_ART = /^(?:art(?:icle)?s?\.?|section)\s+(?:premier|\d{1,4}(?:\s*(?:er|ère))?(?:\s*(?:bis|ter|quater))?(?:[.\-]\d+)*)\s*[.)\-–]*\s*/i
    const LEAD_POINT = /^(\d{1,2}(?:\.\d{1,2})*)\s*\.?\s*-?\s+/
    const pointMode = (a.ann.pointAnchors ?? []).length > 0
    let textBlocks = 0
    for (const b of blocks) {
      if (b.kind !== 'body') continue
      const leadPoint = pointMode && b.anchor && !LEAD_ART.test(b.text) && LEAD_POINT.test(b.text)
      if (b.anchor && (LEAD_ART.test(b.text) || leadPoint)) continue
      textBlocks++
    }
    const rendered = textBlocks * rich.length
    let cells = 0
    for (const b of rich) if (b.type === 'table') for (const r of b.rows) cells += r.length
    console.log(`  ${a.source} (${a.number ?? '-'}) : ${rich.length} blocs rich × ${textBlocks} blocs texte = ${rendered} rendus ; cellules réelles ${cells} → rendues ${cells * textBlocks}`)
  }

  // ── 2. Renvois internes des deux circulaires ──
  const { ART_OR_SEC_REF_RE, ART_NUM_RE, ART_EXT_AFTER, ART_EXT_BEFORE } = await import('../src/lib/doc/artrefs')
  const { articleAnchorFromNum } = await import('../src/lib/doc/anchors')
  for (const [name, id] of Object.entries({ '105-2': 'cms7lgd8l0000wtgzu7y3j8mt', '117-1': 'cms7lggvs0001wtgzvw937xyt' })) {
    const doc = await prisma.document.findUnique({ where: { id } })!
    const ann = parseAnnotations(doc!.annotationsJson)!
    const body = doc!.bodyClean ?? doc!.bodyOriginal
    const artRefs = new Set(Object.keys(ann.labels ?? {}))
    console.log(`\n### ${name} — renvois internes (artRefs = ${artRefs.size} ancres)`)
    console.log('   ancres labels:', [...artRefs].join(' '))
    const found: string[] = []
    const dead: string[] = []
    ART_OR_SEC_REF_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = ART_OR_SEC_REF_RE.exec(body))) {
      if (ART_EXT_AFTER.test(body.slice(m.index + m[0].length))) continue
      if (ART_EXT_BEFORE.test(body.slice(Math.max(0, m.index - 100), m.index))) continue
      for (const p of m[0].split(ART_NUM_RE)) {
        if (!/^\d/.test(p)) continue
        const anchor = articleAnchorFromNum(p.trim())
        if (artRefs.has(anchor)) found.push(`${m[0].trim()} → #${anchor}`)
        else dead.push(`${m[0].trim()} (${anchor}) NON LIÉ`)
      }
    }
    console.log(`   liés: ${found.length} | non liés: ${dead.length}`)
    console.log('   liés   :', [...new Set(found)].slice(0, 25).join(' | '))
    console.log('   non liés:', [...new Set(dead)].slice(0, 25).join(' | '))
    // Ancres réellement émises par segmentAnnotated
    const emitted = new Set(segmentAnnotated(body, ann.toc, ann.pointAnchors).filter((b) => b.kind === 'body' && (b as any).anchor && !(b as any).noAnchors).map((b: any) => b.anchor))
    const missing = [...artRefs].filter((a) => !emitted.has(a))
    console.log('   ancres déclarées SANS cible émise (liens morts):', missing.join(' ') || 'aucune')
  }
  await prisma.$disconnect()
}
main()
