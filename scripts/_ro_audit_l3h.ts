import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
for (const k of ['DATABASE_URL','DIRECT_URL']) if (env[k]) process.env[k]=env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL
import { prisma } from '../src/lib/db'
async function main() {
  const f = JSON.parse(readFileSync('scripts/brh-enrichments.json','utf8'))
  const s = f.supplement.find((x:any)=>x.number==='Circulaire n° 117-1')
  const d = await prisma.document.findUnique({ where: { id:'cms7lggvs0001wtgzvw937xyt' }, select:{ annotationsJson:true } })
  const A = JSON.parse(s.annotationsJson), B = JSON.parse(d!.annotationsJson!)
  const keys = new Set([...Object.keys(A), ...Object.keys(B)])
  for (const k of keys) {
    const a = JSON.stringify(A[k]), b = JSON.stringify(B[k])
    if (a !== b) {
      console.log(`CLÉ « ${k} » DIFFÈRE  json=${a?.length ?? 'absent'} base=${b?.length ?? 'absent'}`)
      if (typeof A[k]==='object' && A[k] && !Array.isArray(A[k])) {
        for (const kk of new Set([...Object.keys(A[k]??{}), ...Object.keys(B[k]??{})])) {
          const x=JSON.stringify(A[k]?.[kk]), y=JSON.stringify(B[k]?.[kk])
          if (x!==y) console.log(`   ↳ ${kk}:\n      json = ${x}\n      base = ${y}`)
        }
      }
    }
  }
  // html bodyClean divergence
  console.log('\n=== html : ampleur de la divergence ===')
  for (const h of f.html) {
    const r = await prisma.document.findFirst({ where: { type:'CIRCULAIRE_BRH', number: h.number }, select:{ bodyClean:true, richBlocksJson:true } })
    const a=(h.bodyClean??''), b=(r?.bodyClean??'')
    console.log(`${h.number}: json bodyClean=${a.length} base=${b.length}  rich json=${(h.richBlocksJson??'').length} base=${(r?.richBlocksJson??'').length}`)
    if (a!==b) { let i=0; while(i<Math.min(a.length,b.length)&&a[i]===b[i]) i++; console.log(`   1re divergence à ${i} :\n      json…${JSON.stringify(a.slice(i-60,i+90))}\n      base…${JSON.stringify(b.slice(i-60,i+90))}`) }
  }
  await prisma.$disconnect()
}
main().catch(async(e)=>{console.error(e);await prisma.$disconnect();process.exit(1)})
