import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { requireAdminApi } from '@/lib/auth/guard'
import { audit } from '@/lib/auth/audit'
import { getClientCtx } from '@/lib/auth/request'
import { estSchemaAbsent } from '@/lib/delais/service-base'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ID_RE = /^[a-z0-9][a-z0-9-]{2,119}$/
const retraitSchema = z.object({ action: z.literal('RETIRER'), motif: z.string().trim().min(10).max(1000) })

/**
 * RETRAIT du badge « Confirmé » d'une inscription — MASTER ADMIN SEUL (vérifié ici, à chaque appel).
 * La confirmation ACTIVE passe RETIRÉE, motif et auteur consignés ; elle reste dans l'historique.
 * Audit NOTARY_CONFIRMATION_WITHDRAWN. 404 s'il n'y a pas de confirmation active.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAdminApi()
  if (!user) return apiError('forbidden', 403)
  if (!ID_RE.test(params.id)) return apiError('notFound', 404)
  let body: unknown
  try { body = await req.json() } catch { return apiError('invalid_json', 400) }
  const parsed = retraitSchema.safeParse(body)
  if (!parsed.success) return apiError('invalidFields', 400)

  try {
    const actives = await prisma.notaryConfirmation.findMany({ where: { notaryId: params.id, status: 'ACTIVE' }, select: { id: true } })
    if (!actives.length) return apiError('notFound', 404)
    const maintenant = new Date()
    await prisma.$transaction(actives.map((c) => prisma.notaryConfirmation.update({
      where: { id: c.id },
      data: { status: 'RETIREE', endedAt: maintenant, endedById: user.id, endReason: parsed.data.motif },
    })))
    const { ip, userAgent } = getClientCtx(req)
    for (const c of actives) {
      await audit({ action: 'NOTARY_CONFIRMATION_WITHDRAWN', actorId: user.id, targetType: 'NotaryConfirmation', targetId: c.id, ip, userAgent, meta: { notaryId: params.id } })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (estSchemaAbsent(e)) return apiError('unavailable', 503)
    throw e
  }
}
