import { cache } from 'react'
import { cookies } from 'next/headers'
import { prisma } from '../db'
import { randomToken } from './crypto'
import { decrireAppareil } from './appareil'
import { IDLE_BACKSTOP_MS, type EndReason } from './session-etat'
export { IDLE_TIMEOUT_MINUTES, IDLE_WARNING_SECONDS, IDLE_BACKSTOP_MS, estVivante, type EndReason } from './session-etat'
import { parseServices } from '../access'
import { downgradeIfPlanExpired } from '../promo'
import { SITWAYEN_MONTHLY_QUOTA } from '../quota'
import type { Role, UserStatus, Locale, DocType } from '../types'

const SESSION_COOKIE = 'lv_session'
export const DEVICE_COOKIE = 'lv_device'
const SESSION_TTL_DAYS = 7

const TOUCH_THROTTLE_MS = 60_000

function baseCookieOpts(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  }
}

export interface SessionUser {
  id: string
  email: string
  name: string | null
  role: Role
  status: UserStatus
  locale: Locale
  totpEnabled: boolean
  organizationId: string | null
  monthlyQuota: number | null
  quotaUsed: number
  /** Services à texte intégral accordés (l'Index reste toujours accessible). */
  services: DocType[]
  /** Ordre des onglets/rubriques choisi par l'utilisateur (CSV de DocType ; '' = défaut). */
  sectionOrder: string
  /** Autorisé à voir le lien vers le PDF original ? */
  canViewSourcePdf: boolean
  /** échéance du palier promo (null = permanent) */
  planExpiresAt: Date | null
}

function toSessionUser(u: {
  id: string
  email: string
  name: string | null
  role: string
  status: string
  locale: string
  totpEnabled: boolean
  organizationId: string | null
  monthlyQuota: number | null
  quotaUsed: number
  services: string
  sectionOrder: string
  canViewSourcePdf: boolean
  planExpiresAt: Date | null
}): SessionUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as Role,
    status: u.status as UserStatus,
    locale: u.locale as Locale,
    totpEnabled: u.totpEnabled,
    organizationId: u.organizationId,
    monthlyQuota: u.monthlyQuota,
    quotaUsed: u.quotaUsed,
    services: parseServices(u.services),
    sectionOrder: u.sectionOrder ?? '',
    canViewSourcePdf: u.canViewSourcePdf,
    planExpiresAt: u.planExpiresAt,
  }
}

/**
 * ─── JOURNAL DES CONNEXIONS (16 sept. 2026) ───────────────────────────────────────────────
 * Une session ne se SUPPRIME plus à sa fin : elle se FERME (`endedAt`, `endReason`). La ligne
 * devient le journal que le master admin lit — début, appareil, fin, motif. Six chemins
 * ferment une session, et tous passent par `closeSession` / `closeAllSessions` : la
 * déconnexion, l'inactivité et l'expiration (ici), la suspension et la réinitialisation 2FA
 * (route admin), la réinitialisation du mot de passe (route reset). Un test de source
 * (`sessions-source.test.ts`) veille à ce qu'aucun `session.delete` ne réapparaisse hors de la
 * purge à 12 mois (`/api/cron/sessions`).
 */
/**
 * Ferme une session OUVERTE. Sans effet si elle est déjà fermée : le `endedAt: null` du `where`
 * garantit que la PREMIÈRE fin fait foi — une expiration découverte tard n'écrase jamais une
 * déconnexion volontaire. `endedAt` peut être daté dans le passé (une expiration a eu lieu à
 * `expiresAt`, pas au moment où on la constate).
 */
export async function closeSession(
  id: string,
  reason: EndReason,
  extra: { evictedById?: string; endedAt?: Date } = {},
): Promise<boolean> {
  const r = await prisma.session.updateMany({
    where: { id, endedAt: null },
    data: { endedAt: extra.endedAt ?? new Date(), endReason: reason, evictedById: extra.evictedById ?? null },
  })
  return r.count === 1
}

/** Ferme toutes les sessions ouvertes d'un compte (suspension, réinitialisations, admin). */
export async function closeAllSessions(userId: string, reason: EndReason, opts: { except?: string } = {}): Promise<number> {
  const r = await prisma.session.updateMany({
    where: { userId, endedAt: null, ...(opts.except ? { id: { not: opts.except } } : {}) },
    data: { endedAt: new Date(), endReason: reason },
  })
  return r.count
}

