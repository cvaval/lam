import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { requireAdminApi } from '@/lib/auth/guard'
import { audit, type AuditAction } from '@/lib/auth/audit'
import { getClientCtx } from '@/lib/auth/request'
import { setDocumentThemes } from '@/lib/legislation/themes'
import { amendArticle, abrogateArticle } from '@/lib/legislation/amendments'

export const runtime = 'nodejs'

const KINDS = ['CITE', 'COMMENTE', 'MODIFIE', 'ABROGE', 'APPLIQUE', 'VOIR'] as const
const TYPES = ['LEGISLATION', 'CIRCULAIRE_BRH', 'JURISPRUDENCE', 'DOCTRINE', 'LOI_FINANCES', 'MARQUE', 'INDEX', 'TARIF_DOUANIER'] as const

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('setThemes'),
    documentId: z.string().min(1),
    themeIds: z.array(z.string().min(1)),
    primaryThemeId: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal('addRef'),
    fromId: z.string().min(1),
    toId: z.string().nullable().optional(),
    toType: z.enum(TYPES).nullable().optional(),
    toNumber: z.string().max(200).nullable().optional(),
    toAnchor: z.string().max(40).nullable().optional(),
    toLabel: z.string().max(200).nullable().optional(),
    kind: z.enum(KINDS).default('CITE'),
    note: z.string().max(500).nullable().optional(),
  }),
  z.object({ action: z.literal('removeRef'), refId: z.string().min(1) }),
  z.object({
    action: z.literal('amend'),
    documentId: z.string().min(1),
    anchor: z.string().min(1).max(40),
    label: z.string().max(120).nullable().optional(),
    originalBody: z.string().max(20000).nullable().optional(),
    newBody: z.string().min(1).max(20000),
    amendedByNumber: z.string().max(200).nullable().optional(),
    effectiveDate: z.string().nullable().optional(),
    note: z.string().max(500).nullable().optional(),
  }),
  z.object({
    action: z.literal('abrogate'),
    documentId: z.string().min(1),
    anchor: z.string().min(1).max(40),
    label: z.string().max(120).nullable().optional(),
    originalBody: z.string().max(20000).nullable().optional(),
    amendedByNumber: z.string().max(200).nullable().optional(),
    effectiveDate: z.string().nullable().optional(),
    note: z.string().max(500).nullable().optional(),
  }),
])

const parseDate = (s?: string | null) => (s ? new Date(s) : null)

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return apiError('forbidden', 403)

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const d = parsed.data
  const ctx = getClientCtx(req)

  try {
    let action: AuditAction = 'DOC_THEMED'
    let targetId = ''
    let meta: Record<string, unknown> = {}

    switch (d.action) {
      case 'setThemes': {
        await setDocumentThemes(d.documentId, d.themeIds, d.primaryThemeId ?? null)
        // NB : la réindexation recherche (searchText + OpenSearch) viendra en Phase 3.
        action = 'DOC_THEMED'
        targetId = d.documentId
        meta = { count: d.themeIds.length, primary: d.primaryThemeId ?? null }
        break
      }
      case 'addRef': {
        if (!d.toId && !(d.toType && d.toNumber)) return apiError('invalidFields', 400)
        const ref = await prisma.crossRef.create({
          data: {
            fromId: d.fromId,
            toId: d.toId ?? null,
            toType: d.toType ?? null,
            toNumber: d.toNumber ?? null,
            toAnchor: d.toAnchor ?? null,
            toLabel: d.toLabel ?? null,
            kind: d.kind,
            note: d.note ?? null,
            source: 'EDITORIAL',
          },
        })
        action = 'CROSSREF_ADDED'
        targetId = d.fromId
        meta = { refId: ref.id, kind: d.kind, toNumber: d.toNumber ?? null }
        break
      }
      case 'removeRef': {
        const ref = await prisma.crossRef.findUnique({ where: { id: d.refId }, select: { fromId: true } })
        if (!ref) return apiError('notFound', 404)
        await prisma.crossRef.delete({ where: { id: d.refId } })
        action = 'CROSSREF_REMOVED'
        targetId = ref.fromId
        meta = { refId: d.refId }
        break
      }
      case 'amend': {
        await amendArticle({
          documentId: d.documentId,
          anchor: d.anchor,
          label: d.label,
          originalBody: d.originalBody,
          newBody: d.newBody,
          amendedByNumber: d.amendedByNumber,
          effectiveDate: parseDate(d.effectiveDate),
          note: d.note,
          origin: 'MANUAL',
        })
        action = 'ARTICLE_AMENDED'
        targetId = d.documentId
        meta = { anchor: d.anchor }
        break
      }
      case 'abrogate': {
        await abrogateArticle({
          documentId: d.documentId,
          anchor: d.anchor,
          label: d.label,
          originalBody: d.originalBody,
          amendedByNumber: d.amendedByNumber,
          effectiveDate: parseDate(d.effectiveDate),
          note: d.note,
        })
        action = 'ARTICLE_ABROGATED'
        targetId = d.documentId
        meta = { anchor: d.anchor }
        break
      }
    }

    await audit({ action, actorId: admin.id, targetType: 'DOCUMENT', targetId, ip: ctx.ip, userAgent: ctx.userAgent, meta })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('POST /api/admin/legislation :', e)
    return apiError('server', 500)
  }
}
