import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { normalizeEmail } from '@/lib/auth/email'
import { randomToken, sha256Hex } from '@/lib/auth/crypto'
import { audit } from '@/lib/auth/audit'
import { getClientCtx } from '@/lib/auth/request'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { sendMail, resetPasswordEmail } from '@/lib/mail'
import { BRAND } from '@/lib/brand'

export const runtime = 'nodejs'

const TTL_MIN = 60
const schema = z.object({ email: z.string().email() })

// Demande de réinitialisation. Réponse TOUJOURS identique ({ok:true}) — ne révèle
// jamais si un compte existe (anti-énumération). Un e-mail n'est envoyé qu'aux comptes
// actifs ; le jeton est stocké HACHÉ, valable 60 min, à usage unique.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: true })

  const email = normalizeEmail(parsed.data.email)
  const ctx = getClientCtx(req)
  // Anti-abus : borne par adresse (énumération / spam d'envois).
  if (!(await guard({ action: 'forgot', subject: email, ...LIMITS.forgot }, { ip: ctx.ip }))) {
    return NextResponse.json({ ok: true })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (user && user.status === 'ACTIVE') {
    const token = randomToken(32)
    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: sha256Hex(token), resetTokenExpiresAt: new Date(Date.now() + TTL_MIN * 60_000) },
    })
    const base = (process.env.NEXT_PUBLIC_APP_URL || BRAND.url).replace(/\/$/, '')
    const locale = ['fr', 'en', 'ht'].includes(user.locale) ? user.locale : 'fr'
    const link = `${base}/${locale}/reset?token=${token}`
    await sendMail(resetPasswordEmail(user.email, link, TTL_MIN))
    await audit({ action: 'PASSWORD_RESET_REQUESTED', actorId: user.id, ip: ctx.ip, userAgent: ctx.userAgent })
  }
  return NextResponse.json({ ok: true })
}
