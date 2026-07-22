/**
 * Recherche documentaire SQL — Option A (plein-texte natif PostgreSQL).
 *
 * DIFFÉRENCE CAPITALE avec l'ancien moteur : le filtrage ET le classement se font
 * dans PostgreSQL, sur la TOTALITÉ du corpus. L'ancien moteur rapportait 1200
 * candidats triés par DATE puis les scorait en mémoire — tout document plus ancien
 * que le 1200ᵉ était invisible (mesuré : « societe » ne voyait rien avant 2017 sur
 * 7 676 documents appariables). Ici, on ne tronque qu'APRÈS classement global.
 *
 * Score = ts_rank_cd (pondéré par les poids A/B/C posés à l'indexation : titre >
 * résumé > corps) × bonus de type (les textes à contenu intégral priment sur les
 * ~27k entrées de l'Index du Moniteur, qui n'ont qu'un titre).
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { FULLTEXT_TYPES } from '../access'
import type { TsQueryPlan } from './tsquery'

export interface FtsFilters {
  types?: string[]
  status?: string
  juridiction?: string
  matiere?: string
  fiscalYear?: number
  niceClass?: string
  category?: string
  yearFrom?: number
  yearTo?: number
  num?: string
}

export interface FtsRow {
  id: string
  score: number
}

/** Bonus appliqué aux types à contenu intégral (parité avec le moteur historique). */
const TYPE_BOOST = 4

/**
 * Renvoie les `limit` meilleurs documents (classés sur tout le corpus) + le total EXACT
 * de documents appariés. `limit` ne borne que l'affichage, jamais la pertinence.
 */
export async function searchDocumentsSql(
  plan: TsQueryPlan,
  filters: FtsFilters,
  limit: number,
): Promise<{ rows: FtsRow[]; total: number }> {
  if (!plan.query.trim()) return { rows: [], total: 0 }

  // websearch_to_tsquery ne lève jamais sur une saisie libre ; to_tsquery reçoit une
  // expression que nous avons construite (uniquement [a-z0-9], « | », « & », parenthèses).
  const tsq = plan.websearch
    ? Prisma.sql`websearch_to_tsquery('french', ${plan.query})`
    : Prisma.sql`to_tsquery('french', ${plan.query})`

  const conds: Prisma.Sql[] = []
  if (filters.types?.length) conds.push(Prisma.sql`d."type" IN (${Prisma.join(filters.types)})`)
  if (filters.status) conds.push(Prisma.sql`d."status" = ${filters.status}`)
  if (filters.juridiction) conds.push(Prisma.sql`d."juridiction" = ${filters.juridiction}`)
  if (filters.matiere) conds.push(Prisma.sql`d."matiere" = ${filters.matiere}`)
  if (typeof filters.fiscalYear === 'number') conds.push(Prisma.sql`d."fiscalYear" = ${filters.fiscalYear}`)
  if (filters.niceClass) conds.push(Prisma.sql`d."niceClasses" LIKE ${'%' + filters.niceClass + '%'}`)
  if (filters.num) conds.push(Prisma.sql`d."number" ILIKE ${'%' + filters.num + '%'}`)
  if (filters.yearFrom != null) conds.push(Prisma.sql`d."publicationDate" >= ${new Date(Date.UTC(filters.yearFrom, 0, 1))}`)
  if (filters.yearTo != null) conds.push(Prisma.sql`d."publicationDate" < ${new Date(Date.UTC(filters.yearTo + 1, 0, 1))}`)
  // Sous-catégorie de l'Index : filtrée explicitement, sinon on masque les avis-sociétés
  // groupés (représentés par les fiches Société) — même règle que le moteur historique.
  if (filters.category) conds.push(Prisma.sql`d."category" = ${filters.category}`)
  else conds.push(Prisma.sql`(d."category" IS NULL OR d."category" <> 'SOCIETE')`)

  // Expression exacte : sous-chaîne sur le texte folé (exact à toute longueur, contrairement
  // à la recherche de phrase de tsquery bornée au 16 383ᵉ lexème) — index GIN trigram.
  for (const ph of plan.phrases ?? []) conds.push(Prisma.sql`d."searchText" LIKE ${'%' + ph + '%'}`)

  const where = conds.length ? Prisma.sql`AND ${Prisma.join(conds, ' AND ')}` : Prisma.empty

  // ts_rank_cd(..., 32) → score normalisé dans ]0,1[ (rank/(rank+1)), stable et comparable.
  const rows = await prisma.$queryRaw<{ id: string; score: number; total: bigint }[]>(Prisma.sql`
    WITH q AS (SELECT ${tsq} AS tsq)
    SELECT d.id,
           (ts_rank_cd(d."searchTsv", q.tsq, 32)
             * (CASE WHEN d."type" IN (${Prisma.join([...FULLTEXT_TYPES])}) THEN ${TYPE_BOOST} ELSE 1 END))::float8 AS score,
           count(*) OVER () AS total
    FROM "Document" d, q
    WHERE d."searchTsv" @@ q.tsq ${where}
    ORDER BY score DESC, d."publicationDate" DESC NULLS LAST, d.id
    LIMIT ${limit}
  `)

  return {
    rows: rows.map((r) => ({ id: r.id, score: Number(r.score) })),
    total: rows.length,
  }
}

