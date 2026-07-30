import { readFileSync, writeFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
for (const k of ['DATABASE_URL','DIRECT_URL']) if (env[k]) process.env[k]=env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL=env.DIRECT_URL
import { prisma } from '../src/lib/db'
async function main(){
  const ids=['cms7lgd8l0000wtgzu7y3j8mt','cms7lggvs0001wtgzvw937xyt']
  for(const id of ids){
    const d=await prisma.document.findUnique({where:{id},select:{number:true,status:true,abrogatedByNumber:true,annotationsJson:true}})
    writeFileSync(process.env.OUTDIR+'/ann_'+(d?.number||id).replace(/\W+/g,'_')+'.json', typeof d?.annotationsJson==='string'?d!.annotationsJson as string:JSON.stringify(d?.annotationsJson,null,1))
    console.log(d?.number, d?.status, d?.abrogatedByNumber, typeof d?.annotationsJson, (typeof d?.annotationsJson==='string'? (d!.annotationsJson as string).length : JSON.stringify(d?.annotationsJson).length))
  }
  await prisma.$disconnect()
}
main().catch(async e=>{console.error(e);await prisma.$disconnect();process.exit(1)})
