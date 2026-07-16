import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { can } from '@/lib/rbac'

export const runtime = 'nodejs'

// Gestion d'une alerte de veille : pause/reprise (PATCH) et suppression (DELETE).
// La propriété est vérifiée par le `where { id, userId }` — pas de fuite entre comptes.

const patchSchema = z.object({ active: z.boolean() })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user || !can(user.role, 'alerts')) return apiError('forbidden', 403)
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const res = await prisma.alert.updateMany({
    where: { id: params.id, userId: user.id },
    data: { active: parsed.data.active },
  })
  if (res.count === 0) return apiError('notFound', 404)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user || !can(user.role, 'alerts')) return apiError('forbidden', 403)
  const res = await prisma.alert.deleteMany({ where: { id: params.id, userId: user.id } })
  if (res.count === 0) return apiError('notFound', 404)
  return NextResponse.json({ ok: true })
}
