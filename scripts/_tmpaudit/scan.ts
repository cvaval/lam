import fs from 'fs'
import path from 'path'
import { scanRefs } from '../../src/lib/doc/crossref'
const root = path.resolve(__dirname, '../..')
const files: [string,string][] = [
  ['105-2 clean', 'scripts/data/circ-brh-105-2/_clean.txt'],
  ['105-2 body', 'scripts/data/circ-brh-105-2/_body.txt'],
  ['117-1 body', 'scripts/data/circ-brh-117-1/_body.txt'],
]
for (const [label, f] of files) {
  const t = fs.readFileSync(path.join(root, f), 'utf8')
  const hits = scanRefs(t)
  console.log(`\n=== ${label} : ${hits.length} renvois ===`)
  for (const h of hits) console.log(JSON.stringify(h.ref), '|', JSON.stringify(t.slice(Math.max(0,h.start-40), h.end+30)))
}
