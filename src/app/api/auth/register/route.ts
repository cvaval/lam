import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { normalizeEmail } from '@/lib/auth/email'
import { audit } from '@/lib/auth/audit'
import { getClientCtx } from '@/lib/auth/request'

export const runtime = 'nodejs'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120).optional(),
  org: z.string().min(1).max(160).optional(),
})

// Demande d'accès → compte PENDING (en attente d'activation par le master admin, §03/§05).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('invalidFields', 400)

  const email = normalizeEmail(parsed.data.email)
  const existing = await prisma.user.findUnique({ where: { email } })
  // Réponse identique pour ne pas révéler l'existence d'un compte.
  if (!existing) {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(parsed.data.password),
        name: parsed.data.name ?? null,
        org: parsed.data.org ?? null,
        role: 'SITWAYEN',
        status: 'PENDING',
      },
    })
    const ctx = getClientCtx(req)
    await audit({ action: 'ACCOUNT_REQUESTED', actorId: user.id, targetType: 'USER', targetId: user.id, ip: ctx.ip, userAgent: ctx.userAgent })
  }
  return NextResponse.json({ ok: true })
}
