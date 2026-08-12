/**
 * Lectures de la carte judiciaire — partagées par la page publique et les API.
 *
 * Règles de PUBLICATION (§3 et §8 du cahier des charges) :
 *  - les sièges UNMAPPED sont exclus des résultats communaux et de la carte
 *    tant qu'ils ne sont pas rattachés ;
 *  - une juridiction inactive n'est jamais publiée ;
 *  - un tribunal sans coordonnée exacte est positionné au CENTROÏDE de sa
 *    commune-siège, marqué `indicative: true` — jamais présenté comme adresse ;
 *  - les tribunaux multiples d'une même commune restent des entrées distinctes ;
 *  - la Cour de cassation vit dans un bloc « Recours national » séparé.
 */
import { prisma } from '../db'
import { buildPlaceIndex, type PlaceIndex } from './search-places'
import type { CourtType } from './constants'

export interface SourceRef { type: 'url' | 'file'; value: string }

const parseSources = (json: string | null): SourceRef[] => {
  try {
    const v = JSON.parse(json ?? '[]')
    if (Array.isArray(v)) return v.filter((s) => s && typeof s.value === 'string' && (s.type === 'url' || s.type === 'file'))
    // communes : { administrative, judicial, postal }
    if (v && typeof v === 'object') return Object.values(v).flat().filter((s: unknown): s is SourceRef => Boolean(s && typeof (s as SourceRef).value === 'string')) as SourceRef[]
  } catch { /* sourceJson invalide → aucune source plutôt qu'un plantage */ }
  return []
}

export interface CourtView {
  id: string
  type: string
  name: string
  seatCity: string | null
  address: string | null
  postalCode: string | null
  plusCode: string | null
  latitude: number | null
  longitude: number | null
  locationPrecision: string
  /** true = position au centroïde communal (« position indicative ») */
  indicative: boolean
  operationalStatus: string | null
  verificationStatus: string
  observation: string | null
  sources: SourceRef[]
  verifiedAt: string | null
}

export interface CommuneRecord {
  commune: {
    id: string
    name: string
    city: string
    department: string
    arrondissement: string
    observation: string | null
    boundaryConfirmed: boolean
    centroid: { lat: number; lng: number } | null
    sources: SourceRef[]
  }
  postal: {
    primaryCode: string | null
    additionalCodes: string[]
    verificationStatus: string | null
    scopeNote: string | null
    sources: SourceRef[]
  }
  courts: {
    peace: CourtView[]
    firstInstance: CourtView | null
    appeal: CourtView | null
    cassation: (CourtView & { scope: string }) | null
  }
  lastVerified: string | null
}

const COMMUNE_ID_RE = /^[a-z0-9][a-z0-9-]{2,119}$/

function toView(c: {
  id: string; type: string; name: string; city: string | null; address: string | null
  postalCode: string | null; plusCode: string | null; latitude: number | null; longitude: number | null
  locationPrecision: string; operationalStatus: string | null; verificationStatus: string
  observation: string | null; sourceJson: string; verifiedAt: Date | null
}, centroid: { lat: number; lng: number } | null): CourtView {
  const exact = c.latitude != null && c.longitude != null
  return {
    id: c.id,
    type: c.type,
    name: c.name,
    seatCity: c.city,
    address: c.address,
    postalCode: c.postalCode,
    plusCode: c.plusCode,
    latitude: exact ? c.latitude : centroid?.lat ?? null,
    longitude: exact ? c.longitude : centroid?.lng ?? null,
    locationPrecision: exact ? c.locationPrecision : centroid ? 'COMMUNE_CENTROID' : 'UNKNOWN',
    indicative: !exact,
    operationalStatus: c.operationalStatus,
    verificationStatus: c.verificationStatus,
    observation: c.observation,
    sources: parseSources(c.sourceJson),
    verifiedAt: c.verifiedAt ? c.verifiedAt.toISOString().slice(0, 10) : null,
  }
}

