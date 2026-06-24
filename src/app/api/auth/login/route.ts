import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { attemptLogin } from '@/lib/auth/service'
import { getClientCtx } from '@/lib/auth/request'
import { guard, LIMITS } from '@/lib/security/ratelimit'

export const runtime = 'nodejs'

const schema = z.object({ email: z.string().email(), password: z.string().min(1) })

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('invalidCredentials', 400)

  const ctx = getClientCtx(req)
  // Frein PAR IP (le verrouillage, lui, est par compte) : borne la force brute distribuée
  // de mots de passe et le DoS par verrouillage. 429 + SCRAPING_ALERT au dépassement (§04).
  if (ctx.ip && !(await guard({ action: 'login', subject: ctx.ip, ...LIMITS.login }, { ip: ctx.ip }))) {
    return apiError('rate', 429)
  }

  const result = await attemptLogin(parsed.data.email, parsed.data.password, ctx)
  if (!result.ok) return NextResponse.json(result, { status: 401 })
  return NextResponse.json(result)
}
