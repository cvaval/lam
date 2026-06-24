import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { canReadService } from '@/lib/access'
import type { DocType } from '@/lib/types'

export const runtime = 'nodejs'

const schema = z.object({ documentId: z.string().min(1), on: z.boolean() })

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)

  const { documentId, on } = parsed.data
  if (on) {
    // Contrôle d'accès §03 : on ne peut mettre en favori qu'un document d'un service lisible.
    // Sinon, un favori forgé ferait fuiter titre + type d'un contenu non accordé au tableau
    // de bord (audit). On vérifie aussi l'existence (404).
    const doc = await prisma.document.findUnique({ where: { id: documentId }, select: { type: true } })
    if (!doc) return apiError('notFound', 404)
    if (!canReadService(user, doc.type as DocType)) return apiError('forbidden', 403)
    try {
      await prisma.favorite.create({ data: { userId: user.id, documentId } })
    } catch (e) {
      // P2002 = déjà en favori (idempotent) ; toute autre erreur doit remonter, pas être avalée.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e
    }
  } else {
    await prisma.favorite.deleteMany({ where: { userId: user.id, documentId } })
  }
  return NextResponse.json({ ok: true, on })
}
