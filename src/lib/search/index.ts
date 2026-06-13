import { prisma } from '../db'
import { FtsProvider } from './fts'
import { OpenSearchProvider } from './opensearch'
import { cacheKey, getCached, setCached, clearSearchCache } from './cache'
import { resetVocab } from './fuzzy'
import type { SearchProvider, SearchQuery, SearchResult } from './types'

export type { SearchQuery, SearchResult, SearchHit, SearchProvider } from './types'

/**
 * À appeler après toute écriture de documents (publication CMS, import Moniteur) :
 * vide le cache de résultats et le vocabulaire fuzzy pour que les nouveaux titres
 * soient immédiatement cherchables. Sans cela, les pages servies depuis le cache
 * et les suggestions « orthographe proche » ignoreraient les ajouts récents.
 */
export function invalidateSearchIndexes(): void {
  clearSearchCache()
  resetVocab()
}

let provider: SearchProvider | null = null

export function getSearchProvider(): SearchProvider {
  if (provider) return provider
  provider = process.env.SEARCH_PROVIDER === 'opensearch' ? new OpenSearchProvider() : new FtsProvider()
  return provider
}

/**
 * Recherche de haut niveau : sert depuis le cache si possible (mémoire de la recherche
 * précédente), sinon exécute, met en cache et journalise (KPI « recherches aujourd'hui »
 * §08). Le quota Sitwayen est appliqué en amont, dans la route API.
 */
export async function runSearch(query: SearchQuery, userId?: string | null): Promise<SearchResult> {
  const key = cacheKey({
    q: query.q.trim().toLowerCase(),
    types: query.types ?? null,
    status: query.status ?? null,
    juridiction: query.juridiction ?? null,
    matiere: query.matiere ?? null,
    fiscalYear: query.fiscalYear ?? null,
    niceClass: query.niceClass ?? null,
    category: query.category ?? null,
    year: query.year ?? null,
    num: query.num ?? null,
    includeCompanies: query.includeCompanies !== false,
    locale: query.locale,
    page: query.page ?? 1,
    size: query.size ?? null,
  })

  const cached = getCached(key)
  if (cached) return cached

  const result = await getSearchProvider().search(query)
  setCached(key, result)

  if (query.q.trim()) {
    await prisma.searchLog
      .create({
        data: {
          userId: userId ?? null,
          query: query.q.slice(0, 300),
          locale: query.locale,
          type: query.types?.length === 1 ? query.types[0] : null,
          resultsCount: result.total,
        },
      })
      .catch(() => {})
  }
  return result
}
