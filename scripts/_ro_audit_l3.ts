import { readFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL

import { prisma } from '../src/lib/db'

async function main() {
  const docs = await prisma.document.findMany({
    where: { type: 'CIRCULAIRE_BRH' },
    select: { id: true, number: true, titleFr: true, status: true, abrogatedByNumber: true,
      publicationDate: true, effectiveDate: true, source: true, matiere: true, sealed: true,
      sourcePdfUrl: true, updatedAt: true },
    orderBy: { number: 'asc' },
  })
  console.log('TOTAL CIRCULAIRE_BRH =', docs.length)
  const abrog = docs.filter((d) => d.status === 'ABROGE')
  console.log('ABROGE =', abrog.length)
  const numbers = new Set(docs.map((d) => d.number))
  console.log('--- ABROGES ---')
  for (const d of abrog) {
    const ok = d.abrogatedByNumber ? numbers.has(d.abrogatedByNumber) : false
    console.log(`${(d.number ?? '(null)').padEnd(28)} ← ${(d.abrogatedByNumber ?? '(AUCUN)').padEnd(28)} cible_existe=${ok} pdf=${d.sourcePdfUrl ? 'oui' : 'NON'} src=${d.source}`)
  }
  console.log('--- statuts non EN_VIGUEUR/ABROGE ---')
  const byStatus = new Map<string, number>()
  for (const d of docs) byStatus.set(d.status, (byStatus.get(d.status) ?? 0) + 1)
  console.log([...byStatus.entries()])
  console.log('--- doublons de numéro ---')
  const cnt = new Map<string, number>()
  for (const d of docs) cnt.set(d.number ?? '(null)', (cnt.get(d.number ?? '(null)') ?? 0) + 1)
  for (const [n, c] of cnt) if (c > 1) console.log('  ', n, c)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
