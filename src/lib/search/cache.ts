import type { SearchResult } from './types'

/**
 * Cache mémoire du moteur de recherche (mémoire de la recherche précédente).
 * Les requêtes identiques sont resservies depuis le cache (TTL court), évitant un
 * nouveau calcul — utile pour la pagination et les recherches répétées.
 */
interface Entry {
  value: SearchResult
  expires: number
}

const TTL_MS = 90_000
const MAX_ENTRIES = 300
const store = new Map<string, Entry>()

const now = () => Date.now()

export function cacheKey(parts: Record<string, unknown>): string {
  return JSON.stringify(parts)
}

export function getCached(key: string): SearchResult | null {
  const e = store.get(key)
  if (!e) return null
  if (e.expires < now()) {
    store.delete(key)
    return null
  }
  // LRU : remet l'entrée en fin de Map.
  store.delete(key)
  store.set(key, e)
  return e.value
}

export function setCached(key: string, value: SearchResult): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
  store.set(key, { value, expires: now() + TTL_MS })
}

export function clearSearchCache(): void {
  store.clear()
}
