import { prisma } from '../db'
import type { ClientCtx } from './request'
import { verifyPassword } from './password'
import { normalizeEmail } from './email'
import { generateTotpSecret, verifyTotp, totpQrDataUrl, totpDelta } from './totp'
import { deviceFingerprint } from './crypto'
import { createSession, getPendingSession, markTwoFactorVerified } from './session'
import { issueTrustedDevice, getValidTrustedDevice } from './devices'
import { audit } from './audit'
import { isSensitiveRole } from '../rbac'
import { sendMail, lockoutEmail } from '../mail'
import { downgradeIfPlanExpired } from '../promo'
import type { Role } from '../types'

const MAX_FAILED = 5
export const LOCK_MINUTES = 15

/**
 * Enregistre une tentative échouée (mot de passe ou code 2FA) : incrémente le
 * compteur, applique le verrouillage 5 essais → 15 min, journalise LOCKOUT et
 * notifie par e-mail. Source unique pour les deux chemins d'authentification.
 * Retourne true si le compte vient d'être verrouillé.
 */
async function registerFailedAttempt(
  user: { id: string; email: string; failedLogins: number; lockedUntil: Date | null },
  action: 'LOGIN_FAIL' | '2FA_FAIL',
  ctx: ClientCtx,
  meta?: Record<string, unknown>,
): Promise<boolean> {
  const failed = user.failedLogins + 1
  const locking = failed >= MAX_FAILED
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLogins: locking ? 0 : failed,
      lockedUntil: locking ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.lockedUntil,
    },
  })
  await audit({ action, actorId: user.id, ip: ctx.ip, userAgent: ctx.userAgent, meta })
  if (locking) {
    await audit({ action: 'LOCKOUT', actorId: user.id, ip: ctx.ip, userAgent: ctx.userAgent })
    await sendMail(lockoutEmail(user.email, LOCK_MINUTES))
  }
  return locking
}

function isLocked(user: { lockedUntil: Date | null }): boolean {
  return Boolean(user.lockedUntil && user.lockedUntil.getTime() > Date.now())
}

export type { ClientCtx } from './request'

export type LoginResult =
  | { ok: true; step: 'done' | '2fa' | 'enroll'; sensitive: boolean }
  | { ok: false; error: 'invalidCredentials' | 'pending' | 'suspended' | 'locked' }

export async function attemptLogin(email: string, password: string, ctx: ClientCtx): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } })
  if (!user) {
    await audit({ action: 'LOGIN_FAIL', ip: ctx.ip, userAgent: ctx.userAgent, meta: { email } })
    return { ok: false, error: 'invalidCredentials' }
  }

  if (isLocked(user)) return { ok: false, error: 'locked' }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    const locking = await registerFailedAttempt(user, 'LOGIN_FAIL', ctx)
    return { ok: false, error: locking ? 'locked' : 'invalidCredentials' }
  }

  // Mot de passe correct → réinitialise les compteurs.
  if (user.failedLogins !== 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } })
  }

  if (user.status === 'PENDING') return { ok: false, error: 'pending' }
  if (user.status === 'SUSPENDED') return { ok: false, error: 'suspended' }

  // Palier octroyé par code promo arrivé à échéance → retour Sitwayen.
  const downgraded = await downgradeIfPlanExpired(user)
  const role = (downgraded ? 'SITWAYEN' : user.role) as Role
  const sensitive = isSensitiveRole(role)
  const fingerprint = deviceFingerprint(ctx.userAgent)

  // Comptes sensibles (Éditeur/Admin) : 2FA à chaque session, pas d'appareil de confiance.
  const trusted = sensitive ? null : await getValidTrustedDevice(user.id, fingerprint)

  if (trusted) {
    await createSession(user.id, { ip: ctx.ip, userAgent: ctx.userAgent, twoFactorVerified: true })
    await audit({ action: 'LOGIN_OK', actorId: user.id, ip: ctx.ip, userAgent: ctx.userAgent, meta: { trustedDevice: true } })
    return { ok: true, step: 'done', sensitive }
  }

  await createSession(user.id, { ip: ctx.ip, userAgent: ctx.userAgent, twoFactorVerified: false })
  await audit({ action: 'LOGIN_OK', actorId: user.id, ip: ctx.ip, userAgent: ctx.userAgent, meta: { pending2fa: true } })
  return { ok: true, step: user.totpEnabled ? '2fa' : 'enroll', sensitive }
}

