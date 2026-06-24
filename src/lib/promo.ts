import { Prisma } from '@prisma/client'
import { prisma } from './db'
import { audit } from './auth/audit'
import { quotaForRole, SITWAYEN_MONTHLY_QUOTA } from './quota'
import { isRole, type Role } from './types'

export type RedeemError = 'unknown' | 'inactive' | 'expired' | 'exhausted' | 'assigned' | 'already'
export type RedeemResult =
  | { ok: true; grantedRole: Role; expiresAt: Date | null; label: string | null }
  | { ok: false; error: RedeemError }

// Erreur interne pour interrompre la transaction avec un code métier (plafond atteint).
class PromoTxError extends Error {
  constructor(public code: RedeemError) {
    super(code)
  }
}

/**
 * Redemption d'un code promo par un compte. Valide l'état du code (actif, non expiré,
 * redemptions restantes, attribution éventuelle) puis octroie le palier. Le contrôle du
 * plafond, la création de la redemption (unicité = garde anti-double), l'incrément du
 * compteur et l'octroi du rôle se font dans UNE transaction (§audit : pas de race qui
 * octroierait le palier sans enregistrer la redemption / qui dépasserait le plafond).
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
  if (promo.maxRedemptions != null && promo.redeemedCount >= promo.maxRedemptions) return { ok: false, error: 'exhausted' }
  if (promo.assignedToUserId && promo.assignedToUserId !== userId) return { ok: false, error: 'assigned' }

  const grantsRole = (isRole(promo.grantsRole) ? promo.grantsRole : 'PWOFESYONEL') as Role
  const expiresAt = promo.durationDays ? new Date(Date.now() + promo.durationDays * 86400_000) : null

  try {
    await prisma.$transaction(async (tx) => {
      // Re-contrôle du plafond DANS la transaction (anti-race entre deux requêtes).
      const fresh = await tx.promoCode.findUnique({
        where: { id: promo.id },
        select: { redeemedCount: true, maxRedemptions: true },
      })
      if (fresh?.maxRedemptions != null && fresh.redeemedCount >= fresh.maxRedemptions) throw new PromoTxError('exhausted')
      // L'unicité @@unique([promoCodeId, userId]) garantit une seule redemption par compte
      // (P2002 → 'already'), même en cas de double-clic / requêtes concurrentes.
      await tx.promoRedemption.create({ data: { promoCodeId: promo.id, userId, grantedRole: grantsRole, expiresAt } })
      await tx.promoCode.update({ where: { id: promo.id }, data: { redeemedCount: { increment: 1 } } })
      await tx.user.update({
        where: { id: userId },
        data: { role: grantsRole, planExpiresAt: expiresAt, monthlyQuota: quotaForRole(grantsRole) },
      })
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { ok: false, error: 'already' }
    if (e instanceof PromoTxError) return { ok: false, error: e.code }
    throw e
  }

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
