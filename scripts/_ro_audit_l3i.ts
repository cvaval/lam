import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
for (const k of ['DATABASE_URL','DIRECT_URL']) if (env[k]) process.env[k]=env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL
import { prisma } from '../src/lib/db'
async function main() {
  for (const id of ['cmqbnm0ed001dsmfzjn2r5y8q','cmqbnm0ef001esmfzx82dettd']) {
    const d = await prisma.document.findUnique({ where: { id }, select:{ number:true, titleFr:true, status:true, abrogatedByNumber:true } })
    console.log(id, '=>', d?.number, d?.status, d?.abrogatedByNumber, '|', d?.titleFr?.slice(0,60))
  }
  // tous les docId cités dans les connexe des 2 circulaires : pointent-ils vers un texte abrogé ?
  for (const [n,id] of [['105-2','cms7lgd8l0000wtgzu7y3j8mt'],['117-1','cms7lggvs0001wtgzvw937xyt']] as const) {
    const d = await prisma.document.findUnique({ where:{id}, select:{annotationsJson:true} })
    const a = JSON.parse(d!.annotationsJson!)
    const ids = new Set<string>()
    for (const arr of Object.values(a.connexe ?? {}) as any[]) for (const b of arr) if (b.docId) ids.add(b.docId)
    for (const c of (a.crossRefs ?? []) as any[]) for (const dd of c.docs ?? []) if (dd.id) ids.add(dd.id)
    console.log(`\n${n} : ${ids.size} renvois vers d'autres documents`)
    for (const x of ids) {
      const t = await prisma.document.findUnique({ where:{id:x}, select:{number:true,status:true,abrogatedByNumber:true} })
      console.log('   ', x, '→', t ? `${t.number} [${t.status}${t.status==='ABROGE'?' ← '+t.abrogatedByNumber:''}]` : 'INTROUVABLE')
    }
  }
  await prisma.$disconnect()
}
main().catch(async(e)=>{console.error(e);await prisma.$disconnect();process.exit(1)})
