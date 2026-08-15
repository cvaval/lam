import fs from 'node:fs'
import { segmentAnnotated, pointAnchorFromHeading } from './src/lib/legislation/annotated'
const P='/private/tmp/claude-501/-Users-cvaval-Library-CloudStorage-Dropbox-Lam-Veritab/b86c8ab9-626b-4ed6-9e9c-f6e8779c5980/scratchpad/avis-brh/source.json'
const d=JSON.parse(fs.readFileSync(P,'utf8'))
const corps:string[]=d.corps
const blocks=segmentAnnotated(corps.join('\n'), d.toc, d.pointAnchors)
let ln=0
for(const b of blocks as any[]){
  const n=b.text.split('\n').length
  if(b.kind==='section') console.log(`L${String(ln).padStart(3)} SEC ${b.anchor.padEnd(7)} ${JSON.stringify(b.text).slice(0,70)}`)
  else if(b.anchor) console.log(`L${String(ln).padStart(3)} ART ${b.anchor.padEnd(7)} noAnchors=${b.noAnchors} ${JSON.stringify(b.text.split('\n')[0]).slice(0,70)}`)
  ln+=n
}
// occurrences multiples d'un libellé toc
for(const t of d.toc){
  const occ=corps.map((l,i)=>[l,i] as [string,number]).filter(([l])=>l.replace(/\s+/g,' ').trim()===t.label.replace(/\s+/g,' ').trim()).map(([,i])=>i)
  if(occ.length!==1) console.log('LIBELLÉ MULTIPLE', t.anchor, JSON.stringify(t.label), occ)
}
// toutes les lignes qui RESSEMBLENT à une tête numérotée
const RE=/^(\d{1,2}(?:\.\d{1,2})*)\s*\.?\s*-?\s+\S/
const cands=new Map<string,number[]>()
corps.forEach((l,i)=>{const m=RE.exec(l.trim()); if(m){const a=cands.get(m[1])??[];a.push(i);cands.set(m[1],a)}})
console.log('\nDésignations candidates (première occurrence gagne) :')
for(const [k,v] of [...cands.entries()].sort()) console.log(' ',k.padEnd(6), v.join(','), '| 1re =', JSON.stringify(corps[v[0]]).slice(0,60))
// test forme fac-similé « 2.1.Constitution »
console.log('\n« 2.1.Constitution du dossier » →', pointAnchorFromHeading('2.1.Constitution du dossier', new Set(['1','2','2.1','2.2','3','4','5','6'])))
