import { cache } from 'react'
import { cookies } from 'next/headers'
import { prisma } from '../db'
import { randomToken } from './crypto'
import type { Role, UserStatus, Locale } from '../types'

const SESSION_COOKIE = 'lv_session'
export const DEVICE_COOKIE = 'lv_device'
const SESSION_TTL_DAYS = 7

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
  indexOnly: boolean
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
  indexOnly: boolean
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
    indexOnly: u.indexOnly,
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
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
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
