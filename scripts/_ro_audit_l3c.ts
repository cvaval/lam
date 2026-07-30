import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
for (const k of ['DATABASE_URL','DIRECT_URL']) if (env[k]) process.env[k]=env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL
import { prisma } from '../src/lib/db'
async function main() {
  // ce que renverrait findFirst pour chaque abrogatedByNumber présent
  const abrog = await prisma.document.findMany({ where: { type:'CIRCULAIRE_BRH', status:'ABROGE' }, select:{ id:true, number:true, abrogatedByNumber:true } })
  for (const d of abrog) {
    const target = await prisma.document.findFirst({ where: { type:'CIRCULAIRE_BRH', number: d.abrogatedByNumber! }, select:{ id:true, number:true, titleFr:true } })
    const all = await prisma.document.count({ where: { type:'CIRCULAIRE_BRH', number: d.abrogatedByNumber! } })
    if (all > 1) console.log(`AMBIGU ${d.number} → ${d.abrogatedByNumber} : ${all} fiches, findFirst = "${target?.titleFr}" (${target?.id})`)
  }
  console.log('\n--- searchText de 105-2 : présence du contenu des TABLEAUX ---')
  const d = await prisma.document.findUnique({ where: { id:'cms7lgd8l0000wtgzu7y3j8mt' }, select:{ searchText:true, richBlocksJson:true, bodyClean:true, annotationsJson:true } })
  const st = d!.searchText ?? ''
  for (const probe of ['BIC','bic','Jacmel','Ouanaminthe','P-024','Créditeur','codes postaux']) {
    console.log(`  "${probe}" dans searchText = ${st.includes(probe)} | dans bodyClean = ${(d!.bodyClean??'').includes(probe)} | dans rich = ${(d!.richBlocksJson??'').includes(probe)}`)
  }
  await prisma.$disconnect()
}
main().catch(async(e)=>{console.error(e);await prisma.$disconnect();process.exit(1)})