/** Démarre l'enrôlement TOTP (première connexion après activation). */
export async function beginEnrollment(): Promise<{ qr: string; secret: string } | null> {
  const pending = await getPendingSession()
  if (!pending) return null
  let secret = (await prisma.user.findUnique({ where: { id: pending.user.id }, select: { totpSecret: true, totpEnabled: true } }))
    ?.totpSecret
  // Régénère un secret tant que l'enrôlement n'est pas finalisé.
  if (!secret) {
    secret = generateTotpSecret()
    await prisma.user.update({ where: { id: pending.user.id }, data: { totpSecret: secret } })
  }
  const qr = await totpQrDataUrl(pending.user.email, secret)
  return { qr, secret }
}

export type VerifyResult = { ok: true } | { ok: false; error: 'badCode' | 'locked' | 'session' }

async function finishTwoFactor(
  userId: string,
  sessionId: string,
  trustDevice: boolean,
  sensitive: boolean,
  ctx: ClientCtx,
  enrolled: boolean,
) {
  await markTwoFactorVerified(sessionId)
  await prisma.user.update({
    where: { id: userId },
    data: { failedLogins: 0, lockedUntil: null, ...(enrolled ? { totpEnabled: true } : {}) },
  })
  if (trustDevice && !sensitive) {
    // Confort uniquement : la 2FA est DÉJÀ validée (markTwoFactorVerified ci-dessus).
    // Une panne d'émission d'« appareil de confiance » ne doit JAMAIS faire échouer la
    // connexion — sinon /api/auth/verify renverrait 500 et l'écran afficherait « code
    // invalide » alors que la session est vérifiée (ce qui ne frappait que les rôles
    // non sensibles, seuls à atteindre cette ligne).
    try {
      await issueTrustedDevice(userId, deviceFingerprint(ctx.userAgent), ctx.ip)
    } catch (e) {
      console.error('issueTrustedDevice (non bloquant) :', e)
    }
  }
  if (enrolled) await audit({ action: '2FA_ENROLLED', actorId: userId, ip: ctx.ip })
  await audit({ action: '2FA_OK', actorId: userId, ip: ctx.ip, userAgent: ctx.userAgent, meta: { trustDevice: trustDevice && !sensitive } })
}

export async function verifyTwoFactor(code: string, trustDevice: boolean, ctx: ClientCtx): Promise<VerifyResult> {
  const pending = await getPendingSession()
  if (!pending) return { ok: false, error: 'session' }
  const user = await prisma.user.findUnique({ where: { id: pending.user.id } })
  if (!user || !user.totpSecret) return { ok: false, error: 'session' }

  // Même garde que le mot de passe : un compte verrouillé ne peut pas forcer le
  // code TOTP par essais successifs (la 2FA compte aussi dans le verrouillage).
  if (isLocked(user)) return { ok: false, error: 'locked' }

  const sensitive = isSensitiveRole(user.role as Role)
  const enrolling = !user.totpEnabled

  if (!verifyTotp(code, user.totpSecret)) {
    // Diagnostic : delta d'horloge (null = mauvais secret ; |delta|>2 = téléphone déréglé).
    const locking = await registerFailedAttempt(user, '2FA_FAIL', ctx, {
      delta: totpDelta(code, user.totpSecret),
      enrolling,
    })
    return { ok: false, error: locking ? 'locked' : 'badCode' }
  }

  await finishTwoFactor(user.id, pending.session.id, trustDevice, sensitive, ctx, enrolling)
  return { ok: true }
}
