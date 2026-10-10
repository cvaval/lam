/**
 * REGISTRE DES COUCHES de la carte judiciaire — la SEULE définition de ce que la carte peut
 * afficher, et le SEUL endroit qui lit et écrit le paramètre `?layers=`.
 *
 * Jusqu'au 9 oct. 2026, les quatre couches de juridictions étaient câblées en dur à sept
 * endroits (slugs, lecture de l'URL, omission du paramètre, boutons, `l.length < 4` de la
 * carte, liste des couches cliquables, légende), et tous supposaient que « par défaut » et
 * « toutes » ne faisaient qu'un. C'est faux dès qu'une couche naît MASQUÉE (les notaires).
 *
 * AJOUTER UNE COUCHE se résume désormais à :
 *   1. une entrée dans `MAP_LAYERS` ;
 *   2. une source de points (une route GeoJSON, ou une source existante filtrée par `where`) ;
 *   3. ses libellés fr/en/ht (`labelKey`, `legendKey`).
 * Boutons, légende, visibilité, couches cliquables et URL suivent sans autre code — un test
 * le prouve avec une couche fictive (`layers.test.ts`).
 *
 * Module PUR (aucun React, aucun DOM, aucune base) : lu par la page serveur, les composants
 * et la carte cliente.
 */
import type { CourtType } from './constants'
import type { Dictionary } from '../i18n/dictionaries'

type JudicialKey = keyof Dictionary['judicial']

export type LayerGroupId = 'juridictions' | 'professions'

export interface LayerGroup {
  id: LayerGroupId
  labelKey: JudicialKey
}

/**
 * Le marqueur d'une couche.
 *  - `court` : forme ET teinte viennent de `COURT_STYLE` (CourtCard.tsx), source unique du
 *    codage des ordres de juridiction — le registre ne les recopie pas (la carte avait déjà
 *    divergé de sa légende pour une teinte recopiée, avenant AV-02) ;
 *  - `emoji` : caractère peint sur canvas au centre d'une pastille blanche cernée d'encre
 *    (carte), et le caractère lui-même dans le HTML (bouton, légende, fiche). `sizeBy` fixe
 *    trois tailles d'image (`<imagePrefix>-s|m|l`) selon une propriété numérique du point :
 *    une image étirée par `icon-size` rendrait l'emoji flou.
 */
export type LayerMarker =
  | { kind: 'court'; courtType: CourtType }
  | {
      kind: 'emoji'
      glyph: string
      imagePrefix: string
      sizeBy?: { property: string; medium: number; large: number }
    }

/** Une source de points GeoJSON (chemin RELATIF : la carte l'absolutise pour le worker `blob:`). */
export interface PointSource {
  url: string
  /** Filtre d'égalité côté client — plusieurs couches peuvent partager une même réponse. */
  where?: Readonly<Record<string, string>>
  /** Regroupement en agrégats dénombrés (tribunaux de paix). */
  cluster?: { radius: number; maxZoom: number }
}

export interface MapLayerDef {
  /** Stable et public : il vit dans les URL partagées. */
  slug: string
  group: LayerGroupId
  defaultOn: boolean
  marker: LayerMarker
  /** Libellé du bouton de couche (`t.judicial[labelKey]`). */
  labelKey: JudicialKey
  /** Libellé de la légende. */
  legendKey: JudicialKey
  /** Identifiants des couches MapLibre que gouverne cette couche. */
  mapLayers: { points: string; clusters?: string }
  source: PointSource
  /** Décalage de l'icône en px CSS — pour ne pas masquer ce qui est posé au même point. */
  iconOffset?: readonly [number, number]
  /**
   * Plan d'empilement sur la carte (0 par défaut ; plus petit = plus bas). À plan égal, l'ordre
   * du registre. Indépendant de l'ordre des boutons.
   */
  drawOrder?: number
  /**
   * Bulle au clic sur un point (Me Vaval, 9 oct. 2026) : le NOMBRE (propriété `count` du point)
   * en lien vers la liste textuelle, ANCRÉE sur la commune : `/{locale}{listPath}#{communeId}`.
   * Libellés « {n} notaire » / « {n} notaires » : `t.judicial[countOneKey | countManyKey]`.
   */
  popup?: { listPath: string; countOneKey: JudicialKey; countManyKey: JudicialKey }
}