export async function createSession(
  userId: string,
  opts: { ip?: string | null; userAgent?: string | null; twoFactorVerified: boolean },
) {
  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000)
  // L'appareil se décrit À LA CRÉATION et ne se recalcule jamais ; non reconnu → null, et
  // l'écran montre l'UA brut (règle : le journal ne dit que ce qu'il sait).
  const appareil = decrireAppareil(opts.userAgent)
  const session = await prisma.session.create({
    data: {
      token,
      userId,
      twoFactorVerified: opts.twoFactorVerified,
      // Vérifiée dès la création = passée par un appareil de confiance (service.ts).
      verifiedVia: opts.twoFactorVerified ? 'TRUSTED_DEVICE' : null,
      deviceLabel: appareil.reconnu ? appareil.libelle : null,
      ip: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
      expiresAt,
    },
  })
  cookies().set(SESSION_COOKIE, token, baseCookieOpts(SESSION_TTL_DAYS * 86400))
  return session
}

// React cache() : une seule requête session par rendu, même si le layout ET la
// page appellent getCurrentUser (constat d'audit #28).
const loadSession = cache(async () => {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } })
  if (!session) return null
  // Une ligne FERMÉE n'authentifie plus jamais — quel que soit son motif, et sans rien écrire.
  if (session.endedAt) return null
  const now = Date.now()
  if (session.expiresAt.getTime() < now) {
    // La fin réelle est l'expiration, pas sa découverte.
    await closeSession(session.id, 'EXPIRED', { endedAt: session.expiresAt }).catch(() => {})
    return null
  }
  // Inactivité (filet serveur) : invalide après IDLE_BACKSTOP_MS sans aucune requête.
  // lastSeenAt absent (session créée avant la fonctionnalité) → initialisé, pas de coupure.
  const last = session.lastSeenAt?.getTime()
  if (last !== undefined && now - last > IDLE_BACKSTOP_MS) {
    await closeSession(session.id, 'IDLE', { endedAt: new Date(last + IDLE_BACKSTOP_MS) }).catch(() => {})
    return null
  }
  // Marque l'activité (throttle : au plus une écriture par minute et par session).
  if (last === undefined || now - last > TOUCH_THROTTLE_MS) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } }).catch(() => {})
  }
  return session
})

/** Session pleinement authentifiée (2FA validée). À utiliser pour gating des pages app. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await loadSession()
  if (!session || !session.twoFactorVerified) return null
  if (session.user.status !== 'ACTIVE') return null
  const u = session.user
  // Palier promo expiré : rétrograder MAINTENANT plutôt qu'à la prochaine connexion (§07,
  // audit) — sinon rôle/quota élevés conservés jusqu'à ~7 j. downgradeIfPlanExpired ne fait
  // rien si non expiré ou si le compte est staff.
  if (u.planExpiresAt && u.planExpiresAt.getTime() <= Date.now() && (await downgradeIfPlanExpired(u))) {
    return toSessionUser({ ...u, role: 'SITWAYEN', planExpiresAt: null, monthlyQuota: SITWAYEN_MONTHLY_QUOTA })
  }
  return toSessionUser(u)
}

/** Session en attente de 2FA (pour l'écran /verify) — null si déjà vérifiée. */
export async function getPendingSession() {
  const session = await loadSession()
  if (!session || session.twoFactorVerified) return null
  return { session, user: toSessionUser(session.user) }
}

export async function markTwoFactorVerified(sessionId: string) {
  await prisma.session.update({ where: { id: sessionId }, data: { twoFactorVerified: true, verifiedVia: 'TOTP' } })
}

/**
 * Retire le COOKIE de session et rend le jeton qu'il portait. Synchrone, sans base :
 * c'est le seul geste qui déconnecte réellement le navigateur, et il ne doit dépendre
 * de rien. La suppression en base vient après, en meilleur effort.
 */
export function clearSessionCookie(): string | undefined {
  const token = cookies().get(SESSION_COOKIE)?.value
  cookies().delete(SESSION_COOKIE)
  return token
}

/** Ferme la session que porte ce jeton (déconnexion). Sans effet si elle n'existe plus ou est déjà fermée. */
export async function closeSessionByToken(token: string, reason: EndReason = 'LOGOUT') {
  await prisma.session.updateMany({ where: { token, endedAt: null }, data: { endedAt: new Date(), endReason: reason } })
}

/**
 * Déconnexion complète — le cookie D'ABORD, la base ensuite.
 *
 * L'ordre n'est pas indifférent. Quand la base était interrogée en premier, son
 * indisponibilité (pool saturé, démarrage à froid) faisait échouer toute la déconnexion :
 * le cookie survivait, et la page /login, qui renvoie au tableau de bord si une session
 * existe, ramenait l'utilisateur dans le compte qu'il venait de quitter. Une ligne de
 * session orpheline en base est au contraire inoffensive : plus aucun cookie ne la
 * désigne, et elle expire.
 */
export async function destroyCurrentSession() {
  const token = clearSessionCookie()
  if (token) await closeSessionByToken(token, 'LOGOUT')
}

export function deviceCookieOpts(days: number) {
  return baseCookieOpts(days * 86400)
}
