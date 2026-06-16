/**
 * Backfill des sociétés manquantes de l'Index du Moniteur.
 *
 * Re-parse les entrées Index existantes (category SOCIETE/MARQUE) avec l'extracteur
 * amélioré (src/lib/moniteur/companies.ts) — qui capture désormais les noms SANS
 * guillemets — et crée les sociétés + liens (CompanyPublication) manquants. Idempotent :
 * l'id société est déterministe (idx-c-…) et les liens existants (société↔document) sont
 * conservés ; aucune donnée correcte n'est touchée.
 *
 *   npx tsx scripts/backfill-companies.ts            # aperçu (rien écrit)
 *   npx tsx scripts/backfill-companies.ts --commit   # écrit en base
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { extractCompanies, companyId } from '../src/lib/moniteur/companies'
import { fold } from '../src/lib/search/normalize'

// Connexion directe (DDL/écritures en lot) si DIRECT_URL est dans .env.
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })

const COMMIT = process.argv.includes('--commit')

function kindOf(category: string, text: string): string {
  if (category === 'MARQUE') return 'MARQUE'
  const t = fold(text)
  return t.includes('augmentation') || t.includes('modification du capital') ? 'MODIF_CAPITAL' : 'STATUTS'
}

async function main() {
  const docs = await prisma.document.findMany({
    where: { type: 'INDEX', category: { in: ['SOCIETE', 'MARQUE'] } },
    select: { id: true, bodyOriginal: true, category: true, publicationDate: true, moniteurRef: true },
  })
  console.log(`Entrées SOCIETE/MARQUE : ${docs.length}`)

  // États existants pour idempotence.
  const existingCompanyIds = new Set((await prisma.company.findMany({ select: { id: true } })).map((c) => c.id))
  const existingPubs = new Set(
    (await prisma.companyPublication.findMany({ where: { documentId: { not: null } }, select: { companyId: true, documentId: true } }))
      .map((p) => `${p.companyId}|${p.documentId}`),
  )

  const newCompanies = new Map<string, { id: string; name: string; searchName: string }>()
  const newPubs: { id: string; companyId: string; documentId: string; kind: string; label: string; date: Date | null; moniteurRef: string | null }[] = []
  let docsTouched = 0

  for (const d of docs) {
    const names = extractCompanies(d.bodyOriginal || '')
    if (!names.length) continue
    let touched = false
    for (const name of names) {
      const id = companyId(name)
      if (!existingCompanyIds.has(id) && !newCompanies.has(id)) {
        newCompanies.set(id, { id, name, searchName: fold(name) })
      }
      const pubKey = `${id}|${d.id}`
      if (!existingPubs.has(pubKey)) {
        existingPubs.add(pubKey)
        newPubs.push({ id: `idx-p-${randomUUID()}`, companyId: id, documentId: d.id, kind: kindOf(d.category!, d.bodyOriginal || ''), label: (d.bodyOriginal || '').slice(0, 160), date: d.publicationDate, moniteurRef: d.moniteurRef })
        touched = true
      }
    }
    if (touched) docsTouched++
  }

  console.log(`\n${COMMIT ? '✏️  À ÉCRIRE' : '👁  APERÇU'} : ${newCompanies.size} nouvelles sociétés · ${newPubs.length} nouveaux liens · ${docsTouched} entrées complétées`)
  console.log('\nExemples de NOUVELLES sociétés (validation qualité) :')
  for (const c of [...newCompanies.values()].slice(0, 40)) console.log('  • ' + c.name)

  if (!COMMIT) { console.log('\n(Aperçu — relancer avec --commit pour écrire.)'); return }

  // Écriture par lots ; skipDuplicates en filet de sécurité.
  const comps = [...newCompanies.values()]
  for (let i = 0; i < comps.length; i += 1000) await prisma.company.createMany({ data: comps.slice(i, i + 1000), skipDuplicates: true })
  for (let i = 0; i < newPubs.length; i += 1000) await prisma.companyPublication.createMany({ data: newPubs.slice(i, i + 1000), skipDuplicates: true })
  console.log(`\n✅ Écrit : ${comps.length} sociétés + ${newPubs.length} liens.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
