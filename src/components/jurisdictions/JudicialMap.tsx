'use client'

/**
 * Carte interactive (MapLibre GL JS) — complément visuel de la liste, jamais le
 * seul accès à l'information.
 *
 * Auto-hébergée de bout en bout : style construit localement (fond uni), couches
 * GeoJSON servies par /maps/hti/*, points par l'API publique — AUCUNE origine
 * externe (CSP `connect-src 'self'` inchangée), aucun serveur de tuiles tiers.
 * NEXT_PUBLIC_MAP_STYLE_URL peut, si Lam approuve un fournisseur, remplacer le
 * style — les origines correspondantes devront alors être listées dans la CSP.
 *
 * Icônes : formes distinctes dessinées sur canvas (cercle/triangle/carré/losange),
 * différenciées par la FORME et la teinte (palette du 9 oct. 2026), via `COURT_STYLE` — une seule définition, partagée
 * avec la légende et les fiches. Des couches `symbol`/`circle`, avec regroupement
 * (cluster) des tribunaux de paix : pas 185 nœuds DOM.
 *
 * COUCHES : toutes viennent du REGISTRE (`src/lib/jurisdictions/layers.ts`) — visibilité,
 * couches cliquables, sources, agrégats et chargement paresseux en découlent. Rien n'est
 * câblé ici pour une couche particulière.
 *
 * SEULE EXCEPTION AU « ZÉRO DOM » : le nombre porté par chaque agrégat (quelques nœuds,
 * un par agrégat visible). Le style ne déclare aucune source de glyphes PBF, donc une
 * couche `text-field` ne rendrait rien — voir `syncClusterLabels`.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as maplibregl from 'maplibre-gl'
import type { Map as MlMap, MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Locale } from '@/lib/types'
import { BRAND_COLORS } from '@/lib/brand-colors'
import { LAYER_REGISTRY, emojiImageExpression, type MapLayerDef } from '@/lib/jurisdictions/layers'
import { EMOJI_SIZES, emojiPuckImage, type CanvasFactory } from '@/lib/jurisdictions/marker-canvas'
import { ROUTES_SOURCE_ID, glyphsTemplate, routesLayers, routesSource } from '@/lib/jurisdictions/fond-de-rues'
import { Protocol } from 'pmtiles'
import { COURT_STYLE, MARKER_STROKE } from './CourtCard'
import { compte } from '@/lib/jurisdictions/notaires-format'

const HAITI_BOUNDS: [[number, number], [number, number]] = [[-75.0, 17.9], [-71.5, 20.2]]

/**
 * Fond de carte seulement. Le codage des ORDRES DE JURIDICTION vient de `COURT_STYLE`
 * (avenant AV-02) : ces quatre teintes étaient recopiées ici, et la carte a divergé de
 * sa propre légende. Une seule définition, désormais.
 */
const COLORS = {
  /**
   * ⚠️ TERRE ET MER NE SE CONFONDENT PLUS (9 oct. 2026). Au passage à Agora, `koton` est devenu
   * l'ivoire de la page, et les DEUX étaient en `koton` : l'île n'existait que par ses filets.
   * Terre blanche sur mer ardoise diluée (`carteMer`), trait de côte et départements en encre
   * (14:1 sur la terre, 11:1 sur la mer). Sur la terre blanche, les marqueurs tiennent tous plus
   * de 6:1 (vert TPI 6,7, encre appel 14,2, bleu Cassation 12,3) ; les tribunaux de paix gardent
   * leur cerne d'encre.
   */
  bg: BRAND_COLORS.carteMer,
  land: BRAND_COLORS.blan,
  deptLine: BRAND_COLORS.chabon,
  arrLine: BRAND_COLORS.grafit,
  communeLine: BRAND_COLORS.grafit,
  /**
   * Fond de sélection (`woujPal`, terre cuite pâle sous Agora). La commune choisie doit se lire
   * comme une SURFACE teintée et non comme un simple liseré, sinon son contour se confond avec le
   * marqueur d'une juridiction posée à l'intérieur ; son contour d'encre (2,5 px) la cerne.
   */
  selected: BRAND_COLORS.woujPal,
} as const

