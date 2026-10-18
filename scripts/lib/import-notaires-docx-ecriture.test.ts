/**
 * Écriture de l'import « Notaires.docx » — Prisma simulé. Valeurs FICTIVES (dépôt public).
 * Protégé : une adresse ajoutée APRÈS la simulation n'est pas écrasée ; idempotence des
 * propositions ; aucun badge « Confirmé » attribué par un import.
 */
import { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { appliquer } from './import-notaires-docx-ecriture'
import type { PlanEntree } from './import-notaires-docx'

const CTX = { sha: 'f'.repeat(64), fichier: 'Notaires.docx', jour: '2026-10-18' }
const plan = (o: Partial<PlanEntree> = {}): PlanEntree => ({
  rang: 6, nom: 'Clermont DOSSOUS',
  rapprochement: { niveau: 'EXACT', notaryId: 'n12', candidats: [] },
  existant: null,
  propose: { address: '80, Ave Exemple, Port-au-Prince', phones: ['+50920000001'], emails: ['etude@exemple.ht'] },
  completions: [
    { champ: 'address', valeur: '80, Ave Exemple, Port-au-Prince' },
    { champ: 'phones', valeur: ['+50920000001'] },
    { champ: 'email', valeur: 'etude@exemple.ht' },
  ],
  propositions: [], anomalies: [], action: 'COMPLÉTER',
  ...o,
})

function base(o: { fiche?: boolean; misesAJour?: number[]; propositionExiste?: boolean; creationConcurrente?: boolean } = {}) {
  const maj = [...(o.misesAJour ?? [1, 1, 1])]
  const tx = {
    notaryContact: {
      findUnique: vi.fn().mockResolvedValue(o.fiche ? { id: 'contact-n12' } : null),
      create: vi.fn().mockImplementation(async () => {
        if (o.creationConcurrente) throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' })
        return {}
      }),
    },
    $executeRaw: vi.fn().mockImplementation(async () => maj.shift() ?? 0),
    notary: { findUnique: vi.fn().mockResolvedValue({ fullName: 'Clermont DOSSOUS', displayName: null, communeId: 'c', contact: null }) },
    notaryConfirmation: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), create: vi.fn() },
  }
  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    notaryRequest: {
      findUnique: vi.fn().mockResolvedValue(o.propositionExiste ? { id: 'req-1' } : null),
      create: vi.fn().mockResolvedValue({ id: 'req-2' }),
    },
  }
  return { prisma, tx }
}

describe('appliquer — écriture conditionnelle, jamais d’écrasement', () => {
  it('fiche absente : créée avec les trois compléments et la provenance du document', async () => {
    const { prisma, tx } = base()
    const r = await appliquer(prisma as never, plan(), CTX)
    expect(r.ecrit).toEqual(['address', 'phones', 'email'])
    const data = tx.notaryContact.create.mock.calls[0][0].data
    expect(data).toMatchObject({ id: 'contact-n12', address: '80, Ave Exemple, Port-au-Prince', phonesJson: '["+50920000001"]', email: 'etude@exemple.ht', active: true })
    expect(JSON.parse(data.sourceJson)).toMatchObject({ file: 'Notaires.docx', sha256: 'f'.repeat(64), rang: 6, providedOn: '2026-10-18' })
  })

  it('ADRESSE AJOUTÉE APRÈS LA SIMULATION : la mise à jour conditionnelle ne touche rien, l’écart devient une proposition', async () => {
    const { prisma, tx } = base({ fiche: true, misesAJour: [0, 1, 1] })
    const r = await appliquer(prisma as never, plan(), CTX)
    expect(r.ecrit).toEqual(['phones', 'email'])
    expect(r.concurrence).toEqual(['address'])
    // La requête ne remplace QU'UNE valeur absente (null, vide ou espaces).
    const sql = (tx.$executeRaw.mock.calls[0][0] as TemplateStringsArray).join('?')
    expect(sql).toMatch(/address IS NULL OR btrim\(address\) = ''/)
    const payload = JSON.parse(prisma.notaryRequest.create.mock.calls[0][0].data.payloadJson)
    expect(payload.propositions[0]).toMatchObject({ champ: 'address', motif: expect.stringContaining('non écrasée') })
  })

  it('fiche créée entre-temps par une autre écriture (P2002) : retour aux écritures conditionnelles', async () => {
    const { prisma, tx } = base({ creationConcurrente: true, misesAJour: [0, 0, 0] })
    const r = await appliquer(prisma as never, plan(), CTX)
    expect(tx.$executeRaw).toHaveBeenCalledTimes(3)
    expect(r).toMatchObject({ ecrit: [], concurrence: ['address', 'phones', 'email'] })
  })

  it('idempotence : la proposition existe déjà (même fichier, même entrée) → rien de créé', async () => {
    const { prisma } = base({ propositionExiste: true })
    const r = await appliquer(prisma as never, plan({ completions: [], propositions: [{ champ: 'address', existant: 'x', propose: 'y', motif: 'm' }] }), CTX)
    expect(r.proposition).toBe('existante')
    expect(prisma.notaryRequest.create).not.toHaveBeenCalled()
    expect(prisma.notaryRequest.findUnique).toHaveBeenCalledWith({ where: { sourceKey: 'notaires-docx:ffffffffffffffff:6' }, select: { id: true } })
  })

  it('rapprochement incertain : AUCUNE écriture, une proposition de type IMPORT sans notaire', async () => {
    const { prisma, tx } = base()
    const r = await appliquer(prisma as never, plan({
      rapprochement: { niveau: 'PROBABLE', notaryId: null, candidats: [] }, completions: [],
      propositions: [{ champ: 'inscription', existant: null, propose: 'Lesly ALPHONSE', motif: 'à confirmer' }],
    }), CTX)
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(tx.notaryContact.create).not.toHaveBeenCalled()
    expect(r.proposition).toBe('creee')
    expect(prisma.notaryRequest.create.mock.calls[0][0].data).toMatchObject({ kind: 'IMPORT', notaryId: null, requesterEmail: 'legal@agora.ht' })
  })

  it('aucun badge « Confirmé » n’est jamais attribué par un import', async () => {
    const { prisma, tx } = base()
    await appliquer(prisma as never, plan(), CTX)
    expect(tx.notaryConfirmation.create).not.toHaveBeenCalled()
  })
})
