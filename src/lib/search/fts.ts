import { prisma } from '../db'
import type { Prisma } from '@prisma/client'
import { expandQuery, SYNONYMS } from './synonyms'
import { buildTsQuery, toOrQuery } from './tsquery'
import { searchDocumentsSql, searchDocumentsFuzzySql, type FtsFilters } from './ftsql'
import { fuzzyExpand } from './fuzzy'
import { makeSnippet } from './highlight'
import { fold, extractAnnotationsText } from './normalize'
import { SEARCH_FIELD_WEIGHTS, ANNOTATIONS_SEARCH_WEIGHT } from './fields'
import { pickLocale } from '../i18n/pick'
import { DOC_TYPE_META } from '../brand'
import { PAGE_SIZE, MAX_PAGE_SIZE } from './types'
import type { SearchProvider, SearchQuery, SearchResult, SearchHit } from './types'
import type { DocType, DocStatus, Locale } from '../types'
import { FULLTEXT_TYPES } from '../access'
import { parseCirculaireRef } from '../brh/gaps'

// Mots vides ignorés pour le calcul de couverture (un mot « de » ne compte pas).
const STOPWORDS = new Set([
  'de', 'la', 'le', 'les', 'des', 'du', 'et', 'en', 'au', 'aux', 'un', 'une', 'sur', 'pour', 'par',
  'of', 'the', 'and', 'for', 'to', 'in', 'on',
])

/** Groupes de synonymes des mots de contenu de la requête (pour la couverture). */
function buildGroups(q: string): string[][] {
  const words = fold(q).split(/\s+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w))
  const uniq = [...new Set(words)]
  return uniq.map((w) => {
    const set = new Set([w])
    const syn = SYNONYMS[w]
    if (syn) for (const s of syn) set.add(fold(s))
    return [...set]
  })
}

/**
 * Pertinence par correspondance de NOM : récompense fortement la couverture de TOUS
 * les mots de la requête + une correspondance de phrase exacte. C'est ce qui fait
 * remonter « Société Agricole de Soisson de Nippes S.A. » au-dessus des sociétés qui ne
 * partagent qu'un mot.
 */
function nameRelevance(primaryFold: string, groups: string[][], queryFold: string): number {
  if (!groups.length) return 0
  let matched = 0
  for (const g of groups) if (g.some((w) => primaryFold.includes(w))) matched++
  const coverage = matched / groups.length // 0..1
  let phrase = 0
  if (queryFold.length >= 3 && primaryFold.includes(queryFold)) phrase = primaryFold === queryFold ? 400 : 220
  return coverage * 140 + phrase
}

interface RelevanceCtx {
  groups: string[][]
  queryFold: string
}

// Plafond du jeu de candidats rapporté du SQL pour le scoring en mémoire.
// N'est plus utilisé par le chemin principal (plein-texte SQL, classement global) —
// conservé pour le REPLI orthographique (fuzzy), qui ne concerne que des requêtes
// sans correspondance exacte, donc peu volumineuses.
const CANDIDATE_LIMIT = 1200
const FUZZY_CANDIDATE_LIMIT = 600

// Profondeur du classement plein-texte rapportée de SQL. Ne borne QUE l'affichage :
// le classement, lui, est calculé par PostgreSQL sur la TOTALITÉ des documents appariés
// (c'est ce qui supprime le trou de rappel de l'ancien plafond par date).
const FTS_DEPTH = 400
// Poids du rang plein-texte (ts_rank_cd ∈ ]0,1[, × bonus de type) ramené sur l'échelle
// de `nameRelevance` (0…540) pour rester comparable aux scores des fiches Société.
const FTS_WEIGHT = 120

