/**
 * `estSchemaAbsent` — la frontière entre « la migration n'est pas passée » et « il y a un
 * bug ». Elle décide si l'utilisatrice lit une phrase ou un « Internal Server Error ».
 *
 * ⚠️ Le cas qui manquait, constaté le 20 août 2026 sur le serveur de développement : le
 * client Prisma en mémoire ne connaissait pas encore les modèles `Delai*`, donc
 * `prisma.delaiEntry` valait `undefined` et l'appel cassait en `TypeError` — jamais en P2021.
 * `/fr/delais` rendait un 500, et les deux routes publiques aussi. Un 503 « le répertoire
 * n'a pas été versé en base » était disponible et n'était pas rendu.
 */
import { describe, expect, it } from 'vitest'
import { estSchemaAbsent } from './service-base'

describe('les formes que prend une table absente', () => {
  it('P2021 — la table n’existe pas (Prisma)', () => {
    expect(estSchemaAbsent(Object.assign(new Error('no table'), { code: 'P2021' }))).toBe(true)
  })

  it('42P01 — le SQLSTATE, qui remonte par les requêtes brutes', () => {
    expect(estSchemaAbsent({ code: '42P01' })).toBe(true)
    expect(estSchemaAbsent({ meta: { code: '42P01' } })).toBe(true)
  })

  it('délégué absent du client généré — `prisma.delaiEntry` vaut undefined', () => {
    const casse = new TypeError("Cannot read properties of undefined (reading 'findMany')")
    expect(estSchemaAbsent(casse)).toBe(true)
    expect(estSchemaAbsent(new TypeError("Cannot read properties of undefined (reading 'findUnique')"))).toBe(true)
    expect(estSchemaAbsent(new TypeError("Cannot read property 'create' of undefined"))).toBe(false)
  })
})

describe('ce qu’elle ne doit PAS avaler', () => {
  it('un vrai défaut de programmation reste un défaut', () => {
    // Le motif est étroit à dessein : « reading 'length' » n'a rien à voir avec un schéma.
    expect(estSchemaAbsent(new TypeError("Cannot read properties of undefined (reading 'length')"))).toBe(false)
    expect(estSchemaAbsent(new TypeError("Cannot read properties of null (reading 'findMany')"))).toBe(false)
  })

  it('une erreur de contrainte, de connexion ou de validation n’est pas un schéma absent', () => {
    expect(estSchemaAbsent(Object.assign(new Error('unique'), { code: 'P2002' }))).toBe(false)
    expect(estSchemaAbsent(Object.assign(new Error('unreachable'), { code: 'P1001' }))).toBe(false)
    expect(estSchemaAbsent(new Error('boom'))).toBe(false)
  })

  it('ni une valeur qui n’est pas une erreur', () => {
    expect(estSchemaAbsent(null)).toBe(false)
    expect(estSchemaAbsent(undefined)).toBe(false)
    expect(estSchemaAbsent('P2021')).toBe(false)
    expect(estSchemaAbsent(42)).toBe(false)
  })
})
