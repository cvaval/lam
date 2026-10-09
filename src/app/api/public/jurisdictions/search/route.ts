import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { getClientCtx } from '@/lib/auth/request'
import { getNotaryIndex, getPlaceIndex } from '@/lib/jurisdictions/data'
import { searchPlaces } from '@/lib/jurisdictions/search-places'
import { searchNotaries } from '@/lib/jurisdictions/search-notaries'
import { normalizePlaceName } from '@/lib/jurisdictions/normalize-place'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Suggestions de communes ET de notaires (carte judiciaire) — PUBLIC, lecture seule.
 *   GET /api/public/jurisdictions/search?q={query}&limit={1..8}
 *
 * Chaque suggestion porte `kind` : 'commune' | 'notaire'. PARTAGE DES PLACES : 5 au plus pour
 * chaque sorte, `limit` en tout — sinon, sur « Saint-Louis », les communes masqueraient le
 * notaire « Saint-Louis CHARLES ». Une suggestion de notaire ne porte que son identifiant, son
 * nom, sa mention et sa commune : AUCUNE coordonnée (elles ne se lisent que sur sa page).
 *
 * Aucune donnée personnelle : la requête n'est PAS journalisée (seuls les
 * dépassements de débit émettent une alerte, sans la chaîne saisie). Index local
 * des 149 communes — aucun géocodeur externe.
 */
const params = z.object({
  q: z.string().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(8).default(8),
})

export async function GET(req: NextRequest) {
  const { ip } = getClientCtx(req)
  if (!(await guard({ action: 'jur-search', subject: ip ?? 'anon', ...LIMITS.jurSearch }, { ip }))) {
    return apiError('rate_limited', 429)
  }
  const parsed = params.safeParse({
    q: req.nextUrl.searchParams.get('q') ?? '',
    limit: req.nextUrl.searchParams.get('limit') ?? undefined,
  })
  if (!parsed.success) return apiError('invalid_query', 400)

  const [index, notaires] = await Promise.all([getPlaceIndex(), getNotaryIndex()])
  const limit = parsed.data.limit
  const PART = 5
  const communes = searchPlaces(index, parsed.data.q, limit)
  const notairesHits = searchNotaries(notaires, parsed.data.q)
  // Chaque sorte a droit à 5 places ; une sorte qui n'use pas les siennes les cède à l'autre.
  const nCommunes = Math.min(communes.length, Math.max(PART, limit - Math.min(PART, notairesHits.length)), limit)
  const nNotaires = Math.min(notairesHits.length, limit - nCommunes)
  const res = NextResponse.json({
    // On renvoie la forme NORMALISÉE, jamais la saisie brute : le client n'a besoin
    // que de savoir ce qui a été interprété, et cette forme ne peut contenir que
    // [a-z0-9 ] — aucun écho d'une charge hostile, même en JSON.
    query: normalizePlaceName(parsed.data.q).slice(0, 80),
    items: [
      ...communes.slice(0, nCommunes).map((h) => ({
        kind: 'commune' as const,
        id: h.id,
        name: h.name,
        department: h.department,
        arrondissement: h.arrondissement,
        postalCode: h.postalCode,
        matchType: h.matchType,
        score: h.score,
      })),
      // Liste BLANCHE : ni adresse, ni téléphone, ni courriel.
      ...notairesHits.slice(0, nNotaires).map((n) => ({
        kind: 'notaire' as const,
        id: n.id,
        name: n.name,
        mention: n.mention,
        communeId: n.communeId,
        communeName: n.communeName,
      })),
    ],
  })
  // Données publiques et stables : cache CDN court, revalidation en arrière-plan.
  res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  return res
}