/** Icône de forme (bordure navy) dessinée hors DOM — retourne l'ImageData. */
function shapeIcon(shape: 'circle' | 'triangle' | 'square' | 'diamond', color: string, size = 26): ImageData {
  // ⚠ Le canevas est en pixels d'APPAREIL : déclaré en pixelRatio 2, il est rendu à la
  // moitié de sa taille. Avec l'ancien icon-size 0,55 le tracé sortait à 5,5 px et le
  // cerne à 0,69 px — sous-pixellaire, donc absent. On dessine désormais à 2× la taille
  // CSS voulue et on rend à icon-size 1 : la forme et le contour sont réellement délivrés.
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  // Contour CONSTITUTIF : Sitwon est à 1,2:1 de Koton — sans lui, le triangle des TPI
  // s'évanouit dans le fond de carte (AV-02).
  ctx.strokeStyle = MARKER_STROKE
  ctx.lineWidth = 4  // 2 px CSS après le pixelRatio 2
  const m = 3
  ctx.beginPath()
  if (shape === 'circle') ctx.arc(size / 2, size / 2, size / 2 - m, 0, Math.PI * 2)
  else if (shape === 'square') ctx.rect(m, m, size - 2 * m, size - 2 * m)
  else if (shape === 'triangle') {
    ctx.moveTo(size / 2, m); ctx.lineTo(size - m, size - m); ctx.lineTo(m, size - m); ctx.closePath()
  } else {
    ctx.moveTo(size / 2, m); ctx.lineTo(size - m, size / 2); ctx.lineTo(size / 2, size - m); ctx.lineTo(m, size / 2); ctx.closePath()
  }
  ctx.fill()
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

interface PointFeature {
  type: 'Feature'
  properties: Record<string, unknown> & { communeId?: string | null }
  geometry: { type: 'Point'; coordinates: [number, number] }
}

const REGISTRY = LAYER_REGISTRY

/**
 * Protocole `pmtiles://` du fond de rues, enregistré UNE fois pour toute la page : un seul
 * fichier servi par agora.ht, lu par requêtes partielles (`Range`), sans serveur de tuiles.
 */
let protocolePmtiles = false
function enregistrerPmtiles() {
  if (protocolePmtiles) return
  maplibregl.addProtocol('pmtiles', new Protocol().tile)
  protocolePmtiles = true
}
const canvasFactory: CanvasFactory = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c as unknown as ReturnType<CanvasFactory>
}

