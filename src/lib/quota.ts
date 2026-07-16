import { prisma } from './db'
import { hasUnlimitedSearch } from './rbac'
import type { Role } from './types'

/**
 * Quota de recherche mensuel (§03). Sitwayen (gratuit) : quota ; Pwofesyonèl /
 * Enstitisyon / Éditeur / Admin : illimité. Réinitialisation au changement de mois.
 */

// Source unique du quota gratuit — le @default(30) de prisma/schema.prisma doit suivre.
export const SITWAYEN_MONTHLY_QUOTA = 30

/** Quota mensuel applicable à un rôle (null = illimité). */
export function quotaForRole(role: Role): number | null {
  return role === 'SITWAYEN' ? SITWAYEN_MONTHLY_QUOTA : null
}

/** Recherches restantes ce mois-ci (null = illimité). Source unique du calcul
 *  affiché (page compte, QuotaChip) — ne pas recopier le clamp ailleurs. */
export function remainingQuota(monthlyQuota: number | null, quotaUsed: number): number | null {
  return monthlyQuota == null ? null : Math.max(0, monthlyQuota - quotaUsed)
}

export async function consumeSearchQuota(
  userId: string,
  role: Role,
): Promise<{ allowed: boolean; remaining: number | null }> {
  if (hasUnlimitedSearch(role)) return { allowed: true, remaining: null }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { monthlyQuota: true, quotaUsed: true, quotaResetAt: true },
  })
  if (!user || user.monthlyQuota == null) return { allowed: true, remaining: null }

  const now = new Date()
  const sameMonth =
    user.quotaResetAt.getFullYear() === now.getFullYear() && user.quotaResetAt.getMonth() === now.getMonth()

  // Nouveau mois : remise à zéro (une éventuelle course ici est bénigne — léger
  // sous-comptage au pire, jamais de dépassement).
  if (!sameMonth) {
    await prisma.user.update({ where: { id: userId }, data: { quotaUsed: 1, quotaResetAt: now } })
    return { allowed: true, remaining: user.monthlyQuota - 1 }
  }

  // Incrément ATOMIQUE gardé par le plafond : deux requêtes concurrentes ne
  // peuvent pas dépasser le quota (count === 0 ⇒ épuisé).
  const updated = await prisma.user.updateMany({
    where: { id: userId, quotaUsed: { lt: user.monthlyQuota } },
    data: { quotaUsed: { increment: 1 } },
  })
  if (updated.count === 0) return { allowed: false, remaining: 0 }
  return { allowed: true, remaining: Math.max(0, user.monthlyQuota - user.quotaUsed - 1) }
}
