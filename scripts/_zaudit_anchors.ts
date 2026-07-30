/** AUDIT LECTURE SEULE — ancres mortes / doublons sur les deux circulaires. Jetable. */
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
  }),
)
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL
import { prisma } from '../src/lib/db'
import { parseAnnotations, segmentAnnotated } from '../src/lib/legislation/annotated'

async function main() {
  for (const [name, id] of Object.entries({ '105-2': 'cms7lgd8l0000wtgzu7y3j8mt', '117-1': 'cms7lggvs0001wtgzvw937xyt' })) {
    const d = (await prisma.document.findUnique({ where: { id } }))!
    const a = parseAnnotations(d.annotationsJson)!
    const raw = JSON.parse(d.annotationsJson!)
    const body = d.bodyClean ?? d.bodyOriginal
    const blocks = segmentAnnotated(body, a.toc, a.pointAnchors)
    const live = new Set<string>()
    for (const b of blocks) {
      if (b.kind === 'section') live.add(b.anchor)
      else if (b.anchor && !b.noAnchors) live.add(b.anchor)
    }
    const navAnchors = [...JSON.stringify(raw.navToc).matchAll(/"anchor":"([^"]+)"/g)].map((m) => m[1])
    const idxAnchors = (raw.indexEntries ?? []).flatMap((e: any) => (e.ctRefs ?? []).map((r: string) => `art-${String(r).replace(/\./g, '-')}`))
    const docRefAnchors = (raw.indexEntries ?? []).flatMap((e: any) => (e.docRefs ?? []).filter((r: any) => r.id === id && r.anchor).map((r: any) => r.anchor))
    const connexeKeys = Object.keys(raw.connexe ?? {})
    const commKeys = Object.keys(raw.commentaires ?? {})
    const jurisKeys = new Set(blocks.filter((b) => b.kind === 'body' && (b as any).jurisKey).map((b: any) => b.jurisKey))
    const dead = (arr: string[]) => [...new Set(arr.filter((x) => !live.has(x)))]
    console.log(`\n### ${name} — ancres vivantes ${live.size}`)
    console.log('  navToc morts   :', dead(navAnchors).join(', ') || 'aucun', `(${navAnchors.length} liens)`)
    console.log('  index morts    :', dead(idxAnchors).join(', ') || 'aucun', `(${idxAnchors.length} renvois)`)
    console.log('  docRefs morts  :', dead(docRefAnchors).join(', ') || 'aucun', `(${docRefAnchors.length})`)
    console.log('  connexe morts  :', dead(connexeKeys).join(', ') || 'aucun', `(${connexeKeys.length})`)
    console.log('  commentaires clés non appariées :', commKeys.filter((k) => !jurisKeys.has(k)).join(', ') || 'aucune', `(${commKeys.length})`)
    const labelsDead = dead(Object.keys(raw.labels ?? {}))
    console.log('  labels morts   :', labelsDead.join(', ') || 'aucun')
  }
  await prisma.$disconnect()
}
main()
