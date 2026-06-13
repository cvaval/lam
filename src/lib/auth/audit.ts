import type { PrismaClient } from '@prisma/client'
import { prisma } from '../db'

export type AuditAction =
  | 'LOGIN_OK'
  | 'LOGIN_FAIL'
  | 'LOCKOUT'
  | '2FA_OK'
  | '2FA_FAIL'
  | '2FA_ENROLLED'
  | 'LOGOUT'
  | 'ACCOUNT_REQUESTED'
  | 'ACCOUNT_CREATED'
  | 'ACCOUNT_ACTIVATED'
  | 'ACCOUNT_REJECTED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_REACTIVATED'
  | 'ROLE_CHANGED'
  | '2FA_RESET'
  | 'PROMO_CREATED'
  | 'PROMO_ASSIGNED'
  | 'PROMO_REDEEMED'
  | 'PROMO_EXPIRED'
  | 'DOC_PUBLISHED'
  | 'DOC_DELETED'
  | 'EXPORT'
  | 'SCRAPING_ALERT'
  | 'QUOTA_BLOCKED'

export async function audit(
  opts: {
    action: AuditAction
    actorId?: string | null
    targetType?: string
    targetId?: string
    ip?: string | null
    userAgent?: string | null
    meta?: Record<string, unknown>
  },
  // Les scripts (import-brh, import-moniteur) passent leur propre client
  // pour ne pas ouvrir une seconde connexion via le singleton.
  client: Pick<PrismaClient, 'auditLog'> = prisma,
): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        action: opts.action,
        actorId: opts.actorId ?? null,
        targetType: opts.targetType,
        targetId: opts.targetId,
        ip: opts.ip ?? null,
        userAgent: opts.userAgent ?? null,
        metaJson: opts.meta ? JSON.stringify(opts.meta) : null,
      },
    })
  } catch {
    // Le journal d'audit ne doit jamais bloquer le flux principal.
  }
}
