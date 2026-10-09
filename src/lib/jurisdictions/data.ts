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
import { estSchemaAbsent } from '../delais/service-base'
import { buildPlaceIndex, type PlaceIndex } from './search-places'
import { normalizePlaceName } from './normalize-place'
import { nomJuridiction } from './notaires-format'
import { readPhones } from './coordonnees'
import { buildNotaryIndex, type NotaryIndex } from './search-notaries'
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

/** Un notaire tel que la fiche le publie : ni commune imprimée, ni observation interne. */
export interface NotaryView {
  /** Identifiant de l'entrée — la page du notaire est `/{locale}/juridictions/notaires/{id}`. */
  id: string
  ordinal: number
  /** Nom AFFICHÉ : la décision de la cliente le cas échéant (n° 9 « Gemma »), sinon l'imprimé. */
  fullName: string
  /** « PDD », « PD/CMM » ou null — affiché tel qu'imprimé, jamais interprété. */
  mention: string | null
  /** Une fiche de coordonnées active existe (elles ne s'affichent que sur la page du notaire). */
  hasContact: boolean
}

/**
 * Lecture des notaires impossible pour une raison de SCHÉMA, et non de programme : table pas
 * encore créée (P2021, 42P01), client Prisma antérieur au modèle, ou colonne pas encore migrée
 * (P2022 — le code déployé avant `prisma db push`). La page se sert alors sans les notaires.
 */
const lectureNotairesImpossible = (e: unknown) =>
  estSchemaAbsent(e) || (typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2022')

const NOTAIRE_VUE = {
  id: true, ordinal: true, fullName: true, displayName: true, mention: true,
  contact: { select: { active: true } },
} as const

const versVue = (n: {
  id: string; ordinal: number; fullName: string; displayName: string | null; mention: string | null
  contact: { active: boolean } | null
}): NotaryView => ({
  id: n.id, ordinal: n.ordinal, fullName: n.displayName ?? n.fullName, mention: n.mention, hasContact: Boolean(n.contact?.active),
})

/** Communes du ressort d'un TPI et nombre de notaires actifs de chacune. */
export interface RessortCount { communeId: string; communeName: string; count: number }

/**
 * Provenance de la liste, en langage clair : l'éditeur et les dates de consultation. Les URL,
 * noms de fichier et empreintes restent en base (`sourceJson`) — jamais sur une page publique
 * (demande de la cliente du 9 oct. 2026).
 */
export interface NotaryProvenance { consultations: string[] }

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
    /** `notairesDuRessort` : null tant que la liste des notaires n'est pas en base. */
    firstInstance: (CourtView & { notairesDuRessort: RessortCount[] | null }) | null
    appeal: CourtView | null
    cassation: (CourtView & { scope: string }) | null
  }
  /**
   * Notaires commissionnés pour la commune (actifs, par numéro de liste). La fiche n'est PAS
   * filtrée par les couches de la carte. null = liste indisponible (table pas encore migrée).
   */
  notaires: NotaryView[] | null
  notairesSource: NotaryProvenance | null
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

  // Notaires : en PARALLÈLE des sièges — un aller-retour de plus en latence, pas quatre.
  const [sieges, notaires] = await Promise.all([
    clesSieges.length
      ? prisma.judicialCommune.findMany({
          where: { key: { in: [...new Set(clesSieges)] } },
          select: { key: true, centroidLat: true, centroidLng: true },
        })
      : Promise.resolve([]),
    chargerNotairesCommune(commune.id, tpiJ?.court.id ?? null),
  ])

  const centroidSiege = (dept: string | null, name: string | null) => {
    if (!dept || !name) return null
    const s = sieges.find((x) => x.key === `${dept}|${name}`)
    return s?.centroidLat != null && s.centroidLng != null ? { lat: s.centroidLat, lng: s.centroidLng } : null
  }
  const tpi = tpiJ
    ? { ...toView(tpiJ.court, centroidSiege(tpiJ.court.department, tpiJ.court.commune)), notairesDuRessort: notaires?.ressort ?? null }
    : null
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
    notaires: notaires?.liste ?? null,
    notairesSource: notaires?.provenance ?? null,
    lastVerified: verifiedDates.sort().at(-1) ?? null,
  }
}