/** Longueur maximale acceptée pour `?layers=` ; au-delà, le défaut. */
export const MAX_LAYERS_PARAM = 80

export const COURT_POINTS_URL = '/api/public/jurisdictions/map-points'

export const LAYER_GROUPS: readonly LayerGroup[] = [
  { id: 'juridictions', labelKey: 'layerGroupJuridictions' },
  { id: 'professions', labelKey: 'layerGroupProfessions' },
]

const SLUG_RE = /^[a-z][a-z0-9-]{0,23}$/

/**
 * Seuils des trois tailles du 👤 des notaires (1-2, 3-6, 7 et plus) — fixés sur la répartition
 * réelle des 125 communes pourvues (59 / 53 / 13). Lus aussi par le plan d'import.
 */
export const NOTARY_SIZE_STEPS = { medium: 3, large: 7 } as const

export const MAP_LAYERS = [
  {
    slug: 'paix',
    group: 'juridictions',
    defaultOn: true,
    marker: { kind: 'court', courtType: 'PAIX' },
    labelKey: 'layerPaix',
    legendKey: 'peace',
    // Deux couches MapLibre : l'agrégat (disque dénombré) et les points isolés.
    mapLayers: { clusters: 'paix-clusters', points: 'paix-points' },
    source: { url: COURT_POINTS_URL, where: { courtType: 'PAIX' }, cluster: { radius: 34, maxZoom: 11 } },
  },
  {
    slug: 'tpi',
    group: 'juridictions',
    defaultOn: true,
    marker: { kind: 'court', courtType: 'PREMIERE_INSTANCE' },
    labelKey: 'layerTpi',
    legendKey: 'firstInstance',
    mapLayers: { points: 'courts-PREMIERE_INSTANCE' },
    source: { url: COURT_POINTS_URL, where: { courtType: 'PREMIERE_INSTANCE' } },
  },
  {
    slug: 'appel',
    group: 'juridictions',
    defaultOn: true,
    marker: { kind: 'court', courtType: 'APPEL' },
    labelKey: 'layerAppel',
    legendKey: 'appeal',
    mapLayers: { points: 'courts-APPEL' },
    source: { url: COURT_POINTS_URL, where: { courtType: 'APPEL' } },
  },
  {
    slug: 'cassation',
    group: 'juridictions',
    defaultOn: true,
    marker: { kind: 'court', courtType: 'CASSATION' },
    labelKey: 'layerCassation',
    legendKey: 'cassation',
    mapLayers: { points: 'courts-CASSATION' },
    source: { url: COURT_POINTS_URL, where: { courtType: 'CASSATION' } },
  },
  {
    // Première couche qui n'est pas une juridiction. Masquée par défaut : la demande parle
    // d'« ajouter » des données, les quatre juridictions restent le défaut (question 3 à la
    // cliente). 👤 : choix de Me Vaval du 9 oct. 2026. Un point par commune, au centroïde ;
    // la taille dit le nombre (1-2, 3-6, 7 et plus) ; décalé en haut à droite et peint sous
    // les tribunaux, pour ne jamais en masquer un.
    slug: 'notaires',
    group: 'professions',
    defaultOn: false,
    marker: { kind: 'emoji', glyph: '👤', imagePrefix: 'notaire', sizeBy: { property: 'count', ...NOTARY_SIZE_STEPS } },
    labelKey: 'layerNotaires',
    legendKey: 'legendNotaires',
    mapLayers: { points: 'notaires-points' },
    source: { url: '/api/public/jurisdictions/notaires/map-points' },
    // 14 px CSS en haut à droite : à 10 px, la grande pastille de Port-au-Prince (27 px) restait
    // presque entièrement sous le carré de la cour d'appel et l'agrégat des paix.
    iconOffset: [14, -14],
    // SOUS les tribunaux : à l'échelle du pays, les pastilles de communes voisines se
    // chevauchent ; peintes dessous, elles ne masquent jamais un tribunal.
    drawOrder: -1,
    // Au clic : « N notaires → », vers la section de la commune dans « Notaires par juridiction ».
    popup: { listPath: '/juridictions/notaires', countOneKey: 'notaryCountOne', countManyKey: 'notaryCountMany' },
  },
] as const satisfies readonly MapLayerDef[]

