/**
 * Les deux routes de la rédaction sur les notaires — exécutées pour de vrai, Prisma, gardes et
 * journal simulés.
 *
 * Coordonnées (chantier C, `corpus.manage`) :
 *  - un éditeur saisit ; un numéro illisible est refusé et NOMMÉ ; une entrée retirée n'en reçoit pas ;
 *  - accepter une demande en enregistrant est réservé au master admin, et se fait dans la même
 *    transaction (la demande est rattachée au notaire) ;
 *  - supprimer est réservé au master admin ; tout est audité avant/après.
 *
 * Décision (chantier D, master admin) :
 *  - une demande décidée ne se rouvre pas ;
 *  - INSCRIRE crée `tiers-AAAAMMJJ-n` (édition `tiers`), vérification consignée dans la source.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = {
  notary: { findUnique: vi.fn(), findMany: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
  notaryContact: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
  notaryRequest: { findUnique: vi.fn(), update: vi.fn() },
  judicialCommune: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}
const requireCapabilityApi = vi.fn()
const requireAdminApi = vi.fn()
const audit = vi.fn()

vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/lib/auth/guard', () => ({ requireCapabilityApi, requireAdminApi }))
vi.mock('@/lib/auth/audit', () => ({ audit }))

const coordonnees = await import('./[id]/coordonnees/route')
const decision = await import('./demandes/[id]/route')

const ADMIN = { id: 'u-1', role: 'MASTER_ADMIN', email: 'admin@agora.ht' }
const EDITEUR = { id: 'u-2', role: 'EDITEUR', email: 'redaction@agora.ht' }
const NOTAIRE = { id: 'mjsp-2026-09-08-11', active: true, contact: null }
const SAISIE = {
  address: '14 rue Marcadieux, Bourdon, Port-au-Prince', phones: ['+509 2942-3848'], email: 'patrickvictor@etudevictor.com',
  searchAliases: [], observation: null, upToDateOn: '2026-10-09', providedBy: 'Me Patrick Victor', channel: 'courriel', active: true,
}

const req = (method: string, url: string, body?: unknown) =>
  new NextRequest(`https://agora.ht${url}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
const put = (body: unknown, id = NOTAIRE.id) => coordonnees.PUT(req('PUT', `/api/admin/notaires/${id}/coordonnees`, body), { params: { id } })
const patch = (body: unknown, id = 'clx0demande0000001') => decision.PATCH(req('PATCH', `/api/admin/notaires/demandes/${id}`, body), { params: { id } })

beforeEach(() => {
  vi.resetAllMocks()
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma))
  prisma.notary.findUnique.mockResolvedValue(NOTAIRE)
  prisma.notaryContact.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({ ...create, createdAt: new Date(), updatedAt: new Date() }))
})

describe('coordonnées — saisie de la rédaction', () => {
  it('sans droit corpus.manage : 403, rien n’est lu', async () => {
    requireCapabilityApi.mockResolvedValue(null)
    expect((await put(SAISIE)).status).toBe(403)
    expect(prisma.notary.findUnique).not.toHaveBeenCalled()
  })

  it('un éditeur crée la fiche `contact-<id>` : E.164, audit avant/après', async () => {
    requireCapabilityApi.mockResolvedValue(EDITEUR)
    const res = await put(SAISIE)
    expect(res.status).toBe(200)
    const arg = prisma.notaryContact.upsert.mock.calls[0][0]
    expect(arg.where).toEqual({ notaryId: NOTAIRE.id })
    expect(arg.create).toMatchObject({ id: 'contact-mjsp-2026-09-08-11', notaryId: NOTAIRE.id, phonesJson: '["+50929423848"]' })
    const a = audit.mock.calls[0][0]
    expect(a).toMatchObject({ action: 'NOTARY_CONTACT_UPDATED', actorId: 'u-2', targetId: 'contact-mjsp-2026-09-08-11' })
    expect(a.meta.avant).toBeNull()
    expect(a.meta.apres).toMatchObject({ phonesJson: '["+50929423848"]', upToDateOn: '2026-10-09' })
  })

  it('numéro illisible : 400, le numéro est nommé, rien d’écrit', async () => {
    requireCapabilityApi.mockResolvedValue(EDITEUR)
    const res = await put({ ...SAISIE, phones: ['12'] })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ ok: false, error: 'invalidFields', fields: ['telephone:12'] })
    expect(prisma.notaryContact.upsert).not.toHaveBeenCalled()
  })

  it('entrée retirée (n° 37) : 404, pas de coordonnées', async () => {
    requireCapabilityApi.mockResolvedValue(ADMIN)
    prisma.notary.findUnique.mockResolvedValue({ ...NOTAIRE, active: false })
    expect((await put(SAISIE)).status).toBe(404)
    expect(prisma.notaryContact.upsert).not.toHaveBeenCalled()
  })

  it('accepter une demande en enregistrant : réservé au master admin', async () => {
    requireCapabilityApi.mockResolvedValue(EDITEUR)
    expect((await put({ ...SAISIE, requestId: 'clx0demande0000001' })).status).toBe(403)
    expect(prisma.notaryContact.upsert).not.toHaveBeenCalled()
  })

  it('master admin + demande sans notaire choisi : fiche écrite ET demande acceptée, rattachée, dans la même transaction', async () => {
    requireCapabilityApi.mockResolvedValue(ADMIN)
    prisma.notaryRequest.findUnique.mockResolvedValue({ status: 'NOUVELLE', kind: 'CONTACT', notaryId: null })
    const res = await put({ ...SAISIE, requestId: 'clx0demande0000001' })
    expect(res.status).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.notaryRequest.update).toHaveBeenCalledWith({
      where: { id: 'clx0demande0000001' },
      data: expect.objectContaining({ status: 'ACCEPTEE', notaryId: NOTAIRE.id, decidedById: 'u-1' }),
    })
    expect(JSON.parse(prisma.notaryContact.upsert.mock.calls[0][0].create.sourceJson).requestId).toBe('clx0demande0000001')
    expect(audit.mock.calls.map((c) => c[0].action)).toEqual(['NOTARY_CONTACT_UPDATED', 'NOTARY_REQUEST_DECIDED'])
  })

  it('demande qui vise un AUTRE notaire, ou déjà décidée : 409, rien d’écrit', async () => {
    requireCapabilityApi.mockResolvedValue(ADMIN)
    prisma.notaryRequest.findUnique.mockResolvedValue({ status: 'NOUVELLE', kind: 'CONTACT', notaryId: 'mjsp-2026-09-08-9' })
    expect((await put({ ...SAISIE, requestId: 'clx0demande0000001' })).status).toBe(409)
    prisma.notaryRequest.findUnique.mockResolvedValue({ status: 'REFUSEE', kind: 'CONTACT', notaryId: NOTAIRE.id })
    expect((await put({ ...SAISIE, requestId: 'clx0demande0000001' })).status).toBe(409)
    expect(prisma.notaryContact.upsert).not.toHaveBeenCalled()
  })

  it('supprimer : master admin seulement, audité', async () => {
    requireAdminApi.mockResolvedValue(null)
    const refus = await coordonnees.DELETE(req('DELETE', `/api/admin/notaires/${NOTAIRE.id}/coordonnees`), { params: { id: NOTAIRE.id } })
    expect(refus.status).toBe(403)
    requireAdminApi.mockResolvedValue(ADMIN)
    prisma.notaryContact.findUnique.mockResolvedValue({ id: 'contact-mjsp-2026-09-08-11', phonesJson: '[]' })
    const ok = await coordonnees.DELETE(req('DELETE', `/api/admin/notaires/${NOTAIRE.id}/coordonnees`), { params: { id: NOTAIRE.id } })
    expect(ok.status).toBe(200)
    expect(prisma.notaryContact.delete).toHaveBeenCalledWith({ where: { notaryId: NOTAIRE.id } })
    expect(audit.mock.calls[0][0].meta).toMatchObject({ supprimee: true, apres: null })
  })
})

describe('décision du master admin', () => {
  beforeEach(() => { requireAdminApi.mockResolvedValue(ADMIN) })

  it('un éditeur ne décide pas', async () => {
    requireAdminApi.mockResolvedValue(null)
    expect((await patch({ action: 'EN_COURS' })).status).toBe(403)
  })

  it('refus motivé : REFUSÉE, décideur et date consignés', async () => {
    prisma.notaryRequest.findUnique.mockResolvedValue({ id: 'clx0demande0000001', status: 'EN_COURS', kind: 'CONTACT' })
    expect((await patch({ action: 'REFUSER', note: 'Pas notaire.' })).status).toBe(200)
    expect(prisma.notaryRequest.update).toHaveBeenCalledWith({
      where: { id: 'clx0demande0000001' },
      data: { status: 'REFUSEE', decidedById: 'u-1', decidedAt: expect.any(Date), decisionNote: 'Pas notaire.' },
    })
  })

  it('une demande décidée ne se rouvre pas : 409', async () => {
    prisma.notaryRequest.findUnique.mockResolvedValue({ id: 'clx0demande0000001', status: 'ACCEPTEE', kind: 'LISTING' })
    expect((await patch({ action: 'REFUSER', note: 'trop tard' })).status).toBe(409)
    expect(prisma.notaryRequest.update).not.toHaveBeenCalled()
  })

  it('INSCRIRE : entrée `tiers-…` hors liste, vérification consignée, demande acceptée et rattachée', async () => {
    prisma.notaryRequest.findUnique.mockResolvedValue({ id: 'clx0demande0000001', status: 'EN_COURS', kind: 'LISTING' })
    prisma.judicialCommune.findUnique.mockResolvedValue({ id: 'commune-nord-port-margot', name: 'Port-Margot', department: { name: 'Nord' } })
    const jour = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    prisma.notary.findMany.mockResolvedValue([{ id: `tiers-${jour}-1` }])
    prisma.notary.aggregate.mockResolvedValue({ _max: { ordinal: 4 } })
    prisma.notary.create.mockImplementation(async ({ data }: { data: { id: string } }) => ({ id: data.id }))

    const res = await patch({ action: 'INSCRIRE', fullName: 'Me Jean Exemple', communeId: 'commune-nord-port-margot', verifiedOn: '2026-10-09', note: 'Appel à la Chambre des notaires du Nord.' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, notaryId: `tiers-${jour}-2` })

    const data = prisma.notary.create.mock.calls[0][0].data
    expect(data).toMatchObject({ edition: 'tiers', ordinal: 5, fullName: 'Me Jean Exemple', communeId: 'commune-nord-port-margot', sourceCommune: 'Port-Margot', sourceDepartment: 'Nord', active: true })
    expect(JSON.parse(data.sourceJson)).toEqual({ requestId: 'clx0demande0000001', verifiedBy: 'admin@agora.ht', verifiedOn: '2026-10-09', how: 'Appel à la Chambre des notaires du Nord.' })
    expect(prisma.notaryRequest.update.mock.calls[0][0].data).toMatchObject({ status: 'ACCEPTEE', notaryId: `tiers-${jour}-2` })
  })

  it('INSCRIRE sur une demande de coordonnées : 409', async () => {
    prisma.notaryRequest.findUnique.mockResolvedValue({ id: 'clx0demande0000001', status: 'NOUVELLE', kind: 'CONTACT' })
    expect((await patch({ action: 'INSCRIRE', fullName: 'X Y Z', communeId: 'commune-nord-port-margot', verifiedOn: '2026-10-09', note: 'vérifié au téléphone' })).status).toBe(409)
    expect(prisma.notary.create).not.toHaveBeenCalled()
  })
})
