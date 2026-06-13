import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { getPendingSession } from '@/lib/auth/session'
import { currentTotp } from '@/lib/auth/totp'

export const runtime = 'nodejs'

// DEV UNIQUEMENT : renvoie le code TOTP courant de la session en attente, pour
// démontrer la 2FA sans application d'authentification. Désactivé en production.
export async function GET() {
  if (process.env.NODE_ENV === 'production') return apiError('notFound', 404)
  const pending = await getPendingSession()
  if (!pending) return apiError('unauthorized', 401)
  const user = await prisma.user.findUnique({ where: { id: pending.user.id }, select: { totpSecret: true } })
  if (!user?.totpSecret) return apiError('notFound', 404)
  return NextResponse.json({ ok: true, code: currentTotp(user.totpSecret) })
}
