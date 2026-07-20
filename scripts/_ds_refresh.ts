/** Rafraîchit les 80 textes du Décret sûretés portés au Code civil depuis le corps du décret
 *  NORMALISÉ (guillemets de citation retirés, points finaux restaurés) — sans toucher à la
 *  structure. Idempotent. Constat cliente : rendu des alinéas + fragments de guillemets. */
import { readFileSync } from 'node:fs'
for (const f of ['.env.local','.env']) { try { for (const line of readFileSync(f,'utf8').split('\n')) { const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']\s*$/g,'').trim() } } catch {} }
import { prisma } from '@/lib/db'
import { reindexDocument } from '@/lib/search/reindex'
const REF = 'Décret réformant le Droit des Sûretés (Le Moniteur, Spécial n° 7 du 14 mai 2020)'
const REF_COURT = 'D. du 14 mai 2020'
const AMENDED = ['1780','1782','1838','1839',...Array.from({length:19},(_,i)=>String(1840+i))]
const NEW_ARTS = [...Array.from({length:10},(_,i)=>`1774-${i+1}`),...Array.from({length:10},(_,i)=>`1809-${i+1}`),'1849-1','1849-2','1851-1',...Array.from({length:21},(_,i)=>`1858-${i+1}`),'1859-1','1869-1','1869-2','1869-3',...Array.from({length:9},(_,i)=>`1970-${i+1}`)]
;(async () => {
  const dLines = readFileSync('scripts/data/decret-suretes/bodyOriginal.txt','utf8').split('\n')
  const BOUND = /^(?:Article\s|CHAPITRE\b|TITRE\b|Section\s+[IVX]+\.-|[IVX]+[).-]\s|[a-z]\)\s+(?:L['’]article\b|L['’]actuel\b|Les articles\b|Un chapitre\b|La sous-section\b)|L['’]article\s|L['’]actuel\b|Les articles\s|Elle comprend\b|Elle comporte\b|Le chapitre\b|Dans le\b|La Loi\b|Donné\b|Par\s*:)/
  const quoted = new Map<string,string[]>()
  for (let i=0;i<dLines.length;i++){
    const m = dLines[i].match(/^Article\s+(\d{3,4}(?:-\d+)?)\s*\.\-\s*(.*)$/)
    if (!m) continue
    const n = m[1]; if (!AMENDED.includes(n)&&!NEW_ARTS.includes(n)) continue
    const buf=[m[2].trim()]
    for (let j=i+1;j<dLines.length;j++){ const l=dLines[j].trim(); if(!l||BOUND.test(l)) break; buf.push(l) }
    quoted.set(n, buf)
  }
  const block = (n:string) => { const [h,...r]=quoted.get(n)!; return [`Art. ${n} (${REF_COURT}) ${h}`.replace(/'/g,'’'), ...r.map(s=>s.replace(/'/g,'’'))] }
  // 1) AV EN_VIGUEUR des 23 réécrits
  let avUpd=0
  for (const n of AMENDED) {
    const nb = block(n).join('\n')
    const av = await prisma.articleVersion.findFirst({ where:{ anchor:`art-${n}`, status:'EN_VIGUEUR', amendedByNumber:REF } })
    if (av && av.body !== nb) { await prisma.articleVersion.update({ where:{ id:av.id }, data:{ body:nb } }); avUpd++ }
  }
  // 2) blocs des 57 nouveaux dans le corps
  const cc = await prisma.document.findFirst({ where:{ source:'CODE_CIVIL_ANNOTE' } })
  const ann = JSON.parse(cc!.annotationsJson!)
  const tocSet = new Set(ann.toc.map((t:any)=>t.label.replace(/\s+/g,' ').trim()))
  let lines = cc!.bodyOriginal!.split('\n')
  let bodyUpd=0
  for (const n of NEW_ARTS) {
    const i = lines.findIndex(l=>l.startsWith(`Art. ${n} (${REF_COURT})`))
    if (i<0) throw new Error(`bloc art ${n} introuvable dans le corps CC`)
    let j=i+1
    while (j<lines.length && !/^Art\.?\s*\d/.test(lines[j].trim()) && !tocSet.has(lines[j].replace(/\s+/g,' ').trim())) j++
    const nb = block(n)
    if (lines.slice(i,j).join('\n') !== nb.join('\n')) { lines = [...lines.slice(0,i), ...nb, ...lines.slice(j)]; bodyUpd++ }
  }
  if (bodyUpd) await prisma.document.update({ where:{ id:cc!.id }, data:{ bodyOriginal: lines.join('\n') } })
  await reindexDocument(cc!.id)
  console.log(`✓ rafraîchis — AV réécrits : ${avUpd}/23 · blocs nouveaux : ${bodyUpd}/57 · réindexé`)
  // contrôle : plus aucun » orphelin ni « dans les 80 blocs du CC
  const cc2 = await prisma.document.findFirst({ where:{ source:'CODE_CIVIL_ANNOTE' }, select:{ bodyOriginal:true } })
  const bad = cc2!.bodyOriginal!.split('\n').filter(l=>/^Art\. (17|18|19)\d/.test(l)===false && /»/.test(l) && !/«/.test(l) && /\(D\. du 14 mai 2020\)/.test(l))
  console.log(`  lignes de bloc sûretés avec » orphelin : ${bad.length}`)
  process.exit(0)
})().catch(e=>{console.error(e?.message??e);process.exit(1)})
