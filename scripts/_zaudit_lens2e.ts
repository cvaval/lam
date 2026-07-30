/** AUDIT LECTURE SEULE — lentille 2 (e) : régression sur les autres textes annotés. Jetable. */
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
import { labelFromAnchor } from '../src/lib/legislation/articles'

const TARGETS = ['CODE_CIVIL_ANNOTE', 'CODE_PENAL_ANNOTE', 'CODE_COMMERCE_ANNOTE', 'CONSTITUTION_1987', 'CODE_TRAVAIL_ANNOTE', 'CODE_DOUANES_ANNOTE']
async function main() {
  const docs = await prisma.document.findMany({
    where: { NOT: { annotationsJson: null } },
    select: { id: true, source: true, number: true, titleFr: true, annotationsJson: true, richBlocksJson: true, bodyClean: true, bodyOriginal: true, type: true },
  })
  console.log(`documents annotés : ${docs.length}`)
  console.log('\n--- richBlocksJson (source du régresseur `rich`) ---')
  for (const d of docs) if (d.richBlocksJson) console.log('  RICH:', d.source, d.number)
  console.log('\n--- pointAnchors (source de sectionRefs) ---')
  for (const d of docs) { const a = parseAnnotations(d.annotationsJson); if (a?.pointAnchors?.length) console.log('  POINTS:', d.source, a.pointAnchors.length) }
  console.log('\n--- hrefFor : n\'est fourni que pour type CIRCULAIRE_BRH ---')
  console.log('  annotés de type CIRCULAIRE_BRH :', docs.filter((d) => d.type === 'CIRCULAIRE_BRH').map((d) => `${d.source}/${d.number}`).join(', '))
  console.log('\n--- code-search : effet du changement de libellé (labelFromAnchor -> ann.labels) ---')
  for (const d of docs) {
    const a = parseAnnotations(d.annotationsJson)
    if (!a) continue
    const body = d.bodyClean ?? d.bodyOriginal
    let changed = 0, total = 0, empty = 0
    const samples: string[] = []
    for (const b of segmentAnnotated(body, a.toc, a.pointAnchors)) {
      if (b.kind !== 'body' || !b.anchor || b.noAnchors) continue
      if (!/^art-(\d+)/.test(b.anchor)) continue
      total++
      const before = labelFromAnchor(b.anchor)
      const after = a.labels?.[b.anchor] ?? before
      if (after !== before) { changed++; if (samples.length < 3) samples.push(`${b.anchor}: "${before}" -> "${after}"`) }
      if (!after) empty++
    }
    if (changed || empty) console.log(`  ${d.source} (${total} art.) : libellés modifiés ${changed}, vides ${empty} | ${samples.join(' ; ')}`)
  }
  await prisma.$disconnect()
}
main()
