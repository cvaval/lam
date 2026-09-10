import { prisma } from './db'
import { foldedLikePattern, TARIF_FOLD_CAP } from './tarifs'

/**
 * Positions dont la DÉSIGNATION correspond à la requête, ACCENTS REPLIÉS des deux côtés.
 *
 * ⚠️ POURQUOI CE DÉTOUR PAR DU SQL BRUT. `mode: 'insensitive'` de Prisma attrape la casse,
 * jamais les accents : « ecran » ne trouvait pas « écran », « depot » pas « dépôt ». Le
 * repli exige `unaccent()` des deux côtés de la comparaison, et Prisma ne sait pas appeler
 * une fonction SQL dans un `where`. L'extension est installée sur cette base (schéma
 * `public`, v1.1) — je l'avais affirmée absente le 9 septembre, à tort.
 *
 * ⚠️ BALAYAGE COMPLET ASSUMÉ, ET MESURÉ : 236 ms sur les 5 918 positions, table entièrement
 * en cache. Un index d'expression irait plus vite, mais `unaccent()` est STABLE et non
 * IMMUTABLE : l'indexer suppose une fonction enveloppe et donc une MIGRATION, que la
 * consigne interdit. Sur une table de cette taille, le balayage est le bon compromis ; il
 * cesserait de l'être si le tarif dépassait quelques dizaines de milliers de lignes.
 *
 * ⚠️ `public.unaccent` est QUALIFIÉ : le `search_path` d'une connexion applicative n'est pas
 * celui d'une session d'administration, et une fonction non qualifiée s'y perd en silence.
 *
 * Ne lève jamais : le repli est un CONFORT qui s'ajoute à la recherche littérale. Si la
 * requête échoue (extension retirée, droits changés), la recherche doit continuer de rendre
 * ce qu'elle rendait avant, pas une page d'erreur.
 */
export async function tariffFoldedIds(q: string): Promise<string[]> {
  const motif = foldedLikePattern(q)
  if (!motif) return []
  try {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "CustomsTariff"
      WHERE public.unaccent(designation) ILIKE public.unaccent(${motif})
      LIMIT ${TARIF_FOLD_CAP}
    `
    return rows.map((r) => r.id)
  } catch {
    return []
  }
}
