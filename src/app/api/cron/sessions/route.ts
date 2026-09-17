import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { purgerConnexions } from '@/lib/admin/purge-connexions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Purge quotidienne des données de connexion (vercel.json → crons, 4 h UTC) — voir
 * `purgerConnexions` pour ce qu'elle fait et pourquoi. Mêmes autorisations que
 * /api/cron/alerts : `Authorization: Bearer ${CRON_SECRET}`, session MASTER_ADMIN, ou dev local.
 *
 * `?simulation=1` compte sans écrire : la recette en production passe par là avant la
 * première exécution planifiée.
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

  const simulation = req.nextUrl.searchParams.get('simulation') === '1'
  const bilan = await purgerConnexions(prisma, { simulation })
  console.log(`[cron] purge connexions ${simulation ? '(simulation) ' : ''}: expirées fermées ${bilan.sessionsFermeesExpirees} · sessions supprimées ${bilan.sessionsSupprimees} · audit supprimé ${bilan.auditSupprime} · seuil ${bilan.seuil}`)
  return NextResponse.json({ ok: true, ...bilan })
}
