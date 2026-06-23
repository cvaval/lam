import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdminApi } from '@/lib/auth/guard'
import { audit } from '@/lib/auth/audit'

export const runtime = 'nodejs'

// Tarif douanier : édition de la table dynamique (Master Admin uniquement). §08
const fields = z.object({
  code: z.string().trim().min(1).max(40),
  designation: z.string().trim().min(1).max(400),
  unite: z.string().trim().max(40).nullable().optional(),
  dd: z.string().trim().max(60).nullable().optional(),
  ddRef: z.string().trim().max(200).nullable().optional(),
  tca: z.string().trim().max(60).nullable().optional(),
  accises: z.string().trim().max(60).nullable().optional(),
  note: z.string().trim().max(400).nullable().optional(),
  chapter: z.string().trim().max(10).nullable().optional(),
  position: z.number().int().min(0).max(1_000_000).optional(),
})
type Fields = z.infer<typeof fields>

const norm = (v: string | null | undefined) => {
  const s = (v ?? '').trim()
  return s ? s : null
}
// Chapitre SH = 2 premiers chiffres du code (ex. « 0101.21.00 » → « 01 »).
const deriveChapter = (code: string) => (code.replace(/\D/g, '').slice(0, 2) || null)

function toData(d: Fields) {
  const code = d.code.trim()
  return {
    code,
    searchCode: code.replace(/\D/g, '') || null, // recherche par chiffres seuls
    designation: d.designation.trim(),
    unite: norm(d.unite),
    dd: norm(d.dd),
    ddRef: norm(d.ddRef),
    tca: norm(d.tca),
    accises: norm(d.accises),
    note: norm(d.note),
    chapter: norm(d.chapter) ?? deriveChapter(d.code),
    ...(d.position != null ? { position: d.position } : {}),
  }
}

// Créer une position tarifaire.
export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return apiError('forbidden', 403)
  const parsed = fields.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const row = await prisma.customsTariff.create({ data: toData(parsed.data) })
  await audit({ action: 'DOC_PUBLISHED', actorId: admin.id, targetType: 'TARIFF', targetId: row.id, meta: { op: 'create', code: row.code } })
  return NextResponse.json({ ok: true, row })
}

// Modifier une position tarifaire.
export async function PATCH(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return apiError('forbidden', 403)
  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : null
  const parsed = fields.safeParse(body)
  if (!id || !parsed.success) return apiError('invalidFields', 400)
  const exists = await prisma.customsTariff.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return apiError('notFound', 404)
  const row = await prisma.customsTariff.update({ where: { id }, data: toData(parsed.data) })
  await audit({ action: 'DOC_PUBLISHED', actorId: admin.id, targetType: 'TARIFF', targetId: id, meta: { op: 'update', code: row.code } })
  return NextResponse.json({ ok: true, row })
}

// Supprimer une position tarifaire.
export async function DELETE(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return apiError('forbidden', 403)
  const body = await req.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : null
  if (!id) return apiError('invalidFields', 400)
  const row = await prisma.customsTariff.findUnique({ where: { id }, select: { id: true, code: true } })
  if (!row) return apiError('notFound', 404)
  await prisma.customsTariff.delete({ where: { id } })
  await audit({ action: 'DOC_DELETED', actorId: admin.id, targetType: 'TARIFF', targetId: id, meta: { op: 'delete', code: row.code } })
  return NextResponse.json({ ok: true })
}
