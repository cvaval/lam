/**
 * Suggestions de la barre de recherche de la carte — communes ET notaires, route réellement
 * exécutée, données simulées. Ce qu'elle doit tenir : le partage des 8 places (5 au plus par
 * sorte), le type de chaque suggestion, et AUCUNE coordonnée dans une suggestion de notaire.
 */
import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'
import { buildPlaceIndex } from '@/lib/jurisdictions/search-places'
import { buildNotaryIndex } from '@/lib/jurisdictions/search-notaries'

const commune = (id: string, name: string) => ({
  id, name, department: 'Nord', arrondissement: 'X', postalCode: null, postalCodes: [], aliases: [],
})
const notaire = (id: string, name: string) => ({
  id, name, printedName: null, mention: null, communeId: 'c', communeName: 'Fort-Liberté', aliases: [], hasContact: true,
})
const places = buildPlaceIndex([
  commune('commune-nord-saint-louis-du-nord', 'Saint-Louis-du-Nord'),
  commune('commune-sud-saint-louis-du-sud', 'Saint-Louis-du-Sud'),
])
const notaires = buildNotaryIndex([
  notaire('mjsp-2026-09-08-385', 'Saint-Louis CHARLES'),
  ...Array.from({ length: 9 }, (_, i) => notaire(`mjsp-2026-09-08-${500 + i}`, `Saint Louis NOM${i}`)),
])
vi.mock('@/lib/jurisdictions/data', () => ({
  getPlaceIndex: async () => places,
  getNotaryIndex: async () => notaires,
}))
const { GET } = await import('./route')

let ip = 0
const req = (q: string) =>
  new NextRequest(`http://localhost/api/public/jurisdictions/search?q=${encodeURIComponent(q)}`, { headers: { 'x-real-ip': `10.2.0.${++ip}` } })

describe('suggestions : communes et notaires', () => {
  it('« Saint-Louis » : les communes ne masquent pas les notaires (8 places, partagées)', async () => {
    const body = await (await GET(req('Saint-Louis'))).json()
    const kinds = body.items.map((x: { kind: string }) => x.kind)
    expect(body.items).toHaveLength(8)
    expect(kinds.filter((k: string) => k === 'commune')).toHaveLength(2)
    expect(kinds.filter((k: string) => k === 'notaire')).toHaveLength(6)
    expect(body.items.some((x: { id: string }) => x.id === 'mjsp-2026-09-08-385')).toBe(true)
  })
  it('une suggestion de notaire ne porte AUCUNE coordonnée (liste blanche)', async () => {
    const body = await (await GET(req('Saint-Louis'))).json()
    for (const x of body.items.filter((i: { kind: string }) => i.kind === 'notaire')) {
      expect(Object.keys(x).sort()).toEqual(['communeId', 'communeName', 'id', 'kind', 'mention', 'name'])
    }
    expect(JSON.stringify(body)).not.toMatch(/tel:|@|\+509|address|phone|email/i)
  })
  it('une commune garde sa forme d’avant, avec son type', async () => {
    const body = await (await GET(req('Saint-Louis-du-Sud'))).json()
    expect(body.items[0]).toMatchObject({ kind: 'commune', id: 'commune-sud-saint-louis-du-sud', department: 'Nord' })
  })
})
