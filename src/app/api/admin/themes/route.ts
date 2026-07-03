import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api'
import { requireAdminApi } from '@/lib/auth/guard'
import { audit, type AuditAction } from '@/lib/auth/audit'
import { getClientCtx } from '@/lib/auth/request'
import { createTheme, updateTheme, removeTheme, reorderThemes, getThemeTree, ThemeError } from '@/lib/legislation/themes'
import { reindexDocument } from '@/lib/search/reindex'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

/** Normalise un slug : minuscules, sans accents, tirets. */
function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    slug: z.string().max(80).optional(),
    labelFr: z.string().min(1).max(120),
    labelEn: z.string().max(120).optional(),
    labelHt: z.string().max(120).optional(),
    parentId: z.string().nullable().optional(),
    color: z.string().max(20).nullable().optional(),
  }),
  z.object({
    action: z.literal('update'),
    id: z.string().min(1),
    labelFr: z.string().min(1).max(120).optional(),
    labelEn: z.string().max(120).nullable().optional(),
    labelHt: z.string().max(120).nullable().optional(),
    color: z.string().max(20).nullable().optional(),
    parentId: z.string().nullable().optional(),
    active: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('remove'),
    id: z.string().min(1),
    hardDelete: z.boolean().optional(),
    reassignTo: z.string().nullable().optional(),
  }),
  z.object({ action: z.literal('reorder'), orderedIds: z.array(z.string().min(1)).min(1) }),
])

/** Arbre des thèmes (back-office). */
export async function GET() {
  if (!(await requireAdminApi())) return apiError('forbidden', 403)
  return NextResponse.json({ ok: true, tree: await getThemeTree() })
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return apiError('forbidden', 403)

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const d = parsed.data
  const ctx = getClientCtx(req)

  try {
    let action: AuditAction = 'THEME_UPDATED'
    let meta: Record<string, unknown> = {}

    // Renommer/supprimer un thème change les libellés dénormalisés (themeLabels) et donc le
    // searchText des documents rattachés : on capture les ids AVANT l'opération pour les
    // ré-indexer ensuite, sinon la recherche reste sur l'ancien libellé (constat audit).
    const toReindex =
      d.action === 'update' || d.action === 'remove'
        ? (await prisma.documentTheme.findMany({ where: { themeId: d.id }, select: { documentId: true } })).map((x) => x.documentId)
        : []

    switch (d.action) {
      case 'create': {
        const theme = await createTheme({
          slug: slugify(d.slug || d.labelFr),
          labelFr: d.labelFr,
          labelEn: d.labelEn,
          labelHt: d.labelHt,
          parentId: d.parentId ?? null,
          color: d.color ?? null,
        })
        action = 'THEME_CREATED'
        meta = { id: theme.id, slug: theme.slug, labelFr: theme.labelFr }
        break
      }
      case 'update': {
        const theme = await updateTheme(d.id, {
          labelFr: d.labelFr,
          labelEn: d.labelEn,
          labelHt: d.labelHt,
          color: d.color,
          parentId: d.parentId,
          active: d.active,
        })
        action = d.active === false ? 'THEME_ARCHIVED' : 'THEME_UPDATED'
        meta = { id: d.id, slug: theme.slug }
        break
      }
      case 'remove': {
        await removeTheme(d.id, { hardDelete: d.hardDelete, reassignTo: d.reassignTo ?? null })
        action = d.hardDelete ? 'THEME_DELETED' : 'THEME_ARCHIVED'
        meta = { id: d.id, reassignTo: d.reassignTo ?? null }
        break
      }
      case 'reorder': {
        await reorderThemes(d.orderedIds)
        meta = { count: d.orderedIds.length }
        break
      }
    }

    await audit({ action, actorId: admin.id, targetType: 'THEME', ip: ctx.ip, userAgent: ctx.userAgent, meta })

    // Ré-indexation des documents impactés (themeLabels + searchText) — best-effort, ne bloque
    // pas la réponse en cas d'échec ponctuel. reorder n'affecte pas les libellés (aucun reindex).
    if (toReindex.length) {
      for (const docId of toReindex) await reindexDocument(docId).catch((e) => console.warn('reindex thème :', docId, e))
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof ThemeError) {
      const map = { slugExists: ['exists', 409], cycle: ['cycle', 400], hasChildren: ['hasChildren', 409], notFound: ['notFound', 404] } as const
      const [code, status] = map[e.code]
      return apiError(code, status)
    }
    console.error('POST /api/admin/themes :', e)
    return apiError('server', 500)
  }
}
