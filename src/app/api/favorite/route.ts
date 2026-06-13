import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'

export const runtime = 'nodejs'

const schema = z.object({ documentId: z.string().min(1), on: z.boolean() })

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)

  const { documentId, on } = parsed.data
  if (on) {
    await prisma.favorite
      .create({ data: { userId: user.id, documentId } })
      .catch(() => {}) // déjà en favori
  } else {
    await prisma.favorite.deleteMany({ where: { userId: user.id, documentId } })
  }
  return NextResponse.json({ ok: true, on })
}
