/** LECTURE SEULE : vérifie la Constitution vs la grammaire des renvois. */
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
  const consts = await prisma.document.findMany({
    where: { OR: [{ source: { contains: 'CONSTITUTION' } }, { titleFr: { contains: 'Constitution' } }] },
    select: { id: true, source: true, titleFr: true, type: true, bodyOriginal: true, bodyClean: true },
  })
  console.log('--- documents Constitution ---')
  for (const d of consts) {
    const body = d.bodyClean ?? d.bodyOriginal ?? ''
    console.log(`${d.id} | source=${d.source} | type=${d.type} | ${String(d.titleFr).slice(0, 70)} | ${body.length} o`)
  }

  // Occurrences de « 31.1.1 » dans TOUT le corpus, avec contexte
  const all = await prisma.document.findMany({
    select: { id: true, source: true, titleFr: true, bodyOriginal: true, bodyClean: true },
  })
  console.log(`\ncorpus: ${all.length} documents`)
  const re = /\b(?:articles?|art\.)\s+31\.1\.1/gi
  let hits = 0
  for (const d of all) {
    for (const [field, body] of [['bodyOriginal', d.bodyOriginal], ['bodyClean', d.bodyClean]] as const) {
      if (!body) continue
      let m: RegExpExecArray | null
      const r = new RegExp(re.source, 'gi')
      while ((m = r.exec(body))) {
        hits++
        console.log(`\n[${d.source}] ${String(d.titleFr).slice(0, 50)} (${field}) @${m.index}`)
        console.log('   …' + body.slice(Math.max(0, m.index - 90), m.index + 110).replace(/\n/g, ' ⏎ ') + '…')
      }
    }
  }
  console.log(`\ntotal « article(s) 31.1.1 » = ${hits}`)

  // Toute occurrence de la chaîne 31.1.1 (même sans « article »), dans la Constitution
  for (const d of consts) {
    const body = d.bodyClean ?? d.bodyOriginal ?? ''
    const r = /31\.1\.1/g
    let m: RegExpExecArray | null
    let n = 0
    while ((m = r.exec(body))) {
      n++
      console.log(`\n[${d.source}] brut 31.1.1 @${m.index}: …${body.slice(Math.max(0, m.index - 80), m.index + 90).replace(/\n/g, ' ⏎ ')}…`)
    }
    console.log(`[${d.source}] occurrences brutes « 31.1.1 » = ${n}`)
  }
  await prisma.$disconnect()
}
main()
