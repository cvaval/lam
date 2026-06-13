import { prisma } from './db'
import { audit } from './auth/audit'
import { quotaForRole, SITWAYEN_MONTHLY_QUOTA } from './quota'
import { isRole, type Role } from './types'

export type RedeemResult =
  | { ok: true; grantedRole: Role; expiresAt: Date | null; label: string | null }
  | { ok: false; error: 'unknown' | 'inactive' | 'expired' | 'exhausted' | 'assigned' | 'already' }

/** Applique le palier octroyé à un compte (rôle + expiration + quota). */
async function applyGrant(userId: string, grantsRole: Role, durationDays: number | null) {
  const expiresAt = durationDays ? new Date(Date.now() + durationDays * 86400_000) : null
  await prisma.user.update({
    where: { id: userId },
    data: {
      role: grantsRole,
      planExpiresAt: expiresAt,
      monthlyQuota: quotaForRole(grantsRole),
    },
  })
  return expiresAt
}

/**
 * Redemption d'un code promo par un compte. Valide l'état du code (actif, non
 * expiré, redemptions restantes, attribution éventuelle) puis octroie le palier.
 */
export async function redeemPromo(
  rawCode: string,
  userId: string,
  ctx?: { actorId?: string | null; ip?: string | null },
): Promise<RedeemResult> {
  const code = rawCode.trim().toUpperCase()
  const promo = await prisma.promoCode.findUnique({ where: { code } })
  if (!promo) return { ok: false, error: 'unknown' }
  if (!promo.active) return { ok: false, error: 'inactive' }
  if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) return { ok: false, error: 'expired' }
  if (promo.maxRedemptions != null && promo.redeemedCount >= promo.maxRedemptions)
    return { ok: false, error: 'exhausted' }
  if (promo.assignedToUserId && promo.assignedToUserId !== userId) return { ok: false, error: 'assigned' }

  const already = await prisma.promoRedemption.findUnique({
    where: { promoCodeId_userId: { promoCodeId: promo.id, userId } },
  })
  if (already) return { ok: false, error: 'already' }

  const grantsRole = (isRole(promo.grantsRole) ? promo.grantsRole : 'PWOFESYONEL') as Role
  const expiresAt = await applyGrant(userId, grantsRole, promo.durationDays)

  await prisma.$transaction([
    prisma.promoRedemption.create({
      data: { promoCodeId: promo.id, userId, grantedRole: grantsRole, expiresAt },
    }),
    prisma.promoCode.update({ where: { id: promo.id }, data: { redeemedCount: { increment: 1 } } }),
  ])

  await audit({
    action: 'PROMO_REDEEMED',
    actorId: ctx?.actorId ?? userId,
    targetType: 'USER',
    targetId: userId,
    ip: ctx?.ip ?? null,
    meta: { code: promo.code, grantsRole, durationDays: promo.durationDays },
  })

  return { ok: true, grantedRole: grantsRole, expiresAt, label: promo.label }
}

/**
 * Rétrograde un compte dont le palier promo a expiré (appelé à la connexion).
 * Retourne true si une rétrogradation a eu lieu.
 */
export async function downgradeIfPlanExpired(user: {
  id: string
  role: string
  planExpiresAt: Date | null
}): Promise<boolean> {
  if (!user.planExpiresAt || user.planExpiresAt.getTime() > Date.now()) return false
  if (user.role === 'MASTER_ADMIN' || user.role === 'EDITEUR') return false
  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'SITWAYEN', planExpiresAt: null, monthlyQuota: SITWAYEN_MONTHLY_QUOTA, quotaUsed: 0 },
  })
  await audit({ action: 'PROMO_EXPIRED', actorId: user.id, targetType: 'USER', targetId: user.id })
  return true
}
