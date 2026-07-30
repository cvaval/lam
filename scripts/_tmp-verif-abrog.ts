/** AUDIT LECTURE SEULE — à supprimer après usage. */
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

async function main() {
  const docs = await prisma.document.findMany({
    where: { type: 'CIRCULAIRE_BRH' },
    select: {
      id: true, number: true, titleFr: true, status: true, abrogatedByNumber: true,
      publicationDate: true, bodyOriginal: true, bodyClean: true, source: true,
    },
    orderBy: { number: 'asc' },
  })
  console.log(`TOTAL circulaires BRH : ${docs.length}`)
  console.log(`ABROGE en base : ${docs.filter((d) => d.status === 'ABROGE').length}`)
  for (const d of docs.filter((d) => d.status === 'ABROGE'))
    console.log(`   ${d.number} ← ${d.abrogatedByNumber ?? '(aucun)'}`)

  // Numéros existants
  const byNum = new Map(docs.map((d) => [d.number ?? '', d]))
  console.log('\n--- Existence des numéros cités par l’audit ---')
  for (const n of ['129', '129-1', '109-1', '131', '95-4', '95-5', '99-3', '99-4', '115-5', '115-6',
    '89-1', '89-2', '89-3', '87', '87-1', '88', '88-1', '92', '92-1', '82-2', '82-3', '83-4', '83-5',
    '61-2', '63-3', '72-3', '111', '95', '95-1', '93', '105', '105-1', '105-2', '117', '117-1']) {
    const k = `Circulaire n° ${n}`
    const d = byNum.get(k)
    console.log(`  ${k.padEnd(24)} ${d ? `OK id=${d.id} statut=${d.status} pub=${d.publicationDate?.toISOString().slice(0, 10)}` : 'ABSENT'}`)
  }

  // Balayage : mentions d'abrogation
  console.log('\n--- Mentions « abroge / remplace ... circulaire N » ---')
  const re = /(abrog\w*|remplac\w*|annul\w*)[^.]{0,160}?circulaire[s]?\s*(?:n[°ºo]?\s*)?([0-9]{2,3}(?:-[0-9A-Za-z]+)*)/gi
  for (const d of docs) {
    const body = (d.bodyClean ?? d.bodyOriginal ?? '').replace(/\s+/g, ' ')
    const hits = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = re.exec(body))) {
      const target = m[2]
      if (`Circulaire n° ${target}` === d.number) continue
      hits.add(`${target} :: ${body.slice(Math.max(0, m.index - 60), m.index + 200)}`)
    }
    if (hits.size)
      for (const h of hits) console.log(`\n[${d.number}] (${d.status}) → ${h}`)
  }
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
