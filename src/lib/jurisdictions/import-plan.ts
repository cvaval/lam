/**
 * Transformation PURE du référentiel d'amorçage en plan d'écriture (testée sans
 * base). Le script scripts/import-judicial-map.ts ne fait qu'appliquer ce plan.
 *
 * Règles structurantes :
 *  - un tribunal de paix n'est relié à une commune QUE si `associatedCommuneOrCity`
 *    est renseigné et que le couple (département, commune) résout sans ambiguïté ;
 *  - les sièges non rattachés restent des Court au statut UNMAPPED, sans relation ;
 *  - les centroïdes proviennent de la table de correspondance cartographique
 *    (metadata.json — géométrie officielle COD-AB), jamais d'une déduction ;
 *  - la Cour de cassation est reliée à chaque commune par CASSATION_NATIONALE
 *    (bloc « Recours national » de la fiche).
 */
import type { JudicialSeed } from './seed-schema'
import { normalizePlaceName } from './normalize-place'

export interface GeoCorrespondence {
  lamId: string
  adm2_pcode: string
  aliasKreyol: string | null
  centroidLat: number
  centroidLng: number
}

export interface ImportPlan {
  departments: Array<{ id: string; name: string; capital: string; arrondissementCount: number; communeCount: number }>
  arrondissements: Array<{ id: string; name: string; departmentId: string }>
  communes: Array<{
    id: string; key: string; slug: string; name: string; city: string
    departmentId: string; arrondissementId: string
    geometryKey: string | null; centroidLat: number | null; centroidLng: number | null
    aliasesJson: string; observation: string | null; sourceJson: string
  }>
  postalCodes: Array<{
    id: string; communeId: string; code: string; label: string | null; isPrimary: boolean
    verificationStatus: string; scopeNote: string | null; sourceJson: string
  }>
  courts: Array<{
    id: string; type: string; name: string; normalizedName: string; scope: string
    department: string | null; arrondissement: string | null; commune: string | null; city: string | null
    address: string | null; postalCode: string | null; plusCode: string | null
    latitude: number | null; longitude: number | null
    locationPrecision: string; operationalStatus: string | null; verificationStatus: string
    observation: string | null; sourceJson: string; active: boolean
  }>
  jurisdictions: Array<{
    id: string; courtId: string; communeId: string; relationship: string
    scopeNote: string | null; legalBasisJson: string
  }>
  anomalies: string[]
}

const slugify = (s: string) =>
  normalizePlaceName(s).replace(/ /g, '-')

