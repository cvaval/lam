import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth/session'
import { runAlertsDigest } from '@/lib/alerts'
import { prisma } from '@/lib/db'
import { appliquerAbrogationsEchues } from '@/lib/brh/abrogations'
import { reindexDocument } from '@/lib/search/reindex'

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

  // Abrogations à effet DIFFÉRÉ : une circulaire signée n'abroge qu'à sa prise d'effet.
  // La 87-1, signée le 16 février 2026, ne fait tomber la 87 que le 1er octobre 2026 —
  // sans cette passe, rien ne l'aurait jamais porté. Idempotent : ne touche que ce qui
  // diffère, et refuse toute cible plus récente que son abrogeante (homonyme probable).
  const abrogations = await appliquerAbrogationsEchues(prisma)
  for (const ligne of abrogations.portees) {
    const numero = ligne.split(' ← ')[0]
    const docs = await prisma.document.findMany({ where: { type: 'CIRCULAIRE_BRH', number: numero }, select: { id: true } })
    for (const d of docs) await reindexDocument(d.id)
  }
  if (abrogations.portees.length) console.log(`[cron] abrogations portées : ${abrogations.portees.join(' · ')}`)
  if (abrogations.ignorees.length) console.warn(`[cron] abrogations ignorées : ${abrogations.ignorees.join(' · ')}`)

  return NextResponse.json({ ok: true, ...summary, abrogations })
}
