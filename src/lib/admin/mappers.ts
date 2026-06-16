import type { Role, UserStatus, DocType } from '../types'
import { parseServices } from '../access'

/** DTO d'un compte présenté dans la console admin (sérialisable client). */
export interface AdminUser {
  id: string
  email: string
  name: string | null
  role: Role
  status: UserStatus
  requestedAt: string
  activatedAt: string | null
  /** Services à texte intégral accordés (l'Index reste toujours accessible). */
  services: DocType[]
  /** Autorisé à voir le lien vers le PDF original ? */
  canViewSourcePdf: boolean
}

/**
 * Projette une ligne Prisma User vers AdminUser. Source unique partagée par
 * admin/page.tsx et admin/users/page.tsx (évite la dérive du mapping).
 *
 * NB : volontairement hors de UsersManager.tsx ('use client') — un composant
 * serveur ne peut pas appeler une fonction exportée par un module client
 * (Next.js la transforme en référence client).
 */
export function toAdminUser(u: {
  id: string
  email: string
  name: string | null
  role: string
  status: string
  requestedAt: Date
  activatedAt: Date | null
  services: string
  canViewSourcePdf: boolean
}): AdminUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as Role,
    status: u.status as UserStatus,
    requestedAt: u.requestedAt.toISOString(),
    activatedAt: u.activatedAt?.toISOString() ?? null,
    services: parseServices(u.services),
    canViewSourcePdf: u.canViewSourcePdf,
  }
}
