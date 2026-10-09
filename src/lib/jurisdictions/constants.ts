/**
 * Carte judiciaire — valeurs applicatives (chaînes validées, pas d'enum Prisma,
 * conformément aux conventions du projet). Toute valeur hors liste est rejetée
 * par Zod à l'import et par les API publiques.
 */

export const COURT_TYPES = ['CASSATION', 'APPEL', 'PREMIERE_INSTANCE', 'PAIX'] as const
export type CourtType = (typeof COURT_TYPES)[number]

export const JURISDICTION_RELATIONSHIPS = [
  'PAIX_LOCAL',
  'TPI_COMPETENT',
  'APPEL_COMPETENT',
  'CASSATION_NATIONALE',
] as const
export type JurisdictionRelationship = (typeof JURISDICTION_RELATIONSHIPS)[number]

export const LOCATION_PRECISIONS = ['EXACT_ADDRESS', 'CITY_CENTER', 'COMMUNE_CENTROID', 'UNKNOWN'] as const
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number]

export const VERIFICATION_STATUSES = ['CONFIRMED_OFFICIAL', 'CORROBORATED', 'TO_VERIFY', 'UNMAPPED'] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

// Les couches affichables (et le paramètre `?layers=`) vivent dans le REGISTRE : layers.ts.

export function isCourtType(v: string): v is CourtType {
  return (COURT_TYPES as readonly string[]).includes(v)
}