// Projection : colonnes réellement lues en JS (scoring + affichage). Exclut
// volontairement `searchText` (jamais lu hors WHERE) et `bodyOriginal` (corps
// volumineux, jusqu'à ~460k car.) — sans cette projection, chaque requête
// transférait des Mo inutiles pour jusqu'à 1200 candidats (5-37 s/requête).
const DOC_SELECT = {
  id: true, type: true, status: true,
  titleFr: true, titleEn: true, titleHt: true,
  summaryFr: true, summaryEn: true, summaryHt: true,
  number: true, bhdaNumber: true, holder: true, author: true,
  keywords: true, revue: true, matiere: true, juridiction: true,
  moniteurRef: true, publicationDate: true, niceClasses: true, imageUrl: true,
  // Texte des annotations (jurisprudence/commentaires/connexe/index) : nécessaire au SCORING
  // des mots d'arrêts (hors bodyOriginal). Léger — non nul seulement pour les ~10 textes
  // annotés ; nul (donc quasi gratuit) pour les ~28k entrées de l'Index du Moniteur.
  annotationsJson: true,
} satisfies Prisma.DocumentSelect

interface Weighted {
  value: string | null | undefined
  weight: number
}

/**
 * Moteur de recherche intégré (zéro infrastructure), dimensionné pour l'Index du
 * Moniteur (~28k entrées). Deux temps (recherche dynamique) :
 *  1) correspondances EXACTES (sous-chaîne + synonymie translingue) ;
 *  2) correspondances APPROCHANTES (orthographe proche, distance d'édition ≤ 2).
 * Les avis-sociétés groupés (catégorie SOCIETE) sont masqués au profit des fiches
 * Société individuelles (référence unique par société). Résultats dédupliqués par titre.
 */
export class FtsProvider implements SearchProvider {
  readonly name = 'fts' as const