export type LayerSlug = (typeof MAP_LAYERS)[number]['slug']

export interface LayerRegistry {
  layers: readonly MapLayerDef[]
  groups: readonly LayerGroup[]
  /** Tous les slugs, dans l'ordre CANONIQUE (celui du registre). */
  all: readonly string[]
  /** Les slugs affichés quand l'URL ne dit rien. */
  defaults: readonly string[]
  /** Lecture de `?layers=` — voir la table du contrat d'URL dans `layers.test.ts`. */
  parse(raw: string | null | undefined): string[]
  /**
   * Écriture de `?layers=`. `null` = paramètre OMIS (la sélection est le défaut) ; `''` =
   * paramètre PRÉSENT et vide (aucune couche). Ordre canonique : `tpi,paix` ≡ `paix,tpi`.
   */
  serialize(active: Iterable<string>): string | null
  /** Bascule une couche ; résultat en ordre canonique. */
  toggle(active: Iterable<string>, slug: string): string[]
  /** Visibilité de chaque couche MapLibre gouvernée. */
  visibility(active: Iterable<string>): Array<{ slug: string; mapLayerId: string; visible: boolean }>
  /** Couches dont il faut avoir chargé les points : celles du défaut, plus celles qu'on affiche. */
  toLoad(active: Iterable<string>): string[]
  /** Slugs du plus BAS au plus HAUT sur la carte (`drawOrder`, puis ordre du registre). */
  stackOrder: readonly string[]
  /** Couches MapLibre de POINTS (cliquables : sélectionnent la commune). */
  pointLayerIds: readonly string[]
  /** Couches MapLibre d'AGRÉGATS (dénombrés ; un clic zoome). */
  clusterLayerIds: readonly string[]
  /** Groupes qui ont au moins une couche, dans l'ordre de `groups`. */
  sections(): Array<{ group: LayerGroup; layers: MapLayerDef[] }>
  bySlug(slug: string): MapLayerDef | undefined
}

/**
 * Construit un registre et en VÉRIFIE la cohérence : un slug dupliqué ou mal formé, un
 * identifiant MapLibre partagé ou un groupe inconnu lèvent une erreur au chargement du
 * module — jamais une carte silencieusement fausse.
 */
