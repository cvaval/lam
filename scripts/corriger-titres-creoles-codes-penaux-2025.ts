/**
 * TITRES CRÉOLES DES CODES PÉNAUX RÉVISÉS — dictés par Me Vaval le 17 oct. 2026 :
 * « Dekrè ki revize Dekrè 11 mas 2020 sou Kòd Penal la ». Le Code de procédure pénale suit la même
 * graphie (« Dekrè », « Kòd »). Seul `titleHt` change ; `_import-codes-penaux-2025.ts` porte la même
 * valeur, pour qu'un nouveau versement ne la défasse pas.
 *
 *     npx tsx scripts/corriger-titres-creoles-codes-penaux-2025.ts            # à blanc
 *     npx tsx scripts/corriger-titres-creoles-codes-penaux-2025.ts --commit   # écrit
 */
import { PrismaClient } from '@prisma/client'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')
const TITRES = [
  { source: 'CODE_PENAL_2025', avant: 'Dekre ki revize Dekre 11 mas 2020 sou Kod Penal la', apres: 'Dekrè ki revize Dekrè 11 mas 2020 sou Kòd Penal la' },
  { source: 'CODE_PROCEDURE_PENALE_2025', avant: 'Dekre ki revize Dekre 11 mas 2020 sou Kod Pwosedi Penal la', apres: 'Dekrè ki revize Dekrè 11 mas 2020 sou Kòd Pwosedi Penal la' },
]

async function main() {
  const fiches = []
  for (const t of TITRES) {
    const d = await prisma.document.findMany({ where: { source: t.source, type: 'LEGISLATION' }, select: { id: true, titleHt: true } })
    if (d.length !== 1) throw new Error(`⛔ ${t.source} : ${d.length} fiche(s) — rien n'est écrit`)
    if (d[0].titleHt !== t.avant && d[0].titleHt !== t.apres) throw new Error(`⛔ ${t.source} : titre créole inattendu « ${d[0].titleHt} » — rien n'est écrit`)
    console.log(`${t.source} (${d[0].id}) : « ${d[0].titleHt} » → « ${t.apres} »${d[0].titleHt === t.apres ? ' (déjà fait)' : ''}`)
    fiches.push({ ...t, id: d[0].id, fait: d[0].titleHt === t.apres })
  }
  if (!COMMIT) {
    console.log('\n(à blanc — --commit pour écrire)')
    return
  }
  for (const f of fiches.filter((x) => !x.fait)) {
    await prisma.document.update({ where: { id: f.id }, data: { titleHt: f.apres } })
    await reindexDocument(f.id)
    await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: f.id, meta: { via: 'corriger-titres-creoles-codes-penaux-2025', correction: 'titre créole', avant: f.avant, apres: f.apres, decision: 'dicté par Me Vaval (17 oct. 2026)' } })
  }
  const relus = await prisma.document.findMany({ where: { id: { in: fiches.map((f) => f.id) } }, select: { id: true, titleHt: true } })
  for (const f of fiches) if (relus.find((r) => r.id === f.id)?.titleHt !== f.apres) throw new Error(`⛔ recompte : ${f.source} n'a pas le bon titre`)
  console.log('\n✅ écrit et recompté : 2/2 titres créoles')
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
