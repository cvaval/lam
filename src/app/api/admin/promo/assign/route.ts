import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdminApi } from '@/lib/auth/guard'
import { audit } from '@/lib/auth/audit'
import { redeemPromo } from '@/lib/promo'
import { getClientCtx } from '@/lib/auth/request'

export const runtime = 'nodejs'

// Le master admin attribue un code promo à un compte précis : le palier est
// appliqué immédiatement (redemption au nom du compte).
const schema = z.object({ code: z.string().min(3), userId: z.string().min(1) })

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return apiError('forbidden', 403)

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } })
  if (!target) return apiError('noUser', 404)

  const result = await redeemPromo(parsed.data.code, target.id, { actorId: admin.id, ip: getClientCtx(req).ip })
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 })

  await audit({
    action: 'PROMO_ASSIGNED',
    actorId: admin.id,
    targetType: 'USER',
    targetId: target.id,
    meta: { code: parsed.data.code.toUpperCase(), grantedRole: result.grantedRole },
  })
  return NextResponse.json({ ok: true, grantedRole: result.grantedRole, expiresAt: result.expiresAt })
}
