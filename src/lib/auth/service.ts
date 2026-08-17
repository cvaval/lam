import { prisma } from '../db'
import type { ClientCtx } from './request'
import { verifyPassword } from './password'
import { normalizeEmail } from './email'
import { generateTotpSecret, verifyTotpStep, totpQrDataUrl, totpDelta } from './totp'
import { deviceFingerprint } from './crypto'
import { createSession, getPendingSession, markTwoFactorVerified } from './session'
import { issueTrustedDevice, getValidTrustedDevice } from './devices'
import { audit } from './audit'
import { isSensitiveRole } from '../rbac'
import { sendMail, lockoutEmail } from '../mail'
import { downgradeIfPlanExpired } from '../promo'
import type { Role } from '../types'

const MAX_FAILED = 5
/** Échecs tous azimuts au-delà desquels on PRÉVIENT sans bloquer (force brute répartie). */
const ALERTE_TOTAL = 20
export const LOCK_MINUTES = 15

/**
 * Enregistre une tentative échouée (mot de passe ou code 2FA) : incrémente le
 * compteur, applique le verrouillage 5 essais → 15 min, journalise LOCKOUT et
 * notifie par e-mail. Source unique pour les deux chemins d'authentification.
 * Retourne true si le compte vient d'être verrouillé.
 */
/**
 * Compte les échecs RÉCENTS d'un compte, et ceux venus de la MÊME ORIGINE.
 *
 * Le journal d'audit sert ici de compteur : il est persistant, commun à toutes les
 * instances, et ces deux chemins y écrivent déjà à chaque échec.
 */
async function echecsRecents(userId: string, ip: string | null): Promise<{ origine: number; total: number }> {
  const fenetre = new Date(Date.now() - LOCK_MINUTES * 60_000)
  // ⚠ UNE CONNEXION RÉUSSIE EFFACE L'ARDOISE DE SON ORIGINE. Le compteur de colonne était
  // remis à zéro au succès ; le journal, lui, ne s'efface pas. Sans ce report, l'abonné qui
  // se trompe trois fois, entre, puis se trompe deux fois de plus se retrouverait verrouillé
  // — plus sévère qu'avant la correction. On ne compte donc que ce qui suit la réussite.
  const derniereReussite = ip
    ? await prisma.auditLog.findFirst({
        where: { actorId: userId, action: 'LOGIN_OK', ip, createdAt: { gte: fenetre } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
    : null
  const depuis = derniereReussite && derniereReussite.createdAt > fenetre ? derniereReussite.createdAt : fenetre
  const echecs = { actorId: userId, action: { in: ['LOGIN_FAIL', '2FA_FAIL'] } }
  const [origine, total] = await Promise.all([
    ip ? prisma.auditLog.count({ where: { ...echecs, ip, createdAt: { gt: depuis } } }) : Promise.resolve(0),
    prisma.auditLog.count({ where: { ...echecs, createdAt: { gte: fenetre } } }),
  ])
  return { origine, total }
}

/**
 * ⚠️ LE VERROU EST PAR ORIGINE, PAS PAR COMPTE — audit du 16 août 2026.
 *
 * Le verrouillage était global : cinq essais depuis n'importe où bloquaient l'abonné
 * quinze minutes. Quiconque connaissait une adresse pouvait donc empêcher son titulaire
 * de se connecter, indéfiniment, en cinq requêtes toutes les quinze minutes. Un mécanisme
 * de sécurité devenait une arme contre celui qu'il protégeait — et sur une plateforme
 * d'avocats, priver un confrère de son fonds documentaire un jour d'audience n'est pas
 * une gêne théorique.
 *
 * Le verrou compte désormais les échecs venus de LA MÊME ADRESSE : un attaquant ne bloque
 * que lui-même, et le titulaire, qui se connecte d'ailleurs, n'est jamais atteint. La
 * force brute reste bornée — cinq essais par origine et par quart d'heure, doublés du
 * frein par IP déjà posé sur la route (12 par minute).
 *
 * Ce que ce choix ne couvre pas, et il faut le savoir : une force brute RÉPARTIE sur des
 * centaines d'adresses n'est plus arrêtée par le verrou. Elle reste bornée par le frein
 * par IP, et surtout elle est désormais VISIBLE — au-delà de ALERTE_TOTAL échecs tous
 * azimuts, le titulaire est prévenu et l'événement journalisé. Avertir sans bloquer vaut
 * mieux que bloquer la victime.
 *
 * Sans IP exploitable (proxy mal configuré), on retombe sur le compteur global : mieux
 * vaut un verrou trop large qu'aucun verrou.
 */
async function registerFailedAttempt(
  user: { id: string; email: string; failedLogins: number; lockedUntil: Date | null },
  action: 'LOGIN_FAIL' | '2FA_FAIL',
  ctx: ClientCtx,
  meta?: Record<string, unknown>,
): Promise<boolean> {
  await audit({ action, actorId: user.id, ip: ctx.ip, userAgent: ctx.userAgent, meta })
  const { origine, total } = await echecsRecents(user.id, ctx.ip)

  // Le compteur de colonne reste tenu à jour : il alimente le back-office et sert de
  // repli quand l'adresse manque. Il ne commande plus le verrou.
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: total } })

  const verrouille = ctx.ip ? origine >= MAX_FAILED : total >= MAX_FAILED

  // Notification : au plus une par heure, sinon un attaquant inonderait la boîte du
  // titulaire — le remède deviendrait la nuisance.
  if (verrouille || total >= ALERTE_TOTAL) {
    const dejaPrevenu = await prisma.auditLog.count({
      where: { actorId: user.id, action: 'LOCKOUT', createdAt: { gte: new Date(Date.now() - 3_600_000) } },
    })
    await audit({
      action: 'LOCKOUT',
      actorId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      meta: { origine, total, verrouille, reparti: !verrouille },
    })
    if (dejaPrevenu === 0) await sendMail(lockoutEmail(user.email, LOCK_MINUTES))
  }
  return verrouille
}