  async search(query: SearchQuery): Promise<SearchResult> {
    const terms = expandQuery(query.q)
    const queryFold = fold(query.q)
    const groups = buildGroups(query.q)
    // Défense en profondeur : un page NaN/≤0 retombe sur 1 (jamais de skip négatif/NaN).
    const page = Math.max(1, Math.trunc(query.page ?? 1) || 1)
    const size = Math.min(MAX_PAGE_SIZE, query.size ?? PAGE_SIZE)

    const base: Prisma.DocumentWhereInput = {}
    if (query.types?.length) base.type = { in: query.types }
    if (query.status) base.status = query.status
    if (query.juridiction) base.juridiction = query.juridiction
    if (query.matiere) base.matiere = query.matiere
    if (typeof query.fiscalYear === 'number') base.fiscalYear = query.fiscalYear
    if (query.niceClass) base.niceClasses = { contains: query.niceClass }
    // Sous-catégorie de l'Index (LOI, DECRET, ARRETE, AVIS, SOCIETE…).
    if (query.category) base.category = query.category
    // Période de publication « entre l'année X et Y » (bornes inclusives) —
    // l'année exacte de la puce BRH est déjà fusionnée en amont (runSearch).
    if (query.yearFrom != null || query.yearTo != null) {
      base.publicationDate = {
        ...(query.yearFrom != null ? { gte: new Date(Date.UTC(query.yearFrom, 0, 1)) } : {}),
        ...(query.yearTo != null ? { lt: new Date(Date.UTC(query.yearTo + 1, 0, 1)) } : {}),
      }
    }
    if (query.num) base.number = { contains: query.num }

    // ── Navigation (sans requête texte) : pagination SQL, ou tri par numéro en mémoire ──
    if (!terms.length) {
      // Tri par NUMÉRO : `number` est une chaîne (« Circulaire n° 131 ») → tri numérique
      // impossible en SQL. On charge l'ensemble filtré (borné) et on trie en JS.
      // RÉSERVÉ aux circulaires BRH (seul type au numéro sériel) : ailleurs, un
      // ?sort=num-* résiduel (persisté en changeant d'onglet) retombe sur le tri
      // par date — sinon l'Index (27k lignes) chargerait 5 000 lignes lourdes
      // et afficherait un total plafonné.
      const numSortable = query.types?.length === 1 && query.types[0] === 'CIRCULAIRE_BRH'
      if (numSortable && (query.sort === 'num-asc' || query.sort === 'num-desc')) {
        const allDocs = await prisma.document.findMany({ where: base, take: 5000, select: DOC_SELECT })
        sortByCirculaireNumber(allDocs, query.sort === 'num-desc' ? -1 : 1)
        const pageDocs = allDocs.slice((page - 1) * size, (page - 1) * size + size)
        const hits = pageDocs.map((d) => toDocHit(d, terms, query.locale, 0.5, false))
        await this.enrichSnippets(hits, terms)
        return { total: allDocs.length, hits, expandedTerms: terms, provider: 'fts' }
      }
      // Tri par DATE : signature (publicationDate, défaut) ou entrée en vigueur, récent
      // d'abord, sans-date en fin.
      const orderBy: Prisma.DocumentOrderByWithRelationInput =
        query.sort === 'eff'
          ? { effectiveDate: { sort: 'desc', nulls: 'last' } }
          : { publicationDate: { sort: 'desc', nulls: 'last' } }
      const [total, docs] = await Promise.all([
        prisma.document.count({ where: base }),
        prisma.document.findMany({ where: base, orderBy, skip: (page - 1) * size, take: size, select: DOC_SELECT }),
      ])
      const hits = docs.map((d) => toDocHit(d, terms, query.locale, 0.5, false))
      await this.enrichSnippets(hits, terms)
      return { total, hits, expandedTerms: terms, provider: 'fts' }
    }

    // ── 1) Correspondances exactes ── (documents et sociétés en parallèle : -1 aller-retour)
    // Documents : PLEIN-TEXTE NATIF PostgreSQL — filtrage ET classement en SQL sur tout le
    // corpus (plus de plafond par date). Repli sur l'ancien `contains` trigram si la colonne
    // vectorielle n'est pas encore migrée ou si la requête ne produit aucun lexème.
    const plan = buildTsQuery(query.q)
    const filters: FtsFilters = {
      types: query.types as string[] | undefined,
      status: query.status ?? undefined,
      juridiction: query.juridiction ?? undefined,
      matiere: query.matiere ?? undefined,
      fiscalYear: typeof query.fiscalYear === 'number' ? query.fiscalYear : undefined,
      niceClass: query.niceClass ?? undefined,
      category: query.category ?? undefined,
      yearFrom: query.yearFrom ?? undefined,
      yearTo: query.yearTo ?? undefined,
      num: query.num ?? undefined,
    }
    const depth = Math.max(FTS_DEPTH, page * size + size)
    const ctx = { groups, queryFold }
    const [ftsDocs, exactCompanies] = await Promise.all([
      plan ? this.fetchDocHitsFts(plan, filters, depth, query.locale, ctx, terms) : Promise.resolve(null),
      this.fetchCompanyHits(terms, query, ctx, false, new Set()),
    ])
    const exactDocs = ftsDocs ? ftsDocs.hits : await this.fetchDocHits(terms, base, query.locale, ctx, false)
    const docTotal = ftsDocs ? ftsDocs.total : exactDocs.length
    const exact = [...exactDocs, ...exactCompanies].sort((a, b) => b.score - a.score || sortByDate(a, b))

    // ── 2) Correspondances approchantes (orthographe proche) ──
    // Tentée UNIQUEMENT si l'exact ne remplit pas une page : évite de construire le
    // vocabulaire fuzzy (lecture du corpus, coûteuse à froid) pour la grande majorité
    // des requêtes qui ont des correspondances exactes. La correction orthographique
    // n'intervient que lorsque l'exact est insuffisant.
    let fuzzy: SearchHit[] = []
    let fuzzyTerms: string[] = []
    // Repli ORTHOGRAPHIQUE par trigrammes SQL (déterministe, sans préchauffage) — tenté en
    // premier dès que l'exact ne remplit pas une page.
    if (exact.length === 0 && plan && plan.words.length) {
      const longest = [...plan.words].sort((a, b) => b.length - a.length)[0]
      try {
        const fz = await searchDocumentsFuzzySql(longest, filters, depth)
        if (fz.rows.length) {
          const seenIds = new Set(exactDocs.map((h) => h.id))
          const { annotationsJson: _s, ...LIGHT } = DOC_SELECT
          const rows = await prisma.document.findMany({ where: { id: { in: fz.rows.map((r) => r.id) } }, select: LIGHT })
          const m = new Map(rows.map((d) => [d.id, d as DocRow]))
          // Classement fin : proximité du terme mal orthographié avec le MOT le plus proche
          // du titre (le SQL n'a fait que présélectionner, sans trier — cf. ftsql.ts).
          for (const r of fz.rows) {
            const d = m.get(r.id)
            if (!d || seenIds.has(d.id)) continue
            const title = fold([d.titleFr, d.titleHt, d.titleEn, d.number].filter(Boolean).join(' '))
            const prox = bestWordProximity(longest, title)
            fuzzy.push(toDocHit(d, terms, query.locale, (prox * 200 + r.score) * 0.4, true))
          }
          fuzzy.sort((a, b) => b.score - a.score || sortByDate(a, b))
        }
      } catch {
        /* trigram indisponible → on laisse le repli historique ci-dessous */
      }
    }
    if (exact.length === 0 && fuzzy.length === 0) {
      const queryWords = fold(query.q).split(/\s+/).filter((w) => w.length >= 4)
      const exactSet = new Set(terms)
      const fuzzyTermSet = new Set<string>()
      for (const w of queryWords) {
        for (const f of await fuzzyExpand(w)) if (!exactSet.has(f)) fuzzyTermSet.add(f)
      }
      fuzzyTerms = [...fuzzyTermSet]
      if (fuzzyTerms.length) {
        const seenDocIds = new Set(exactDocs.map((h) => h.id))
        const seenCoIds = new Set(exactCompanies.map((h) => h.id))
        const [fDocsRaw, fCos] = await Promise.all([
          this.fetchDocHits(fuzzyTerms, base, query.locale, ctx, true, FUZZY_CANDIDATE_LIMIT),
          this.fetchCompanyHits(fuzzyTerms, query, ctx, true, seenCoIds),
        ])
        const fDocs = fDocsRaw.filter((h) => !seenDocIds.has(h.id) && !fuzzy.some((x) => x.id === h.id))
        fuzzy = [...fuzzy, ...fDocs, ...fCos].sort((a, b) => b.score - a.score || sortByDate(a, b))
      }
    }

    // Déduplication par clé (société = id, document = titre folé) — exact prioritaire.
    const seen = new Set<string>()
    const all: SearchHit[] = []
    for (const h of [...exact, ...fuzzy]) {
      const key = h.kind === 'company' ? `c:${h.id}` : `d:${fold(h.title)}`
      if (seen.has(key)) continue
      seen.add(key)
      all.push(h)
    }

    // Total : EXACT pour les documents (compté en SQL sur tout le corpus, pas seulement sur
    // les candidats rapportés) + fiches Société + éventuels résultats approchants.
    // La profondeur rapportée croît avec la page demandée : la pagination reste servie.
    const total = ftsDocs ? docTotal + exactCompanies.length + fuzzy.length : all.length
    const start = (page - 1) * size
    const pageHits = all.slice(start, start + size)
    // Les extraits (snippets) issus du corps ne sont calculés que pour la page affichée
    // — le corps n'est jamais transféré pour l'ensemble des candidats.
    await this.enrichSnippets(pageHits, [...terms, ...fuzzyTerms])
    return { total, hits: pageHits, expandedTerms: [...terms, ...fuzzyTerms], provider: 'fts' }
  }

