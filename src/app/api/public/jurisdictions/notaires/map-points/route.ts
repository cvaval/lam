import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { getClientCtx } from '@/lib/auth/request'
import { getNotaryPoints } from '@/lib/jurisdictions/data'
import { estSchemaAbsent } from '@/lib/delais/service-base'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Points de la couche « notaires » (carte judiciaire) — PUBLIC, lecture seule, GeoJSON.
 *   GET /api/public/jurisdictions/notaires/map-points
 *
 * UN point par commune pourvue, au centroïde, avec `communeId`, `communeName` et `count`
 * (notaires actifs) — JAMAIS de nom : la liste nominative passe par la fiche de la commune.
 * Liste BLANCHE des paramètres : aucun n'est accepté, tout paramètre → 400. Frein de débit
 * de la carte (`LIMITS.jurMap`) sous une clé sœur : les deux couches ne se partagent pas le
 * quota d'un visiteur. Table pas encore migrée → 503 explicite, jamais un 500 muet.
 */
export async function GET(req: NextRequest) {
  const { ip } = getClientCtx(req)
  if (!(await guard({ action: 'jur-map-notaires', subject: ip ?? 'anon', ...LIMITS.jurMap }, { ip }))) {
    return apiError('rate_limited', 429)
  }
  if ([...req.nextUrl.searchParams.keys()].length > 0) return apiError('invalid_params', 400)

  try {
    const collection = await getNotaryPoints()
    const res = NextResponse.json(collection)
    res.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
    return res
  } catch (e) {
    if (!estSchemaAbsent(e)) throw e
    const res = apiError('notaries_unavailable', 503)
    res.headers.set('Cache-Control', 'no-store')
    return res
  }
}
