import { readFileSync } from 'node:fs'
import { segmentAnnotated } from '@/lib/legislation/annotated'
import { articleAnchorFromHeading } from '@/lib/doc/anchors'
const D = 'scripts/data/cpc'
const body = readFileSync(`${D}/bodyOriginal.txt`, 'utf8')
const st = JSON.parse(readFileSync(`${D}/structure.json`, 'utf8'))
const b = segmentAnnotated(body, st.toc)
const secs = b.filter((x: any) => x.kind === 'section').length
const anc = new Set(b.filter((x: any) => x.kind === 'body' && x.anchor).map((x: any) => x.anchor))
console.log(`  en-têtes segmentés : ${secs}/${st.toc.length} ${secs === st.toc.length ? '✓' : '✗'}`)
console.log(`  ancres d'articles  : ${anc.size} (attendu 1040) ${anc.size === 1040 ? '✓' : '✗'}`)
const orph = Object.keys(st.labels).filter((a) => !anc.has(a))
console.log(`  libellés sans bloc : ${orph.length ? '✗ ' + orph.slice(0,6).join(', ') : '0 ✓'}`)
// Les notes « Anc. art. N » créent-elles des ancres parasites ?
const parasites = body.split('\n').filter((l) => /^Anc\.?\s*art/i.test(l.trim()) && articleAnchorFromHeading(l.trim()))
console.log(`  notes « Anc. art. » devenues ancres : ${parasites.length ? '✗ ' + parasites.length : '0 ✓'}`)
// décimaux
const dec = [...anc].filter((a) => /^art-\d+-\d+$/.test(a))
console.log(`  ancres décimales   : ${dec.length} · ex. ${dec.slice(0,4).join(', ')}`)
