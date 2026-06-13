import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdminApi } from '@/lib/auth/guard'
import { audit } from '@/lib/auth/audit'
import { randomPromoCode } from '@/lib/auth/crypto'
import { ROLES } from '@/lib/types'

export const runtime = 'nodejs'

// Liste des codes promo (console admin).
export async function GET() {
  if (!(await requireAdminApi())) return apiError('forbidden', 403)
  const codes = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
  return NextResponse.json({ ok: true, codes })
}

const createSchema = z.object({
  code: z.string().min(3).max(40).optional(),
  label: z.string().max(160).optional(),
  grantsRole: z.enum(ROLES).default('PWOFESYONEL'),
  durationDays: z.number().int().positive().max(3650).nullable().optional(),
  percentOff: z.number().int().min(0).max(100).nullable().optional(),
  maxRedemptions: z.number().int().positive().max(100000).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
})

// Génère un code promo.
export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return apiError('forbidden', 403)

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const d = parsed.data

  const code = (d.code?.trim() || randomPromoCode()).toUpperCase()
  if (await prisma.promoCode.findUnique({ where: { code } })) {
    return apiError('exists', 409)
  }

  const promo = await prisma.promoCode.create({
    data: {
      code,
      label: d.label ?? null,
      grantsRole: d.grantsRole,
      durationDays: d.durationDays ?? null,
      percentOff: d.percentOff ?? null,
      maxRedemptions: d.maxRedemptions ?? null,
      expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
      createdById: admin.id,
    },
  })
  await audit({ action: 'PROMO_CREATED', actorId: admin.id, targetType: 'PROMO', targetId: promo.id, meta: { code } })
  return NextResponse.json({ ok: true, promo })
}
