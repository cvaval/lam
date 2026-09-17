import type { PrismaClient } from '@prisma/client'

/**
 * PURGE DES DONNÉES DE CONNEXION — tenir la promesse de la Politique de confidentialité.
 *
 * § 8.5 : « Données de connexion : conservées pendant une durée de douze (12) mois à compter
 * de leur collecte » (au visa de l'art. 3 al. 3 de l'Arrêté de 2018). Jusqu'au 17 sept. 2026,
 * rien ne la faisait respecter : 1 181 lignes d'audit depuis juin, jamais purgées.
 *
 * Trois gestes, dans cet ordre :
 *  1. FERMER ce qui est mort sans l'avoir dit — les sessions expirées jamais fermées (la
 *     fermeture est paresseuse : elle n'arrive que si le cookie se représente). Datées de
 *     `expiresAt`, pas de la découverte : la fin réelle est l'expiration.
 *  2. SUPPRIMER les sessions fermées depuis plus de 12 mois — le seul endroit du code qui
 *     supprime une session (sentinelle : sessions-source.test.ts).
 *  3. SUPPRIMER les lignes d'audit DE CONNEXION de plus de 12 mois — la liste fermée
 *     ACTIONS_DE_CONNEXION, rien d'autre : DOC_DELETED, ROLE_CHANGED, ACCOUNT_*, PROMO_*,
 *     EXPORT sont l'histoire du corpus et des comptes, et restent (décision D4, 16 sept. 2026).
 *     Le verrou anti-force-brute compte sur 15 minutes : la purge ne le touche pas.
 *
 * `simulation: true` compte sans écrire — c'est ainsi que la route se recette en production.
 */
export const RETENTION_JOURS = 365
export const ACTIONS_DE_CONNEXION = ['LOGIN_OK', 'LOGIN_FAIL', '2FA_OK', '2FA_FAIL', 'LOCKOUT', 'LOGOUT', 'SESSION_EVICTED', 'SESSION_CLOSED_BY_ADMIN'] as const

export interface BilanPurge {
  simulation: boolean
  seuil: string
  sessionsFermeesExpirees: number
  sessionsSupprimees: number
  auditSupprime: number
}

export async function purgerConnexions(client: Pick<PrismaClient, 'session' | 'auditLog'>, opts: { simulation: boolean; now?: Date }): Promise<BilanPurge> {
  const now = opts.now ?? new Date()
  const seuil = new Date(now.getTime() - RETENTION_JOURS * 86400_000)

  // 1. fermer les expirées jamais fermées, datées de leur expiration
  const expirees = await client.session.findMany({ where: { endedAt: null, expiresAt: { lt: now } }, select: { id: true, expiresAt: true } })
  if (!opts.simulation) {
    for (const s of expirees) {
      await client.session.updateMany({ where: { id: s.id, endedAt: null }, data: { endedAt: s.expiresAt, endReason: 'EXPIRED' } })
    }
  }
  // 2. supprimer les fermées depuis plus de 12 mois
  const whereSessions = { endedAt: { lt: seuil } }
  const sessionsSupprimees = opts.simulation
    ? await client.session.count({ where: whereSessions })
    : (await client.session.deleteMany({ where: whereSessions })).count
  // 3. supprimer l'audit de connexion de plus de 12 mois — liste fermée
  const whereAudit = { action: { in: [...ACTIONS_DE_CONNEXION] }, createdAt: { lt: seuil } }
  const auditSupprime = opts.simulation
    ? await client.auditLog.count({ where: whereAudit })
    : (await client.auditLog.deleteMany({ where: whereAudit })).count

  return { simulation: opts.simulation, seuil: seuil.toISOString(), sessionsFermeesExpirees: expirees.length, sessionsSupprimees, auditSupprime }
}
