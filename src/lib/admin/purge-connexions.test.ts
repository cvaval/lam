/**
 * La purge tient la promesse des 12 mois — et ne touche à rien d'autre. Client Prisma simulé :
 * on vérifie les REQUÊTES (quoi, avec quel filtre), pas la base.
 */
import { describe, it, expect } from 'vitest'
import { purgerConnexions, ACTIONS_DE_CONNEXION, RETENTION_JOURS } from './purge-connexions'

function faux() {
  const appels: { modele: string; op: string; args: any }[] = []
  const enr = (modele: string, op: string, retour: any) => (args: any) => { appels.push({ modele, op, args }); return Promise.resolve(retour) }
  const client = {
    session: {
      findMany: enr('session', 'findMany', [{ id: 'exp1', expiresAt: new Date('2026-09-01T00:00:00Z') }]),
      updateMany: enr('session', 'updateMany', { count: 1 }),
      count: enr('session', 'count', 4),
      deleteMany: enr('session', 'deleteMany', { count: 4 }),
    },
    auditLog: { count: enr('auditLog', 'count', 9), deleteMany: enr('auditLog', 'deleteMany', { count: 9 }) },
  }
  return { client: client as any, appels }
}
const now = new Date('2026-09-17T04:00:00Z')

describe('purgerConnexions', () => {
  it('en simulation : compte, ne ferme rien, ne supprime rien', async () => {
    const { client, appels } = faux()
    const b = await purgerConnexions(client, { simulation: true, now })
    expect(b).toMatchObject({ simulation: true, sessionsFermeesExpirees: 1, sessionsSupprimees: 4, auditSupprime: 9 })
    expect(appels.map((a) => a.op)).toEqual(['findMany', 'count', 'count'])
  })
  it('en réel : ferme les expirées DATÉES de leur expiration, puis supprime au-delà du seuil', async () => {
    const { client, appels } = faux()
    await purgerConnexions(client, { simulation: false, now })
    const fermeture = appels.find((a) => a.op === 'updateMany')!
    expect(fermeture.args.where).toEqual({ id: 'exp1', endedAt: null })
    expect(fermeture.args.data).toEqual({ endedAt: new Date('2026-09-01T00:00:00Z'), endReason: 'EXPIRED' })
    const seuil = new Date(now.getTime() - RETENTION_JOURS * 86400_000)
    expect(appels.find((a) => a.modele === 'session' && a.op === 'deleteMany')!.args.where).toEqual({ endedAt: { lt: seuil } })
    expect(appels.find((a) => a.modele === 'auditLog' && a.op === 'deleteMany')!.args.where).toEqual({ action: { in: [...ACTIONS_DE_CONNEXION] }, createdAt: { lt: seuil } })
  })
  it('la liste des actions purgées est FERMÉE : ni suppression de document, ni compte, ni promo, ni export', () => {
    for (const a of ['DOC_DELETED', 'ROLE_CHANGED', 'ACCOUNT_SUSPENDED', 'PROMO_REDEEMED', 'EXPORT', 'DOC_PUBLISHED']) expect(ACTIONS_DE_CONNEXION).not.toContain(a)
    expect(ACTIONS_DE_CONNEXION).toEqual(['LOGIN_OK', 'LOGIN_FAIL', '2FA_OK', '2FA_FAIL', 'LOCKOUT', 'LOGOUT', 'SESSION_EVICTED', 'SESSION_CLOSED_BY_ADMIN'])
  })
  it('douze mois, comme la Politique de confidentialité § 8.5', () => {
    expect(RETENTION_JOURS).toBe(365)
  })
})
