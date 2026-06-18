import { NextRequest } from 'next/server'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { canReadService, canSeeSourcePdf } from '@/lib/access'
import { isBlobUrl, getPrivateBlob } from '@/lib/storage/blob'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import type { DocType } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * Sert le PDF original d'un document depuis le store Blob PRIVÉ, derrière le contrôle
 * d'accès du corpus : il faut une session, l'accès au service du document
 * (canReadService) ET le droit de voir le PDF source (canSeeSourcePdf) — exactement
 * la même règle que le lien « source » de la fiche. Le contenu est streamé ; l'URL
 * Blob privée n'est jamais exposée au navigateur.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)
  if (!(await guard({ action: 'doc', subject: user.id, ...LIMITS.doc }, { actorId: user.id }))) {
    return apiError('rate', 429)
  }

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: { type: true, number: true, sourcePdfUrl: true },
  })
  if (!doc || !doc.sourcePdfUrl) return apiError('notFound', 404)
  if (!canReadService(user, doc.type as DocType) || !canSeeSourcePdf(user)) return apiError('forbidden', 403)
  // Seuls les PDF migrés vers le Blob sont servables (les anciens chemins locaux ne le sont pas).
  if (!isBlobUrl(doc.sourcePdfUrl)) return apiError('notFound', 404)

  const blob = await getPrivateBlob(doc.sourcePdfUrl).catch(() => null)
  if (!blob || !blob.stream) return apiError('notFound', 404)

  const safe = (doc.number ?? 'document').replace(/[^\w.-]+/g, '_').slice(0, 80)
  return new Response(blob.stream, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${safe}.pdf"`,
      // Privé : cache navigateur uniquement, jamais partagé.
      'cache-control': 'private, max-age=3600',
    },
  })
}
