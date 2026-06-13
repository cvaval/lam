import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdminApi } from '@/lib/auth/guard'
import { hashPassword } from '@/lib/auth/password'
import { normalizeEmail } from '@/lib/auth/email'
import { randomPassword } from '@/lib/auth/crypto'
import { audit } from '@/lib/auth/audit'
import { redeemPromo } from '@/lib/promo'
import { getClientCtx } from '@/lib/auth/request'
import { sendMail, welcomeEmail } from '@/lib/mail'
import { quotaForRole } from '@/lib/quota'
import { ROLES } from '@/lib/types'

export const runtime = 'nodejs'

// Le master admin crée un compte directement (sans demande préalable). Un mot de
// passe temporaire lisible est renvoyé une seule fois ; l'enrôlement 2FA est forcé
// à la première connexion. Un code promo peut être appliqué dans la foulée.
const schema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  role: z.enum(ROLES).default('PWOFESYONEL'),
  organizationName: z.string().max(160).optional(),
  promoCode: z.string().max(40).optional(),
})

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return apiError('forbidden', 403)

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const d = parsed.data
  const email = normalizeEmail(d.email)

  if (await prisma.user.findUnique({ where: { email } })) {
    return apiError('exists', 409)
  }

  let organizationId: string | undefined
  if (d.organizationName?.trim()) {
    const org = await prisma.organization.create({ data: { name: d.organizationName.trim(), kind: 'CABINET' } })
    organizationId = org.id
  }

  const tempPassword = randomPassword()
  const user = await prisma.user.create({
    data: {
      email,
      name: d.name ?? null,
      passwordHash: await hashPassword(tempPassword),
      role: d.role,
      status: 'ACTIVE',
      totpEnabled: false, // enrôlement 2FA forcé à la 1ʳᵉ connexion
      totpSecret: null,
      monthlyQuota: quotaForRole(d.role),
      organizationId,
      activatedAt: new Date(),
      activatedById: admin.id,
    },
  })

  await audit({
    action: 'ACCOUNT_CREATED',
    actorId: admin.id,
    targetType: 'USER',
    targetId: user.id,
    ...getClientCtx(req),
    meta: { email, role: d.role },
  })
  await sendMail(welcomeEmail(email, d.role))

  let promo: { applied: boolean; error?: string } = { applied: false }
  if (d.promoCode?.trim()) {
    const r = await redeemPromo(d.promoCode, user.id, { actorId: admin.id, ip: getClientCtx(req).ip })
    promo = r.ok ? { applied: true } : { applied: false, error: r.error }
  }

  return NextResponse.json({ ok: true, userId: user.id, email, tempPassword, promo })
}
