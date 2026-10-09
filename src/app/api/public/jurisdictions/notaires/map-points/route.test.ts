/**
 * La route des points « notaires » — comportementale, Prisma simulé, route réellement exécutée.
 *
 * Ce qu'elle doit tenir : un point par commune pourvue, au centroïde, avec le seul NOMBRE
 * (jamais un nom) ; aucun paramètre accepté ; les en-têtes de cache de la carte ; le frein de
 * débit ; et un 503 explicite tant que la table n'est pas migrée.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = {
  notary: { groupBy: vi.fn() },
  judicialCommune: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma }))

const { GET } = await import('./route')

let compteurIp = 0
const req = (query = '', ip = `10.1.0.${++compteurIp}`) =>
  new NextRequest(`http://localhost/api/public/jurisdictions/notaires/map-points${query}`, { headers: { 'x-real-ip': ip } })

const COMMUNES = [
  { id: 'commune-ouest-port-au-prince', name: 'Port-au-Prince', centroidLat: 18.54, centroidLng: -72.33 },
  { id: 'commune-ouest-cite-soleil', name: 'Cité Soleil', centroidLat: 18.58, centroidLng: -72.33 },
  { id: 'commune-centre-baptiste', name: 'Baptiste', centroidLat: null, centroidLng: null },
]

beforeEach(() => {
  vi.clearAllMocks()
  prisma.notary.groupBy.mockResolvedValue([
    { communeId: 'commune-ouest-port-au-prince', _count: { _all: 21 } },
    { communeId: 'commune-ouest-cite-soleil', _count: { _all: 3 } },
    { communeId: 'commune-centre-baptiste', _count: { _all: 1 } },
  ])
  prisma.judicialCommune.findMany.mockResolvedValue(COMMUNES)
})

describe('GET /api/public/jurisdictions/notaires/map-points', () => {
  it('un point par commune pourvue, au centroïde, avec le nombre', async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe('FeatureCollection')
    expect(body.features).toEqual([
      {
        type: 'Feature',
        properties: { communeId: 'commune-ouest-cite-soleil', communeName: 'Cité Soleil', count: 3 },
        geometry: { type: 'Point', coordinates: [-72.33, 18.58] },
      },
      {
        type: 'Feature',
        properties: { communeId: 'commune-ouest-port-au-prince', communeName: 'Port-au-Prince', count: 21 },
        geometry: { type: 'Point', coordinates: [-72.33, 18.54] },
      },
    ])
  })

  it('ne compte que les ACTIFS rattachés à une commune', async () => {
    await GET(req())
    expect(prisma.notary.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { active: true, communeId: { not: null } },
    }))
  })

  it('PAS DE NOM : liste blanche des propriétés, et aucun champ nominatif demandé à la base', async () => {
    const body = await (await GET(req())).json()
    for (const f of body.features) expect(Object.keys(f.properties).sort()).toEqual(['communeId', 'communeName', 'count'])
    const appel = JSON.stringify(prisma.notary.groupBy.mock.calls[0][0])
    expect(appel).not.toMatch(/fullName|mention|sourceJson|observation/)
  })

  it('une commune sans centroïde documenté n’est pas publiée', async () => {
    const body = await (await GET(req())).json()
    expect(body.features.some((f: { properties: { communeId: string } }) => f.properties.communeId === 'commune-centre-baptiste')).toBe(false)
  })

  it('liste blanche des paramètres : aucun n’est accepté', async () => {
    for (const q of ['?types=PAIX', '?commune=x', '?a=']) {
      const res = await GET(req(q))
      expect(res.status, q).toBe(400)
    }
    expect(prisma.notary.groupBy).not.toHaveBeenCalled()
  })

  it('mêmes en-têtes de cache que les points des tribunaux', async () => {
    const res = await GET(req())
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
  })

  it('frein de débit (LIMITS.jurMap, 30 par minute et par adresse) : la 31e est refusée', async () => {
    const ip = '10.9.9.9'
    for (let i = 0; i < 30; i++) expect((await GET(req('', ip))).status).toBe(200)
    expect((await GET(req('', ip))).status).toBe(429)
  })

  it('table pas encore migrée ⇒ 503 explicite, non mis en cache', async () => {
    prisma.notary.groupBy.mockRejectedValue(Object.assign(new Error('table does not exist'), { code: 'P2021' }))
    const res = await GET(req())
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe('notaries_unavailable')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('une autre panne n’est PAS maquillée en 503', async () => {
    prisma.notary.groupBy.mockRejectedValue(new Error('connexion perdue'))
    await expect(GET(req())).rejects.toThrow('connexion perdue')
  })
})
