import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { sha256Hex } from '@/lib/auth/crypto'
import { revokeTrustedDevices } from '@/lib/auth/devices'
import { audit } from '@/lib/auth/audit'
import { getClientCtx } from '@/lib/auth/request'
import { guard, LIMITS } from '@/lib/security/ratelimit'

export const runtime = 'nodejs'

const schema = z.object({ token: z.string().min(10).max(200), password: z.string().min(8).max(200) })

// Consomme un jeton de réinitialisation : pose le nouveau mot de passe, invalide le
// jeton (usage unique) et lève le verrouillage anti-bruteforce. Le jeton est comparé
// par son empreinte SHA-256 ; un jeton expiré ou inconnu → resetInvalid.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('weakPassword', 400)

  const ctx = getClientCtx(req)
  if (!(await guard({ action: 'reset', subject: ctx.ip ?? 'anon', ...LIMITS.reset }, { ip: ctx.ip }))) {
    return apiError('rate', 429)
  }

  const user = await prisma.user.findFirst({
    where: { resetTokenHash: sha256Hex(parsed.data.token), resetTokenExpiresAt: { gt: new Date() } },
  })
  if (!user) return apiError('resetInvalid', 400)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      failedLogins: 0,
      lockedUntil: null,
    },
  })
  // Reprise du contrôle du compte (§04, audit) : une réinitialisation doit invalider TOUTES
  // les sessions existantes (y compris celles d'un éventuel intrus) et révoquer les appareils
  // de confiance — sinon le changement de mot de passe ne rend pas la main à la victime.
  await prisma.session.deleteMany({ where: { userId: user.id } })
  await revokeTrustedDevices(user.id)
  await audit({ action: 'PASSWORD_RESET', actorId: user.id, ip: ctx.ip, userAgent: ctx.userAgent })
  return NextResponse.json({ ok: true })
}
