import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { can } from '@/lib/rbac'
import { buildSealedPdf } from '@/lib/pdf/seal'
import { audit } from '@/lib/auth/audit'
import { randomToken } from '@/lib/auth/crypto'
import { getClientCtx } from '@/lib/auth/request'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { DOC_TYPE_META } from '@/lib/brand'
import type { DocType } from '@/lib/types'

export const runtime = 'nodejs'

// Export PDF scellé + filigrane dynamique (§09). Réservé aux paliers qui ont la
// capacité export.sealed (Pwofesyonèl, Enstitisyon, Master Admin).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)
  if (!can(user.role, 'export.sealed')) return apiError('forbidden', 403)

  // Anti-scraping : plafond d'exports scellés par minute (§09).
  if (!(await guard({ action: 'export', subject: user.id, ...LIMITS.export }, { actorId: user.id, ip: getClientCtx(req).ip }))) {
    return apiError('rate', 429)
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return apiError('invalidFields', 400)

  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc) return apiError('notFound', 404)

  const watermarkId = `${user.id.slice(-6)}-${randomToken(4)}`.toUpperCase()
  const meta = DOC_TYPE_META[doc.type as DocType]
  const bytes = await buildSealedPdf({
    title: doc.titleFr,
    badge: meta?.badge ?? 'LAM',
    status: doc.status,
    number: doc.number,
    moniteurRef: doc.moniteurRef,
    bodyOriginal: doc.bodyOriginal,
    exporterEmail: user.email,
    watermarkId,
  })

  const ctx = getClientCtx(req)
  await prisma.exportRecord.create({ data: { userId: user.id, documentId: doc.id, watermarkId, ip: ctx.ip } })
  await audit({ action: 'EXPORT', actorId: user.id, targetType: 'DOCUMENT', targetId: doc.id, ip: ctx.ip, meta: { watermarkId } })

  const filename = `lam-veritab-${doc.id.slice(-6)}.pdf`
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}
