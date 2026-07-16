import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth/session'
import { runAlertsDigest } from '@/lib/alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Passe de veille quotidienne (vercel.json → crons). Autorisations acceptées :
 *  - Vercel Cron : en-tête `Authorization: Bearer ${CRON_SECRET}` (env à définir) ;
 *  - session MASTER_ADMIN (déclenchement manuel de secours) ;
 *  - dev local (NODE_ENV ≠ production), comme /api/auth/devcode.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  let allowed = Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
  if (!allowed) {
    const user = await getCurrentUser().catch(() => null)
    allowed = user?.role === 'MASTER_ADMIN'
  }
  if (!allowed && process.env.NODE_ENV !== 'production') allowed = true
  if (!allowed) return apiError('forbidden', 403)

  const summary = await runAlertsDigest()
  return NextResponse.json({ ok: true, ...summary })
}
