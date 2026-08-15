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
  // Fusion année/période UNE seule fois : l'année exacte (puce BRH) devient la
  // période [year, year] et les providers ne lisent QUE yearFrom/yearTo — les
  // deux moteurs ne peuvent pas diverger sur la précédence.
  query = { ...query, yearFrom: query.yearFrom ?? query.year, yearTo: query.yearTo ?? query.year }

  // Domaine du droit : le slug demandé est résolu en SOUS-ARBRE, ici et une seule fois.
  //
  // ⚠️ CHERCHER « DROIT PRIVÉ » DOIT RAMENER LE DROIT CIVIL. Un thème parent ne porte
  // presque aucun document en propre — ils vivent dans ses branches. Filtrer sur le seul
  // id demandé rendrait une page vide sur les six domaines de tête, et le lecteur en
  // conclurait qu'il n'y a rien à lire.
  if (query.domaine && !query.domaineIds) {
    query = { ...query, domaineIds: await sousArbreDuTheme(query.domaine) }
  }

  // ⚠️ `?sort=eff` SURVIT AU CHANGEMENT D'ONGLET. La puce « Entrée en vigueur » n'est plus
  // proposée là où la colonne est vide — aucune décision, aucune entrée de l'Index, aucune
  // loi de finances n'en porte — mais le paramètre reste dans l'URL quand on change de
  // section. Sans ce repli, trier des décisions « par entrée en vigueur » rendrait un ordre
  // arbitraire ET STABLE, donc indétectable à la lecture : pire qu'un désordre visible.
  //
  // L'arbitrage est rendu ICI, en amont des moteurs, pour que le moteur intégré et le
  // miroir trient pareil — la même URL doit rendre le même ordre.
  if (query.sort === 'eff' && !(await axeEffetExiste(query.types))) {
    query = { ...query, sort: undefined }
  }

  const key = cacheKey({
    q: query.q.trim().toLowerCase(),
    types: query.types ?? null,
    status: query.status ?? null,
    juridiction: query.juridiction ?? null,
    matiere: query.matiere ?? null,
    fiscalYear: query.fiscalYear ?? null,
    niceClass: query.niceClass ?? null,
    category: query.category ?? null,
    yearFrom: query.yearFrom ?? null,
    yearTo: query.yearTo ?? null,
    noDate: query.noDate ?? null,
    effYear: query.effYear ?? null,
    noEffDate: query.noEffDate ?? null,
    num: query.num ?? null,
    parties: query.parties ?? null,
    domaine: query.domaine ?? null,
    domaineIds: query.domaineIds ?? null,
    judge: query.judge ?? null,
    mp: query.mp ?? null,
    judgeId: query.judgeId ?? null,
    judgeRole: query.judgeRole ?? null,
    sort: query.sort ?? null,
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

/**
 * Ids d'un thème et de tous ses descendants, à partir de son slug. Rend un tableau VIDE
 * si le slug est inconnu — et le filtre, portant sur une liste vide, ne s'applique pas :
 * mieux vaut ne pas filtrer qu'exclure tout sur une faute de frappe dans une URL.
 */
async function sousArbreDuTheme(slug: string): Promise<string[]> {
  const racine = await prisma.theme.findUnique({ where: { slug }, select: { id: true } })
  if (!racine) return []
  const tous = await prisma.theme.findMany({ select: { id: true, parentId: true } })
  const enfantsDe = new Map<string, string[]>()
  for (const t of tous) {
    if (!t.parentId) continue
    if (!enfantsDe.has(t.parentId)) enfantsDe.set(t.parentId, [])
    enfantsDe.get(t.parentId)!.push(t.id)
  }
  const out: string[] = []
  const pile = [racine.id]
  while (pile.length) {
    const id = pile.pop()!
    out.push(id)
    for (const c of enfantsDe.get(id) ?? []) pile.push(c)
  }
  return out
}

/**
 * L'axe « entrée en vigueur » existe-t-il pour les types demandés ?
 *
 * On interroge le TYPE, non le jeu filtré : un filtre qui, par accident, ne retiendrait
 * aucune ligne datée ne doit pas changer le sens du tri demandé — la question posée est
 * « cette section connaît-elle cette date ? », pas « ce résultat-ci en contient-il ? ».
 */
async function axeEffetExiste(types?: string[]): Promise<boolean> {
  const n = await prisma.document.count({
    where: { ...(types?.length ? { type: { in: types } } : {}), effectiveDate: { not: null } },
  })
  return n > 0
}
