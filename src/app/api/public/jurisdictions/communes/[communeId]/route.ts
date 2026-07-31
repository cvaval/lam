import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { getClientCtx } from '@/lib/auth/request'
import { getCommuneRecord } from '@/lib/jurisdictions/data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Fiche complète d'une commune (carte judiciaire) — PUBLIC, lecture seule.
 *   GET /api/public/jurisdictions/communes/{communeId}
 *
 * Tribunaux de paix en TABLEAU jamais regroupé ; Cour de cassation dans le bloc
 * « Recours national » ; sièges UNMAPPED exclus tant qu'ils ne sont pas rattachés.
 */
const communeId = z.string().regex(/^[a-z0-9][a-z0-9-]{2,119}$/)

export async function GET(req: NextRequest, { params }: { params: { communeId: string } }) {
  const { ip } = getClientCtx(req)
  if (!(await guard({ action: 'jur-commune', subject: ip ?? 'anon', ...LIMITS.jurCommune }, { ip }))) {
    return apiError('rate_limited', 429)
  }
  const parsed = communeId.safeParse(params.communeId)
  if (!parsed.success) return apiError('invalid_commune_id', 400)

  const record = await getCommuneRecord(parsed.data)
  if (!record) return apiError('commune_not_found', 404)

  const res = NextResponse.json(record)
  res.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
  return res
}
