import fs from 'node:fs'
import { segmentAnnotated } from './src/lib/legislation/annotated'
import type { TocEntry } from './src/lib/legislation/annotated'

const P = '/private/tmp/claude-501/-Users-cvaval-Library-CloudStorage-Dropbox-Lam-Veritab/b86c8ab9-626b-4ed6-9e9c-f6e8779c5980/scratchpad/avis-brh/source.json'
const d = JSON.parse(fs.readFileSync(P, 'utf8'))
const corps: string[] = d.corps
const toc: TocEntry[] = d.toc
const body = corps.join('\n')
const blocks = segmentAnnotated(body, toc, d.pointAnchors)

const secs = blocks.filter((b) => b.kind === 'section') as any[]
const bodies = blocks.filter((b) => b.kind === 'body') as any[]
console.log('blocs total', blocks.length, '| sections', secs.length, '/ toc', toc.length)
const emitted = new Set<string>()
for (const s of secs) emitted.add(s.anchor)
const realArt: string[] = []
const muted: string[] = []
for (const b of bodies) {
  if (b.anchor && !b.noAnchors) { realArt.push(b.anchor); emitted.add(b.anchor) }
  else if (b.anchor) muted.push(b.anchor)
}
console.log('ancres art RÉELLES', realArt.length, JSON.stringify(realArt))
console.log('ancres art MUETTES (noAnchors)', muted.length, JSON.stringify(muted))
// doublons
const all = [...secs.map((s)=>s.anchor), ...realArt]
const dup = all.filter((a, i) => all.indexOf(a) !== i)
console.log('ancres en double', dup.length, JSON.stringify(dup))

// sections non appariées
const matchedLabels = new Set(secs.map((s: any) => s.anchor))
for (const t of toc) if (!matchedLabels.has(t.anchor)) console.log('TOC NON APPARIÉE', t.anchor, JSON.stringify(t.label))

// restitution
const recomposed = blocks.map((b: any) => b.text).join('\n')
console.log('restitution identique :', recomposed === body, '| lignes', recomposed.split('\n').length, body.split('\n').length)

// toc label = ligne exacte du corps ?
const setLines = new Set(corps)
for (const t of toc) if (!setLines.has(t.label)) console.log('LABEL NON EXACT DANS LE CORPS:', JSON.stringify(t.label))

// index refs
let dead = 0, tot = 0
for (const e of d.index) {
  for (const r of e.ctRefs ?? []) { tot++; const a = `art-${r}`; if (!emitted.has(a)) { dead++; console.log('ctRef MORT', a, '|', e.subject.slice(0,50)) } }
  for (const dr of e.docRefs ?? []) { tot++; if (dr.anchor && !emitted.has(dr.anchor)) { dead++; console.log('docRef MORT', dr.anchor) }
    if (!dr.id) console.log('docRef SANS ID -> href /'+'{locale}/doc/'+(dr.anchor?('#'+dr.anchor):'')+'  ||', dr.label) }
}
console.log('renvois index', tot, 'morts(ancre)', dead)

// navToc
const navAnchors: string[] = []
const walk = (items: any[]) => { for (const it of items) { navAnchors.push(it.anchor); if (it.children) walk(it.children) } }
for (const g of d.navToc) { navAnchors.push(g.anchor); if (g.children) walk(g.children) }
console.log('navToc ancres', navAnchors.length, 'mortes', navAnchors.filter((a) => !emitted.has(a)).length, JSON.stringify(navAnchors.filter((a) => !emitted.has(a))))
console.log('navToc doublons', navAnchors.filter((a,i)=>navAnchors.indexOf(a)!==i))

// labels
for (const k of Object.keys(d.labels)) if (!emitted.has(k)) console.log('label sans ancre', k)