export function createLayerRegistry(
  layers: readonly MapLayerDef[],
  groups: readonly LayerGroup[] = LAYER_GROUPS,
): LayerRegistry {
  const slugs = new Set<string>()
  const mapIds = new Set<string>()
  const groupIds = new Set(groups.map((g) => g.id))
  for (const l of layers) {
    if (!SLUG_RE.test(l.slug)) throw new Error(`couche « ${l.slug} » : slug invalide`)
    if (slugs.has(l.slug)) throw new Error(`couche « ${l.slug} » : slug dupliqué`)
    slugs.add(l.slug)
    if (!groupIds.has(l.group)) throw new Error(`couche « ${l.slug} » : groupe inconnu ${l.group}`)
    for (const id of [l.mapLayers.clusters, l.mapLayers.points]) {
      if (id === undefined) continue
      if (mapIds.has(id)) throw new Error(`couche « ${l.slug} » : identifiant MapLibre partagé ${id}`)
      mapIds.add(id)
    }
    if (l.mapLayers.clusters && !l.source.cluster) {
      throw new Error(`couche « ${l.slug} » : couche d'agrégats sans regroupement de source`)
    }
  }

  const all = layers.map((l) => l.slug)
  const defaults = layers.filter((l) => l.defaultOn).map((l) => l.slug)
  const canon = (active: Iterable<string>) => {
    const set = new Set(active)
    return all.filter((s) => set.has(s))
  }
  const isDefault = (c: readonly string[]) => c.length === defaults.length && c.every((s, i) => s === defaults[i])

  return {
    layers,
    groups,
    all,
    defaults,
    parse(raw) {
      if (raw == null || raw.length > MAX_LAYERS_PARAM) return [...defaults]
      if (raw.trim() === '') return []
      const asked = raw.split(',').map((s) => s.trim())
      const valid = canon(asked)
      // Rien de valide (slug inconnu, faute de frappe) ⇒ le défaut, comme avant le registre.
      return valid.length ? valid : [...defaults]
    },
    serialize(active) {
      const c = canon(active)
      return isDefault(c) ? null : c.join(',')
    },
    toggle(active, slug) {
      const set = new Set(canon(active))
      if (set.has(slug)) set.delete(slug)
      else if (slugs.has(slug)) set.add(slug)
      return canon(set)
    },
    visibility(active) {
      const on = new Set(canon(active))
      return layers.flatMap((l) =>
        [l.mapLayers.clusters, l.mapLayers.points]
          .filter((id): id is string => id !== undefined)
          .map((mapLayerId) => ({ slug: l.slug, mapLayerId, visible: on.has(l.slug) })),
      )
    },
    toLoad(active) {
      const on = new Set(canon(active))
      return layers.filter((l) => l.defaultOn || on.has(l.slug)).map((l) => l.slug)
    },
    stackOrder: layers
      .map((l, i) => ({ slug: l.slug, k: l.drawOrder ?? 0, i }))
      .sort((a, b) => a.k - b.k || a.i - b.i)
      .map((x) => x.slug),
    pointLayerIds: layers.map((l) => l.mapLayers.points),
    clusterLayerIds: layers.flatMap((l) => (l.mapLayers.clusters ? [l.mapLayers.clusters] : [])),
    sections() {
      return groups
        .map((group) => ({ group, layers: layers.filter((l) => l.group === group.id) }))
        .filter((s) => s.layers.length > 0)
    },
    bySlug(slug) {
      return layers.find((l) => l.slug === slug)
    },
  }
}

/** Le registre de la plateforme. */
export const LAYER_REGISTRY = createLayerRegistry(MAP_LAYERS)

export const ALL_LAYERS: readonly LayerSlug[] = LAYER_REGISTRY.all as LayerSlug[]
export const DEFAULT_LAYERS: readonly LayerSlug[] = LAYER_REGISTRY.defaults as LayerSlug[]

export function parseLayers(raw: string | null | undefined): LayerSlug[] {
  return LAYER_REGISTRY.parse(raw) as LayerSlug[]
}

export function serializeLayers(active: Iterable<string>): string | null {
  return LAYER_REGISTRY.serialize(active)
}

/**
 * Image MapLibre d'un marqueur `emoji` pour un point : expression `step` sur `sizeBy`, ou
 * l'image moyenne quand la couche n'a qu'une taille.
 */
export function emojiImageExpression(marker: Extract<LayerMarker, { kind: 'emoji' }>): unknown {
  const p = marker.imagePrefix
  if (!marker.sizeBy) return `${p}-m`
  const { property, medium, large } = marker.sizeBy
  return ['step', ['get', property], `${p}-s`, medium, `${p}-m`, large, `${p}-l`]
}
