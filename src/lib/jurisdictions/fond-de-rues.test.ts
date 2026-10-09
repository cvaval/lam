import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { PMTiles, type RangeResponse, type Source } from 'pmtiles'
import {
  OSM_ATTRIBUTION, COD_AB_ATTRIBUTION, ROUTES_FONT, ROUTES_LIGNES, ROUTES_MINZOOM, ROUTES_NOMS,
  ROUTES_NOMS_MINZOOM, ROUTES_PMTILES_PATH, attributionsCarte, glyphsTemplate, routesLayers, routesSource,
} from './fond-de-rues'

/**
 * Le fond de rues : ce que la carte pose (couches, zooms, polices, URL) et ce que le dépôt livre
 * (le fichier PMTiles RÉEL, ses métadonnées, les glyphes). Un fichier hors budget, une URL
 * relative, une mention OSM perdue : autant de défauts invisibles à l'ouverture de la carte.
 */
const racine = resolve(__dirname, '../../..')
const pmtilesPath = resolve(racine, `public${ROUTES_PMTILES_PATH}`)
const BUDGET = 15 * 1024 * 1024
const couleurs = { line: '#52656B', text: '#152E38', halo: '#FFFFFF' }

/** Source PMTiles lue depuis le disque (le navigateur, lui, lit par requêtes `Range`). */
class FichierLocal implements Source {
  private buf = readFileSync(pmtilesPath)
  getKey() { return pmtilesPath }
  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    const b = this.buf.subarray(offset, offset + length)
    return { data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }
  }
}

describe('couches du fond de rues', () => {
  const [lignes, noms] = routesLayers(couleurs)
  it('deux couches : les lignes dès le zoom 11, les noms dès le zoom 14', () => {
    expect([lignes.id, noms.id]).toEqual([ROUTES_LIGNES, ROUTES_NOMS])
    expect(lignes.minzoom).toBe(ROUTES_MINZOOM)
    expect(noms.minzoom).toBe(ROUTES_NOMS_MINZOOM)
    expect([ROUTES_MINZOOM, ROUTES_NOMS_MINZOOM]).toEqual([11, 14])
  })
  it('les noms : le long des routes, police Inter, seulement les voies nommées', () => {
    expect(noms.type).toBe('symbol')
    const layout = (noms as { layout: Record<string, unknown> }).layout
    expect(layout['symbol-placement']).toBe('line')
    expect(layout['text-field']).toEqual(['get', 'name'])
    expect(layout['text-font']).toEqual([ROUTES_FONT])
    expect((noms as { filter: unknown }).filter).toEqual(['has', 'name'])
  })
})

describe('URL absolues (le worker `blob:` ne résout pas une URL relative)', () => {
  it('la source est une URL pmtiles absolue', () => {
    expect(routesSource('https://agora.ht')).toEqual({ type: 'vector', url: 'pmtiles://https://agora.ht/maps/hti/routes-hti.pmtiles' })
  })
  it('le gabarit des glyphes est absolu et garde `{fontstack}` et `{range}` littéraux', () => {
    const g = glyphsTemplate('https://agora.ht')
    expect(g).toBe('https://agora.ht/maps/fonts/{fontstack}/{range}.pbf')
    expect(g).not.toContain('%7B')
  })
})

describe('attribution', () => {
  it('OpenStreetMap est TOUJOURS mentionné, même quand la variable d’environnement est définie', () => {
    expect(attributionsCarte(undefined)).toEqual([COD_AB_ATTRIBUTION, OSM_ATTRIBUTION])
    expect(attributionsCarte('Autre mention')).toEqual(['Autre mention', OSM_ATTRIBUTION])
    expect(attributionsCarte('   ')).toEqual([COD_AB_ATTRIBUTION, OSM_ATTRIBUTION])
  })
})

describe('le fichier livré', () => {
  it('existe et tient dans le budget de 15 Mo', () => {
    expect(existsSync(pmtilesPath)).toBe(true)
    expect(statSync(pmtilesPath).size).toBeLessThanOrEqual(BUDGET)
  })
  it('Haïti SEULE, zooms 11 à 15', async () => {
    const h = await new PMTiles(new FichierLocal()).getHeader()
    expect([h.minZoom, h.maxZoom]).toEqual([11, 15])
    // La frontière dominicaine est vers −71,62 : aucune tuile au-delà.
    expect(h.minLon).toBeGreaterThan(-74.6)
    expect(h.maxLon).toBeLessThan(-71.55)
    expect(h.minLat).toBeGreaterThan(17.9)
    expect(h.maxLat).toBeLessThan(20.2)
  })
  it('les métadonnées décrivent CE fichier (taille, empreinte, source épinglée, licence)', () => {
    const meta = JSON.parse(readFileSync(resolve(racine, 'public/maps/hti/routes-metadata.json'), 'utf8'))
    expect(meta.bytes).toBe(statSync(pmtilesPath).size)
    expect(meta.sha256).toBe(createHash('sha256').update(readFileSync(pmtilesPath)).digest('hex'))
    expect(meta.source).toBe('https://download.geofabrik.de/central-america/haiti-and-domrep-latest.osm.pbf')
    expect(meta.sourceSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(meta.license).toMatch(/ODbL/)
  })
})

describe('les glyphes Inter', () => {
  const dossier = resolve(racine, `public/maps/fonts/${ROUTES_FONT}`)
  it('les plages utiles sont présentes et non vides (accents, « ’ »)', () => {
    for (const r of ['0-255', '256-511', '8192-8447']) {
      expect(statSync(resolve(dossier, `${r}.pbf`)).size, r).toBeGreaterThan(10_000)
    }
  })
  it('les 256 plages existent (aucune requête de glyphes en 404) et la licence OFL accompagne la police', () => {
    expect(readdirSync(dossier).filter((f) => f.endsWith('.pbf'))).toHaveLength(256)
    expect(readFileSync(resolve(dossier, 'OFL.txt'), 'utf8')).toMatch(/SIL OPEN FONT LICENSE/i)
  })
})
