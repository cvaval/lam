import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
for (const k of ['DATABASE_URL','DIRECT_URL']) if (env[k]) process.env[k]=env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL
import { prisma } from '../src/lib/db'
import { parseAnnotations, segmentAnnotated } from '../src/lib/legislation/annotated'
import { parseRichBlocks, buildBodySegments, tableShortCaption } from '../src/lib/doc/richblocks'

const LEAD_ART = /^(?:art(?:icle)?s?\.?|section)\s+(?:premier|\d{1,4}(?:\s*(?:er|ère))?(?:\s*(?:bis|ter|quater))?(?:[.\-]\d+)*)\s*[.)\-–]*\s*/i
const LEAD_POINT = /^(\d{1,2}(?:\.\d{1,2})*)\s*\.?\s*-?\s+/

async function main() {
  const d = await prisma.document.findUnique({ where: { id:'cms7lgd8l0000wtgzu7y3j8mt' }, select:{ bodyOriginal:true, bodyClean:true, annotationsJson:true, richBlocksJson:true } })
  const ann = parseAnnotations(d!.annotationsJson)!
  const rich = parseRichBlocks(d!.richBlocksJson)
  const text = d!.bodyClean ?? d!.bodyOriginal!
  const pointMode = (ann.pointAnchors ?? []).length > 0
  const blocks = segmentAnnotated(text, ann.toc ?? [], ann.pointAnchors)
  console.log('pointMode =', pointMode, '| blocs =', blocks.length, '| richBlocks =', rich.length)
  let cardBlocks = 0, plainBodyBlocks = 0, sectionBlocks = 0
  let totalRichRendered = 0, totalOrphan = 0
  const perPlain: number[] = []
  for (const b of blocks as any[]) {
    if (b.kind === 'section') { sectionBlocks++; continue }
    const leadPoint = pointMode && b.anchor && !LEAD_ART.test(b.text) && LEAD_POINT.test(b.text)
    if (b.anchor && (LEAD_ART.test(b.text) || leadPoint)) { cardBlocks++; continue }
    plainBodyBlocks++
    const segs = buildBodySegments(b.text, rich)
    const nr = segs.filter(s=>s.kind==='rich').length
    const no = segs.filter((s:any)=>s.kind==='rich' && s.orphan).length
    totalRichRendered += nr; totalOrphan += no
    perPlain.push(nr)
  }
  console.log(`sections=${sectionBlocks} cartes(article)=${cardBlocks} corps-simple=${plainBodyBlocks}`)
  console.log(`TABLEAUX RENDUS AU TOTAL = ${totalRichRendered} (dont orphelins ${totalOrphan}) pour ${rich.length} tableaux réels`)
  console.log('par bloc de corps simple :', perPlain.join(','))
  // total rangées rendues
  let rows = 0
  for (const b of blocks as any[]) {
    if (b.kind === 'section') continue
    const leadPoint = pointMode && b.anchor && !LEAD_ART.test(b.text) && LEAD_POINT.test(b.text)
    if (b.anchor && (LEAD_ART.test(b.text) || leadPoint)) continue
    for (const s of buildBodySegments(b.text, rich)) if (s.kind==='rich' && (s.block as any).type==='table') rows += (s.block as any).rows.length
  }
  console.log('RANGÉES RENDUES =', rows, '| rangées réelles =', rich.filter((b:any)=>b.type==='table').reduce((a:number,b:any)=>a+b.rows.length,0))
  await prisma.$disconnect()
}
main().catch(async(e)=>{console.error(e);await prisma.$disconnect();process.exit(1)})
