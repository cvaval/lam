/**
 * Registre de TEST : la plateforme plus une couche fictive. Lu par `layers.test.ts` et
 * `layers-ui.test.tsx` ; jamais par le code de l'application.
 */
import { LAYER_GROUPS, MAP_LAYERS, createLayerRegistry, type MapLayerDef } from './layers'

/**
 * UNE COUCHE FICTIVE, DÉCLARÉE ICI ET NULLE PART AILLEURS — la preuve que le registre suffit.
 * Les huissiers ne sont PAS une couche de la plateforme (la cliente ne l'a pas demandée) ;
 * ils servent d'exemple de « couche qui viendra ensuite ». Le rendu des boutons et de la
 * légende est vérifié dans `layers-ui.test.tsx`, avec ce même registre.
 */
export const HUISSIERS: MapLayerDef = {
  slug: 'huissiers',
  group: 'professions',
  defaultOn: false,
  marker: { kind: 'emoji', glyph: '⚖️', imagePrefix: 'huissier', sizeBy: { property: 'count', medium: 3, large: 7 } },
  labelKey: 'layerGroupProfessions',
  legendKey: 'layerGroupProfessions',
  mapLayers: { points: 'huissiers-points' },
  source: { url: '/api/public/jurisdictions/huissiers/map-points' },
  iconOffset: [-10, -10],
}
export const AVEC_HUISSIERS = createLayerRegistry([...(MAP_LAYERS as unknown as MapLayerDef[]), HUISSIERS], LAYER_GROUPS)
