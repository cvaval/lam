import { cache } from 'react'
import { cookies } from 'next/headers'
import { prisma } from '../db'
import { randomToken } from './crypto'
import { parseServices } from '../access'
import type { Role, UserStatus, Locale, DocType } from '../types'

const SESSION_COOKIE = 'lv_session'
export const DEVICE_COOKIE = 'lv_device'
const SESSION_TTL_DAYS = 7

/**
 * Déconnexion automatique pour inactivité (§sécurité). Deux mécanismes de portées
 * distinctes — ne pas les confondre :
 *  - IDLE_TIMEOUT_MINUTES : la véritable déconnexion d'inactivité HUMAINE, appliquée
 *    côté NAVIGATEUR (minuteur précis basé sur l'activité réelle souris/clavier/
 *    défilement, voir IdleTimer), avec un avertissement avant la coupure.
 *  - Le SERVEUR applique un filet plus large (IDLE_BACKSTOP_MS) : il invalide la
 *    session après une absence TOTALE de requêtes (navigateur abandonné / onglet
 *    fermé / JS désactivé). Ce filet ne mesure PAS l'inactivité humaine : loadSession()
 *    rafraîchit lastSeenAt sur toute requête authentifiée — y compris un simple ping
 *    /api/auth/heartbeat. Un appelant (client légitime comme script automatisé) qui
 *    émet une requête à intervalle < IDLE_BACKSTOP_MS garde donc la session vivante
 *    indéfiniment ; la garantie se limite au cas « plus aucune requête n'arrive ».
 *    Le « +5 min » absorbe le délai entre les pings d'activité du client.
 */
export const IDLE_TIMEOUT_MINUTES = 15
export const IDLE_WARNING_SECONDS = 60
const IDLE_BACKSTOP_MS = (IDLE_TIMEOUT_MINUTES + 5) * 60_000
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
    canViewSourcePdf: u.canViewSourcePdf,
    planExpiresAt: u.planExpiresAt,
  }
}

export async function createSession(
  userId: string,
  opts: { ip?: string | null; userAgent?: string | null; twoFactorVerified: boolean },
) {
  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000)
  const session = await prisma.session.create({
    data: {
      token,
      userId,
      twoFactorVerified: opts.twoFactorVerified,
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
  const now = Date.now()
  if (session.expiresAt.getTime() < now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  // Inactivité (filet serveur) : invalide après IDLE_BACKSTOP_MS sans aucune requête.
  // lastSeenAt absent (session créée avant la fonctionnalité) → initialisé, pas de coupure.
  const last = session.lastSeenAt?.getTime()
  if (last !== undefined && now - last > IDLE_BACKSTOP_MS) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
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
  return toSessionUser(session.user)
}

/** Session en attente de 2FA (pour l'écran /verify) — null si déjà vérifiée. */
export async function getPendingSession() {
  const session = await loadSession()
  if (!session || session.twoFactorVerified) return null
  return { session, user: toSessionUser(session.user) }
}

export async function markTwoFactorVerified(sessionId: string) {
  await prisma.session.update({ where: { id: sessionId }, data: { twoFactorVerified: true } })
}

export async function destroyCurrentSession() {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (token) await prisma.session.deleteMany({ where: { token } })
  cookies().delete(SESSION_COOKIE)
}

export function deviceCookieOpts(days: number) {
  return baseCookieOpts(days * 86400)
}
