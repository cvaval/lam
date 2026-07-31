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
 * Icônes : formes distinctes dessinées sur canvas (cercle/triangle/carré/losange)
 * — pas de texte sur la carte (aucun serveur de glyphes), pas de 185 nœuds DOM :
 * des couches `symbol`/`circle`, avec regroupement (cluster) des tribunaux de paix.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as maplibregl from 'maplibre-gl'
import type { Map as MlMap, MapLayerMouseEvent, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { LayerSlug } from '@/lib/jurisdictions/constants'
import { LAYER_SLUGS } from '@/lib/jurisdictions/constants'
import type { Locale } from '@/lib/types'

const HAITI_BOUNDS: [[number, number], [number, number]] = [[-75.0, 17.9], [-71.5, 20.2]]
const COLORS = {
  bg: '#e8ecf2',
  land: '#F6F4EE',
  deptLine: '#1C1B3A',
  arrLine: '#1C1B3A',
  communeLine: '#1C1B3A',
  selected: '#BEF264',
  PAIX: '#BEF264',
  PREMIERE_INSTANCE: '#F4A823',
  APPEL: '#4F8EF7',
  CASSATION: '#7C6F9B',
} as const

/** Icône de forme (bordure navy) dessinée hors DOM — retourne l'ImageData. */
function shapeIcon(shape: 'circle' | 'triangle' | 'square' | 'diamond', color: string, size = 26): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.strokeStyle = '#1C1B3A'
  ctx.lineWidth = 2.5
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
  properties: { id: string; courtType: keyof typeof LAYER_ICON; name: string; communeId: string | null; indicative: boolean }
  geometry: { type: 'Point'; coordinates: [number, number] }
}
const LAYER_ICON = { PAIX: 'circle', PREMIERE_INSTANCE: 'triangle', APPEL: 'square', CASSATION: 'diamond' } as const

