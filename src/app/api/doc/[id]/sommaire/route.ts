import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { canReadService } from '@/lib/access'
import { extractSommaire } from '@/lib/doc/sommaire'
import type { DocType } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * Aperçu (sommaire / table des matières) d'une édition du Moniteur, pour la
 * prévisualisation au clic sur un numéro (§07). Trois sources, par ordre de
 * préférence : sommaire présent dans le texte → entrées de l'Index du Moniteur de
 * cette édition (même numéro) → début du texte. Accès gardé par service.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: { type: true, number: true, bodyOriginal: true },
  })
  if (!doc) return apiError('notFound', 404)
  if (!canReadService(user, doc.type as DocType)) return apiError('forbidden', 403)

  // 1) Sommaire présent dans le texte (éditions récentes).
  const text = extractSommaire(doc.bodyOriginal)
  if (text) return NextResponse.json({ ok: true, source: 'text', text })

  // 2) Entrées de l'Index du Moniteur de cette édition (même numéro) = sommaire structuré.
  if (doc.number) {
    const items = await prisma.document.findMany({
      where: { type: 'INDEX', number: doc.number },
      select: { titleFr: true, category: true },
      take: 250,
      orderBy: { titleFr: 'asc' },
    })
    if (items.length) {
      return NextResponse.json({
        ok: true,
        source: 'index',
        items: items.map((i) => ({ title: i.titleFr.replace(/\s+/g, ' ').trim().slice(0, 220), category: i.category })),
      })
    }
  }

  // 3) Repli : début du texte officiel.
  const excerpt = (doc.bodyOriginal || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 900)
  return NextResponse.json({ ok: true, source: excerpt ? 'excerpt' : 'none', text: excerpt || null })
}
