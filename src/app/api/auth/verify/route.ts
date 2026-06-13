import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { verifyTwoFactor } from '@/lib/auth/service'
import { getClientCtx } from '@/lib/auth/request'

export const runtime = 'nodejs'

const schema = z.object({ code: z.string().min(6).max(8), trustDevice: z.boolean().optional() })

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('badCode', 400)

  const result = await verifyTwoFactor(parsed.data.code, parsed.data.trustDevice ?? false, getClientCtx(req))
  if (!result.ok) return NextResponse.json(result, { status: 401 })
  return NextResponse.json(result)
}