export function JudicialMap({
  locale, selectedCommuneId, layers, attribution, loadingLabel,
}: {
  locale: Locale
  selectedCommuneId: string | null
  layers: LayerSlug[]
  attribution: string
  loadingLabel: string
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
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  // Navigation déclenchée par la carte : l'URL reste la source de vérité.
  const selectCommune = (id: string | null) => {
    const params = new URLSearchParams()
    if (id) params.set('commune', id)
    const l = layersRef.current
    if (l.length && l.length < 4) params.set('layers', l.join(','))
    const qs = params.toString()
    router.push(`/${locale}/juridictions${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL
    const style: StyleSpecification | string = styleUrl || {
      version: 8,
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
    // chargée, SANS erreur — carte vide et silencieuse. Les URL doivent être absolues.
    const asset = (path: string) => new URL(path, window.location.origin).toString()

    map.on('load', async () => {
      try {
      for (const [shape, color] of [
        ['circle', COLORS.PAIX], ['triangle', COLORS.PREMIERE_INSTANCE],
        ['square', COLORS.APPEL], ['diamond', COLORS.CASSATION],
      ] as const) {
        map.addImage(`court-${shape}`, shapeIcon(shape, color), { pixelRatio: 2 })
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
        paint: { 'line-color': COLORS.communeLine, 'line-width': 0.4, 'line-opacity': 0.35 },
      })
      map.addLayer({
        id: 'arr-line', type: 'line', source: 'arrondissements',
        paint: { 'line-color': COLORS.arrLine, 'line-width': 0.7, 'line-opacity': 0.4, 'line-dasharray': [3, 2] },
      })
      map.addLayer({
        id: 'dept-line', type: 'line', source: 'departments',
        paint: { 'line-color': COLORS.deptLine, 'line-width': 1.4, 'line-opacity': 0.75 },
      })
      map.addLayer({
        id: 'commune-selected-fill', type: 'fill', source: 'communes',
        filter: ['==', ['get', 'lamId'], selectedRef.current ?? ''],
        paint: { 'fill-color': COLORS.selected, 'fill-opacity': 0.28 },
      })
      map.addLayer({
        id: 'commune-selected-line', type: 'line', source: 'communes',
        filter: ['==', ['get', 'lamId'], selectedRef.current ?? ''],
        paint: { 'line-color': '#5e8a2a', 'line-width': 2.2 },
      })

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

      // Points : une source clusterisée pour les 175 tribunaux de paix, une source
      // simple pour TPI / appel / cassation (29 points).
      try {
        const res = await fetch(asset('/api/public/jurisdictions/map-points'))
        const collection = (await res.json()) as { features?: PointFeature[] }
        const feats = Array.isArray(collection.features) ? collection.features : []
        const paix = feats.filter((f) => f.properties.courtType === 'PAIX')
        const others = feats.filter((f) => f.properties.courtType !== 'PAIX')
        map.addSource('courts-paix', {
          type: 'geojson', data: { type: 'FeatureCollection', features: paix },
          cluster: true, clusterRadius: 34, clusterMaxZoom: 11,
        })
        map.addSource('courts-others', { type: 'geojson', data: { type: 'FeatureCollection', features: others } })
        map.addLayer({
          id: 'paix-clusters', type: 'circle', source: 'courts-paix', filter: ['has', 'point_count'],
          paint: {
            'circle-color': COLORS.PAIX, 'circle-stroke-color': '#1C1B3A', 'circle-stroke-width': 2,
            'circle-radius': ['step', ['get', 'point_count'], 10, 5, 14, 15, 18],
            'circle-opacity': 0.9,
          },
        })
        map.addLayer({
          id: 'paix-points', type: 'symbol', source: 'courts-paix', filter: ['!', ['has', 'point_count']],
          layout: { 'icon-image': 'court-circle', 'icon-size': 0.55, 'icon-allow-overlap': true },
        })
        for (const [type, icon] of Object.entries(LAYER_ICON)) {
          if (type === 'PAIX') continue
          map.addLayer({
            id: `courts-${type}`, type: 'symbol', source: 'courts-others',
            filter: ['==', ['get', 'courtType'], type],
            layout: {
              'icon-image': `court-${icon}`, 'icon-allow-overlap': true,
              'icon-size': type === 'CASSATION' ? 0.85 : 0.65,
            },
          })
        }

        map.on('click', 'paix-clusters', (e: MapLayerMouseEvent) => {
          const f = e.features?.[0]
          if (!f) return
          if (f.geometry.type !== 'Point') return
          map.easeTo({ center: f.geometry.coordinates as [number, number], zoom: map.getZoom() + 1.5, duration: reduceMotion ? 0 : 400 })
        })
        const pointLayers = ['paix-points', 'courts-PREMIERE_INSTANCE', 'courts-APPEL', 'courts-CASSATION']
        for (const layerId of pointLayers) {
          map.on('click', layerId, (e: MapLayerMouseEvent) => {
            const f = e.features?.[0]
            const communeId = f?.properties?.communeId as string | undefined
            if (communeId) { e.preventDefault?.(); selectCommune(communeId) }
          })
          map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
          map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
        }
      } catch { /* points indisponibles → la carte reste utilisable (limites + liste) */ }

      map.on('click', 'commune-fill', (e: MapLayerMouseEvent) => {
        if (e.defaultPrevented) return
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

    return () => {
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
    const visible = new Set(layersRef.current.map((s) => LAYER_SLUGS[s]))
    const setVis = (layerId: string, on: boolean) => {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', on ? 'visible' : 'none')
    }
    setVis('paix-clusters', visible.has('PAIX'))
    setVis('paix-points', visible.has('PAIX'))
    setVis('courts-PREMIERE_INSTANCE', visible.has('PREMIERE_INSTANCE'))
    setVis('courts-APPEL', visible.has('APPEL'))
    setVis('courts-CASSATION', visible.has('CASSATION'))
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
      className="h-[46vh] w-full outline-none ring-sitwon focus-visible:ring-2 lg:h-[560px]"
    />
  )
}
