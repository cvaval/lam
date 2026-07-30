import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
for (const k of ['DATABASE_URL','DIRECT_URL']) if (env[k]) process.env[k]=env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL=env.DIRECT_URL
import { prisma } from '../src/lib/db'
async function main(){
  const abr = await prisma.document.findMany({ where:{ type:'CIRCULAIRE_BRH', status:'ABROGE' }, select:{ id:true, number:true, titleFr:true, abrogatedByNumber:true }, orderBy:{number:'asc'} })
  for(const d of abr){
    const all = await prisma.document.findMany({ where:{ type:'CIRCULAIRE_BRH', number: d.abrogatedByNumber! }, select:{id:true,titleFr:true,publicationDate:true} })
    const first = await prisma.document.findFirst({ where:{ type:'CIRCULAIRE_BRH', number: d.abrogatedByNumber! }, select:{id:true,titleFr:true} })
    console.log(`${(d.number||'').padEnd(26)} -> ${(d.abrogatedByNumber||'').padEnd(24)} candidats=${all.length}  findFirst="${first?.titleFr?.slice(0,58)}"`)
    if(all.length>1) for(const a of all) console.log(`      · ${a.titleFr?.slice(0,70)}  (${a.publicationDate?.toISOString().slice(0,10)})`)
  }
  await prisma.$disconnect()
}
main().catch(async e=>{console.error(e);await prisma.$disconnect();process.exit(1)})
