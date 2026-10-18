/**
 * API publique de la fiche (fenêtre modale) : la LISTE BLANCHE seulement, 404 ≠ 503, aucune donnée
 * privée (empreinte, provenance, demandes, justificatifs). Prisma simulé, valeurs FICTIVES.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prisma = { notary: { findUnique: vi.fn() }, notaryConfirmation: { findMany: vi.fn() } }
const guard = vi.fn()
vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/lib/security/ratelimit', () => ({ guard, LIMITS: { jurNotaire: { limit: 120, windowMs: 60_000 } } }))
const { GET } = await import('./route')

const LIGNE = {
  id: 'mjsp-2026-09-08-11', ordinal: 11, edition: '2026-09-08', fullName: 'Jean EXEMPLE', displayName: null, mention: null, active: true,
  sourceCommune: 'PORT-AU-PRINCE', sourceJson: JSON.stringify({ consultations: [{ date: '2026-09-08' }] }), communeId: 'commune-ouest-port-au-prince',
  commune: { id: 'commune-ouest-port-au-prince', name: 'Port-au-Prince', department: { name: 'Ouest' }, jurisdictions: [{ court: { id: 'court-tpi-pap', name: 'TPI de Port-au-Prince', active: true } }] },
  contact: {
    address: '10, Rue Exemple', phonesJson: '["+50920000001"]', email: 'etude@exemple.ht', emailsJson: '["etude@exemple.ht"]',
    upToDateOn: new Date('2026-10-18T00:00:00Z'), active: true, sourceJson: JSON.stringify({ providedBy: 'Me Exemple', requestId: 'clx0demande', decision: { texte: 'privé' } }),
  },
}
const appel = (id: string) => GET(new NextRequest(`https://agora.ht/api/public/jurisdictions/notaires/${id}`), { params: { id } })

beforeEach(() => {
  vi.resetAllMocks()
  guard.mockResolvedValue(true)
  prisma.notary.findUnique.mockResolvedValue(LIGNE)
  prisma.notaryConfirmation.findMany.mockResolvedValue([])
})

describe('GET /api/public/jurisdictions/notaires/{id}', () => {
  it('200 : la fiche publique, rien d’autre ; `no-store`', async () => {
    const res = await appel('mjsp-2026-09-08-11')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const { fiche } = await res.json()
    expect(Object.keys(fiche).sort()).toEqual(['commune', 'confirmedOn', 'contact', 'id', 'jurisdiction', 'mention', 'name', 'printedName', 'sourceCommune'])
    expect(fiche.contact).toEqual({ address: '10, Rue Exemple', phones: ['+50920000001'], emails: ['etude@exemple.ht'], upToDateOn: '2026-10-18' })
    expect(fiche.confirmedOn).toBeNull()
    // Aucune donnée privée ni interne : provenance, demande, décision, empreinte de version.
    expect(JSON.stringify(fiche)).not.toMatch(/Me Exemple|requestId|clx0demande|privé|providedBy|version|snapshot|evidence/)
  })
  it('inscription inconnue ou retirée : 404', async () => {
    prisma.notary.findUnique.mockResolvedValue(null)
    expect((await appel('mjsp-2026-09-08-999')).status).toBe(404)
    prisma.notary.findUnique.mockResolvedValue({ ...LIGNE, active: false })
    expect((await appel('mjsp-2026-09-08-37')).status).toBe(404)
  })
  it('identifiant mal formé : 404, sans lecture de la base', async () => {
    expect((await appel('..%2Fadmin')).status).toBe(404)
    expect(prisma.notary.findUnique).not.toHaveBeenCalled()
  })
  it('incident de lecture : 503 — DISTINCT d’une fiche introuvable', async () => {
    prisma.notary.findUnique.mockRejectedValue(new Error('connexion perdue'))
    const res = await appel('mjsp-2026-09-08-11')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, error: 'unavailable' })
  })
  it('débit limité par adresse IP : 429', async () => {
    guard.mockResolvedValue(false)
    expect((await appel('mjsp-2026-09-08-11')).status).toBe(429)
  })
})