/**
 * Repli ORTHOGRAPHIQUE (fautes de frappe) — trigrammes PostgreSQL.
 *
 * Remplace l'ancien vocabulaire de 60 000 mots reconstruit en mémoire à chaque instance
 * (coûteux à froid, et muet au premier appel — constat d'audit). Ici, l'opérateur `%>`
 * (word_similarity) compare le terme au mot le PLUS PROCHE du texte, en s'appuyant sur
 * l'index GIN trigram déjà en place. Déterministe, sans préchauffage.
 */
export async function searchDocumentsFuzzySql(
  term: string,
  filters: FtsFilters,
  limit: number,
): Promise<{ rows: FtsRow[]; total: number }> {
  const t = term.trim()
  if (t.length < 4) return { rows: [], total: 0 }

  const conds: Prisma.Sql[] = []
  if (filters.types?.length) conds.push(Prisma.sql`d."type" IN (${Prisma.join(filters.types)})`)
  if (filters.status) conds.push(Prisma.sql`d."status" = ${filters.status}`)
  if (filters.category) conds.push(Prisma.sql`d."category" = ${filters.category}`)
  else conds.push(Prisma.sql`(d."category" IS NULL OR d."category" <> 'SOCIETE')`)
  const where = conds.length ? Prisma.sql`AND ${Prisma.join(conds, ' AND ')}` : Prisma.empty

  // Le filtrage `%>` s'appuie sur l'index GIN trigram. Le TRI, lui, évite volontairement
  // word_similarity() par ligne : sur des textes de plusieurs centaines de Ko, ce calcul
  // coûtait ~18 s. On classe par type puis par date (le repli sert à SAUVER une requête
  // sans résultat, pas à trier finement), et l'on affine ensuite sur les titres en JS.
  // `colonne %> mot` (commutateur de `mot <% colonne`) : le MOT est comparé aux extraits du
  // TEXTE, et la colonne indexée est à gauche → l'index GIN trigram est utilisable.
  // Seuil de proximité abaissé POUR CETTE REQUÊTE uniquement (set_config local à la
  // transaction) : le défaut 0.6 rejetait « blanchimant » → « blanchiment » (≈0.55).
  // La transaction garantit que le réglage et la requête partagent la même connexion.
  // Pas de `count(*) OVER ()` ni de tri SQL ici : ils forceraient PostgreSQL à évaluer
  // TOUT l'ensemble apparié (≈10 s sur 19 Mo de texte). Avec un simple LIMIT, le moteur
  // s'arrête dès qu'il a assez de lignes ; le classement fin se fait ensuite sur les
  // TITRES côté application (cf. fts.ts), ce qui est à la fois plus rapide et plus juste.
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('pg_trgm.word_similarity_threshold', '0.45', true)`)
    return tx.$queryRaw<{ id: string; score: number }[]>(Prisma.sql`
      SELECT d.id,
             (CASE WHEN d."type" IN (${Prisma.join([...FULLTEXT_TYPES])}) THEN ${TYPE_BOOST} ELSE 1 END)::float8 AS score
      FROM "Document" d
      WHERE d."searchText" %> ${t} ${where}
      LIMIT ${limit}
    `)
  })

  return {
    rows: rows.map((r) => ({ id: r.id, score: Number(r.score) })),
    total: rows.length,
  }
}