  /**
   * Restaure l'extrait texte (snippet) à partir du corps du document — UNIQUEMENT pour
   * les hits document de la page affichée dont le résumé est absent (snippet vide). Le
   * corps (`bodyOriginal`) n'est ainsi jamais transféré pour l'ensemble des candidats,
   * seulement pour les ≤ 20-50 résultats réellement montrés.
   */
  private async enrichSnippets(hits: SearchHit[], terms: string[]): Promise<void> {
    const need = hits.filter((h) => h.kind === 'document' && !h.snippet)
    if (!need.length) return
    const rows = await prisma.document.findMany({
      where: { id: { in: need.map((h) => h.id) } },
      select: { id: true, bodyOriginal: true },
    })
    const bodyById = new Map(rows.map((r) => [r.id, r.bodyOriginal]))
    for (const h of need) h.snippet = makeSnippet(bodyById.get(h.id) || h.title, terms)
  }

  /**
   * Chemin PRINCIPAL : plein-texte natif PostgreSQL. PostgreSQL apparie et CLASSE sur tout
   * le corpus ; on ne rapatrie que les `depth` meilleurs, puis on hydrate ces seules lignes.
   * Le rang FTS est recombiné avec `nameRelevance` (couverture des mots + phrase dans le
   * titre/n°) pour rester sur la même échelle que les fiches Société.
   * Renvoie null si la colonne vectorielle est absente (migration non jouée) → l'appelant
   * retombe alors sur l'ancien chemin trigram, sans rupture de service.
   */
  private async fetchDocHitsFts(
    plan: NonNullable<ReturnType<typeof buildTsQuery>>,
    filters: FtsFilters,
    depth: number,
    locale: Locale,
    ctx: RelevanceCtx,
    terms: string[],
  ): Promise<{ hits: SearchHit[]; total: number } | null> {
    let res: Awaited<ReturnType<typeof searchDocumentsSql>>
    try {
      res = await searchDocumentsSql(plan, filters, depth)
      // Le ET n'a rien donné → on élargit au OU avant de céder la place au fuzzy.
      if (!res.total) {
        const or = toOrQuery(plan)
        if (or) res = await searchDocumentsSql({ ...plan, query: or }, filters, depth)
      }
    } catch {
      return null // colonne/index absents → repli transparent
    }
    if (!res.rows.length) return { hits: [], total: res.total }

    // annotationsJson n'est PAS chargé ici : le scoring est fait par PostgreSQL, et ce champ
    // pèse jusqu'à ~590 Ko sur les codes annotés (transfert inutile pour la page affichée).
    const { annotationsJson: _skip, ...LIGHT } = DOC_SELECT
    const docs = await prisma.document.findMany({ where: { id: { in: res.rows.map((r) => r.id) } }, select: LIGHT })
    const byId = new Map(docs.map((d) => [d.id, d as DocRow]))
    const hits: SearchHit[] = []
    for (const r of res.rows) {
      const d = byId.get(r.id)
      if (!d) continue
      // Couverture des mots de la requête dans le titre + n° (fait primer la meilleure
      // correspondance de nom) ; le bonus de TYPE est déjà appliqué côté SQL.
      const rel = nameRelevance(fold([d.titleFr, d.titleHt, d.titleEn, d.number].filter(Boolean).join(' ')), ctx.groups, ctx.queryFold)
      hits.push(toDocHit(d, terms, locale, rel + r.score * FTS_WEIGHT, false))
    }
    return { hits, total: res.total }
  }