export function JudicialMap({
  locale, selectedCommuneId, layers, attribution, loadingLabel, popupLabels = {},
}: {
  locale: Locale
  selectedCommuneId: string | null
  layers: readonly string[]
  attribution: string
  loadingLabel: string
  /** Libellés des bulles de couche (`MapLayerDef.popup`) et `seeList`. */
  popupLabels?: Record<string, string>
}) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const readyRef = useRef(false)
  const bboxRef = useRef<globalThis.Map<string, [[number, number], [number, number]]>>(new globalThis.Map())
  const selectedRef = useRef<string | null>(selectedCommuneId)
  selectedRef.current = selectedCommuneId
  const layersRef = useRef(layers)
  layersRef.current = layers
  /** Étiquettes de dénombrement des agrégats, indexées par `<couche>:<cluster_id>`. */
  const clusterLabelsRef = useRef<globalThis.Map<string, maplibregl.Marker>>(new globalThis.Map())
  /** Demande une resynchronisation des étiquettes depuis l'extérieur du gestionnaire `load`. */
  const resyncRef = useRef<(() => void) | null>(null)
  /**
   * Couches du registre dont les points sont chargés et les couches MapLibre posées, et
   * chargements en cours. Une couche masquée par défaut ne charge ses points qu'à sa
   * PREMIÈRE activation, puis les garde : la carte n'est pas démontée par la navigation.
   */
  const installedRef = useRef<Set<string>>(new Set())
  const pendingRef = useRef<globalThis.Map<string, Promise<void>>>(new globalThis.Map())
  /** Bulle ouverte au clic sur un point (une seule à la fois). */
  const popupRef = useRef<maplibregl.Popup | null>(null)
  /** Réponses GeoJSON par URL : les quatre couches de juridictions partagent la même. */
  const fetchedRef = useRef<globalThis.Map<string, Promise<PointFeature[]>>>(new globalThis.Map())
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  /**
   * DÉNOMBREMENT DES AGRÉGATS DE TRIBUNAUX DE PAIX.
   *
   * Un disque qui en cache quinze sans le dire n'informe pas : il trompe. Le disque est
   * désormais Chabon à chiffre Blan (10,31:1) — il était Sitwon à chiffre Chabon, où le
   * nombre ne rendait que 1,44:1 : il était là sans être lisible.
   *
   * ⚠️ POURQUOI DU DOM ET NON UNE COUCHE `text-field`. Le texte MapLibre exige une source
   * de glyphes PBF déclarée par le style ; ce style n'en a pas, et en héberger imposerait
   * de convertir les fontes et de servir ~1 Mo d'atlas. Une étiquette DOM coûte zéro octet
   * et rend la marque dans SA fonte (Plex Mono), ce qu'un atlas de glyphes ne ferait pas.
   *
   * `pointer-events: none` est INDISPENSABLE : sans lui l'étiquette intercepterait le clic
   * qui déplie l'agrégat, et le disque deviendrait inerte au centre — précisément là où
   * l'on clique.
   *
   * ⚠️ ON INTERROGE LES AGRÉGATS **RENDUS**, pas la source. `queryRenderedFeatures` ne
   * retourne que ce qui est réellement à l'écran et respecte la visibilité de la couche :
   * décocher « Tribunaux de paix » vide donc les étiquettes sans code supplémentaire.
   * `querySourceFeatures` retournait en plus des agrégats hors cadre (20 contre 15).
   *
   * Les couches d'agrégats sont celles que déclare le registre (`clusterLayerIds`).
   */
  const syncClusterLabels = (map: MlMap) => {
    const labels = clusterLabelsRef.current
    const drop = (id: string) => { labels.get(id)?.remove(); labels.delete(id) }
    const clusterLayers = REGISTRY.clusterLayerIds.filter((id) => map.getLayer(id))
    if (!clusterLayers.length) {
      for (const id of [...labels.keys()]) drop(id)
      return
    }
    let feats: ReturnType<MlMap['queryRenderedFeatures']> = []
    try { feats = map.queryRenderedFeatures({ layers: clusterLayers }) } catch { return }

    const vus = new Set<string>()
    for (const f of feats) {
      const n = f.properties?.point_count as number | undefined
      const cid = f.properties?.cluster_id as number | undefined
      const id = `${f.layer?.id}:${cid}`
      // Un agrégat chevauchant deux tuiles revient deux fois : une seule étiquette.
      if (!n || cid == null || vus.has(id) || f.geometry.type !== 'Point') continue
      vus.add(id)
      const at = f.geometry.coordinates as [number, number]
      const existant = labels.get(id)
      // Supercluster réattribue les identifiants par niveau de zoom, mais un même
      // identifiant peut réapparaître ailleurs : on repositionne plutôt que de faire
      // confiance à la seule présence en table.
      if (existant) { existant.setLngLat(at); continue }

      // Corps calés sur `circle-radius` de la couche : le nombre doit tenir DANS le
      // disque, pas déborder. Les deux expressions évoluent ENSEMBLE.
      const taille = n >= 15 ? 13 : n >= 5 ? 12 : 10
      const el = document.createElement('div')
      el.textContent = String(n)
      el.setAttribute('aria-hidden', 'true') // la donnée accessible est la liste des communes
      el.style.cssText =
        `pointer-events:none;font-family:var(--font-plex-mono),ui-monospace,monospace;`
        + `font-size:${taille}px;font-weight:600;line-height:1;color:${BRAND_COLORS.blan};`
        + `text-align:center;user-select:none;`
      labels.set(id, new maplibregl.Marker({ element: el }).setLngLat(at).addTo(map))
    }
    for (const id of [...labels.keys()]) if (!vus.has(id)) drop(id)
  }

  // Navigation déclenchée par la carte : l'URL reste la source de vérité. Le registre
  // sérialise (paramètre omis quand la sélection est le défaut).
  const selectCommune = (id: string | null) => {
    const params = new URLSearchParams()
    if (id) params.set('commune', id)
    const layersParam = REGISTRY.serialize(layersRef.current)
    if (layersParam !== null) params.set('layers', layersParam)
    const qs = params.toString()
    router.push(`/${locale}/juridictions${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  /**
   * Bulle d'un point de couche : nom de la commune et « N notaires → », lien vers
   * `/{locale}{listPath}#{communeId}` (section ancrée de la liste). DOM construit nœud par nœud
   * (`textContent`, jamais de HTML). ⚠️ Lien CLASSIQUE, pas `router.push` : la navigation interne
   * (pushState) ne met pas à jour `:target`, et la section visée ne serait pas mise en évidence.
   */
  const openPopup = (map: MlMap, layer: MapLayerDef, at: [number, number], communeId: string, props: Record<string, unknown>) => {
    const conf = layer.popup
    if (!conf) return
    const n = Number(props.count) || 0
    const nom = typeof props.communeName === 'string' ? props.communeName : ''
    const nombre = compte(n, locale, popupLabels[conf.countOneKey] ?? '{n}', popupLabels[conf.countManyKey] ?? '{n}')
    const href = `/${locale}${conf.listPath}#${encodeURIComponent(communeId)}`
    const box = document.createElement('div')
    box.className = 'pr-5 text-ank'
    if (nom) {
      const titre = document.createElement('p')
      titre.className = 'font-serif text-body-sm font-semibold text-ank'
      titre.textContent = nom
      box.append(titre)
    }
    const lien = document.createElement('a')
    lien.href = href
    lien.className = 'mt-1 inline-flex min-h-[32px] items-center text-body-sm font-semibold text-ank !underline underline-offset-2 hover:text-chabon'
    lien.textContent = `${nombre} →`
    if (popupLabels.seeList) lien.title = popupLabels.seeList
    lien.setAttribute('aria-label', [nombre, nom, popupLabels.seeList].filter(Boolean).join(' — '))
    box.append(lien)
    popupRef.current?.remove()
    popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '260px', offset: layer.iconOffset ? [layer.iconOffset[0], layer.iconOffset[1] - 12] : 14 })
      .setLngLat(at)
      .setDOMContent(box)
      .addTo(map)
  }

  // URL absolue : MapLibre parse le GeoJSON dans un worker `blob:` (voir plus bas).
  const asset = (path: string) => new URL(path, window.location.origin).toString()

  const fetchPoints = (url: string): Promise<PointFeature[]> => {
    let p = fetchedRef.current.get(url)
    if (!p) {
      p = fetch(asset(url))
        .then(async (res) => {
          if (!res.ok) throw new Error(`${url} : HTTP ${res.status}`)
          const collection = (await res.json()) as { features?: PointFeature[] }
          return Array.isArray(collection.features) ? collection.features : []
        })
      // Un échec n'est pas mémorisé : la prochaine activation retentera.
      p.catch(() => fetchedRef.current.delete(url))
      fetchedRef.current.set(url, p)
    }
    return p
  }

  /**
   * Pose une couche du registre : sa source (filtrée par `where`, regroupée si `cluster`),
   * ses couches MapLibre, ses clics. L'empilement suit TOUJOURS `stackOrder` (le `drawOrder`
   * du registre, puis son ordre), même quand une couche arrive tard (chargement paresseux) :
   * on l'insère sous la première couche déjà posée qui doit être au-dessus d'elle.
   */
  const installLayer = (map: MlMap, layer: MapLayerDef): Promise<void> => {
    if (installedRef.current.has(layer.slug)) return Promise.resolve()
    const pending = pendingRef.current.get(layer.slug)
    if (pending) return pending
    const run = (async () => {
      const all = await fetchPoints(layer.source.url)
      if (mapRef.current !== map) return // carte démontée entre-temps
      const where = Object.entries(layer.source.where ?? {})
      const features = where.length ? all.filter((f) => where.every(([k, v]) => f.properties?.[k] === v)) : all
      const sourceId = `pts-${layer.slug}`
      const cluster = layer.source.cluster
      map.addSource(sourceId, {
        type: 'geojson', data: { type: 'FeatureCollection', features },
        ...(cluster ? { cluster: true, clusterRadius: cluster.radius, clusterMaxZoom: cluster.maxZoom } : {}),
      })
      const pile = REGISTRY.stackOrder
      const audessus = pile.slice(pile.indexOf(layer.slug) + 1).find((s) => installedRef.current.has(s))
      const after = audessus ? REGISTRY.bySlug(audessus) : undefined
      const beforeId = after ? (after.mapLayers.clusters ?? after.mapLayers.points) : undefined

      const marker = layer.marker
      if (layer.mapLayers.clusters) {
        map.addLayer({
          id: layer.mapLayers.clusters, type: 'circle', source: sourceId, filter: ['has', 'point_count'],
          paint: {
            // Même teinte que le point isolé (terre cuite des paix) : l'agrégat se lit comme « des paix ».
            'circle-color': marker.kind === 'court' ? COURT_STYLE[marker.courtType].color : BRAND_COLORS.chabon,
            'circle-stroke-color': BRAND_COLORS.blan, 'circle-stroke-width': 2,
            'circle-radius': ['step', ['get', 'point_count'], 10, 5, 14, 15, 18],
            'circle-opacity': 0.9,
          },
        }, beforeId)
        map.on('click', layer.mapLayers.clusters, (e: MapLayerMouseEvent) => {
          const f = e.features?.[0]
          if (!f) return
          if (f.geometry.type !== 'Point') return
          map.easeTo({ center: f.geometry.coordinates as [number, number], zoom: map.getZoom() + 1.5, duration: reduceMotion ? 0 : 400 })
        })
      }
      map.addLayer({
        id: layer.mapLayers.points, type: 'symbol', source: sourceId,
        ...(cluster ? { filter: ['!', ['has', 'point_count']] as maplibregl.FilterSpecification } : {}),
        layout: marker.kind === 'court'
          ? {
              'icon-image': `court-${COURT_STYLE[marker.courtType].shape}`, 'icon-size': 1, 'icon-allow-overlap': true,
            }
          : {
              'icon-image': emojiImageExpression(marker) as maplibregl.ExpressionSpecification,
              'icon-allow-overlap': true,
              ...(layer.iconOffset ? { 'icon-offset': [...layer.iconOffset] as [number, number] } : {}),
            },
      }, beforeId)
      const layerId = layer.mapLayers.points
      map.on('click', layerId, (e: MapLayerMouseEvent) => {
        // Marqueurs superposés (tribunal et 👤 d'une commune voisine) : c'est celui que l'on
        // VOIT au-dessus qui l'emporte — les gestionnaires, eux, s'exécutent dans l'ordre où
        // les couches ont été chargées, pas dans l'ordre d'empilement.
        const points = REGISTRY.pointLayerIds.filter((pid) => map.getLayer(pid))
        const dessus = map.queryRenderedFeatures(e.point, { layers: points })[0]
        if (dessus && dessus.layer.id !== layerId) return
        const f = e.features?.[0]
        const communeId = f?.properties?.communeId as string | undefined
        if (!communeId) return
        e.preventDefault?.()
        // Couche à bulle (notaires) : le NOMBRE, en lien vers la section de la commune dans la
        // liste textuelle. La commune est sélectionnée comme avant (fiche à côté de la carte).
        if (layer.popup && f?.geometry.type === 'Point') openPopup(map, layer, f.geometry.coordinates as [number, number], communeId, f.properties ?? {})
        selectCommune(communeId)
      })
      map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })

      installedRef.current.add(layer.slug)
      const visible = new Set(layersRef.current)
      for (const v of REGISTRY.visibility(visible)) {
        if (v.slug === layer.slug && map.getLayer(v.mapLayerId)) {
          map.setLayoutProperty(v.mapLayerId, 'visibility', v.visible ? 'visible' : 'none')
        }
      }
      resyncRef.current?.()
    })()
      .catch((err) => {
        // Points indisponibles → la carte reste utilisable (limites + liste) ; retentable.
        console.error(`[carte judiciaire] couche « ${layer.slug} »`, err)
      })
      .finally(() => pendingRef.current.delete(layer.slug))
    pendingRef.current.set(layer.slug, run)
    return run
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL
    enregistrerPmtiles()
    const style: StyleSpecification | string = styleUrl || {
      version: 8,
      // Polices de la carte (noms de rues) : glyphes Inter servis par agora.ht. Gabarit en
      // URL absolue, `{fontstack}`/`{range}` littéraux — voir fond-de-rues.ts.
      glyphs: glyphsTemplate(window.location.origin),
      sources: {},
      layers: [{ id: 'bg', type: 'background', paint: { 'background-color': COLORS.bg } }],
    }
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      bounds: HAITI_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      minZoom: 5.5,
      maxZoom: 15,
      attributionControl: false,
      cooperativeGestures: false,
    })
    mapRef.current = map
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: attribution }))
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }))
    map.keyboard.enable()
    // Canal d'erreur MapLibre : une couche ou une source en échec ne doit pas rester
    // silencieuse (la carte afficherait un fond vide sans explication).
    map.on('error', (e: unknown) => {
      console.error('[carte judiciaire] MapLibre', (e as { error?: Error })?.error ?? e)
    })

    // ⚠ MapLibre parse le GeoJSON dans un Web Worker créé depuis une URL `blob:` :
    // la base du worker est donc `blob:…`, et une URL RELATIVE y est irrésolvable
    // (« Failed to parse URL from /maps/… »). La source reste alors éternellement non
    // chargée, SANS erreur — carte vide et silencieuse. Les URL doivent être absolues
    // (`asset`, ci-dessus).

    map.on('load', async () => {
      try {
      // Taille en pixels d'APPAREIL = 2 × la taille CSS voulue (pixelRatio 2).
      // Le degré le plus rare est le plus grand : la hiérarchie se lit à la taille.
      const TAILLE: Record<string, number> = { circle: 24, triangle: 32, square: 36, diamond: 44 }
      for (const { shape, color } of Object.values(COURT_STYLE)) {
        map.addImage(`court-${shape}`, shapeIcon(shape, color, TAILLE[shape]), { pixelRatio: 2 })
      }
      // Marqueurs `emoji` du registre : pastille blanche cernée d'encre, trois tailles nettes
      // (une image étirée par `icon-size` rendrait l'emoji flou). Repli silhouette si le
      // système n'a pas de police emoji — voir marker-canvas.ts.
      for (const l of REGISTRY.layers) {
        if (l.marker.kind !== 'emoji') continue
        try {
          for (const [k, css] of Object.entries(EMOJI_SIZES)) {
            const img = emojiPuckImage(canvasFactory, l.marker.glyph, css, { paper: BRAND_COLORS.blan, ink: MARKER_STROKE })
            map.addImage(`${l.marker.imagePrefix}-${k}`, { width: img.width, height: img.height, data: img.data }, { pixelRatio: 2 })
          }
        } catch (err) {
          // Une image manquante ne doit pas emporter la carte : la couche restera sans icône.
          console.error(`[carte judiciaire] marqueur « ${l.slug} »`, err)
        }
      }

      map.addSource('departments', { type: 'geojson', data: asset('/maps/hti/hti-adm1-departments.geojson') })
      map.addSource('arrondissements', { type: 'geojson', data: asset('/maps/hti/hti-arrondissements.geojson') })
      map.addSource('communes', { type: 'geojson', data: asset('/maps/hti/hti-adm2-communes.geojson') })

      map.addLayer({ id: 'dept-fill', type: 'fill', source: 'departments', paint: { 'fill-color': COLORS.land } })
      map.addLayer({
        id: 'commune-fill', type: 'fill', source: 'communes',
        paint: { 'fill-color': COLORS.land, 'fill-opacity': 0.01 }, // zone cliquable, visuellement neutre
      })
      map.addLayer({
        id: 'commune-line', type: 'line', source: 'communes',
        paint: { 'line-color': COLORS.communeLine, 'line-width': 0.5, 'line-opacity': 0.45 },
      })
      map.addLayer({
        id: 'arr-line', type: 'line', source: 'arrondissements',
        paint: { 'line-color': COLORS.arrLine, 'line-width': 0.8, 'line-opacity': 0.6, 'line-dasharray': [3, 2] },
      })
      map.addLayer({
        id: 'dept-line', type: 'line', source: 'departments',
        paint: { 'line-color': COLORS.deptLine, 'line-width': 1.5, 'line-opacity': 0.9 },
      })
      map.addLayer({
        id: 'commune-selected-fill', type: 'fill', source: 'communes',
        filter: ['==', ['get', 'lamId'], selectedRef.current ?? ''],
        paint: { 'fill-color': COLORS.selected, 'fill-opacity': 0.55 },
      })
      map.addLayer({
        id: 'commune-selected-line', type: 'line', source: 'communes',
        filter: ['==', ['get', 'lamId'], selectedRef.current ?? ''],
        // Sitwon — la sélection est un acte d'usage. Depuis AV-02 les TPI sont eux aussi
        // Sitwon : le trait passe à 3,2 px pour que la limite communale ne se confonde pas
        // avec un marqueur (une frontière épaisse ≠ un triangle cerné de 26 px).
        // AV-05 ch. 3 : Sitwon n'est jamais un trait (1,29:1). Le filet devient Chabon
        // (8,49:1) ; c'est l'AIRE en Wouj Pal qui signale la commune choisie.
        paint: { 'line-color': BRAND_COLORS.chabon, 'line-width': 2.5 },
      })

      // FOND DE RUES (OpenStreetMap, hébergé par Agora) — invisible sous le zoom 11 : la vue
      // d'ouverture ne charge aucune tuile de rues. Les lignes passent SOUS les limites et
      // l'aplat de sélection ; les noms au-dessus d'eux mais SOUS toute couche de points du
      // registre, posées ensuite. Un échec ici ne doit pas emporter la carte.
      if (!styleUrl) {
        try {
          map.addSource(ROUTES_SOURCE_ID, routesSource(window.location.origin))
          const [lignes, noms] = routesLayers({ line: BRAND_COLORS.grafit, text: BRAND_COLORS.ank, halo: BRAND_COLORS.blan })
          map.addLayer(lignes, 'commune-fill')
          map.addLayer(noms)
        } catch (err) {
          console.error('[carte judiciaire] fond de rues', err)
        }
      }

      // Emprises par commune (survol clavier/centrage) calculées UNE fois du GeoJSON servi.
      try {
        const res = await fetch(asset('/maps/hti/hti-adm2-communes.geojson'))
        const gj = (await res.json()) as { features: Array<{ properties: { lamId?: string }; geometry: { type: string; coordinates: unknown } }> }
        for (const f of gj.features) {
          const id = f.properties.lamId
          if (!id) continue
          let minX = 180, minY = 90, maxX = -180, maxY = -90
          const walk = (c: unknown): void => {
            if (Array.isArray(c) && typeof c[0] === 'number') {
              const [x, y] = c as [number, number]
              if (x < minX) minX = x; if (x > maxX) maxX = x
              if (y < minY) minY = y; if (y > maxY) maxY = y
            } else if (Array.isArray(c)) c.forEach(walk)
          }
          walk(f.geometry.coordinates)
          bboxRef.current.set(id, [[minX, minY], [maxX, maxY]])
        }
      } catch { /* emprise indisponible → pas de recentrage automatique */ }

      /*
       * QUAND RESYNCHRONISER LES ÉTIQUETTES D'AGRÉGATS — le point délicat.
       *
       * `idle` serait l'événement naturel : il NE SE DÉCLENCHE JAMAIS sur cette carte
       * (vérifié, 0 occurrence après déplacement). Et sur `sourcedata` la source est
       * chargée mais pas encore découpée en tuiles : la requête revient vide.
       *
       * D'où le substitut usuel : les événements qui, eux, arrivent, lèvent un drapeau ;
       * `render` le consomme à la première frame où les tuiles sont prêtes. Une requête
       * par stabilisation, jamais une par frame.
       */
      let aResynchroniser = true
      const marquer = () => { aResynchroniser = true }
      const sourcesAgregees = new Set(REGISTRY.layers.filter((l) => l.source.cluster).map((l) => `pts-${l.slug}`))
      map.on('moveend', marquer)
      map.on('zoomend', marquer)
      map.on('sourcedata', (e) => {
        if (sourcesAgregees.has(e.sourceId) && e.isSourceLoaded) marquer()
      })
      map.on('render', () => {
        // ⚠️ Le drapeau se RÉARME tant que les tuiles chargent. Sans cela il était
        // consommé à la première frame venue — avant que le moindre agrégat soit
        // dessiné — et plus rien ne le relevait : aucune étiquette n'apparaissait.
        if (!map.areTilesLoaded()) { aResynchroniser = true; return }
        if (!aResynchroniser) return
        aResynchroniser = false
        syncClusterLabels(map)
      })
      resyncRef.current = marquer

      // Points : les couches du défaut et celles que l'URL affiche ; les autres attendront
      // leur première activation (chargement paresseux). Échecs isolés par couche.
      await Promise.all(
        REGISTRY.toLoad(layersRef.current)
          .map((slug) => REGISTRY.bySlug(slug))
          .filter((l): l is MapLayerDef => Boolean(l))
          .map((l) => installLayer(map, l)),
      )

      map.on('click', 'commune-fill', (e: MapLayerMouseEvent) => {
        if (e.defaultPrevented) return
        // Un point (tribunal, notaire…) sous le curseur l'emporte sur l'aplat communal, quel
        // que soit l'ordre d'enregistrement des gestionnaires — une couche chargée tard
        // enregistre son clic APRÈS celui-ci.
        const points = REGISTRY.pointLayerIds.filter((pid) => map.getLayer(pid))
        if (points.length && map.queryRenderedFeatures(e.point, { layers: points }).length) return
        const id = e.features?.[0]?.properties?.lamId as string | undefined
        if (id) selectCommune(id)
      })
      map.on('mouseenter', 'commune-fill', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'commune-fill', () => { map.getCanvas().style.cursor = '' })

      readyRef.current = true
      applyState(map)
      } catch (err) {
        console.error('[carte judiciaire] initialisation des couches', err)
      }
    })

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') selectCommune(null) }
    containerRef.current.addEventListener('keydown', onKey)

    // La table est saisie ICI, pas dans le nettoyage : au démontage, `ref.current` peut
    // déjà désigner autre chose, et l'on retirerait alors les marqueurs d'une autre carte
    // en laissant fuir ceux-ci (react-hooks/exhaustive-deps).
    const etiquettes = clusterLabelsRef.current
    return () => {
      for (const m of etiquettes.values()) m.remove()
      etiquettes.clear()
      popupRef.current?.remove()
      popupRef.current = null
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyState = (map: MlMap) => {
    const selected = selectedRef.current
    if (map.getLayer('commune-selected-fill')) {
      map.setFilter('commune-selected-fill', ['==', ['get', 'lamId'], selected ?? ''])
      map.setFilter('commune-selected-line', ['==', ['get', 'lamId'], selected ?? ''])
    }
    // Une boucle sur le registre : chaque couche bascule ses propres identifiants MapLibre.
    for (const v of REGISTRY.visibility(layersRef.current)) {
      if (map.getLayer(v.mapLayerId)) map.setLayoutProperty(v.mapLayerId, 'visibility', v.visible ? 'visible' : 'none')
    }
    // Les étiquettes de dénombrement sont du DOM : `visibility` ne les atteint pas.
    // On lève le drapeau — `queryRenderedFeatures` ne verra la couche masquée qu'APRÈS
    // le prochain rendu, un appel immédiat lirait l'état d'avant.
    resyncRef.current?.()
    // Première activation d'une couche masquée par défaut : on charge ses points maintenant.
    for (const slug of REGISTRY.toLoad(layersRef.current)) {
      const l = REGISTRY.bySlug(slug)
      if (l && !installedRef.current.has(slug)) void installLayer(map, l)
    }
    if (selected) {
      const bbox = bboxRef.current.get(selected)
      if (bbox) map.fitBounds(bbox, { padding: 60, maxZoom: 11.5, duration: reduceMotion ? 0 : 600 })
    } else {
      map.fitBounds(HAITI_BOUNDS, { padding: 24, duration: reduceMotion ? 0 : 600 })
    }
  }

  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) applyState(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCommuneId, layers.join(',')])

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={loadingLabel}
      tabIndex={0}
 className="h-[46vh] w-full lg:h-[560px]"
    />
  )
}
