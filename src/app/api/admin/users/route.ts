import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdminApi } from '@/lib/auth/guard'
import { audit, type AuditAction } from '@/lib/auth/audit'
import { revokeTrustedDevices } from '@/lib/auth/devices'
import { sendMail, welcomeEmail } from '@/lib/mail'
import { quotaForRole } from '@/lib/quota'
import { serializeServices } from '@/lib/access'
import { ROLES, type Role, type DocType } from '@/lib/types'

export const runtime = 'nodejs'

const schema = z.object({
  action: z.enum(['activate', 'reject', 'suspend', 'reactivate', 'changeType', 'reset2fa', 'setServices']),
  userId: z.string().min(1),
  role: z.enum(ROLES).optional(),
  // Services à texte intégral accordés (valeurs invalides filtrées par serializeServices).
  services: z.array(z.string()).optional(),
  canViewSourcePdf: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return apiError('forbidden', 403)

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const { action, userId, role, services, canViewSourcePdf } = parsed.data

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
    case 'setServices':
      // Services à texte intégral accordés (§03). L'Index reste toujours accessible.
      await prisma.user.update({
        where: { id: userId },
        data: {
          services: serializeServices((services ?? []) as DocType[]),
          canViewSourcePdf: !!canViewSourcePdf,
        },
      })
      auditAction = 'ROLE_CHANGED'
      break
  }

  await audit({
    action: auditAction,
    actorId: admin.id,
    targetType: 'USER',
    targetId: userId,
    meta: {
      email: target.email,
      role: role ?? target.role,
      ...(action === 'setServices'
        ? { services: serializeServices((services ?? []) as DocType[]), canViewSourcePdf: !!canViewSourcePdf }
        : {}),
    },
  })
  return NextResponse.json({ ok: true })
}