  private async fetchDocHits(
    terms: string[],
    base: Prisma.DocumentWhereInput,
    locale: Locale,
    ctx: RelevanceCtx,
    fuzzy: boolean,
    limit = CANDIDATE_LIMIT,
  ): Promise<SearchHit[]> {
    // Pour le WHERE `contains`, on écarte les termes < 3 car. : l'index GIN trigram ne les
    // couvre pas → scan séquentiel (constat d'audit §20). Les termes complets restent utilisés
    // pour le scoring/surlignage. Repli sur tous les termes si la requête EST courte.
    const idxTerms = terms.filter((t) => t.length >= 3)
    const orTerms = idxTerms.length ? idxTerms : terms
    const where: Prisma.DocumentWhereInput = {
      ...base,
      AND: [
        { OR: orTerms.map((t) => ({ searchText: { contains: t } })) },
        // Masque les avis-sociétés groupés (représentés par les fiches Société) —
        // sauf si une sous-catégorie est explicitement filtrée par l'utilisateur.
        ...(base.category == null ? [{ OR: [{ category: null }, { category: { not: 'SOCIETE' } }] }] : []),
      ],
    }
    const docs = await prisma.document.findMany({ where, take: limit, orderBy: { publicationDate: 'desc' }, select: DOC_SELECT })
    const hits: SearchHit[] = []
    for (const d of docs) {
      const fieldScore = scoreFields(weightedFields(d), terms)
      if (fieldScore <= 0) continue
      // Couverture des mots de la requête dans le titre + n° (fait primer la meilleure correspondance).
      const rel = nameRelevance(fold([d.titleFr, d.titleHt, d.titleEn, d.number].filter(Boolean).join(' ')), ctx.groups, ctx.queryFold)
      // Boost de TYPE : les textes à contenu intégral priment sur l'Index du Moniteur (titre seul),
      // qui sinon noyait les circulaires/codes lors d'une recherche par mot du corps (constat cliente).
      const typeBoost = FULLTEXT_TYPES.includes(d.type as DocType) ? 4 : 1
      const score = (rel + fieldScore * 0.3) * typeBoost
      hits.push(toDocHit(d, terms, locale, fuzzy ? score * 0.4 : score, fuzzy))
    }
    return hits
  }