/** Le compte est-il verrouillé POUR CETTE ORIGINE ? (cf. l'avertissement ci-dessus) */
async function isLocked(user: { id: string; lockedUntil: Date | null }, ctx: ClientCtx): Promise<boolean> {
  // Verrou administratif posé à la main en base : il prime et reste global.
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) return true
  const { origine, total } = await echecsRecents(user.id, ctx.ip)
  return ctx.ip ? origine >= MAX_FAILED : total >= MAX_FAILED
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

  if (await isLocked(user, ctx)) return { ok: false, error: 'locked' }

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

/**
 * `wrongSecret` et `clockSkew` séparent DEUX causes que le serveur distinguait déjà dans
 * son journal depuis juin, sans jamais le dire à la personne concernée :
 *   delta === null  le code ne provient pas du secret enregistré — presque toujours une
 *                   ancienne entrée « Lam » restée dans l'application d'authentification
 *                   après une réinitialisation. Aucun nombre d'essais n'en viendra à bout.
 *   |delta| > 2     l'horloge du téléphone dérive.
 * Les confondre sous « Code invalide » enferme l'utilisateur dans une boucle : il retape
 * indéfiniment un code qui ne peut pas fonctionner, jusqu'au verrouillage.
 */
export type VerifyResult =
  | { ok: true }
  | {
      ok: false
      error: 'badCode' | 'wrongSecret' | 'clockSkew' | 'locked' | 'session'
      /** Décalage d'horloge en MINUTES, signé (+ = téléphone en avance). `clockSkew` seul. */
      minutes?: number
    }

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
  if (await isLocked(user, ctx)) return { ok: false, error: 'locked' }

  const sensitive = isSensitiveRole(user.role as Role)
  const enrolling = !user.totpEnabled

  const step = verifyTotpStep(code, user.totpSecret)
  if (step === null) {
    // Le delta, cherché sur ±5 min, dit LAQUELLE des deux causes s'applique.
    const delta = totpDelta(code, user.totpSecret)
    const locking = await registerFailedAttempt(user, '2FA_FAIL', ctx, { delta, enrolling })
    if (locking) return { ok: false, error: 'locked' }
    if (delta === null) return { ok: false, error: 'wrongSecret' }
    // « Plus d'une minute » n'aide pas à agir ; « environ 4 minutes d'avance » si.
    // Le delta ne peut être connu que d'un code issu du BON secret : le communiquer
    // n'apprend rien à qui ne l'a pas déjà.
    return { ok: false, error: 'clockSkew', minutes: Math.round((delta * 30) / 60) }
  }
  // Anti-rejeu (§04) : un code déjà consommé (pas ≤ dernier accepté) est refusé, même valide.
  if (user.lastTotpStep != null && step <= user.lastTotpStep) {
    const locking = await registerFailedAttempt(user, '2FA_FAIL', ctx, { replay: true, enrolling })
    return { ok: false, error: locking ? 'locked' : 'badCode' }
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastTotpStep: step } })

  await finishTwoFactor(user.id, pending.session.id, trustDevice, sensitive, ctx, enrolling)
  return { ok: true }
}
