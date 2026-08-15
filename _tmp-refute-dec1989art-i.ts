import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main(){
  const v:any[]=await p.document.findMany({where:{source:{startsWith:'CC_VANDAL_II'}},select:{source:true,bodyOriginal:true},orderBy:{source:'asc'}})
  for(const d of v){
    const b=(d.bodyOriginal||'').trim()
    const tail=b.slice(-220).replace(/\s+/g,' ')
    const hasClause=/abroge toutes|sera publi|à la diligence/i.test(b)
    console.log(d.source,'| clauseFinale:',hasClause,'| tail:',tail)
  }
  await p.$disconnect()
}
main().catch(async e=>{console.error(e); await p.$disconnect(); process.exit(1)})
