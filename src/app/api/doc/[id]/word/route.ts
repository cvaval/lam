import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { can } from '@/lib/rbac'
import { canReadService } from '@/lib/access'
import { audit } from '@/lib/auth/audit'
import { getClientCtx } from '@/lib/auth/request'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { parseRichBlocks } from '@/lib/doc/richblocks'
import { parseAnnotations } from '@/lib/legislation/annotated'
import { buildLegislationDocx } from '@/lib/legislation/word'
import { isLocale, DEFAULT_LOCALE, type DocType } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * VERSION WORD d'un texte de la Législation annotée (src/lib/legislation/word.ts) — générée du
 * texte officiel de la fiche, filigrane Agora + mention légale. Mêmes gardes que les annexes des
 * circulaires et que le PDF scellé : palier `export.sealed`, service accordé, plafond anti-
 * aspiration, journal EXPORT. Réservée aux fiches au lecteur annoté (type LEGISLATION, appareil
 * `annotationsJson`) ; les fascicules du Moniteur, qui sont des scans, n'en ont pas.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)
  if (!can(user.role, 'export.sealed')) return apiError('forbidden', 403)
  if (!(await guard({ action: 'export', subject: user.id, ...LIMITS.export }, { actorId: user.id, ip: getClientCtx(req).ip }))) {
    return apiError('rate', 429)
  }
  const localeParam = req.nextUrl.searchParams.get('locale') ?? ''
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE

  const doc = await prisma.document.findUnique({ where: { id: params.id } })
  if (!doc) return apiError('notFound', 404)
  if (!canReadService(user, doc.type as DocType)) return apiError('forbidden', 403)
  const annotations = parseAnnotations(doc.annotationsJson)
  if (doc.type !== 'LEGISLATION' || !annotations || (doc.source ?? '').startsWith('MONITEUR_PDF_')) return apiError('notFound', 404)

  const bytes = await buildLegislationDocx({
    titleFr: doc.titleFr,
    number: doc.number,
    moniteurRef: doc.moniteurRef,
    body: doc.bodyClean ?? doc.bodyOriginal,
    annotations,
    rich: parseRichBlocks(doc.richBlocksJson),
    downloaderEmail: user.email,
    locale,
  })

  const ctx = getClientCtx(req)
  await audit({ action: 'EXPORT', actorId: user.id, targetType: 'DOCUMENT', targetId: doc.id, ip: ctx.ip, meta: { kind: 'word', format: 'docx' } })

  const slug = (doc.source ?? doc.id.slice(-6)).replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'content-disposition': `attachment; filename="agora-${slug || doc.id.slice(-6)}.docx"`,
      'cache-control': 'no-store',
    },
  })
}
