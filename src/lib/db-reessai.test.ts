/**
 * Reprise d'une requête dont l'attente de connexion a expiré (P2024) — et d'elle seule.
 */
import { describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { avecReessaiConnexion, estAttenteConnexion, REESSAIS_CONNEXION } from './db-reessai'

const erreur = (code: string) => new Prisma.PrismaClientKnownRequestError('échec', { code, clientVersion: '5.22.0' })

describe('reprise sur attente de connexion expirée', () => {
  it('P2024 seulement ; une autre erreur Prisma ou une erreur ordinaire ne sont pas des attentes', () => {
    expect(estAttenteConnexion(erreur('P2024'))).toBe(true)
    expect(estAttenteConnexion(erreur('P2002'))).toBe(false)
    expect(estAttenteConnexion(new Error('P2024'))).toBe(false)
  })

  it('rejoue après une attente expirée, et journalise la reprise', async () => {
    const journal = vi.fn()
    const executer = vi.fn().mockRejectedValueOnce(erreur('P2024')).mockResolvedValueOnce('lignes')
    await expect(avecReessaiConnexion(executer, { journal })).resolves.toBe('lignes')
    expect(executer).toHaveBeenCalledTimes(2)
    expect(journal).toHaveBeenCalledWith(expect.stringContaining('P2024 reprise 1/2'))
  })

  it(`au plus ${REESSAIS_CONNEXION} reprises, puis l'erreur remonte`, async () => {
    const executer = vi.fn().mockRejectedValue(erreur('P2024'))
    await expect(avecReessaiConnexion(executer, { journal: () => {} })).rejects.toMatchObject({ code: 'P2024' })
    expect(executer).toHaveBeenCalledTimes(1 + REESSAIS_CONNEXION)
  })

  it('jamais pour une autre erreur : une écriture refusée (P2002) n’est pas rejouée', async () => {
    const executer = vi.fn().mockRejectedValue(erreur('P2002'))
    await expect(avecReessaiConnexion(executer, { journal: () => {} })).rejects.toMatchObject({ code: 'P2002' })
    expect(executer).toHaveBeenCalledTimes(1)
  })
})
