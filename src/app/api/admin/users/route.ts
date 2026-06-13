import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdminApi } from '@/lib/auth/guard'
import { audit, type AuditAction } from '@/lib/auth/audit'
import { revokeTrustedDevices } from '@/lib/auth/devices'
import { sendMail, welcomeEmail } from '@/lib/mail'
import { quotaForRole } from '@/lib/quota'
import { ROLES, type Role } from '@/lib/types'

export const runtime = 'nodejs'

const schema = z.object({
  action: z.enum(['activate', 'reject', 'suspend', 'reactivate', 'changeType', 'reset2fa', 'setIndexOnly']),
  userId: z.string().min(1),
  role: z.enum(ROLES).optional(),
  indexOnly: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return apiError('forbidden', 403)

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const { action, userId, role, indexOnly } = parsed.data

  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) return apiError('notFound', 404)

  let auditAction: AuditAction = 'ROLE_CHANGED'

  switch (action) {
    case 'activate': {
      const newRole: Role = role ?? (target.role as Role)
      await prisma.user.update({
        where: { id: userId },
        data: {
          status: 'ACTIVE',
          role: newRole,
          activatedAt: new Date(),
          activatedById: admin.id,
          // Enrôlement 2FA obligatoire à la première connexion : on (ré)initialise.
          totpEnabled: false,
          totpSecret: null,
          monthlyQuota: quotaForRole(newRole),
        },
      })
      await sendMail(welcomeEmail(target.email, newRole))
      auditAction = 'ACCOUNT_ACTIVATED'
      break
    }
    case 'reject':
      await prisma.user.delete({ where: { id: userId } })
      auditAction = 'ACCOUNT_REJECTED'
      break
    case 'suspend':
      await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } })
      await prisma.session.deleteMany({ where: { userId } })
      auditAction = 'ACCOUNT_SUSPENDED'
      break
    case 'reactivate':
      await prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } })
      auditAction = 'ACCOUNT_REACTIVATED'
      break
    case 'changeType':
      if (!role) return apiError('invalidFields', 400)
      await prisma.user.update({
        where: { id: userId },
        data: { role, monthlyQuota: quotaForRole(role) },
      })
      auditAction = 'ROLE_CHANGED'
      break
    case 'reset2fa':
      await prisma.user.update({ where: { id: userId }, data: { totpEnabled: false, totpSecret: null } })
      await revokeTrustedDevices(userId)
      await prisma.session.deleteMany({ where: { userId } })
      auditAction = '2FA_RESET'
      break
    case 'setIndexOnly':
      // Accès restreint à l'Index du Moniteur (références seules).
      await prisma.user.update({ where: { id: userId }, data: { indexOnly: !!indexOnly } })
      auditAction = 'ROLE_CHANGED'
      break
  }

  await audit({
    action: auditAction,
    actorId: admin.id,
    targetType: 'USER',
    targetId: userId,
    meta: { email: target.email, role: role ?? target.role, ...(action === 'setIndexOnly' ? { indexOnly: !!indexOnly } : {}) },
  })
  return NextResponse.json({ ok: true })
}
