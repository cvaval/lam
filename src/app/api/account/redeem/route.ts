import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/session'
import { redeemPromo } from '@/lib/promo'
import { getClientCtx } from '@/lib/auth/request'

export const runtime = 'nodejs'

// Un utilisateur active lui-même un code promo depuis son compte.
const schema = z.object({ code: z.string().min(3).max(40) })

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)

  const result = await redeemPromo(parsed.data.code, user.id, { actorId: user.id, ip: getClientCtx(req).ip })
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, grantedRole: result.grantedRole, expiresAt: result.expiresAt })
}
