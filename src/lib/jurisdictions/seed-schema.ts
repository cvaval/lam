/**
 * Schéma Zod du référentiel d'amorçage (data/judicial-map/seed-v1.json).
 * TOUT l'import passe par cette validation avant la moindre transaction ;
 * les tests unitaires la partagent (aucune divergence script/tests possible).
 */
import { z } from 'zod'
import { COURT_TYPES, LOCATION_PRECISIONS, VERIFICATION_STATUSES } from './constants'

const source = z.object({ type: z.enum(['url', 'file']), value: z.string().min(1).max(500) })
export const sourceList = z.array(source)

const id = z.string().min(3).max(120).regex(/^[a-z0-9][a-z0-9-]*$/, 'identifiant stable en minuscules')
const name = z.string().min(1).max(160)
const postal = z.string().regex(/^HT\d{4}$/)
const lat = z.number().min(17.5).max(20.5) // bornes d'Haïti — toute coordonnée hors pays est une erreur
const lng = z.number().min(-75.5).max(-71)

export const seedSchema = z.object({
  schemaVersion: z.string(),
  generatedAt: z.string(),
  language: z.string(),
  description: z.string(),
  sourceWorkbook: z.string(),
  rules: z.record(z.string()),
  counts: z.object({
    departments: z.number().int(),
    communes: z.number().int(),
    postalRecords: z.number().int(),
    tpiCourts: z.number().int(),
    tpiJurisdictions: z.number().int(),
    peaceCourts: z.number().int(),
    appealCourts: z.number().int(),
    cassationCourts: z.number().int(),
  }),
  dataQuality: z.object({
    communesWithoutPrimaryPostalCode: z.number().int(),
    peaceCourtsWithoutConfirmedCommune: z.number().int(),
    courtsWithoutExactCoordinates: z.number().int(),
    publicationRule: z.string(),
  }),
  departments: z.array(
    z.object({
      id,
      name,
      capital: name,
      arrondissementCount: z.number().int().positive(),
      communeCount: z.number().int().positive(),
      communesWithPeaceCourtCount: z.number().int().nonnegative(),
      tpiSeatCount: z.number().int().nonnegative(),
      appealCourtSeatCount: z.number().int().nonnegative(),
      sources: sourceList,
    }),
  ),
  communes: z.array(
    z.object({
      id,
      key: z.string().min(3).max(120),
      department: name,
      arrondissement: name,
      commune: name,
      city: name,
      // null = présence non documentée (Ducis : aucune affectation CSPJ repérée,
      // sans preuve d'inexistence juridique) — jamais coercé en false.
      peaceCourtPresent: z.boolean().nullable(),
      peaceCourtSeats: z.array(z.string()),
      peaceCourtVerification: z.string().nullable(),
      tpiInCity: z.boolean(),
      tpiNameInCity: z.string().nullable(),
      tpiStatus: z.string().nullable(),
      appealCourtInCity: z.boolean(),
      appealCourtNameInCity: z.string().nullable(),
      observation: z.string().nullable(),
      postalCodePrimary: postal,
      postalCodesAdditional: z.array(postal),
      postalVerificationStatus: z.string(),
      sources: z.object({ administrative: sourceList, judicial: sourceList, postal: sourceList }),
    }),
  ),
  postalCodes: z.array(
    z.object({
      id,
      communeKey: z.string(),
      department: name,
      arrondissement: name,
      commune: name,
      city: name,
      primaryCode: postal,
      additionalCodes: z.array(postal),
      verificationStatus: z.string(),
      scopeNote: z.string().nullable(),
      sources: sourceList,
    }),
  ),
  courts: z.object({
    cassation: z.array(
      z.object({
        id,
        type: z.literal('CASSATION'),
        name,
        scope: z.literal('NATIONAL'),
        department: name,
        arrondissement: name,
        commune: name,
        city: name,
        address: z.string().min(3),
        postalCode: postal,
        plusCode: z.string().regex(/^[23456789CFGHJMPQRVWX+]{4,12}$/i),
        latitude: lat,
        longitude: lng,
        locationPrecision: z.enum(LOCATION_PRECISIONS),
        verificationStatus: z.enum(VERIFICATION_STATUSES),
        verificationNote: z.string().nullable(),
        sources: sourceList,
      }),
    ),
    appeal: z.array(
      z.object({
        id,
        type: z.literal('APPEL'),
        name,
        department: name,
        city: name,
        address: z.string().nullable(),
        latitude: lat.nullable(),
        longitude: lng.nullable(),
        locationPrecision: z.enum(LOCATION_PRECISIONS),
        verificationStatus: z.enum(VERIFICATION_STATUSES),
        sources: sourceList,
      }),
    ),
    firstInstance: z.array(
      z.object({
        id,
        type: z.literal('PREMIERE_INSTANCE'),
        name,
        department: name,
        seatArrondissement: name,
        seatCommune: name,
        seatCity: name,
        coveredArrondissements: z.array(name),
        coveredCommunes: z.array(name),
        coveredCommuneCount: z.number().int().positive(),
        competentAppealCourt: name,
        operationalStatus: z.string().nullable(),
        verificationStatus: z.enum(VERIFICATION_STATUSES),
        legalBasis: sourceList,
        scopeNote: z.string().nullable(),
        sources: sourceList,
        address: z.string().nullable(),
        latitude: lat.nullable(),
        longitude: lng.nullable(),
        locationPrecision: z.enum(LOCATION_PRECISIONS),
      }),
    ),
    peace: z.array(
      z.object({
        id,
        type: z.literal('PAIX'),
        department: name,
        cspjJurisdiction: z.string().nullable(),
        name,
        seatName: z.string().min(1),
        associatedCommuneOrCity: z.string().nullable(),
        seatType: z.string().nullable(),
        observation: z.string().nullable(),
        sources: sourceList,
        address: z.string().nullable(),
        latitude: lat.nullable(),
        longitude: lng.nullable(),
        locationPrecision: z.enum(LOCATION_PRECISIONS),
        verificationStatus: z.enum(VERIFICATION_STATUSES),
      }),
    ),
  }),
  tpiJurisdictions: z.array(
    z.object({
      id,
      communeKey: z.string(),
      department: name,
      arrondissement: name,
      commune: name,
      city: name,
      competentTpi: name,
      tpiSeatCity: name,
      competentAppealCourt: name,
      legalBasis: sourceList,
      scopeNote: z.string().nullable(),
    }),
  ),
})

