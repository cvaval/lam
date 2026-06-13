import { redirect } from 'next/navigation'
import { getCurrentUser } from './session'
import type { SessionUser } from './session'
import { can, type Capability } from '../rbac'
import type { Locale } from '../types'

/** Exige une session pleinement authentifiée (2FA validée) ; sinon → /login. */
export async function requireUser(locale: Locale): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/login`)
  return user
}

/** Exige une capacité (§03) ; sinon → /dashboard. */
export async function requireCapability(locale: Locale, cap: Capability): Promise<SessionUser> {
  const user = await requireUser(locale)
  if (!can(user.role, cap)) redirect(`/${locale}/dashboard`)
  return user
}

// Comparaison directe du rôle (et non can('admin.accounts')) : le grant 'own'
// d'Enstitisyon rendrait can() vrai alors que la console est réservée au Master Admin.
export async function requireAdmin(locale: Locale): Promise<SessionUser> {
  const user = await requireUser(locale)
  if (user.role !== 'MASTER_ADMIN') redirect(`/${locale}/dashboard`)
  return user
}

/**
 * Variante API du garde Master Admin : retourne l'utilisateur ou null (l'appelant
 * répond 403). À utiliser dans toutes les routes /api/admin/*.
 */
export async function requireAdminApi(): Promise<SessionUser | null> {
  const user = await getCurrentUser()
  return user && user.role === 'MASTER_ADMIN' ? user : null
}
