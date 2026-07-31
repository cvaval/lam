import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { getClientCtx } from '@/lib/auth/request'
import { getPlaceIndex } from '@/lib/jurisdictions/data'
import { searchPlaces } from '@/lib/jurisdictions/search-places'
import { normalizePlaceName } from '@/lib/jurisdictions/normalize-place'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Suggestions de communes (carte judiciaire) — PUBLIC, lecture seule.
 *   GET /api/public/jurisdictions/search?q={query}&limit={1..8}
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

  const index = await getPlaceIndex()
  const items = searchPlaces(index, parsed.data.q, parsed.data.limit)
  const res = NextResponse.json({
    // On renvoie la forme NORMALISÉE, jamais la saisie brute : le client n'a besoin
    // que de savoir ce qui a été interprété, et cette forme ne peut contenir que
    // [a-z0-9 ] — aucun écho d'une charge hostile, même en JSON.
    query: normalizePlaceName(parsed.data.q).slice(0, 80),
    items: items.map((h) => ({
      id: h.id,
      name: h.name,
      department: h.department,
      arrondissement: h.arrondissement,
      postalCode: h.postalCode,
      matchType: h.matchType,
      score: h.score,
    })),
  })
  // Données publiques et stables : cache CDN court, revalidation en arrière-plan.
  res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
  return res
}