  private async fetchCompanyHits(
    terms: string[],
    query: SearchQuery,
    ctx: RelevanceCtx,
    fuzzy: boolean,
    exclude: Set<string>,
  ): Promise<SearchHit[]> {
    // Les sociétés appartiennent à l'Index : on les affiche en recherche large (« tous »)
    // ou dès que l'Index est dans le périmètre, et on ne les masque QUE si l'utilisateur a
    // filtré sur un type de document précis HORS Index. Régression §03 : la refonte « accès
    // par service » passait désormais le périmètre d'accès complet (allowed, jamais vide)
    // comme `types`, ce qui faisait tomber l'ancienne garde `query.types?.length` et
    // masquait TOUTES les sociétés de la recherche.
    if (query.includeCompanies === false) return []
    if (query.types?.length && !query.types.includes('INDEX')) return []
    const include = { publications: { take: 1, orderBy: { date: 'desc' as const } }, _count: { select: { publications: true } } }
    // Recherche sur le nom accent-folé (searchName) pour matcher « Société » avec « societe ».
    const cTerms = terms.filter((t) => t.length >= 3)
    const effTerms = cTerms.length ? cTerms : terms // index trigram : ≥3 car. (audit §20)
    const orWhere = {
      OR: effTerms.flatMap((t) => [{ searchName: { contains: t } }, { nif: { contains: t } }, { rcNumber: { contains: t } }]),
    }
    // Pour une requête multi-mots, on exige d'abord que le NOM contienne TOUS les mots
    // (la société dont le nom correspond le mieux est ainsi trouvée à coup sûr), puis
    // on élargit (OR) si nécessaire.
    let companies: Prisma.CompanyGetPayload<{
      include: { publications: true; _count: { select: { publications: true } } }
    }>[] = []
    if (!fuzzy && ctx.groups.length > 1) {
      const andWhere = { AND: ctx.groups.map((g) => ({ OR: g.map((w) => ({ searchName: { contains: w } })) })) }
      companies = await prisma.company.findMany({ where: andWhere, include, take: 400 })
    }
    if (!companies.length) {
      companies = await prisma.company.findMany({ where: orWhere, include, take: 400 })
    }
    const hits: SearchHit[] = []
    for (const c of companies) {
      if (exclude.has(c.id)) continue
      const fieldScore = scoreFields(
        [
          { value: c.name, weight: 8 },
          { value: c.nif, weight: 5 },
          { value: c.rcNumber, weight: 5 },
        ],
        terms,
      )
      if (fieldScore <= 0) continue
      const rel = nameRelevance(fold(c.name), ctx.groups, ctx.queryFold)
      // La société prime sur les textes ; le score de nom (couverture + phrase) ordonne les sociétés.
      const score = (rel + fieldScore * 0.3) * (fuzzy ? 0.4 : 1) + 12
      const pub = c.publications[0]
      hits.push({
        kind: 'company',
        id: c.id,
        title: c.name,
        // Référence unique de la société (et non l'ensemble de l'édition du Moniteur).
        snippet: '',
        moniteurRef: pub?.moniteurRef ?? null,
        publicationDate: pub?.date?.toISOString() ?? null,
        refCount: c._count.publications,
        score,
        fuzzy,
      })
    }
    return hits
  }
}