// ── Notaires (liste du MJSP) ─────────────────────────────────────────────────
// Le notaire est rattaché à une COMMUNE ; son TPI se DÉDUIT du rattachement
// `TPI_COMPETENT` de cette commune — jamais stocké sur le notaire.

const lireProvenance = (json: string | null | undefined): NotaryProvenance | null => {
  try {
    const v = JSON.parse(json ?? 'null') as { consultations?: Array<{ date?: unknown }> } | null
    const dates = (v?.consultations ?? []).map((c) => c.date).filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
    return dates.length ? { consultations: [...new Set(dates)].sort() } : null
  } catch { return null }
}

/**
 * Notaires d'une commune + comptes du ressort de son TPI + provenance. `null` si la table
 * n'existe pas encore (code déployé avant la migration) : la fiche reste servie, sans section.
 */
async function chargerNotairesCommune(communeId: string, tpiId: string | null) {
  try {
    const [liste, ressortCommunes, comptes, source] = await Promise.all([
      prisma.notary.findMany({
        where: { communeId, active: true },
        orderBy: { ordinal: 'asc' },
        select: NOTAIRE_VUE,
      }),
      tpiId
        ? prisma.courtCommuneJurisdiction.findMany({
            where: { courtId: tpiId, relationship: 'TPI_COMPETENT' },
            select: { commune: { select: { id: true, name: true } } },
          })
        : Promise.resolve([]),
      tpiId
        ? prisma.notary.groupBy({
            by: ['communeId'],
            where: { active: true, commune: { jurisdictions: { some: { courtId: tpiId, relationship: 'TPI_COMPETENT' } } } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      prisma.notary.findFirst({ select: { sourceJson: true }, orderBy: { updatedAt: 'desc' } }),
    ])
    const n = new Map(comptes.map((c) => [c.communeId, c._count._all]))
    const ressort: RessortCount[] | null = tpiId
      ? ressortCommunes
          .map((j) => ({ communeId: j.commune.id, communeName: j.commune.name, count: n.get(j.commune.id) ?? 0 }))
          .sort((a, b) => a.communeName.localeCompare(b.communeName, 'fr'))
      : null
    return { liste: liste.map(versVue), ressort, provenance: lireProvenance(source?.sourceJson) }
  } catch (e) {
    if (lectureNotairesImpossible(e)) return null
    throw e
  }
}

export interface NotaryPointsResult {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    properties: { communeId: string; communeName: string; count: number }
    geometry: { type: 'Point'; coordinates: [number, number] }
  }>
}

/**
 * UN point par commune pourvue, au centroïde, avec le NOMBRE de notaires actifs — jamais de
 * nom (la liste nominative passe par la fiche, comme les adresses des tribunaux). Une commune
 * sans centroïde documenté n'est pas publiée (aucune n'est dans ce cas : l'import le refuse).
 * Lève l'erreur Prisma si la table n'existe pas : la route la traduit en 503.
 */
export async function getNotaryPoints(): Promise<NotaryPointsResult> {
  const [groupes, communes] = await Promise.all([
    prisma.notary.groupBy({ by: ['communeId'], where: { active: true, communeId: { not: null } }, _count: { _all: true } }),
    prisma.judicialCommune.findMany({ select: { id: true, name: true, centroidLat: true, centroidLng: true } }),
  ])
  const byId = new Map(communes.map((c) => [c.id, c]))
  const features: NotaryPointsResult['features'] = []
  for (const g of groupes) {
    const c = g.communeId ? byId.get(g.communeId) : undefined
    if (!c || c.centroidLat == null || c.centroidLng == null) continue
    // Liste BLANCHE des propriétés : identifiant, nom de la commune, nombre. Rien d'autre.
    features.push({
      type: 'Feature',
      properties: { communeId: c.id, communeName: c.name, count: g._count._all },
      geometry: { type: 'Point', coordinates: [c.centroidLng, c.centroidLat] },
    })
  }
  features.sort((a, b) => a.properties.communeId.localeCompare(b.properties.communeId))
  return { type: 'FeatureCollection', features }
}

export interface NotaryDirectory {
  /** Entrées de la liste (actives ou retirées). */
  totalEntries: number
  /** Entrées affichées (actives), commune reconnue ou non. */
  activeEntries: number
  provenance: NotaryProvenance | null
  tpis: Array<{
    id: string
    /** Nom du tribunal en base (« TPI de Port-au-Prince ») — jamais affiché dans cette liste. */
    name: string
    /** Nom de la juridiction affiché, sans « TPI » (« Port-au-Prince », « Les Cayes »). */
    label: string
    total: number
    communes: Array<{
      id: string
      name: string
      department: string
      notaires: Array<NotaryView & { printedDepartment: string | null }>
    }>
  }>
  /** Entrées dont la commune imprimée n'est pas une commune du référentiel. */
  unmatched: Array<NotaryView & { sourceCommune: string; sourceDepartment: string }>
}

/**
 * La liste textuelle par juridiction : par ressort, puis par commune, puis par numéro. Le
 * ressort est celui du rattachement TPI_COMPETENT de la commune, mais il s'AFFICHE sans
 * « TPI » : les notaires ne dépendent pas des tribunaux de première instance (Me Vaval,
 * 9 oct. 2026). Toutes les communes du ressort y figurent, même sans notaire.
 * `null` = liste pas encore en base.
 */
export async function getNotaryDirectory(): Promise<NotaryDirectory | null> {
  try {
    const [notaires, communes, source] = await Promise.all([
      prisma.notary.findMany({
        orderBy: { ordinal: 'asc' },
        select: { ...NOTAIRE_VUE, communeId: true, sourceDepartment: true, sourceCommune: true, active: true },
      }),
      prisma.judicialCommune.findMany({
        select: {
          id: true, name: true,
          department: { select: { name: true } },
          jurisdictions: { where: { relationship: 'TPI_COMPETENT' }, select: { court: { select: { id: true, name: true, active: true } } } },
        },
      }),
      prisma.notary.findFirst({ select: { sourceJson: true }, orderBy: { updatedAt: 'desc' } }),
    ])
    const actifs = notaires.filter((n) => n.active)
    const parCommune = new Map<string, typeof actifs>()
    for (const n of actifs) if (n.communeId) parCommune.set(n.communeId, [...(parCommune.get(n.communeId) ?? []), n])

    const tpis = new Map<string, NotaryDirectory['tpis'][number]>()
    for (const c of communes) {
      const court = c.jurisdictions.find((j) => j.court.active)?.court
      if (!court) continue
      const t = tpis.get(court.id) ?? { id: court.id, name: court.name, label: nomJuridiction(court.name), total: 0, communes: [] }
      const liste = parCommune.get(c.id) ?? []
      const dept = c.department.name
      t.communes.push({
        id: c.id,
        name: c.name,
        department: dept,
        notaires: liste.map((n) => ({
          ...versVue(n),
          // Désaccord de département, signalé discrètement : la colonne imprimée telle quelle.
          printedDepartment: normalizePlaceName(n.sourceDepartment) === normalizePlaceName(dept) ? null : n.sourceDepartment,
        })),
      })
      t.total += liste.length
      tpis.set(court.id, t)
    }
    const sorted = [...tpis.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'))
    for (const t of sorted) t.communes.sort((a, b) => a.name.localeCompare(b.name, 'fr'))

    return {
      totalEntries: notaires.length,
      activeEntries: actifs.length,
      provenance: lireProvenance(source?.sourceJson),
      tpis: sorted,
      unmatched: actifs.filter((n) => !n.communeId).map((n) => ({
        ...versVue(n), sourceCommune: n.sourceCommune, sourceDepartment: n.sourceDepartment,
      })),
    }
  } catch (e) {
    if (lectureNotairesImpossible(e)) return null
    throw e
  }
}

// ── La page d'un notaire ─────────────────────────────────────────────────────

export interface NotaryProfile {
  id: string
  ordinal: number
  /** Nom affiché. */
  name: string
  /** Nom imprimé par le MJSP quand il diffère du nom affiché (n° 9 : « Gamma »). */
  printedName: string | null
  mention: string | null
  commune: { id: string; name: string; department: string } | null
  /** Colonnes imprimées — utiles quand la commune n'a pas été reconnue. */
  sourceCommune: string
  /** Juridiction déduite de la commune, affichée SANS « TPI » (`nomJuridiction`). */
  jurisdiction: { id: string; label: string } | null
  contact: { address: string | null; phones: string[]; email: string | null; upToDateOn: string | null } | null
  provenance: NotaryProvenance | null
}

const NOTARY_ID_RE = /^[a-z0-9][a-z0-9-]{2,119}$/

/**
 * Profil public d'un notaire. `null` si l'identifiant est inconnu, si l'entrée est RETIRÉE
 * (n° 37 : jamais publiée) ou si la liste n'est pas encore en base.
 */
export async function getNotaryProfile(id: string): Promise<NotaryProfile | null> {
  if (!NOTARY_ID_RE.test(id)) return null
  try {
    const n = await prisma.notary.findUnique({
      where: { id },
      select: {
        id: true, ordinal: true, fullName: true, displayName: true, mention: true, active: true,
        sourceCommune: true, sourceJson: true,
        commune: {
          select: {
            id: true, name: true, department: { select: { name: true } },
            jurisdictions: { where: { relationship: 'TPI_COMPETENT' }, select: { court: { select: { id: true, name: true, active: true } } } },
          },
        },
        contact: { select: { address: true, phonesJson: true, email: true, upToDateOn: true, active: true } },
      },
    })
    if (!n || !n.active) return null
    const court = n.commune?.jurisdictions.find((j) => j.court.active)?.court ?? null
    const c = n.contact?.active ? n.contact : null
    return {
      id: n.id,
      ordinal: n.ordinal,
      name: n.displayName ?? n.fullName,
      printedName: n.displayName && n.displayName !== n.fullName ? n.fullName : null,
      mention: n.mention,
      commune: n.commune ? { id: n.commune.id, name: n.commune.name, department: n.commune.department.name } : null,
      sourceCommune: n.sourceCommune,
      jurisdiction: court ? { id: court.id, label: nomJuridiction(court.name) } : null,
      contact: c
        ? { address: c.address, phones: readPhones(c.phonesJson), email: c.email, upToDateOn: c.upToDateOn ? c.upToDateOn.toISOString().slice(0, 10) : null }
        : null,
      provenance: lireProvenance(n.sourceJson),
    }
  } catch (e) {
    if (lectureNotairesImpossible(e)) return null
    throw e
  }
}

// ── Index de recherche des notaires — reconstruit quand les tables changent ──
let notaryIndexCache: { key: string; index: NotaryIndex } | null = null

/** Index des notaires ACTIFS (nom affiché, nom imprimé, alias de la fiche). Vide si indisponible. */
export async function getNotaryIndex(): Promise<NotaryIndex> {
  try {
    const [a, b] = await Promise.all([
      prisma.notary.aggregate({ _max: { updatedAt: true }, _count: true }),
      prisma.notaryContact.aggregate({ _max: { updatedAt: true }, _count: true }),
    ])
    const key = `${a._count}:${a._max.updatedAt?.getTime() ?? 0}:${b._count}:${b._max.updatedAt?.getTime() ?? 0}`
    if (notaryIndexCache?.key === key) return notaryIndexCache.index
    const rows = await prisma.notary.findMany({
      where: { active: true },
      select: {
        id: true, fullName: true, displayName: true, mention: true, communeId: true,
        commune: { select: { name: true } },
        contact: { select: { active: true, searchAliasesJson: true } },
      },
    })
    const index = buildNotaryIndex(rows.map((n) => ({
      id: n.id,
      name: n.displayName ?? n.fullName,
      printedName: n.displayName ? n.fullName : null,
      mention: n.mention,
      communeId: n.communeId,
      communeName: n.commune?.name ?? null,
      aliases: n.contact?.active
        ? ((): string[] => { try { const v = JSON.parse(n.contact.searchAliasesJson); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [] } catch { return [] } })()
        : [],
      hasContact: Boolean(n.contact?.active),
    })))
    notaryIndexCache = { key, index }
    return index
  } catch (e) {
    if (lectureNotairesImpossible(e)) return buildNotaryIndex([])
    throw e
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
