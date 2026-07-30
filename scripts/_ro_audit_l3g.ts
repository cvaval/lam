import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
for (const k of ['DATABASE_URL','DIRECT_URL']) if (env[k]) process.env[k]=env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL
import { prisma } from '../src/lib/db'
async function main() {
  const f = JSON.parse(readFileSync('scripts/brh-enrichments.json','utf8'))
  for (const s of f.supplement) {
    const d = await prisma.document.findFirst({ where: { type:'CIRCULAIRE_BRH', number: s.number },
      select: { id:true, titleFr:true, bodyOriginal:true, bodyClean:true, richBlocksJson:true, annotationsJson:true, source:true, publicationDate:true, effectiveDate:true } })
    if (!d) { console.log('ABSENT EN BASE :', s.number); continue }
    const cmp = (a:any,b:any)=> (a===b?'IDENTIQUE':`DIFFERE (json=${a==null?'null':String(a).length} base=${b==null?'null':String(b).length})`)
    console.log(`\n### ${s.number} (${d.id})`)
    console.log('  titre        :', cmp(s.title, d.titleFr))
    console.log('  bodyOriginal :', cmp(s.bodyOriginal, d.bodyOriginal))
    console.log('  bodyClean    :', cmp(s.bodyClean, d.bodyClean))
    console.log('  richBlocks   :', cmp(s.richBlocksJson, d.richBlocksJson))
    console.log('  annotations  :', cmp(s.annotationsJson, d.annotationsJson))
    console.log('  source       :', cmp(s.source, d.source))
    console.log('  date         :', s.date, '/', d.publicationDate?.toISOString().slice(0,10), ' effective:', s.effective, '/', d.effectiveDate?.toISOString().slice(0,10))
    if (s.annotationsJson) {
      const a = JSON.parse(s.annotationsJson)
      console.log('  json: pointAnchors=', (a.pointAnchors||[]).length, 'toc=', (a.toc||[]).length, 'index=', (a.indexEntries||[]).length)
    }
    if (d.annotationsJson) {
      const a = JSON.parse(d.annotationsJson)
      console.log('  base: pointAnchors=', (a.pointAnchors||[]).length, 'toc=', (a.toc||[]).length, 'index=', (a.indexEntries||[]).length)
    }
  }
  // html entries vs base
  console.log('\n=== html ===')
  for (const h of f.html) {
    const rows = await prisma.document.findMany({ where: { type:'CIRCULAIRE_BRH', number: h.number }, select:{ id:true, bodyClean:true, richBlocksJson:true } })
    console.log(h.number, 'fiches=', rows.length, rows.map(r=>`clean:${r.bodyClean===h.bodyClean?'=':'≠'} rich:${r.richBlocksJson===h.richBlocksJson?'=':'≠'}`).join(' | '))
  }
  await prisma.$disconnect()
}
main().catch(async(e)=>{console.error(e);await prisma.$disconnect();process.exit(1)})
