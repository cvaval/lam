/**
 * Réinscrit dans scripts/brh-enrichments.json (source de vérité rejouée par import-brh)
 * les circulaires 105-2 et 117-1 ainsi que la chaîne d'abrogation 105 → 105-1 → 105-2 et
 * 117 → 117-1.
 *
 * Sans cela, un ré-import du recueil rétablirait `status = EN_VIGUEUR` sur les textes
 * abrogés et une reconstruction complète recréerait les deux circulaires SANS leurs
 * annotations ni leur source dédiée.
 *
 * Idempotent : relit la base, réécrit les entrées concernées, laisse le reste intact.
 *   npx tsx scripts/_sync-brh-enrichments.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'

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

import { prisma } from '../src/lib/db'

const PATH = 'scripts/brh-enrichments.json'
const NEW_SOURCES = ['CIRC_BRH_105_2', 'CIRC_BRH_117_1']
const ABROGATIONS = [
  { number: 'Circulaire n° 105', status: 'ABROGE', abrogatedByNumber: 'Circulaire n° 105-1' },
  { number: 'Circulaire n° 105-1', status: 'ABROGE', abrogatedByNumber: 'Circulaire n° 105-2' },
  { number: 'Circulaire n° 117', status: 'ABROGE', abrogatedByNumber: 'Circulaire n° 117-1' },
]

async function main() {
  const file = JSON.parse(readFileSync(PATH, 'utf8')) as {
    html: { number: string; bodyClean: string | null; richBlocksJson: string | null }[]
    supplement: Record<string, unknown>[]
    status?: { number: string; status: string; abrogatedByNumber?: string | null }[]
  }
  file.status ??= []

  // Le bloc `html` est REJOUÉ par import-brh après sa purge : s'il est plus ancien que la
  // base, un ré-import écrase les enrichissements par une version périmée (constat d'audit :
  // ~13 ko de tableaux perdus sur la circulaire 131). On le régénère depuis la base.
  let rafraichis = 0
  for (const h of file.html) {
    const d = await prisma.document.findFirst({
      where: { type: 'CIRCULAIRE_BRH', number: h.number },
      select: { bodyClean: true, richBlocksJson: true },
    })
    if (!d) { console.warn(`   ⚠ enrichissement sans cible en base : ${h.number}`); continue }
    if (d.bodyClean !== h.bodyClean || d.richBlocksJson !== h.richBlocksJson) {
      h.bodyClean = d.bodyClean
      h.richBlocksJson = d.richBlocksJson
      rafraichis++
    }
  }

  const docs = await prisma.document.findMany({
    where: { source: { in: NEW_SOURCES } },
    select: {
      number: true, titleFr: true, publicationDate: true, effectiveDate: true,
      bodyOriginal: true, bodyClean: true, richBlocksJson: true, annotationsJson: true, source: true,
    },
  })
  if (docs.length !== 2) throw new Error(`2 circulaires attendues en base, ${docs.length} trouvées — annulé`)

  for (const d of docs) {
    const entry = {
      number: d.number!,
      title: d.titleFr,
      date: d.publicationDate ? d.publicationDate.toISOString().slice(0, 10) : null,
      effective: d.effectiveDate ? d.effectiveDate.toISOString().slice(0, 10) : null,
      bodyOriginal: d.bodyOriginal,
      bodyClean: d.bodyClean,
      richBlocksJson: d.richBlocksJson,
      annotationsJson: d.annotationsJson,
      source: d.source,
    }
    const i = file.supplement.findIndex((s) => s.number === d.number)
    if (i >= 0) file.supplement[i] = entry
    else file.supplement.push(entry)
  }

  for (const a of ABROGATIONS) {
    const i = file.status.findIndex((s) => s.number === a.number)
    if (i >= 0) file.status[i] = a
    else file.status.push(a)
  }

  writeFileSync(PATH, JSON.stringify(file, null, 1))
  console.log(`   ${rafraichis} enrichissement(s) HTML rafraîchi(s) depuis la base`)
  console.log(
    `✓ brh-enrichments.json : ${file.supplement.length} suppléments (dont les 2 circulaires annotées) · ` +
      `${file.status.length} statuts éditoriaux (dont les 3 abrogations)`,
  )
  for (const a of ABROGATIONS) console.log(`   ${a.number.padEnd(22)} ABROGE ← ${a.abrogatedByNumber}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
