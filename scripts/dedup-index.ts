/**
 * Dédoublonnage de l'Index du Moniteur — répétitions INTERNES au fichier source.
 *
 * Le fichier maître (DATA ACEVIEWER/INDEX_COMPLET_BELH_1900-2023.json) répète à
 * l'identique certaines lignes (même référence Moniteur + même texte d'article).
 * L'import les reflète fidèlement → 471 documents strictement identiques (number +
 * bodyOriginal). Ce script les fusionne : il conserve UN canonique par groupe et
 * supprime les autres, sans perdre aucun lien société.
 *
 * Sûreté :
 *  - canonique = le doc du groupe portant le PLUS de publications (sinon id min) ;
 *  - les liens société (CompanyPublication, FK SetNull) des doublons sont MIGRÉS
 *    vers le canonique en UNION : on re-pointe ceux que le canonique n'a pas encore,
 *    on supprime les redondants — donc aucune société ne perd de publication ;
 *  - filet : toute publication pointant encore un doc supprimé est retirée (anti-orphelin) ;
 *  - suppression tracée dans AuditLog (DOC_DELETED) ;
 *  - tout en une transaction ; idempotent (relance = plus aucun groupe → no-op).
 *
 *   npx tsx scripts/dedup-index.ts            # aperçu (rien écrit)
 *   npx tsx scripts/dedup-index.ts --commit   # écrit en base
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')

async function main() {
  // Groupes de doublons exacts : même number ET même bodyOriginal, ≥ 2 occurrences.
  const groups: { ids: string[] }[] = await prisma.$queryRawUnsafe(
    `SELECT array_agg(id ORDER BY id) ids FROM "Document" WHERE type='INDEX' GROUP BY number, "bodyOriginal" HAVING count(*) > 1`,
  )
  if (!groups.length) { console.log('Aucun doublon — rien à faire.'); return }

  const allIds = groups.flatMap((g) => g.ids)
  const pubs = await prisma.companyPublication.findMany({
    where: { documentId: { in: allIds } },
    select: { id: true, companyId: true, documentId: true },
  })
  const pubsByDoc = new Map<string, { id: string; companyId: string }[]>()
  for (const p of pubs) {
    const a = pubsByDoc.get(p.documentId!) ?? []
    a.push({ id: p.id, companyId: p.companyId })
    pubsByDoc.set(p.documentId!, a)
  }
  const pubCount = (id: string) => pubsByDoc.get(id)?.length ?? 0

  const toDelete: string[] = []
  const repoint: { pubId: string; to: string }[] = []
  const dropPubs: string[] = []

  for (const g of groups) {
    // Canonique : plus de publications d'abord, puis id le plus petit (déterministe).
    const canonical = g.ids.slice().sort((a, b) => pubCount(b) - pubCount(a) || (a < b ? -1 : 1))[0]
    const cset = new Set((pubsByDoc.get(canonical) ?? []).map((p) => p.companyId))
    for (const id of g.ids) {
      if (id === canonical) continue
      toDelete.push(id)
      for (const pb of pubsByDoc.get(id) ?? []) {
        if (cset.has(pb.companyId)) dropPubs.push(pb.id) // déjà présent sur le canonique → redondant
        else { repoint.push({ pubId: pb.id, to: canonical }); cset.add(pb.companyId) } // unique → migré
      }
    }
  }

  console.log(`Groupes de doublons : ${groups.length}`)
  console.log(`Documents à supprimer : ${toDelete.length}`)
  console.log(`Publications société migrées (re-pointées) : ${repoint.length}`)
  console.log(`Publications société redondantes supprimées : ${dropPubs.length}`)
  console.log(`DB INDEX après dédup (attendu) : ${27705 - toDelete.length}`)

  if (!COMMIT) { console.log('\n(Aperçu — relancer avec --commit pour écrire.)'); return }

  await prisma.$transaction(async (tx) => {
    for (const r of repoint) await tx.companyPublication.update({ where: { id: r.pubId }, data: { documentId: r.to } })
    if (dropPubs.length) await tx.companyPublication.deleteMany({ where: { id: { in: dropPubs } } })
    // Filet anti-orphelin : aucune publication ne doit rester sur un doc supprimé (FK SetNull).
    await tx.companyPublication.deleteMany({ where: { documentId: { in: toDelete } } })
    await audit(
      {
        action: 'DOC_DELETED',
        targetType: 'DOCUMENT',
        meta: {
          actor: 'script:dedup-index',
          reason: 'dédoublonnage des répétitions internes au source (number + bodyOriginal identiques)',
          count: toDelete.length,
          repointedPubs: repoint.length,
          droppedPubs: dropPubs.length,
          ids: toDelete.slice(0, 100),
          truncated: toDelete.length > 100,
        },
      },
      tx,
    )
    await tx.document.deleteMany({ where: { id: { in: toDelete } } })
  }, { timeout: 120000 })

  console.log(`\n✅ Dédup terminé : ${toDelete.length} doublons supprimés, ${repoint.length} liens société migrés.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
