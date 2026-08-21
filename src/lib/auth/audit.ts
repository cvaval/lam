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
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET'
  | 'PROMO_CREATED'
  | 'PROMO_ASSIGNED'
  | 'PROMO_REDEEMED'
  | 'PROMO_EXPIRED'
  | 'DOC_PUBLISHED'
  | 'DOC_DELETED'
  | 'EXPORT'
  | 'SCRAPING_ALERT'
  | 'QUOTA_BLOCKED'
  // Législation annotée : thèmes, renvois, amendements
  | 'THEME_CREATED'
  | 'THEME_UPDATED'
  | 'THEME_ARCHIVED'
  | 'THEME_DELETED'
  | 'DOC_THEMED'
  | 'CROSSREF_ADDED'
  | 'CROSSREF_REMOVED'
  | 'ARTICLE_AMENDED'
  | 'ARTICLE_ABROGATED'
  // Carte judiciaire : import du référentiel + modifications administratives
  | 'JUDICIAL_IMPORT'
  | 'JUDICIAL_UPDATED'
  // Calculateur de délais (§ 7) : répertoire, calendrier des fêtes, fenêtres de
  // signification. MASQUER et SUPPRIMER sont deux actions distinctes parce que ce sont
  // deux décisions distinctes — la première est réversible, la seconde est réservée au
  // master admin. Les confondre au journal rendrait l'une indiscernable de l'autre.
  | 'DELAI_ENTRY_CREATED'
  | 'DELAI_ENTRY_UPDATED'
  | 'DELAI_ENTRY_HIDDEN'
  | 'DELAI_ENTRY_RESTORED'
  | 'DELAI_ENTRY_DELETED'
  /** § 7.3 — DÉFAIRE une suppression : master admin seul, distinct de « réafficher ». */
  | 'DELAI_ENTRY_UNDELETED'
  | 'DELAI_CALENDAR_UPDATED'
  | 'DELAI_FENETRES_UPDATED'

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
