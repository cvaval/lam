import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { can } from '@/lib/rbac'
import { audit } from '@/lib/auth/audit'
import { getClientCtx } from '@/lib/auth/request'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { parseRichBlocks } from '@/lib/doc/richblocks'
import { buildAnnexesDocx, buildAnnexesXlsx, hasAnnexes } from '@/lib/annexes/generate'
import { isLocale, DEFAULT_LOCALE } from '@/lib/types'

export const runtime = 'nodejs'

const FORMATS = {
  docx: { build: buildAnnexesDocx, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
  xlsx: { build: buildAnnexesXlsx, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
} as const

/**
 * Téléchargement des annexes (tableaux/formulaires) d'une circulaire en Word ou
 * Excel — filigrane Lam + mention légale en pied de page (src/lib/annexes/generate.ts).
 * Réservé aux paliers qui peuvent exporter (export.sealed), comme le PDF scellé.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)
  if (!can(user.role, 'export.sealed')) return apiError('forbidden', 403)

  // Anti-scraping : même plafond que l'export scellé (§09).
  if (!(await guard({ action: 'export', subject: user.id, ...LIMITS.export }, { actorId: user.id, ip: getClientCtx(req).ip }))) {
    return apiError('rate', 429)
  }

  const fmtKey = (req.nextUrl.searchParams.get('format') ?? 'docx') as keyof typeof FORMATS
  const fmt = FORMATS[fmtKey]
  if (!fmt) return apiError('invalidFields', 400)

  const localeParam = req.nextUrl.searchParams.get('locale') ?? ''
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE

  const doc = await prisma.document.findUnique({ where: { id: params.id } })
  if (!doc) return apiError('notFound', 404)

  const rich = parseRichBlocks(doc.richBlocksJson)
  if (!hasAnnexes(rich)) return apiError('notFound', 404)

  const bytes = await fmt.build({
    number: doc.number,
    titleFr: doc.titleFr,
    rich,
    downloaderEmail: user.email,
    locale,
  })

  const ctx = getClientCtx(req)
  await audit({ action: 'EXPORT', actorId: user.id, targetType: 'DOCUMENT', targetId: doc.id, ip: ctx.ip, meta: { kind: 'annexes', format: fmt.ext } })

  const slug = (doc.number ?? doc.id.slice(-6)).replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  const filename = `lam-annexes-${slug || doc.id.slice(-6)}.${fmt.ext}`
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'content-type': fmt.mime,
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}
