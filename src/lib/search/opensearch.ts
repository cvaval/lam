import { DOC_TYPE_META } from '../brand'
import { DOC_TYPES, type DocType, type DocStatus } from '../types'
import { FULLTEXT_TYPES } from '../access'
import { escapeHtml } from './highlight'
import { multiMatchFields } from './fields'
import { createOpenSearchClient } from './client'
import { indexNameForType, COMPANIES_INDEX } from './mappings'
import { PAGE_SIZE, MAX_PAGE_SIZE } from './types'
import type { SearchProvider, SearchQuery, SearchResult, SearchHit } from './types'

/**
 * Provider OpenSearch/Elasticsearch (§09). La création des index et l'indexation
 * vivent dans scripts/reindex.ts (fabrique client partagée : ./client.ts).
 */
export class OpenSearchProvider implements SearchProvider {
  readonly name = 'opensearch' as const
  private client: any

  private async getClient() {
    if (!this.client) this.client = await createOpenSearchClient()
    return this.client
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const client = await this.getClient()
    const size = Math.min(MAX_PAGE_SIZE, query.size ?? PAGE_SIZE)
    const from = (Math.max(1, query.page ?? 1) - 1) * size

    const types = query.types?.length ? query.types : (DOC_TYPES as readonly DocType[])
    const indices = types.map(indexNameForType)
    // Parité avec FtsProvider : les sociétés (Index) sont incluses en recherche large ou
    // dès que l'Index est dans le périmètre ; masquées seulement si filtre de type précis hors Index.
    if (query.includeCompanies !== false && (!query.types?.length || query.types.includes('INDEX'))) indices.push(COMPANIES_INDEX)

    const filter: any[] = []
    if (query.status) filter.push({ term: { status: query.status } })
    if (query.juridiction) filter.push({ term: { juridiction: query.juridiction } })
    if (query.matiere) filter.push({ term: { matiere: query.matiere } })
    if (typeof query.fiscalYear === 'number') filter.push({ term: { fiscalYear: query.fiscalYear } })
    if (query.niceClass) filter.push({ term: { niceClasses: query.niceClass } })
    if (query.category) filter.push({ term: { category: query.category } })
    // Circulaires BRH : filtre par année (range sur la date) et par numéro (wildcard
    // sur le keyword ; on retire les jokers de l'entrée utilisateur).
    if (typeof query.year === 'number') {
      filter.push({ range: { publicationDate: { gte: `${query.year}-01-01`, lt: `${query.year + 1}-01-01` } } })
    }
    if (query.num) {
      const n = query.num.replace(/[*?\s]/g, '').slice(0, 20)
      if (n) filter.push({ wildcard: { number: `*${n}*` } })
    }

    // Parité avec le moteur intégré : masque les avis-sociétés groupés (représentés
    // par les fiches Société), sauf si la sous-catégorie est explicitement filtrée.
    const mustNot: any[] = query.category ? [] : [{ term: { category: 'SOCIETE' } }]

    const must = query.q
      ? [
          {
            multi_match: {
              query: query.q,
              type: 'best_fields',
              fuzziness: 'AUTO', // orthographe proche (recherche dynamique)
              // Champs + poids issus de SEARCH_FIELD_WEIGHTS (source unique, search/fields.ts).
              fields: multiMatchFields(),
            },
          },
        ]
      : [{ match_all: {} }]

    // Boost de PROXIMITÉ : la correspondance de l'EXPRESSION exacte (titre puis corps) prime sur
    // celle de mots isolés — « réserves obligatoires » remonte la circulaire, pas « obligatoire ».
    const should = query.q
      ? [
          // Correspondance de l'EXPRESSION exacte dans le titre : signal fort.
          { match_phrase: { titleFr: { query: query.q, boost: 5 } } },
          // PLANCHER de score INDÉPENDANT de la longueur : tout document contenant TOUS les mots
          // de la requête dans son corps est remonté. Sans cela, les gros textes annotés (Code
          // civil/pénal/douanes — corps de 200-260 k caractères) sont écrasés par la normalisation
          // de longueur BM25 et deviennent introuvables par un mot de leur corps (constat cliente).
          { constant_score: { filter: { match: { bodyOriginal: { query: query.q, operator: 'and' } } }, boost: 8 } },
        ]
      : []

    const baseQuery = { bool: { must, should, filter, must_not: mustNot } }
    // Boost de TYPE : les textes à CONTENU INTÉGRAL (circulaires, législation annotée, lois de
    // finances, jurisprudence, tarifs, marques) priment sur l'Index du Moniteur — ~28k références
    // de TITRE seul qui, sans cela, noyaient les vrais documents (recherche par mot du corps).
    const scoredQuery =
      query.q
        ? {
            function_score: {
              query: baseQuery,
              functions: [{ filter: { terms: { type: FULLTEXT_TYPES } }, weight: 4 }],
              score_mode: 'sum',
              boost_mode: 'multiply',
            },
          }
        : baseQuery

    const res = await client.search({
      index: indices,
      ignore_unavailable: true,
      body: {
        from,
        size,
        query: scoredQuery,
        highlight: {
          pre_tags: ['<mark class="hl">'],
          post_tags: ['</mark>'],
          // ResultCard rend le snippet en HTML : tout contenu de document doit être
          // encodé, seules nos balises <mark> passent (anti-XSS).
          encoder: 'html',
          fields: { summaryFr: {}, summaryEn: {}, summaryHt: {}, bodyOriginal: {}, titleFr: {}, name: {} },
          fragment_size: 240,
          number_of_fragments: 1,
        },
      },
    })

    const hits: SearchHit[] = (res.body.hits.hits ?? []).map((h: any) => {
      const s = h._source
      const isCompany = h._index === COMPANIES_INDEX
      const hl = h.highlight ?? {}
      // Les fragments surlignés sont déjà encodés HTML (encoder ci-dessus) ; les
      // replis sur le contenu brut doivent être échappés avant rendu.
      const snippet =
        hl.summaryFr?.[0] ??
        hl.bodyOriginal?.[0] ??
        hl.name?.[0] ??
        hl.titleFr?.[0] ??
        escapeHtml(String(s.summaryFr ?? s.address ?? '').slice(0, 240))
      const meta = s.type ? DOC_TYPE_META[s.type as DocType] : undefined
      return {
        kind: isCompany ? 'company' : 'document',
        id: h._id,
        type: s.type as DocType | undefined,
        title: s.titleFr ?? s.name ?? '',
        snippet,
        status: s.status as DocStatus | undefined,
        badge: meta?.badge,
        number: s.number ?? null,
        moniteurRef: s.moniteurRef ?? null,
        publicationDate: s.publicationDate ?? null,
        niceClasses: s.niceClasses ?? null,
        bhdaNumber: s.bhdaNumber ?? null,
        holder: s.holder ?? null,
        imageUrl: s.imageUrl ?? null,
        refCount: isCompany ? s.refCount ?? undefined : undefined,
        score: h._score ?? 0,
      }
    })

    const total = typeof res.body.hits.total === 'object' ? res.body.hits.total.value : res.body.hits.total
    // NB : hit.fuzzy et expandedTerms sont propres au moteur intégré (FTS) — OpenSearch
    // gère l'orthographe proche via fuzziness:AUTO sans distinguer les hits (voir types.ts).
    return { total: total ?? hits.length, hits, expandedTerms: [], provider: 'opensearch' }
  }
}
