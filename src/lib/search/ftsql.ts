/**
 * Recherche documentaire SQL — plein-texte natif PostgreSQL.
 *
 * DIFFÉRENCE CAPITALE avec l'ancien moteur : le filtrage ET le classement se font
 * dans PostgreSQL, sur la TOTALITÉ du corpus. L'ancien moteur rapportait 1200
 * candidats triés par DATE puis les scorait en mémoire — tout document plus ancien
 * que le 1200ᵉ était invisible. Ici, on ne tronque qu'APRÈS classement.
 *
 * Configuration `simple` (sans racinisation) : cf. l'en-tête de `tsquery.ts` pour la
 * démonstration (le racinisateur `french` confond « loyer » et « loi »).
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

/** Ordre demandé : pertinence (défaut), date de signature, date d'entrée en vigueur. */
export type FtsOrder = 'relevance' | 'sig' | 'eff'

export interface FtsRow {
  id: string
  score: number
}

/** Bonus appliqué aux types à contenu intégral (parité avec le moteur historique). */
const TYPE_BOOST = 4

/**
 * Traduit les filtres en conditions SQL — source UNIQUE, partagée par la recherche
 * plein-texte ET par le repli orthographique. Le repli n'appliquait auparavant que
 * `types`/`status`/`category` : une recherche filtrée « 1950-1980 » comportant une
 * faute de frappe rapportait des documents hors période (constat d'audit).
 */
function filterConds(filters: FtsFilters): Prisma.Sql[] {
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
  return conds
}

/** Clause ORDER BY correspondant au tri demandé (la pertinence reste le défaut). */
function orderClause(order: FtsOrder): Prisma.Sql {
  if (order === 'sig') return Prisma.sql`d."publicationDate" DESC NULLS LAST, d.id`
  if (order === 'eff') return Prisma.sql`d."effectiveDate" DESC NULLS LAST, d.id`
  return Prisma.sql`score DESC, d."publicationDate" DESC NULLS LAST, d.id`
}

/**
 * Renvoie les `limit` meilleurs documents (classés sur tout le corpus) + le total EXACT
 * de documents appariés. `limit` ne borne que l'affichage, jamais la pertinence.
 */
export async function searchDocumentsSql(
  plan: TsQueryPlan,
  filters: FtsFilters,
  limit: number,
  order: FtsOrder = 'relevance',
): Promise<{ rows: FtsRow[]; total: number }> {
  if (!plan.query.trim()) return { rows: [], total: 0 }

  const conds = filterConds(filters)
  // Expression exacte : sous-chaîne sur le texte folé (exact à toute longueur, contrairement
  // à la recherche de phrase de tsquery bornée au 16 383ᵉ lexème) — index GIN trigram.
  // Les jokers `%`/`_` de la saisie ont été échappés par buildTsQuery (escapeLike) : sans
  // cela, chercher « 50%000 » entre guillemets se comportait comme un joker (208 documents
  // rapportés au lieu de 0 — constat d'audit).
  for (const ph of plan.phrases ?? []) conds.push(Prisma.sql`d."searchText" LIKE ${'%' + ph + '%'}`)

  const where = conds.length ? Prisma.sql`AND ${Prisma.join(conds, ' AND ')}` : Prisma.empty

  // ts_rank_cd(..., 32) → score normalisé dans ]0,1[ (rank/(rank+1)), stable et comparable.
  const rows = await prisma.$queryRaw<{ id: string; score: number; total: bigint }[]>(Prisma.sql`
    WITH q AS (SELECT to_tsquery('simple', ${plan.query}) AS tsq)
    SELECT d.id,
           (ts_rank_cd(d."searchTsv", q.tsq, 32)
             * (CASE WHEN d."type" IN (${Prisma.join([...FULLTEXT_TYPES])}) THEN ${TYPE_BOOST} ELSE 1 END))::float8 AS score,
           count(*) OVER () AS total
    FROM "Document" d, q
    WHERE d."searchTsv" @@ q.tsq ${where}
    ORDER BY ${orderClause(order)}
    LIMIT ${limit}
  `)

  return {
    // Total EXACT sur tout le corpus apparié (fonction de fenêtrage), et NON le nombre de
    // lignes rapportées : `rows.length` plafonnait le total à la profondeur d'affichage —
    // l'interface annonçait « 800 résultats » là où le corpus en comptait 537 ou 7 000
    // selon le terme (constat d'audit).
    rows: rows.map((r) => ({ id: r.id, score: Number(r.score) })),
    total: rows.length ? Number(rows[0].total) : 0,
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

  const conds = filterConds(filters)
  const where = conds.length ? Prisma.sql`AND ${Prisma.join(conds, ' AND ')}` : Prisma.empty

  // Le filtrage `%>` s'appuie sur l'index GIN trigram. Le TRI, lui, évite volontairement
  // word_similarity() par ligne : sur des textes de plusieurs centaines de Ko, ce calcul
  // coûtait ~18 s. On classe ensuite sur les TITRES en JS (cf. fts.ts) — plus rapide et
  // plus juste. `d.id` en ordre garantit un jeu STABLE d'une page à l'autre (sans ORDER BY,
  // PostgreSQL était libre de renvoyer des lignes différentes à chaque appel).
  // `colonne %> mot` (commutateur de `mot <% colonne`) : le MOT est comparé aux extraits du
  // TEXTE, et la colonne indexée est à gauche → l'index GIN trigram est utilisable.
  // Seuil de proximité abaissé POUR CETTE REQUÊTE uniquement (set_config local à la
  // transaction) : le défaut 0.6 rejetait « blanchimant » → « blanchiment » (≈0.55).
  // La transaction garantit que le réglage et la requête partagent la même connexion ;
  // son délai est porté à 20 s car ce chemin mesure ~4 s — au-dessus du défaut Prisma
  // (5 s), il échouait par intermittence et le repli disparaissait sans bruit.
  const rows = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('pg_trgm.word_similarity_threshold', '0.45', true)`)
      return tx.$queryRaw<{ id: string; score: number }[]>(Prisma.sql`
        SELECT d.id,
               (CASE WHEN d."type" IN (${Prisma.join([...FULLTEXT_TYPES])}) THEN ${TYPE_BOOST} ELSE 1 END)::float8 AS score
        FROM "Document" d
        WHERE d."searchText" %> ${t} ${where}
        ORDER BY d.id
        LIMIT ${limit}
      `)
    },
    { timeout: 20_000, maxWait: 5_000 },
  )

  return {
    rows: rows.map((r) => ({ id: r.id, score: Number(r.score) })),
    total: rows.length,
  }
}
