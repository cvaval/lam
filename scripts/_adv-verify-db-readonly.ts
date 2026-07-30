/** LECTURE SEULE — vérifie ce que contient réellement annotationsJson en base. */
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL

import { prisma } from '../src/lib/db'
import { parseAnnotations, segmentAnnotated } from '../src/lib/legislation/annotated'

async function main() {
  for (const source of ['CIRC_BRH_105_2', 'CIRC_BRH_117_1']) {
    const d = await prisma.document.findFirst({
      where: { source },
      select: { id: true, number: true, annotationsJson: true, bodyClean: true, bodyOriginal: true },
    })
    if (!d) {
      console.log(source, '→ ABSENT de la base')
      continue
    }
    const rawObj = JSON.parse(d.annotationsJson ?? '{}')
    const parsed = parseAnnotations(d.annotationsJson)!
    const shown = d.bodyClean ?? d.bodyOriginal
    const bPage = segmentAnnotated(shown, parsed.toc ?? [], (parsed as any).pointAnchors)
    const bWant = segmentAnnotated(shown, rawObj.toc ?? [], rawObj.pointAnchors)
    console.log(`\n== ${source} (${d.id}, ${d.number}) ==`)
    console.log('  BASE  pointAnchors :', (rawObj.pointAnchors ?? []).length, JSON.stringify(rawObj.pointAnchors ?? []).slice(0, 120))
    console.log('  parseAnnotations   :', (parsed as any).pointAnchors)
    console.log(`  blocs PAGE ${bPage.length} / ancres ${bPage.filter((b: any) => b.anchor).length}`)
    console.log(`  blocs VOULU ${bWant.length} / ancres ${bWant.filter((b: any) => b.anchor).length}`)
  }
  await prisma.$disconnect()
}
main()
