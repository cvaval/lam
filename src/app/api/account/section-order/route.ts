import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { DOC_TYPES } from '@/lib/types'
import { serializeSectionOrder } from '@/lib/access'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'

export const runtime = 'nodejs'

// Ordre des onglets/rubriques choisi par l'utilisateur (glisser-déposer du tableau de bord).
// Persisté côté compte → suit l'utilisateur sur toute machine, séance après séance.
const schema = z.object({ order: z.array(z.enum(DOC_TYPES)).max(DOC_TYPES.length) })

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)
  await prisma.user.update({
    where: { id: user.id },
    data: { sectionOrder: serializeSectionOrder(parsed.data.order) },
  })
  return NextResponse.json({ ok: true })
}
