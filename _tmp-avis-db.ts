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

import { prisma } from './src/lib/db'

async function main() {
  const ids = ['cmsqyfecr0000kg2hgx6eh1sv', 'cmqbnm0eb001bsmfzfiddjilj']
  const byId = await prisma.document.findMany({
    where: { id: { in: ids } },
    select: { id: true, number: true, titleFr: true, status: true, source: true, type: true, matiere: true, abrogatedByNumber: true },
  })
  console.log('— par id —')
  for (const d of byId) console.log(JSON.stringify(d))

  const chg = await prisma.document.findMany({
    where: { OR: [{ source: { contains: 'CHANGE' } }, { titleFr: { contains: 'intermédiaires de change' } }] },
    select: { id: true, number: true, titleFr: true, status: true, source: true, type: true },
  })
  console.log('— change —', chg.length)
  for (const d of chg) console.log(JSON.stringify(d))

  const av = await prisma.document.findMany({
    where: { OR: [{ source: { contains: 'AVIS' } }, { titleFr: { contains: 'agents de change' } }] },
    select: { id: true, number: true, titleFr: true, source: true },
  })
  console.log('— avis existant ? —', av.length)
  for (const d of av) console.log(JSON.stringify(d))

  const themes = await prisma.theme.findMany({
    where: { slug: { in: ['brh-implantations', 'brh-devises', 'brh-change'] } },
    select: { id: true, slug: true, labelFr: true },
  })
  console.log('— thèmes —')
  for (const t of themes) console.log(JSON.stringify(t))

  const c127 = await prisma.document.findUnique({
    where: { id: 'cmqbnm0eb001bsmfzfiddjilj' },
    select: { annotationsJson: true, bodyClean: true, bodyOriginal: true },
  })
  console.log('— c127 annotationsJson —', c127?.annotationsJson ? c127.annotationsJson.length : null,
    '· bodyClean', c127?.bodyClean ? c127.bodyClean.length : null,
    '· bodyOriginal', c127?.bodyOriginal?.length)
}
main().finally(() => prisma.$disconnect())
