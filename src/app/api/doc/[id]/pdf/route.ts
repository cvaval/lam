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
 * d'accès du corpus. Règle : session + accès au service (canReadService). Le droit
 * « voir le PDF source » (canSeeSourcePdf) est exigé SAUF pour les circulaires BRH,
 * dont l'original est téléchargeable par tout lecteur de circulaires (le texte est
 * déjà entièrement lisible). `?download=1` force le téléchargement (attachment) ;
 * sinon affichage inline. L'URL Blob privée n'est jamais exposée au navigateur.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
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
  const type = doc.type as DocType
  if (!canReadService(user, type)) return apiError('forbidden', 403)
  if (type !== 'CIRCULAIRE_BRH' && !canSeeSourcePdf(user)) return apiError('forbidden', 403)
  // Seuls les PDF migrés vers le Blob sont servables (les anciens chemins locaux ne le sont pas).
  if (!isBlobUrl(doc.sourcePdfUrl)) return apiError('notFound', 404)

  const blob = await getPrivateBlob(doc.sourcePdfUrl).catch(() => null)
  if (!blob || !blob.stream) return apiError('notFound', 404)

  const safe = (doc.number ?? 'document').replace(/[^\w.-]+/g, '_').slice(0, 80)
  const disposition = req.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline'
  return new Response(blob.stream, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `${disposition}; filename="${safe}.pdf"`,
      // Privé : cache navigateur uniquement, jamais partagé.
      'cache-control': 'private, max-age=3600',
    },
  })
}
