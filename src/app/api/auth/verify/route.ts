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

  // Défense en profondeur : une exception inattendue ne doit pas remonter en 500 brut
  // (stack divulguée) ni laisser l'écran afficher un « code invalide » trompeur sans
  // trace. Le chemin nominal (y compris l'appareil de confiance) est désormais sûr.
  try {
    const result = await verifyTwoFactor(parsed.data.code, parsed.data.trustDevice ?? false, getClientCtx(req))
    if (!result.ok) return NextResponse.json(result, { status: 401 })
    return NextResponse.json(result)
  } catch (e) {
    console.error('POST /api/auth/verify :', e)
    return apiError('server', 500)
  }
}
