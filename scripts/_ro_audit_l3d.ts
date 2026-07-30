import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
for (const k of ['DATABASE_URL','DIRECT_URL']) if (env[k]) process.env[k]=env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL
import { prisma } from '../src/lib/db'
import { fold } from '../src/lib/search/normalize'
async function main() {
  const d = await prisma.document.findUnique({ where: { id:'cms7lgd8l0000wtgzu7y3j8mt' }, select:{ searchText:true, richBlocksJson:true, bodyClean:true, bodyOriginal:true } })
  const st = d!.searchText ?? '', bo = d!.bodyOriginal ?? '', bc = d!.bodyClean ?? '', rj = d!.richBlocksJson ?? ''
  for (const probe of ['BIC','P-024','Créditeur','Ouanaminthe','Jacmel','Port-au-Prince','Notes : (1) Virtual Private Network']) {
    console.log(`  "${probe}" → searchText=${st.includes(fold(probe))} bodyOriginal=${bo.includes(probe)} bodyClean=${bc.includes(probe)} rich=${rj.includes(probe)}`)
  }
  // différence bodyOriginal / bodyClean
  const lo = bo.split('\n'), lc = bc.split('\n')
  console.log(`\nlignes bodyOriginal=${lo.length} bodyClean=${lc.length}`)
  const so = new Set(lo)
  const diffC = lc.filter(l=>!so.has(l))
  const sc = new Set(lc)
  const diffO = lo.filter(l=>!sc.has(l))
  console.log('lignes présentes SEULEMENT dans bodyClean :', diffC.length)
  for (const l of diffC.slice(0,10)) console.log('   +', l.slice(0,160))
  console.log('lignes présentes SEULEMENT dans bodyOriginal :', diffO.length)
  for (const l of diffO.slice(0,10)) console.log('   -', l.slice(0,160))
  await prisma.$disconnect()
}
main().catch(async(e)=>{console.error(e);await prisma.$disconnect();process.exit(1)})