/** Fiche complète d'une commune — null si l'identifiant est inconnu ou invalide. */
export async function getCommuneRecord(communeId: string): Promise<CommuneRecord | null> {
  if (!COMMUNE_ID_RE.test(communeId)) return null
  const commune = await prisma.judicialCommune.findUnique({
    where: { id: communeId },
    include: {
      department: true,
      arrondissement: true,
      postalCodes: { orderBy: [{ isPrimary: 'desc' }, { code: 'asc' }] },
      jurisdictions: { include: { court: true } },
    },
  })
  if (!commune) return null

  const centroid = commune.centroidLat != null && commune.centroidLng != null
    ? { lat: commune.centroidLat, lng: commune.centroidLng }
    : null
  // Publication : jamais d'UNMAPPED ni d'inactif dans une fiche communale.
  const linked = commune.jurisdictions.filter((j) => j.court.active && j.court.verificationStatus !== 'UNMAPPED')
  const peace = linked
    .filter((j) => j.relationship === 'PAIX_LOCAL')
    .map((j) => toView(j.court, centroid))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  const tpiJ = linked.find((j) => j.relationship === 'TPI_COMPETENT')
  const appealJ = linked.find((j) => j.relationship === 'APPEL_COMPETENT')
  const cassJ = linked.find((j) => j.relationship === 'CASSATION_NATIONALE')

  // TPI / cour d'appel : positionnés sur le centroïde de leur commune-SIÈGE (pas celui
  // de la commune consultée).
  //
  // ⚠️ UNE SEULE REQUÊTE POUR LES DEUX SIÈGES. Deux `findFirst` successifs — l'un pour le
  // TPI, l'autre pour la cour d'appel — coûtaient DEUX transactions complètes
  // (BEGIN/DEALLOCATE/SELECT/COMMIT chacune), soit 8 des 17 énoncés SQL de la fiche et,
  // surtout, deux allers-retours enchaînés puisque le second attendait le premier.
  //
  // On interroge par la CLÉ `département|nom`, qui est unique et indexée : elle évite la
  // jointure sur `department` qu'imposait la recherche par nom, laquelle aurait ajouté
  // un SELECT de plus. Vérifié : les 149 communes ont `key === department.name|name`.
  const clesSieges = [
    tpiJ && tpiJ.court.department && tpiJ.court.commune ? `${tpiJ.court.department}|${tpiJ.court.commune}` : null,
    appealJ && appealJ.court.department && appealJ.court.city ? `${appealJ.court.department}|${appealJ.court.city}` : null,
  ].filter((k): k is string => k !== null)

  const sieges = clesSieges.length
    ? await prisma.judicialCommune.findMany({
        where: { key: { in: [...new Set(clesSieges)] } },
        select: { key: true, centroidLat: true, centroidLng: true },
      })
    : []

  const centroidSiege = (dept: string | null, name: string | null) => {
    if (!dept || !name) return null
    const s = sieges.find((x) => x.key === `${dept}|${name}`)
    return s?.centroidLat != null && s.centroidLng != null ? { lat: s.centroidLat, lng: s.centroidLng } : null
  }
  const tpi = tpiJ ? toView(tpiJ.court, centroidSiege(tpiJ.court.department, tpiJ.court.commune)) : null
  const appeal = appealJ ? toView(appealJ.court, centroidSiege(appealJ.court.department, appealJ.court.city)) : null
  const cassation = cassJ ? { ...toView(cassJ.court, null), scope: cassJ.court.scope } : null

  const primary = commune.postalCodes.find((p) => p.isPrimary) ?? null
  const verifiedDates = [tpi, appeal, cassation, ...peace].filter(Boolean).map((c) => c!.verifiedAt).filter(Boolean) as string[]

  return {
    commune: {
      id: commune.id,
      name: commune.name,
      city: commune.city,
      department: commune.department.name,
      arrondissement: commune.arrondissement.name,
      observation: commune.observation,
      boundaryConfirmed: commune.geometryKey != null,
      centroid,
      sources: parseSources(commune.sourceJson),
    },
    postal: {
      primaryCode: primary?.code ?? null,
      additionalCodes: commune.postalCodes.filter((p) => !p.isPrimary).map((p) => p.code),
      verificationStatus: primary?.verificationStatus ?? null,
      scopeNote: primary?.scopeNote ?? null,
      sources: parseSources(primary?.sourceJson ?? null),
    },
    courts: { peace, firstInstance: tpi, appeal, cassation },
    lastVerified: verifiedDates.sort().at(-1) ?? null,
  }
}