type DocRow = Prisma.DocumentGetPayload<{ select: typeof DOC_SELECT }>

function weightedFields(d: DocRow): Weighted[] {
  // Poids issus de SEARCH_FIELD_WEIGHTS — source unique (search/fields.ts).
  const fields: Weighted[] = SEARCH_FIELD_WEIGHTS.map(({ field, weight }) => ({
    value: (d as Record<string, unknown>)[field] as string | null,
    weight,
  }))
  // Texte des annotations (jurisprudence/commentaires/connexe/index), hors colonnes cherchables :
  // scoré pour que les mots des ARRÊTS des codes annotés ressortent (parité avec OpenSearch).
  fields.push({ value: extractAnnotationsText(d.annotationsJson), weight: ANNOTATIONS_SEARCH_WEIGHT })
  return fields
}

function toDocHit(d: DocRow, terms: string[], locale: Locale, score: number, fuzzy: boolean): SearchHit {
  const meta = DOC_TYPE_META[d.type as DocType]
  // Le corps (bodyOriginal) n'est PAS chargé ici (perf) : l'extrait provient du résumé ;
  // à défaut, snippet vide → restauré depuis le corps par enrichSnippets() (page affichée).
  const snippetSource = pickLocale(d.summaryFr, d.summaryEn, d.summaryHt, locale) || ''
  return {
    kind: 'document',
    id: d.id,
    type: d.type as DocType,
    title: pickLocale(d.titleFr, d.titleEn, d.titleHt, locale) || d.titleFr,
    snippet: makeSnippet(snippetSource, terms),
    status: d.status as DocStatus,
    badge: meta?.badge,
    number: d.number,
    moniteurRef: d.moniteurRef,
    publicationDate: d.publicationDate?.toISOString() ?? null,
    niceClasses: d.niceClasses,
    bhdaNumber: d.bhdaNumber,
    holder: d.holder,
    imageUrl: d.imageUrl,
    score,
    fuzzy,
  }
}

function scoreFields(fields: Weighted[], terms: string[]): number {
  let score = 0
  for (const { value, weight } of fields) {
    if (!value) continue
    const hay = fold(value)
    for (const t of terms) {
      if (!t) continue
      let idx = hay.indexOf(t)
      if (idx < 0) continue
      let count = 0
      while (idx >= 0 && count < 5) {
        count++
        idx = hay.indexOf(t, idx + t.length)
      }
      score += weight * count
      if (hay.startsWith(t)) score += weight
    }
  }
  return score
}

/** Proximité trigramme [0..1] entre un terme et le mot le plus proche d'un texte court. */
function bestWordProximity(term: string, text: string): number {
  const tri = (s: string) => {
    const p = `  ${s} `
    const out = new Set<string>()
    for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3))
    return out
  }
  const a = tri(term)
  let best = 0
  for (const w of text.split(/\s+/)) {
    if (!w || Math.abs(w.length - term.length) > 4) continue
    const b = tri(w)
    let inter = 0
    for (const g of a) if (b.has(g)) inter++
    const score = inter / (a.size + b.size - inter)
    if (score > best) best = score
  }
  return best
}

function sortByDate(a: SearchHit, b: SearchHit): number {
  return (b.publicationDate ?? '').localeCompare(a.publicationDate ?? '')
}

/** Tri des circulaires par numéro (série, base, révision) ; réfs non standard en fin. */
function sortByCirculaireNumber(docs: DocRow[], dir: 1 | -1): void {
  const serieOrd = (s?: string) => (s === 'CIRCULAIRE' ? 0 : s === 'LETTRE' ? 1 : 2)
  docs.sort((a, b) => {
    const pa = parseCirculaireRef(a.number)
    const pb = parseCirculaireRef(b.number)
    const so = serieOrd(pa?.serie) - serieOrd(pb?.serie)
    if (so) return so
    if (!pa && !pb) return 0
    if (!pa) return 1
    if (!pb) return -1
    if (pa.base !== pb.base) return (pa.base - pb.base) * dir
    return ((pa.rev ?? 0) - (pb.rev ?? 0)) * dir
  })
}
