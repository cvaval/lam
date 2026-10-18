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
    { champ: 'emails', valeur: ['etude@exemple.ht'] },
  ],
  modifications: [], decision: null,
  propositions: [], anomalies: [], action: 'COMPLÉTER',
  ...o,
})
const DECISION = { rang: 6, decidedOn: '2026-10-18', par: 'Me Exemple', texte: 'l’adresse est : 90, Ave Exemple', notaryId: 'n12', remplacer: ['address' as const], ajouter: [], ecarter: [] }

type Existante = { status: string; notaryId: string | null; niveau: string; champs?: string[] }
function base(o: { fiche?: boolean; misesAJour?: number[]; propositionExiste?: Existante; creationConcurrente?: boolean } = {}) {
  const maj = [...(o.misesAJour ?? [1, 1, 1])]
  const tx = {
    notaryContact: {
      findUnique: vi.fn().mockResolvedValue(o.fiche ? { id: 'contact-n12' } : null),
      create: vi.fn().mockImplementation(async () => {
        if (o.creationConcurrente) throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' })
        return {}
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    $executeRaw: vi.fn().mockImplementation(async () => maj.shift() ?? 0),
    notary: { findUnique: vi.fn().mockResolvedValue({ fullName: 'Clermont DOSSOUS', displayName: null, communeId: 'c', contact: null }) },
    notaryConfirmation: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), create: vi.fn() },
  }
  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    notaryRequest: {
      findUnique: vi.fn().mockResolvedValue(o.propositionExiste ? {
        id: 'req-1', status: o.propositionExiste.status, notaryId: o.propositionExiste.notaryId,
        payloadJson: JSON.stringify({ rapprochement: { niveau: o.propositionExiste.niveau }, propositions: (o.propositionExiste.champs ?? []).map((champ) => ({ champ })) }),
      } : null),
      create: vi.fn().mockResolvedValue({ id: 'req-2' }),
      update: vi.fn().mockResolvedValue({ id: 'req-1' }),
    },
  }
  return { prisma, tx }
}