export function buildImportPlan(seed: JudicialSeed, geo: GeoCorrespondence[]): ImportPlan {
  const anomalies: string[] = []
  const geoById = new Map(geo.map((g) => [g.lamId, g]))

  const departments = seed.departments.map((d) => ({
    id: d.id,
    name: d.name,
    capital: d.capital,
    arrondissementCount: d.arrondissementCount,
    communeCount: d.communeCount,
  }))
  const deptByName = new Map(seed.departments.map((d) => [d.name, d.id]))

  // Arrondissements dérivés des communes (le seed ne les liste pas séparément).
  const arrMap = new Map<string, { id: string; name: string; departmentId: string }>()
  for (const c of seed.communes) {
    const departmentId = deptByName.get(c.department)
    if (!departmentId) { anomalies.push(`département inconnu pour ${c.key} : ${c.department}`); continue }
    const id = `arrondissement-${slugify(c.department)}-${slugify(c.arrondissement)}`
    if (!arrMap.has(id)) arrMap.set(id, { id, name: c.arrondissement, departmentId })
  }

  const communes = seed.communes.map((c) => {
    const g = geoById.get(c.id) ?? null
    const aliases: string[] = []
    if (g?.aliasKreyol && normalizePlaceName(g.aliasKreyol) !== normalizePlaceName(c.commune)) aliases.push(g.aliasKreyol)
    if (c.city && c.city !== c.commune) aliases.push(c.city)
    return {
      id: c.id,
      key: c.key,
      slug: c.id,
      name: c.commune,
      city: c.city,
      departmentId: deptByName.get(c.department)!,
      arrondissementId: `arrondissement-${slugify(c.department)}-${slugify(c.arrondissement)}`,
      geometryKey: g?.adm2_pcode ?? null,
      centroidLat: g?.centroidLat ?? null,
      centroidLng: g?.centroidLng ?? null,
      aliasesJson: JSON.stringify(aliases),
      observation: c.observation,
      sourceJson: JSON.stringify(c.sources),
    }
  })
  const communeByKey = new Map(seed.communes.map((c) => [c.key, c]))
  const communeIdByDeptName = new Map<string, string[]>()
  for (const c of seed.communes) {
    const k = `${c.department}|${c.commune}`
    communeIdByDeptName.set(k, [...(communeIdByDeptName.get(k) ?? []), c.id])
  }

  const postalCodes = seed.postalCodes.flatMap((p) => {
    const commune = communeByKey.get(p.communeKey)
    if (!commune) { anomalies.push(`fiche postale orpheline : ${p.id} (${p.communeKey})`); return [] }
    const src = JSON.stringify(p.sources)
    return [
      {
        id: `${p.id}-${p.primaryCode.toLowerCase()}`,
        communeId: commune.id,
        code: p.primaryCode,
        label: null,
        isPrimary: true,
        verificationStatus: p.verificationStatus,
        scopeNote: p.scopeNote,
        sourceJson: src,
      },
      ...p.additionalCodes.map((code) => ({
        id: `${p.id}-${code.toLowerCase()}`,
        communeId: commune.id,
        code,
        label: null,
        isPrimary: false,
        verificationStatus: p.verificationStatus,
        scopeNote: null,
        sourceJson: src,
      })),
    ]
  })

  const courts: ImportPlan['courts'] = []
  const jurisdictions: ImportPlan['jurisdictions'] = []
  const push = (c: ImportPlan['courts'][number]) => courts.push(c)

  const cass = seed.courts.cassation[0]
  push({
    id: cass.id, type: cass.type, name: cass.name, normalizedName: normalizePlaceName(cass.name),
    scope: 'NATIONAL', department: cass.department, arrondissement: cass.arrondissement,
    commune: cass.commune, city: cass.city, address: cass.address, postalCode: cass.postalCode,
    plusCode: cass.plusCode, latitude: cass.latitude, longitude: cass.longitude,
    locationPrecision: cass.locationPrecision, operationalStatus: null,
    verificationStatus: cass.verificationStatus, observation: cass.verificationNote,
    sourceJson: JSON.stringify(cass.sources), active: true,
  })

  for (const a of seed.courts.appeal) {
    push({
      id: a.id, type: a.type, name: a.name, normalizedName: normalizePlaceName(a.name),
      scope: 'TERRITORIAL', department: a.department, arrondissement: null, commune: null,
      city: a.city, address: a.address, postalCode: null, plusCode: null,
      latitude: a.latitude, longitude: a.longitude, locationPrecision: a.locationPrecision,
      operationalStatus: null, verificationStatus: a.verificationStatus, observation: null,
      sourceJson: JSON.stringify(a.sources), active: true,
    })
  }
  const appealByName = new Map(seed.courts.appeal.map((a) => [a.name, a.id]))

  for (const t of seed.courts.firstInstance) {
    push({
      id: t.id, type: t.type, name: t.name, normalizedName: normalizePlaceName(t.name),
      scope: 'TERRITORIAL', department: t.department, arrondissement: t.seatArrondissement,
      commune: t.seatCommune, city: t.seatCity, address: t.address, postalCode: null, plusCode: null,
      latitude: t.latitude, longitude: t.longitude, locationPrecision: t.locationPrecision,
      operationalStatus: t.operationalStatus, verificationStatus: t.verificationStatus,
      observation: t.scopeNote, sourceJson: JSON.stringify(t.sources), active: true,
    })
  }
  const tpiByName = new Map(seed.courts.firstInstance.map((t) => [t.name, t.id]))

  for (const p of seed.courts.peace) {
    // Rattachement UNIQUEMENT si le couple (département, commune) résout sans ambiguïté.
    let communeId: string | null = null
    if (p.associatedCommuneOrCity) {
      const matches = communeIdByDeptName.get(`${p.department}|${p.associatedCommuneOrCity}`) ?? []
      if (matches.length === 1) communeId = matches[0]
      else anomalies.push(`paix ${p.id} : rattachement ${matches.length === 0 ? 'introuvable' : 'ambigu'} — conservé sans relation`)
    }
    const observation = [p.seatType, p.observation].filter(Boolean).join(' ; ') || null
    push({
      id: p.id, type: p.type, name: p.name, normalizedName: normalizePlaceName(p.name),
      scope: 'TERRITORIAL', department: p.department, arrondissement: null,
      commune: p.associatedCommuneOrCity, city: p.seatName, address: p.address,
      postalCode: null, plusCode: null, latitude: p.latitude, longitude: p.longitude,
      locationPrecision: p.locationPrecision, operationalStatus: p.cspjJurisdiction,
      verificationStatus: p.verificationStatus, observation,
      sourceJson: JSON.stringify(p.sources), active: true,
    })
    if (communeId) {
      jurisdictions.push({
        id: `jx-paix-${p.id}-${communeId}`,
        courtId: p.id, communeId, relationship: 'PAIX_LOCAL',
        scopeNote: p.seatType, legalBasisJson: JSON.stringify(p.sources),
      })
    }
  }

  for (const j of seed.tpiJurisdictions) {
    const commune = communeByKey.get(j.communeKey)
    if (!commune) { anomalies.push(`ressort TPI orphelin : ${j.id}`); continue }
    const tpiId = tpiByName.get(j.competentTpi)
    const appealId = appealByName.get(j.competentAppealCourt)
    if (!tpiId) { anomalies.push(`ressort ${j.id} : TPI inconnu ${j.competentTpi}`); continue }
    if (!appealId) { anomalies.push(`ressort ${j.id} : cour d'appel inconnue ${j.competentAppealCourt}`); continue }
    const legal = JSON.stringify(j.legalBasis)
    jurisdictions.push({
      id: `jx-tpi-${tpiId}-${commune.id}`,
      courtId: tpiId, communeId: commune.id, relationship: 'TPI_COMPETENT',
      scopeNote: j.scopeNote, legalBasisJson: legal,
    })
    jurisdictions.push({
      id: `jx-appel-${appealId}-${commune.id}`,
      courtId: appealId, communeId: commune.id, relationship: 'APPEL_COMPETENT',
      scopeNote: null, legalBasisJson: legal,
    })
    jurisdictions.push({
      id: `jx-cassation-${cass.id}-${commune.id}`,
      courtId: cass.id, communeId: commune.id, relationship: 'CASSATION_NATIONALE',
      scopeNote: 'Recours national — la Cour de cassation n’est pas un tribunal local.',
      legalBasisJson: legal,
    })
  }

  return {
    departments,
    arrondissements: [...arrMap.values()],
    communes,
    postalCodes,
    courts,
    jurisdictions,
    anomalies,
  }
}
