/** AUDIT LECTURE SEULE — lentille 2 (d). Jetable. */
import { readFileSync, writeFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
  }),
)
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]
if (env.DIRECT_URL) process.env.DATABASE_URL = env.DIRECT_URL
import { prisma } from '../src/lib/db'

const OUT = '/private/tmp/claude-501/-Users-cvaval-Library-CloudStorage-Dropbox-Lam-Veritab/b86c8ab9-626b-4ed6-9e9c-f6e8779c5980/scratchpad'
async function main() {
  for (const [name, id] of Object.entries({ '105-2': 'cms7lgd8l0000wtgzu7y3j8mt', '117-1': 'cms7lggvs0001wtgzvw937xyt' })) {
    const d = await prisma.document.findUnique({ where: { id } })
    const a = JSON.parse(d!.annotationsJson!)
    console.log(`\n### ${name}`)
    for (const k of Object.keys(a)) {
      const v = a[k]
      console.log(`  ${k}: ${Array.isArray(v) ? `[${v.length}]` : typeof v === 'object' && v ? `{${Object.keys(v).length}}` : JSON.stringify(v).slice(0, 90)}`)
    }
    console.log('  toc:', JSON.stringify(a.toc, null, 0).slice(0, 3000))
    console.log('  connexe:', JSON.stringify(a.connexe ?? {}).slice(0, 3000))
    console.log('  commentaires:', JSON.stringify(a.commentaires ?? {}).slice(0, 3000))
    console.log('  crossRefs:', JSON.stringify(a.crossRefs ?? []).slice(0, 3000))
    console.log('  indexEntries:', JSON.stringify(a.indexEntries ?? []).slice(0, 2000))
    console.log('  jurisprudence:', JSON.stringify(a.jurisprudence ?? {}).slice(0, 2000))
    console.log('  navToc:', JSON.stringify(a.navToc ?? []).slice(0, 2500))
    console.log('  status/oldVersions:', JSON.stringify(a.status ?? {}), JSON.stringify(Object.keys(a.oldVersions ?? {})))
    writeFileSync(`${OUT}/${name}-body.txt`, d!.bodyClean ?? d!.bodyOriginal)
    writeFileSync(`${OUT}/${name}-orig.txt`, d!.bodyOriginal)
    if (d!.richBlocksJson) writeFileSync(`${OUT}/${name}-rich.json`, d!.richBlocksJson)
    writeFileSync(`${OUT}/${name}-ann.json`, JSON.stringify(a, null, 1))
    console.log('  meta:', JSON.stringify({ number: d!.number, status: d!.status, abrogatedByNumber: d!.abrogatedByNumber, source: d!.source, moniteurRef: d!.moniteurRef, publicationDate: d!.publicationDate, sourcePdfUrl: !!d!.sourcePdfUrl, keywords: d!.keywords?.slice(0, 200), summaryFr: d!.summaryFr?.slice(0, 400) }))
  }
  await prisma.$disconnect()
}
main()