describe('appliquer — écriture conditionnelle, jamais d’écrasement', () => {
  it('fiche absente : créée avec les trois compléments et la provenance du document', async () => {
    const { prisma, tx } = base()
    const r = await appliquer(prisma as never, plan(), CTX)
    expect(r.ecrit).toEqual(['address', 'phones', 'emails'])
    const data = tx.notaryContact.create.mock.calls[0][0].data
    expect(data).toMatchObject({ id: 'contact-n12', address: '80, Ave Exemple, Port-au-Prince', phonesJson: '["+50920000001"]', email: 'etude@exemple.ht', emailsJson: '["etude@exemple.ht"]', active: true })
    expect(JSON.parse(data.sourceJson)).toMatchObject({ file: 'Notaires.docx', sha256: 'f'.repeat(64), rang: 6, providedOn: '2026-10-18' })
  })

  it('ADRESSE AJOUTÉE APRÈS LA SIMULATION : la mise à jour conditionnelle ne touche rien, l’écart devient une proposition', async () => {
    const { prisma, tx } = base({ fiche: true, misesAJour: [0, 1, 1] })
    const r = await appliquer(prisma as never, plan(), CTX)
    expect(r.ecrit).toEqual(['phones', 'emails'])
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
    expect(r).toMatchObject({ ecrit: [], concurrence: ['address', 'phones', 'emails'] })
  })

  it('idempotence : la proposition existe déjà (même fichier, même entrée, même rapprochement) → rien de créé ni de modifié', async () => {
    const { prisma } = base({ propositionExiste: { status: 'NOUVELLE', notaryId: 'n12', niveau: 'EXACT', champs: ['address'] } })
    const r = await appliquer(prisma as never, plan({ completions: [], propositions: [{ champ: 'address', existant: 'x', propose: 'y', motif: 'm' }] }), CTX)
    expect(r.proposition).toBe('existante')
    expect(prisma.notaryRequest.create).not.toHaveBeenCalled()
    expect(prisma.notaryRequest.update).not.toHaveBeenCalled()
    expect(prisma.notaryRequest.findUnique).toHaveBeenCalledWith({ where: { sourceKey: 'notaires-docx:ffffffffffffffff:6' }, select: { id: true, status: true, notaryId: true, payloadJson: true } })
  })

  it('rapprochement ÉTABLI depuis (décision de nom) : la proposition ouverte reprend la nouvelle lecture', async () => {
    const { prisma } = base({ propositionExiste: { status: 'NOUVELLE', notaryId: null, niveau: 'PARTIEL' } })
    const r = await appliquer(prisma as never, plan({ propositions: [{ champ: 'emails', existant: null, propose: 'e@exemple.ht', motif: 'courriel supplémentaire' }] }), CTX)
    expect(r.proposition).toBe('mise-a-jour')
    const data = prisma.notaryRequest.update.mock.calls[0][0].data
    expect(data.notaryId).toBe('n12')
    expect(JSON.parse(data.payloadJson)).toMatchObject({ rapprochement: { niveau: 'EXACT', notaryId: 'n12' }, propositions: [{ champ: 'emails' }] })
    expect(prisma.notaryRequest.create).not.toHaveBeenCalled()
  })

  it('champs proposés changés (courriels désormais publiés) : la proposition ouverte est remise à jour, même vide', async () => {
    const { prisma } = base({ propositionExiste: { status: 'NOUVELLE', notaryId: 'n12', niveau: 'EXACT', champs: ['emails'] } })
    const r = await appliquer(prisma as never, plan(), CTX)
    expect(r.proposition).toBe('mise-a-jour')
    expect(JSON.parse(prisma.notaryRequest.update.mock.calls[0][0].data.payloadJson).propositions).toEqual([])
  })

  it('une proposition TRANCHÉE n’est jamais modifiée, même si le rapprochement a changé', async () => {
    for (const status of ['ACCEPTEE', 'REFUSEE']) {
      const { prisma } = base({ propositionExiste: { status, notaryId: null, niveau: 'PROBABLE' } })
      const r = await appliquer(prisma as never, plan(), CTX)
      expect(r.proposition, status).toBe('existante')
      expect(prisma.notaryRequest.update, status).not.toHaveBeenCalled()
    }
  })

  it('rien à proposer et aucune proposition existante : rien n’est créé', async () => {
    const { prisma } = base()
    const r = await appliquer(prisma as never, plan(), CTX)
    expect(r.proposition).toBeNull()
    expect(prisma.notaryRequest.create).not.toHaveBeenCalled()
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

  it('DÉCISION : une adresse publiée n’est remplacée que si elle est TOUJOURS celle que la décision a vue ; la décision est citée', async () => {
    const { prisma, tx } = base({ fiche: true, misesAJour: [1] })
    const r = await appliquer(prisma as never, plan({
      completions: [], decision: DECISION,
      modifications: [{ champ: 'address', avant: '80, Ave Exemple', apres: '90, Ave Exemple' }],
    }), CTX)
    expect(r.modifie).toEqual(['address'])
    const [sql, ...valeurs] = tx.$executeRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]]
    expect(sql.join('?')).toMatch(/SET address = \?,.* AND address = \?$/)
    expect(valeurs).toEqual(['90, Ave Exemple', 'n12', '80, Ave Exemple'])
    const data = tx.notaryContact.update.mock.calls[0][0].data
    expect(JSON.parse(data.sourceJson)).toMatchObject({ providedBy: 'Me Exemple', providedOn: '2026-10-18', champs: ['address'], decision: { texte: 'l’adresse est : 90, Ave Exemple' } })
    expect(data.upToDateOn.toISOString()).toBe('2026-10-18T00:00:00.000Z')
  })

  it('DÉCISION périmée (la fiche a changé depuis) : rien n’est remplacé, l’écart devient une proposition « décision à revoir »', async () => {
    const { prisma, tx } = base({ fiche: true, misesAJour: [0] })
    const r = await appliquer(prisma as never, plan({
      completions: [], decision: DECISION,
      modifications: [{ champ: 'address', avant: '80, Ave Exemple', apres: '90, Ave Exemple' }],
    }), CTX)
    expect(r).toMatchObject({ modifie: [], concurrence: ['address'] })
    expect(tx.notaryContact.update).not.toHaveBeenCalled()
    const payload = JSON.parse(prisma.notaryRequest.create.mock.calls[0][0].data.payloadJson)
    expect(payload.propositions[0]).toMatchObject({ champ: 'address', motif: expect.stringContaining('décision à revoir') })
  })

  it('DÉCISION qui ne laisse rien à proposer : la proposition ouverte est CLOSE, la décision citée ; sans proposition, rien n’est créé', async () => {
    const { prisma } = base({ propositionExiste: { status: 'NOUVELLE', notaryId: null, niveau: 'PROBABLE', champs: ['inscription'] } })
    const r = await appliquer(prisma as never, plan({ decision: { ...DECISION, remplacer: [] } }), CTX)
    expect(r.proposition).toBe('close')
    const data = prisma.notaryRequest.update.mock.calls[0][0].data
    expect(data).toMatchObject({ status: 'ACCEPTEE', notaryId: 'n12', decisionNote: expect.stringContaining('« l’adresse est : 90, Ave Exemple »') })
    const neuf = base()
    expect((await appliquer(neuf.prisma as never, plan({ decision: { ...DECISION, remplacer: [] } }), CTX)).proposition).toBeNull()
    expect(neuf.prisma.notaryRequest.create).not.toHaveBeenCalled()
  })

  it('sans décision, une proposition devenue vide reste OUVERTE (seul le master admin clôt)', async () => {
    const { prisma } = base({ propositionExiste: { status: 'NOUVELLE', notaryId: 'n12', niveau: 'EXACT', champs: ['emails'] } })
    await appliquer(prisma as never, plan(), CTX)
    expect(prisma.notaryRequest.update.mock.calls[0][0].data.status).toBeUndefined()
  })
})
