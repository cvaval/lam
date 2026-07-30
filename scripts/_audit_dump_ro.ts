/** AUDIT LECTURE SEULE */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL
import { prisma } from '../src/lib/db'
const OUT = process.env.OUTDIR!
async function main() {
  const docs = await prisma.document.findMany({
    where: { type: 'CIRCULAIRE_BRH' },
    select: { id: true, number: true, titleFr: true, status: true, abrogatedByNumber: true,
      publicationDate: true, bodyOriginal: true, bodyClean: true, source: true },
    orderBy: [{ number: 'asc' }],
  })
  mkdirSync(OUT + '/bodies', { recursive: true })
  const idx: any[] = []
  for (const [i, d] of docs.entries()) {
    const fn = `${String(i).padStart(3,'0')}_${(d.number ?? 'SANS').replace(/[^0-9A-Za-z-]/g, '_')}.txt`
    writeFileSync(`${OUT}/bodies/${fn}`, `### ${d.number} | ${d.titleFr}\n### id=${d.id} status=${d.status} abrogatedByNumber=${d.abrogatedByNumber} pub=${d.publicationDate?.toISOString().slice(0,10)} source=${d.source}\n\n--- bodyOriginal ---\n${d.bodyOriginal ?? ''}\n\n--- bodyClean ---\n${d.bodyClean ?? ''}\n`)
    idx.push({ file: fn, id: d.id, number: d.number, title: d.titleFr, status: d.status, abrogatedByNumber: d.abrogatedByNumber, pub: d.publicationDate?.toISOString().slice(0,10), source: d.source, hasClean: !!d.bodyClean, len: (d.bodyOriginal??'').length })
  }
  writeFileSync(`${OUT}/index.json`, JSON.stringify(idx, null, 1))
  console.log('TOTAL', docs.length, 'ABROGE', docs.filter(d=>d.status==='ABROGE').length)
  for (const d of docs) if (d.status !== 'EN_VIGUEUR') console.log(`  ${(d.number??'').padEnd(30)} ${d.status.padEnd(10)} ← ${d.abrogatedByNumber ?? '(aucun)'}   [${d.titleFr?.slice(0,60)}]`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
