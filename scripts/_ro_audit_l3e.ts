import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
for (const k of ['DATABASE_URL','DIRECT_URL']) if (env[k]) process.env[k]=env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL
import { prisma } from '../src/lib/db'
async function main() {
  const d = await prisma.document.findUnique({ where: { id:'cms7lgd8l0000wtgzu7y3j8mt' }, select:{ bodyOriginal:true, bodyClean:true } })
  const lines = (d!.bodyOriginal ?? '').split('\n')
  lines.forEach((l,i)=>{ if (l.includes('WIMAX')||l.startsWith('Notes :')) console.log(i, JSON.stringify(l)) })
  await prisma.$disconnect()
}
main().catch(async(e)=>{console.error(e);await prisma.$disconnect();process.exit(1)})
