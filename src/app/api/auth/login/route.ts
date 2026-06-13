import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { attemptLogin } from '@/lib/auth/service'
import { getClientCtx } from '@/lib/auth/request'

export const runtime = 'nodejs'

const schema = z.object({ email: z.string().email(), password: z.string().min(1) })

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('invalidCredentials', 400)

  const result = await attemptLogin(parsed.data.email, parsed.data.password, getClientCtx(req))
  if (!result.ok) return NextResponse.json(result, { status: 401 })
  return NextResponse.json(result)
}
