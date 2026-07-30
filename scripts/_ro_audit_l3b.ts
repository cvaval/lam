import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
for (const k of ['DATABASE_URL','DIRECT_URL']) if (env[k]) process.env[k]=env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL
import { prisma } from '../src/lib/db'
async function main() {
  const dups = ['Circulaire n° 114-3','Circulaire n° 116','Circulaire n° 118-1','Circulaire n° 88-1','Circulaire n° 89-2','Circulaire n° 87','Circulaire n° 87-1']
  const docs = await prisma.document.findMany({ where: { type: 'CIRCULAIRE_BRH', number: { in: dups } },
    select: { id:true, number:true, titleFr:true, status:true, abrogatedByNumber:true, publicationDate:true, effectiveDate:true, source:true, sealed:true, matiere:true } })
  for (const d of docs) console.log(`${d.number?.padEnd(24)} | ${d.status.padEnd(10)} | ${String(d.publicationDate?.toISOString().slice(0,10))} | eff=${String(d.effectiveDate?.toISOString().slice(0,10))} | src=${d.source} | sealed=${d.sealed} | ${d.titleFr.slice(0,70)}`)
  // les 2 circulaires annotées
  console.log('\n--- 105-2 / 117-1 ---')
  const two = await prisma.document.findMany({ where: { id: { in: ['cms7lgd8l0000wtgzu7y3j8mt','cms7lggvs0001wtgzvw937xyt'] } },
    select: { id:true,number:true,titleFr:true,status:true,abrogatedByNumber:true,publicationDate:true,effectiveDate:true,source:true,sealed:true,matiere:true,sourcePdfUrl:true,
      bodyOriginal:true, bodyClean:true, richBlocksJson:true, annotationsJson:true, searchText:true, type:true, juridiction:true, updatedAt:true } })
  for (const d of two) {
    console.log(`\n${d.number} id=${d.id}`)
    console.log(`  status=${d.status} abrogBy=${d.abrogatedByNumber} pub=${d.publicationDate?.toISOString().slice(0,10)} eff=${d.effectiveDate?.toISOString().slice(0,10)}`)
    console.log(`  source=${d.source} sealed=${d.sealed} matiere=${d.matiere} jur=${d.juridiction} pdf=${d.sourcePdfUrl}`)
    console.log(`  bodyOriginal=${d.bodyOriginal?.length ?? 'null'} bodyClean=${d.bodyClean?.length ?? 'null'} rich=${d.richBlocksJson?.length ?? 'null'} annot=${d.annotationsJson?.length ?? 'null'} searchText=${d.searchText?.length ?? 'null'}`)
    if (d.searchText) console.log(`  searchText contient "gouvernance"=${/gouvernance/i.test(d.searchText)} "BIC"=${/BIC/.test(d.searchText)}`)
  }
  await prisma.$disconnect()
}
main().catch(async(e)=>{console.error(e);await prisma.$disconnect();process.exit(1)})
