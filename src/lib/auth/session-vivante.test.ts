/**
 * « Vivante » se définit sur TROIS conditions. Le 16 sept. 2026, la production comptait
 * 3 sessions Windows « non expirées » ouvertes les 12, 14 et 15 septembre et vues pour la
 * dernière fois quelques minutes après leur création : mortes d'inactivité, jamais fermées,
 * « vivantes » pour qui ne regardait que `expiresAt`. Ce prédicat est le seul employé.
 */
import { describe, it, expect } from 'vitest'
import { estVivante, IDLE_BACKSTOP_MS } from './session-etat'

const now = Date.parse('2026-09-16T19:00:00Z')
const dans7j = new Date(now + 7 * 86400_000)

describe('estVivante — trois conditions', () => {
  it('ouverte, non expirée, vue il y a 5 min → vivante', () => {
    expect(estVivante({ endedAt: null, expiresAt: dans7j, lastSeenAt: new Date(now - 5 * 60_000) }, now)).toBe(true)
  })
  it('fermée → morte, quel que soit le reste', () => {
    expect(estVivante({ endedAt: new Date(now - 1000), expiresAt: dans7j, lastSeenAt: new Date(now) }, now)).toBe(false)
  })
  it('expirée → morte, même vue à l’instant', () => {
    expect(estVivante({ endedAt: null, expiresAt: new Date(now - 1), lastSeenAt: new Date(now) }, now)).toBe(false)
  })
  it('le cas de production : non expirée mais vue il y a deux jours → morte d’inactivité', () => {
    expect(estVivante({ endedAt: null, expiresAt: dans7j, lastSeenAt: new Date(now - 2 * 86400_000) }, now)).toBe(false)
  })
  it('la frontière est le filet serveur (20 min) : juste avant vivante, juste après morte', () => {
    expect(estVivante({ endedAt: null, expiresAt: dans7j, lastSeenAt: new Date(now - IDLE_BACKSTOP_MS) }, now)).toBe(true)
    expect(estVivante({ endedAt: null, expiresAt: dans7j, lastSeenAt: new Date(now - IDLE_BACKSTOP_MS - 1) }, now)).toBe(false)
  })
  it('jamais vue (créée avant la fonctionnalité) → vivante, comme loadSession la traite', () => {
    expect(estVivante({ endedAt: null, expiresAt: dans7j, lastSeenAt: null }, now)).toBe(true)
  })
})

import { classerAutresSessions } from './session-etat'

describe('classerAutresSessions — ce qu’une connexion vérifiée fait des autres', () => {
  const base = { expiresAt: dans7j, endedAt: null }
  it('une session vivante et vérifiée est ÉVINCÉE — c’est la simultanéité réelle, elle vaut un e-mail', () => {
    const [f] = classerAutresSessions([{ ...base, id: 'a', twoFactorVerified: true, lastSeenAt: new Date(now - 60_000) }], now)
    expect(f).toMatchObject({ id: 'a', reason: 'EVICTED', vivante: true })
    expect(f.endedAt.getTime()).toBe(now)
  })
  it('une session morte d’inactivité se ferme IDLE, datée de sa vraie fin — pas EVICTED', () => {
    const vue = new Date(now - 3 * 3600_000)
    const [f] = classerAutresSessions([{ ...base, id: 'b', twoFactorVerified: true, lastSeenAt: vue }], now)
    expect(f).toMatchObject({ id: 'b', reason: 'IDLE', vivante: false })
    expect(f.endedAt.getTime()).toBe(vue.getTime() + IDLE_BACKSTOP_MS)
  })
  it('une session expirée se ferme EXPIRED, datée de son expiration', () => {
    const exp = new Date(now - 86400_000)
    const [f] = classerAutresSessions([{ ...base, id: 'c', expiresAt: exp, twoFactorVerified: true, lastSeenAt: new Date(now) }], now)
    expect(f).toMatchObject({ id: 'c', reason: 'EXPIRED', vivante: false })
    expect(f.endedAt).toEqual(exp)
  })
  it('une session en attente de 2FA est évincée mais n’est pas une connexion : pas d’e-mail', () => {
    const [f] = classerAutresSessions([{ ...base, id: 'd', twoFactorVerified: false, lastSeenAt: new Date(now) }], now)
    expect(f).toMatchObject({ id: 'd', reason: 'EVICTED', vivante: false })
  })
  it('une session jamais vue (antérieure à lastSeenAt) est traitée comme vivante', () => {
    const [f] = classerAutresSessions([{ ...base, id: 'e', twoFactorVerified: true, lastSeenAt: null }], now)
    expect(f).toMatchObject({ reason: 'EVICTED', vivante: true })
  })
  it('aucune autre session → rien à fermer', () => {
    expect(classerAutresSessions([], now)).toEqual([])
  })
})
