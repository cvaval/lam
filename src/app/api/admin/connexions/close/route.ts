import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { requireAdminApi } from '@/lib/auth/guard'
import { closeSession } from '@/lib/auth/session'
import { audit } from '@/lib/auth/audit'
import { getClientCtx } from '@/lib/auth/request'

export const runtime = 'nodejs'

const schema = z.object({ sessionId: z.string().min(1).max(64) })

/**
 * Le master admin ferme UNE session depuis le journal des connexions (décision D7, 16 sept.
 * 2026) — plus fin que « suspendre le compte ». Motif ADMIN sur la ligne, et une ligne d'audit
 * SESSION_CLOSED_BY_ADMIN dont l'ACTEUR est l'administrateur et la CIBLE la session : c'est la
 * décision de quelqu'un, elle se signe.
 *
 * Deux gardes par écran (page + route) : `requireAdmin` sur la page, `requireAdminApi` ici.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return apiError('forbidden', 403)
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)

  const cible = await prisma.session.findUnique({ where: { id: parsed.data.sessionId }, select: { id: true, userId: true, endedAt: true } })
  if (!cible) return apiError('notFound', 404)
  // La première fin fait foi : une session déjà fermée le reste, avec son motif d'origine.
  if (cible.endedAt) return NextResponse.json({ ok: true, dejaFermee: true })

  const fermee = await closeSession(cible.id, 'ADMIN')
  if (fermee) {
    const ctx = getClientCtx(req)
    await audit({ action: 'SESSION_CLOSED_BY_ADMIN', actorId: admin.id, targetType: 'SESSION', targetId: cible.id, ip: ctx.ip, userAgent: ctx.userAgent, meta: { compte: cible.userId } })
  }
  return NextResponse.json({ ok: true, dejaFermee: !fermee })
}
