/**
 * Pose les RENVOIS CROISÉS du corpus des jeux de hasard.
 *
 *   npx tsx scripts/renvois-jeux-hasard.ts [--commit]
 *
 * ⚠️ LE `kind` D'UN RENVOI AFFIRME QUELQUE CHOSE, ET LA FICHE L'AFFICHE. `ABROGE` sur un
 * renvoi qui ne fait que citer transforme une mention en abrogation. Les décrets de 2026 ne
 * NOMMENT aucun texte antérieur : leurs visas sont des citations, et rien d'autre. Seule la
 * réforme de septembre 1958 nomme ses cibles — elle seule porte MODIFIE et ABROGE.
 *
 * L'abrogation déduite des décrets de 2026 vit sur l'`ArticleVersion` (statut ABROGE, note
 * portant le raisonnement), jamais sur le renvoi : un renvoi dit d'où à où, une version dit
 * ce qui est advenu de l'article.
 */
import { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()

const R: { de: string; vers: string; kind: string; note: string }[] = [
  // ── La réforme de 1958 nomme sa cible : elle modifie et elle abroge ──────────────────
  { de: 'LOI_LOTERIE_LEH_REFORME_1958', vers: 'LOI_LOTERIE_LEH_1958', kind: 'MODIFIE',
    note: "Réécrit dix articles (3, 4, 5, 6, 8, 14, 15, 19, 24, 28) et abroge les articles 17 et 29. Les articles 5 et 8 ne sont modifiés qu'en partie — premier alinéa pour l'un, 1° pour l'autre." },
  { de: 'LOI_LOTERIE_LEH_1958', vers: 'LOI_LOTERIE_LEH_REFORME_1958', kind: 'VOIR',
    note: "Modifiée par la Loi du 2 septembre 1958." },
  // ── L'arrêté de 1960 applique l'article 34 de la loi organique ───────────────────────
  { de: 'ARRETE_LEH_PERSONNEL_1960', vers: 'LOI_LOTERIE_LEH_1958', kind: 'APPLIQUE',
    note: "Pris en application de l'article 34, qui annonce des règlements généraux par Arrêté du Président de la République pour définir le statut du personnel." },
  { de: 'LOI_LOTERIE_LEH_1958', vers: 'ARRETE_LEH_PERSONNEL_1960', kind: 'VOIR',
    note: "Statut du personnel défini par l'Arrêté du 8 mars 1960, en application de l'article 34." },
  // ── Les trois décrets de 2026 CITENT leurs devanciers, par leurs visas ───────────────
  ...(['DECRET_ANJHA_2026', 'DECRET_JEUX_HASARD_2026', 'DECRET_JEUX_IMPOSITION_2026'].flatMap((de) =>
    [
      { de, vers: 'LOI_LOTERIE_LEH_1958', kind: 'CITE',
        note: "Visé au préambule sous « Loi organique du 21 mars 1958 de la Loterie de l'État Haïtien » — la date du vote au Sénat, la loi étant sanctionnée le 24 mars et publiée le 14 avril." },
      { de, vers: 'LOI_LOTERIE_LEH_REFORME_1958', kind: 'CITE', note: 'Visé au préambule.' },
      { de, vers: 'DECRET_CASINOS_1960', kind: 'CITE', note: 'Visé au préambule.' },
    ])),
  // ── Les trois de 2026 forment un ensemble : qui régule, ce qui est permis, ce qui est dû
  { de: 'DECRET_JEUX_HASARD_2026', vers: 'DECRET_ANJHA_2026', kind: 'VOIR',
    note: "L'« Autorité compétente » de ce décret est l'Autorité Nationale des Jeux de Hasard et d'Argent, créée par le Décret du 11 août 2026." },
  { de: 'DECRET_JEUX_IMPOSITION_2026', vers: 'DECRET_ANJHA_2026', kind: 'VOIR',
    note: "Les droits et prélèvements sont perçus au profit de l'Autorité Nationale des Jeux de Hasard et d'Argent." },
  { de: 'DECRET_JEUX_IMPOSITION_2026', vers: 'DECRET_JEUX_HASARD_2026', kind: 'VOIR',
    note: "Les licences imposées par ce décret sont celles que le Décret portant règlementation institue en son article 7." },
  { de: 'DECRET_ANJHA_2026', vers: 'DECRET_JEUX_HASARD_2026', kind: 'VOIR',
    note: "L'Autorité créée par ce décret exerce les attributions que lui confie le Décret portant règlementation." },
  { de: 'DECRET_ANJHA_2026', vers: 'DECRET_JEUX_IMPOSITION_2026', kind: 'VOIR',
    note: "Le régime d'imposition applicable aux jeux est fixé par le Décret du 11 août 2026." },
]

async function main() {
  const commit = process.argv.includes('--commit')
  const docs = await prisma.document.findMany({
    where: { source: { in: [...new Set(R.flatMap((x) => [x.de, x.vers]))] } },
    select: { id: true, source: true, titleFr: true },
  })
  const par = new Map(docs.map((d) => [d.source!, d]))
  const manquants = [...new Set(R.flatMap((x) => [x.de, x.vers]))].filter((s) => !par.has(s))
  if (manquants.length) { console.error('⛔ ARRÊT — textes absents : ' + manquants.join(', ')); process.exit(1) }

  console.log(`RENVOIS CROISÉS — ${R.length} à poser\n`)
  const parKind = new Map<string, number>()
  for (const x of R) parKind.set(x.kind, (parKind.get(x.kind) ?? 0) + 1)
  for (const [k, n] of [...parKind].sort()) console.log(`   ${k.padEnd(10)} ${n}`)
  console.log('\n   ⚠ aucun ABROGE : les décrets de 2026 ne nomment personne (voir l’en-tête).')

  if (!commit) { console.log('\n(à blanc — ajouter --commit pour écrire)'); await prisma.$disconnect(); return }
  const deja = await prisma.crossRef.count({ where: { fromId: { in: docs.map((d) => d.id) } } })
  if (deja) { console.error(`\n⛔ ARRÊT — ${deja} renvois existent déjà.`); process.exit(1) }
  for (const [i, x] of R.entries()) {
    const de = par.get(x.de)!, vers = par.get(x.vers)!
    await prisma.crossRef.create({
      data: { fromId: de.id, toId: vers.id, toLabel: vers.titleFr, kind: x.kind, note: x.note, source: 'EDITORIAL', position: i },
    })
  }
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', meta: { via: 'renvois-jeux-hasard', renvois: R.length } })
  console.log(`\n✅ ${R.length} renvois posés.`)
  await prisma.$disconnect()
}

main()