// ── Index de recherche (149 communes) — reconstruit quand la table change ────
let indexCache: { key: string; index: PlaceIndex } | null = null

export async function getPlaceIndex(): Promise<PlaceIndex> {
  const agg = await prisma.judicialCommune.aggregate({ _max: { updatedAt: true }, _count: true })
  const key = `${agg._count}:${agg._max.updatedAt?.getTime() ?? 0}`
  if (indexCache?.key === key) return indexCache.index
  const communes = await prisma.judicialCommune.findMany({
    include: { department: true, arrondissement: true, postalCodes: true },
  })
  const index = buildPlaceIndex(
    communes.map((c) => ({
      id: c.id,
      name: c.name,
      department: c.department.name,
      arrondissement: c.arrondissement.name,
      postalCode: c.postalCodes.find((p) => p.isPrimary)?.code ?? null,
      postalCodes: c.postalCodes.map((p) => p.code),
      aliases: ((): string[] => {
        try { const a = JSON.parse(c.aliasesJson); return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : [] } catch { return [] }
      })(),
    })),
  )
  indexCache = { key, index }
  return index
}

// ── Points cartographiques (GeoJSON) ─────────────────────────────────────────
export interface MapPointsResult {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    properties: {
      id: string; courtType: CourtType; name: string; communeId: string | null
      indicative: boolean; precision: string
    }
    geometry: { type: 'Point'; coordinates: [number, number] }
  }>
}

/**
 * Ne publie que les juridictions actives, reliées sans ambiguïté, et positionnées
 * (coordonnée exacte OU centroïde communal identifié) — avec leur niveau de précision.
 */
export async function getMapPoints(types: CourtType[]): Promise<MapPointsResult> {
  const courts = await prisma.court.findMany({
    where: { type: { in: types }, active: true, verificationStatus: { not: 'UNMAPPED' } },
    include: { jurisdictions: { select: { communeId: true, relationship: true } } },
  })
  const communes = await prisma.judicialCommune.findMany({
    select: { id: true, name: true, centroidLat: true, centroidLng: true, department: { select: { name: true } } },
  })
  const byId = new Map(communes.map((c) => [c.id, c]))
  const byDeptName = new Map(communes.map((c) => [`${c.department.name}|${c.name}`, c]))

  const features: MapPointsResult['features'] = []
  for (const c of courts) {
    // commune de référence : rattachement local (paix) sinon commune-siège (TPI/appel/cassation)
    const local = c.jurisdictions.find((j) => j.relationship === 'PAIX_LOCAL')
    const seat = local ? byId.get(local.communeId) : byDeptName.get(`${c.department}|${c.commune ?? c.city}`)
    let lat = c.latitude
    let lng = c.longitude
    let indicative = false
    if (lat == null || lng == null) {
      if (seat?.centroidLat == null || seat?.centroidLng == null) continue // non positionnable — non publié
      lat = seat.centroidLat
      lng = seat.centroidLng
      indicative = true
    }
    features.push({
      type: 'Feature',
      properties: {
        id: c.id,
        courtType: c.type as CourtType,
        name: c.name,
        communeId: seat?.id ?? null,
        indicative,
        precision: indicative ? 'COMMUNE_CENTROID' : c.locationPrecision,
      },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    })
  }
  return { type: 'FeatureCollection', features }
}

/** Liste légère pour la liste textuelle accessible (obligatoire, §3.9). */
export async function getCommuneDirectory() {
  const communes = await prisma.judicialCommune.findMany({
    select: {
      id: true, name: true, geometryKey: true,
      department: { select: { name: true } },
      arrondissement: { select: { name: true } },
      postalCodes: { where: { isPrimary: true }, select: { code: true } },
    },
    orderBy: [{ name: 'asc' }],
  })
  return communes.map((c) => ({
    id: c.id,
    name: c.name,
    department: c.department.name,
    arrondissement: c.arrondissement.name,
    postalCode: c.postalCodes[0]?.code ?? null,
    boundaryConfirmed: c.geometryKey != null,
  }))
}
