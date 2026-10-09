/**
 * Fond de rues de la carte judiciaire — routes d'Haïti et leurs noms (OpenStreetMap), servis par
 * agora.ht : AUCUNE origine externe, la CSP reste `connect-src 'self'`.
 *
 *  - données : `public/maps/hti/routes-hti.pmtiles` (scripts/build-routes-haiti.py ; source,
 *    date et empreinte dans `public/maps/hti/routes-metadata.json`) ;
 *  - polices de la carte : glyphes Inter (la police du site) dans `public/maps/fonts/Inter-Regular/`.
 *
 * Fonctions PURES, testées dans fond-de-rues.test.ts : la carte (`JudicialMap.tsx`) ne fait que
 * poser ce qu'elles décrivent.
 *
 * ⚠️ URL ABSOLUES. MapLibre parse dans un worker `blob:` : une URL relative y échoue sans erreur.
 * ⚠️ Le gabarit des glyphes ne passe PAS par `new URL()`, qui encoderait `{` en `%7B`.
 */
import type { LayerSpecification, SourceSpecification } from 'maplibre-gl'

export const ROUTES_SOURCE_ID = 'routes'
export const ROUTES_SOURCE_LAYER = 'routes'
export const ROUTES_PMTILES_PATH = '/maps/hti/routes-hti.pmtiles'
export const ROUTES_FONT = 'Inter-Regular'

/** Les lignes à partir du zoom 11 ; les NOMS à partir du zoom 14 (question 2 de la cliente). */
export const ROUTES_MINZOOM = 11
export const ROUTES_NOMS_MINZOOM = 14

/** Identifiants MapLibre des deux couches du fond de rues. */
export const ROUTES_LIGNES = 'routes-lignes'
export const ROUTES_NOMS = 'routes-noms'

/** Mention OBLIGATOIRE (ODbL) partout où la carte s'affiche — jamais par une variable d'env. */
export const OSM_ATTRIBUTION = '© contributeurs OpenStreetMap'
export const COD_AB_ATTRIBUTION = 'Limites administratives : CNIGS / OCHA (COD-AB Haïti, CC BY-IGO)'

/**
 * Mentions de sources de la carte. `NEXT_PUBLIC_MAP_ATTRIBUTION` peut remplacer celle des limites,
 * JAMAIS celle d'OpenStreetMap : définie en production, la variable effacerait sinon la mention
 * que la licence impose.
 */
export function attributionsCarte(env: string | undefined): string[] {
  return [env?.trim() || COD_AB_ATTRIBUTION, OSM_ATTRIBUTION]
}

/** `pmtiles://https://agora.ht/maps/hti/routes-hti.pmtiles` — absolue, pour le worker. */
export function routesSource(origin: string): SourceSpecification {
  return { type: 'vector', url: `pmtiles://${origin}${ROUTES_PMTILES_PATH}` }
}

/** Gabarit des glyphes : `{fontstack}` et `{range}` restent LITTÉRAUX (pas de `new URL()`). */
export function glyphsTemplate(origin: string): string {
  return `${origin}/maps/fonts/{fontstack}/{range}.pbf`
}

const parClasse = (majeure: number, secondaire: number, locale: number, service: number) =>
  ['match', ['get', 'classe'], 'majeure', majeure, 'secondaire', secondaire, 'locale', locale, service]

/**
 * Les deux couches, à poser SOUS toute couche de points du registre :
 *  - lignes : ardoise (`grafit`) atténuée, largeur selon la classe et le zoom — elles restent
 *    discrètes devant les filets d'encre des départements ;
 *  - noms : le long des routes, encre sur halo blanc, à partir du zoom 14.
 */
export function routesLayers(colors: { line: string; text: string; halo: string }): LayerSpecification[] {
  return [
    {
      id: ROUTES_LIGNES,
      type: 'line',
      source: ROUTES_SOURCE_ID,
      'source-layer': ROUTES_SOURCE_LAYER,
      minzoom: ROUTES_MINZOOM,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colors.line,
        'line-opacity': parClasse(0.6, 0.5, 0.42, 0.35) as never,
        'line-width': ['interpolate', ['linear'], ['zoom'],
          11, parClasse(1.1, 0.7, 0.4, 0.3),
          13, parClasse(2, 1.4, 0.8, 0.5),
          15, parClasse(4, 3, 2, 1.2),
        ] as never,
      },
    },
    {
      id: ROUTES_NOMS,
      type: 'symbol',
      source: ROUTES_SOURCE_ID,
      'source-layer': ROUTES_SOURCE_LAYER,
      minzoom: ROUTES_NOMS_MINZOOM,
      filter: ['has', 'name'],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'name'],
        'text-font': [ROUTES_FONT],
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 11, 15, 12.5] as never,
        'text-max-angle': 30,
        'text-padding': 2,
        'symbol-spacing': 280,
        'text-letter-spacing': 0.02,
      },
      paint: { 'text-color': colors.text, 'text-halo-color': colors.halo, 'text-halo-width': 1.5 },
    },
  ]
}
