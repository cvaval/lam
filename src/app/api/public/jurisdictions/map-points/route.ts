import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { getClientCtx } from '@/lib/auth/request'
import { getMapPoints } from '@/lib/jurisdictions/data'
import { COURT_TYPES, type CourtType } from '@/lib/jurisdictions/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Points cartographiques (carte judiciaire) — PUBLIC, lecture seule, GeoJSON.
 *   GET /api/public/jurisdictions/map-points?types=PAIX,PREMIERE_INSTANCE,APPEL,CASSATION
 *
 * Ne publie que les juridictions actives, reliées sans ambiguïté et positionnées
 * (coordonnée exacte ou centroïde communal identifié), avec le niveau de précision.
 * Liste BLANCHE des types — tout inconnu → 400.
 */
export async function GET(req: NextRequest) {
  const { ip } = getClientCtx(req)
  if (!(await guard({ action: 'jur-map', subject: ip ?? 'anon', ...LIMITS.jurMap }, { ip }))) {
    return apiError('rate_limited', 429)
  }
  const raw = req.nextUrl.searchParams.get('types') ?? COURT_TYPES.join(',')
  if (raw.length > 80) return apiError('invalid_types', 400)
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (!parts.length || parts.length > COURT_TYPES.length) return apiError('invalid_types', 400)
  const types: CourtType[] = []
  for (const p of parts) {
    if (!(COURT_TYPES as readonly string[]).includes(p)) return apiError('invalid_types', 400)
    if (!types.includes(p as CourtType)) types.push(p as CourtType)
  }

  const collection = await getMapPoints(types)
  const res = NextResponse.json(collection)
  res.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
  return res
}
