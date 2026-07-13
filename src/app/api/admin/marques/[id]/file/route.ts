import { NextRequest } from 'next/server'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { isBlobUrl, getPrivateBlob } from '@/lib/storage/blob'

export const runtime = 'nodejs'

const CT: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
}

/** Sert la reproduction d'une marque (image ou PDF) depuis le Blob privé — Master Admin. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'MASTER_ADMIN') return apiError('unauthorized', 401)
  const doc = await prisma.document.findUnique({ where: { id: params.id }, select: { type: true, imageUrl: true, sourcePdfUrl: true } })
  if (!doc || doc.type !== 'MARQUE') return apiError('notFound', 404)
  const url = doc.imageUrl || doc.sourcePdfUrl
  if (!url || !isBlobUrl(url)) return apiError('notFound', 404)
  const blob = await getPrivateBlob(url).catch(() => null)
  if (!blob || !blob.stream) return apiError('notFound', 404)
  const ext = (url.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase()
  return new Response(blob.stream, {
    headers: { 'content-type': CT[ext] ?? 'application/octet-stream', 'cache-control': 'private, max-age=3600' },
  })
}
