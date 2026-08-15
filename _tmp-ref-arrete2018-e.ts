import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const ALL = `(coalesce("bodyOriginal",'')||' '||coalesce("bodyClean",'')||' '||coalesce("searchText",'')||' '||coalesce("titleFr",'')||' '||coalesce("titleEn",'')||' '||coalesce("titleHt",'')||' '||coalesce("summaryFr",'')||' '||coalesce("keywords",'')||' '||coalesce("metaJson",'')||' '||coalesce("richBlocksJson",'')||' '||coalesce("annotationsJson",'')||' '||coalesce("sommaireOcr",'')||' '||coalesce("themeIndexJson",'')||' '||coalesce("number",'')||' '||coalesce("moniteurRef",'')||' '||coalesce("recueilRef",''))`
async function q(label:string, pred:string){
  const sql = `select id,type,source,number,left(coalesce("titleFr",''),120) t, length(coalesce("bodyOriginal",'')) blen from "Document" where ${pred}`
  const r:any[] = await (p as any).$queryRawUnsafe(sql)
  console.log(`\n### ${label} -> ${r.length}`)
  for(const d of r.slice(0,50)) console.log(Object.values(d).map(v=>typeof v==='string'? v.slice(0,150):v).join(' | '))
}
async function main(){
  await q("ALL ~ 'afficher les prix'", `${ALL} ilike '%afficher les prix%'`)
  await q("ALL ~ 'monnaie nationale' AND ~'prix'", `${ALL} ilike '%monnaie nationale%' and ${ALL} ilike '%prix%'`)
  await q("ALL ~ 'libell%' and '%2018%' and 'prix'", `${ALL} ilike '%libell%' and ${ALL} ilike '%2018%' and ${ALL} ilike '%afficher%'`)
  await q("ALL ~ 'arrêté%19 septembre%'", `${ALL} ilike '%19 septembre%2018%' or ${ALL} ilike '%19 sept. 2018%' or ${ALL} ilike '%19/09/2018%' or ${ALL} ilike '%2018-09-19%'`)
  await q("source like MONITEUR_PDF_2018", `source ilike '%2018%'`)
  await q("number ilike LM2018%  non-INDEX", `type<>'INDEX' and (coalesce(number,'')||coalesce("moniteurRef",'')) ilike '%2018%'`)
  await p.$disconnect()
}
main().catch(async e=>{console.error(e); await p.$disconnect(); process.exit(1)})
