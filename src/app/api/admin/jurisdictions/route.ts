import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { requireAdminApi } from '@/lib/auth/guard'
import { audit } from '@/lib/auth/audit'
import { getClientCtx } from '@/lib/auth/request'
import { COURT_TYPES, LOCATION_PRECISIONS, VERIFICATION_STATUSES } from '@/lib/jurisdictions/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Administration de la carte judiciaire (MASTER_ADMIN uniquement).
 *  GET  ?export=anomalies → rapport JSON des données à vérifier
 *  PATCH { courtId, … }   → adresse / coordonnées / précision / statut / source /
 *                            vérification / désactivation (JAMAIS de suppression).
 * Toute modification écrit une entrée d'audit JUDICIAL_UPDATED (historique).
 */
const patchSchema = z.object({
  courtId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,119}$/),
  address: z.string().trim().max(300).nullable().optional(),
  latitude: z.number().min(17.5).max(20.5).nullable().optional(),
  longitude: z.number().min(-75.5).max(-71).nullable().optional(),
  locationPrecision: z.enum(LOCATION_PRECISIONS).optional(),
  verificationStatus: z.enum(VERIFICATION_STATUSES).optional(),
  operationalStatus: z.string().trim().max(200).nullable().optional(),
  observation: z.string().trim().max(1000).nullable().optional(),
  addSourceUrl: z.string().url().max(500).optional(),
  active: z.boolean().optional(),
  markVerified: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return apiError('forbidden', 403)

  if (req.nextUrl.searchParams.get('export') === 'anomalies') {
    const [unmapped, toVerify, centroids, noGeometry] = await Promise.all([
      prisma.court.findMany({ where: { verificationStatus: 'UNMAPPED' }, select: { id: true, name: true, department: true, city: true, observation: true } }),
      prisma.court.findMany({ where: { verificationStatus: 'TO_VERIFY', active: true }, select: { id: true, name: true, type: true } }),
      prisma.court.count({ where: { active: true, latitude: null } }),
      prisma.judicialCommune.findMany({ where: { geometryKey: null }, select: { id: true, name: true } }),
    ])
    const res = NextResponse.json({
      generatedAt: new Date().toISOString(),
      unmappedPeaceCourts: unmapped,
      courtsToVerify: toVerify,
      courtsWithoutExactCoordinates: centroids,
      communesWithoutGeometry: noGeometry,
    })
    res.headers.set('Content-Disposition', 'attachment; filename="juridictions-anomalies.json"')
    return res
  }

  const type = req.nextUrl.searchParams.get('type')
  const status = req.nextUrl.searchParams.get('status')
  const where: Record<string, unknown> = {}
  if (type) {
    if (!(COURT_TYPES as readonly string[]).includes(type)) return apiError('invalid_type', 400)
    where.type = type
  }
  if (status) {
    if (!(VERIFICATION_STATUSES as readonly string[]).includes(status)) return apiError('invalid_status', 400)
    where.verificationStatus = status
  }
  const courts = await prisma.court.findMany({
    where,
    orderBy: [{ type: 'asc' }, { department: 'asc' }, { name: 'asc' }],
    select: {
      id: true, type: true, name: true, department: true, city: true, address: true,
      latitude: true, longitude: true, locationPrecision: true, verificationStatus: true,
      operationalStatus: true, active: true, verifiedAt: true,
    },
  })
  return NextResponse.json({ courts })
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return apiError('forbidden', 403)
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('invalid_json', 400)
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return apiError('invalid_body', 400)
  const { courtId, addSourceUrl, markVerified, ...fields } = parsed.data

  const court = await prisma.court.findUnique({ where: { id: courtId } })
  if (!court) return apiError('court_not_found', 404)

  // Cohérence : des coordonnées exactes vont de pair, et une précision EXACT_ADDRESS
  // exige des coordonnées ; on n'écrit jamais un demi-état.
  const nextLat = 'latitude' in fields ? fields.latitude : court.latitude
  const nextLng = 'longitude' in fields ? fields.longitude : court.longitude
  if ((nextLat == null) !== (nextLng == null)) return apiError('coordinates_incomplete', 400)
  const nextPrecision = fields.locationPrecision ?? court.locationPrecision
  if (nextPrecision === 'EXACT_ADDRESS' && (nextLat == null || nextLng == null)) return apiError('precision_requires_coordinates', 400)

  const data: Record<string, unknown> = { ...fields }
  if (addSourceUrl) {
    const sources = (() => { try { const v = JSON.parse(court.sourceJson); return Array.isArray(v) ? v : [] } catch { return [] } })()
    sources.push({ type: 'url', value: addSourceUrl })
    data.sourceJson = JSON.stringify(sources)
  }
  if (markVerified) data.verifiedAt = new Date()

  const updated = await prisma.court.update({ where: { id: courtId }, data })
  const { ip, userAgent } = getClientCtx(req)
  await audit({
    action: 'JUDICIAL_UPDATED',
    actorId: admin.id,
    targetType: 'Court',
    targetId: courtId,
    ip,
    userAgent,
    meta: {
      fields: Object.keys(data),
      before: { address: court.address, latitude: court.latitude, longitude: court.longitude, locationPrecision: court.locationPrecision, verificationStatus: court.verificationStatus, active: court.active },
      after: { address: updated.address, latitude: updated.latitude, longitude: updated.longitude, locationPrecision: updated.locationPrecision, verificationStatus: updated.verificationStatus, active: updated.active },
    },
  })
  return NextResponse.json({ ok: true })
}