export type JudicialSeed = z.infer<typeof seedSchema>

/** Comptes de référence NON NÉGOCIABLES (§2 du cahier des charges). */
export const EXPECTED_COUNTS = {
  departments: 10,
  communes: 149,
  postalRecords: 149,
  tpiCourts: 23,
  tpiJurisdictions: 149,
  peaceCourts: 185,
  appealCourts: 5,
  cassationCourts: 1,
} as const

export interface SeedAnomaly {
  level: 'BLOQUANT' | 'AVERTISSEMENT'
  message: string
}

/**
 * Contrôles de cohérence au-delà des types : comptes exacts, unicité des clés,
 * code postal principal partout, TPI + cour d'appel pour chaque commune,
 * résolution non ambiguë des rattachements de paix. PUR — testé.
 */
export function validateSeed(seed: JudicialSeed): SeedAnomaly[] {
  const anomalies: SeedAnomaly[] = []
  const bloc = (message: string) => anomalies.push({ level: 'BLOQUANT', message })
  const warn = (message: string) => anomalies.push({ level: 'AVERTISSEMENT', message })

  const actual = {
    departments: seed.departments.length,
    communes: seed.communes.length,
    postalRecords: seed.postalCodes.length,
    tpiCourts: seed.courts.firstInstance.length,
    tpiJurisdictions: seed.tpiJurisdictions.length,
    peaceCourts: seed.courts.peace.length,
    appealCourts: seed.courts.appeal.length,
    cassationCourts: seed.courts.cassation.length,
  }
  for (const [k, expected] of Object.entries(EXPECTED_COUNTS)) {
    const got = actual[k as keyof typeof actual]
    if (got !== expected) bloc(`${k} : ${got} au lieu de ${expected}`)
    const declared = seed.counts[k as keyof typeof seed.counts]
    if (got !== declared) bloc(`${k} : ${got} éléments mais le fichier en déclare ${declared}`)
  }

  const keys = new Set<string>()
  for (const c of seed.communes) {
    if (keys.has(c.key)) bloc(`clé communale dupliquée : ${c.key}`)
    keys.add(c.key)
  }
  const ids = new Set<string>()
  const allIds = [
    ...seed.communes.map((c) => c.id),
    ...seed.departments.map((d) => d.id),
    ...seed.postalCodes.map((p) => p.id),
    ...seed.courts.cassation.map((c) => c.id),
    ...seed.courts.appeal.map((c) => c.id),
    ...seed.courts.firstInstance.map((c) => c.id),
    ...seed.courts.peace.map((c) => c.id),
  ]
  for (const i of allIds) {
    if (ids.has(i)) bloc(`identifiant dupliqué : ${i}`)
    ids.add(i)
  }

  // Chaque commune : postal principal (garanti par le type), fiche postale, TPI et cour d'appel.
  const postalByKey = new Map(seed.postalCodes.map((p) => [p.communeKey, p]))
  const juriByKey = new Map(seed.tpiJurisdictions.map((j) => [j.communeKey, j]))
  const tpiNames = new Set(seed.courts.firstInstance.map((t) => t.name))
  const appealNames = new Set(seed.courts.appeal.map((a) => a.name))
  for (const c of seed.communes) {
    const p = postalByKey.get(c.key)
    if (!p) bloc(`commune sans fiche postale : ${c.key}`)
    else if (p.primaryCode !== c.postalCodePrimary)
      bloc(`code postal principal divergent pour ${c.key} : ${c.postalCodePrimary} ≠ ${p.primaryCode}`)
    const j = juriByKey.get(c.key)
    if (!j) bloc(`commune sans TPI ni cour d'appel compétente : ${c.key}`)
    else {
      if (!tpiNames.has(j.competentTpi)) bloc(`TPI inconnu pour ${c.key} : ${j.competentTpi}`)
      if (!appealNames.has(j.competentAppealCourt)) bloc(`cour d'appel inconnue pour ${c.key} : ${j.competentAppealCourt}`)
    }
  }

  // Rattachement des sièges de paix : (département, commune) doit résoudre sans ambiguïté.
  const communeByDeptName = new Map<string, string[]>()
  for (const c of seed.communes) {
    const k = `${c.department}|${c.commune}`
    communeByDeptName.set(k, [...(communeByDeptName.get(k) ?? []), c.id])
  }
  let unmapped = 0
  for (const p of seed.courts.peace) {
    if (!p.associatedCommuneOrCity) {
      unmapped++
      if (p.verificationStatus !== 'UNMAPPED') bloc(`siège de paix sans commune mais non UNMAPPED : ${p.id}`)
      continue
    }
    const matches = communeByDeptName.get(`${p.department}|${p.associatedCommuneOrCity}`) ?? []
    if (matches.length === 0) bloc(`siège de paix ${p.id} : commune introuvable « ${p.department}|${p.associatedCommuneOrCity} »`)
    if (matches.length > 1) bloc(`siège de paix ${p.id} : rattachement ambigu (${matches.length} communes)`)
  }
  if (unmapped !== seed.dataQuality.peaceCourtsWithoutConfirmedCommune)
    warn(`sièges UNMAPPED : ${unmapped} trouvés, ${seed.dataQuality.peaceCourtsWithoutConfirmedCommune} déclarés`)

  return anomalies
}
