import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { audit } from '@/lib/auth/audit'
import { reindexDocument } from '@/lib/search/reindex'
import { uploadToBlob } from '@/lib/storage/blob'

export const runtime = 'nodejs'

/**
 * Marques de fabrique et de commerce (Master Admin §08) : saisie du nom de la marque +
 * téléversement de sa reproduction (image ou PDF) dans le Blob privé. Une marque = un
 * Document type MARQUE (titleFr = nom, holder = titulaire, imageUrl/sourcePdfUrl = fichier).
 */
const MAX_BYTES = 15 * 1024 * 1024 // 15 Mo

/** GET → liste des marques (les plus récentes d'abord). */
export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'MASTER_ADMIN') return apiError('unauthorized', 401)
  const marques = await prisma.document.findMany({
    where: { type: 'MARQUE' },
    select: { id: true, titleFr: true, holder: true, imageUrl: true, sourcePdfUrl: true, number: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ ok: true, marques })
}

/** POST (multipart) : { nom, holder?, number?, file } → crée la marque + téléverse le fichier. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'MASTER_ADMIN') return apiError('unauthorized', 401)

  const form = await req.formData().catch(() => null)
  if (!form) return apiError('invalidFields', 400)
  const nom = String(form.get('nom') ?? '').trim()
  const holder = String(form.get('holder') ?? '').trim() || null
  const number = String(form.get('number') ?? '').trim() || null
  const file = form.get('file')
  if (nom.length < 2) return apiError('invalidFields', 400)

  let imageUrl: string | null = null
  let sourcePdfUrl: string | null = null

  // ── Marque : document créé d'abord (id → nom de blob déterministe) ──
  const doc = await prisma.document.create({
    data: {
      type: 'MARQUE',
      status: 'PUBLIE',
      titleFr: nom,
      bodyOriginal: nom, // référence seule : le nom EST le contenu recherchable
      originalLang: 'fr',
      holder,
      number,
      source: 'MONITEUR',
      category: 'MARQUE',
      publishedById: user.id,
    },
  })

  if (file && typeof file === 'object' && 'arrayBuffer' in file) {
    const f = file as File
    const buf = Buffer.from(await f.arrayBuffer())
    if (buf.byteLength > MAX_BYTES) {
      await prisma.document.delete({ where: { id: doc.id } }).catch(() => {})
      return apiError('fileTooLarge', 413)
    }
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
    const isImage = f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name)
    if (!isPdf && !isImage) {
      await prisma.document.delete({ where: { id: doc.id } }).catch(() => {})
      return apiError('unsupportedFileType', 415)
    }
    const ext = isPdf ? 'pdf' : (f.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'png').toLowerCase()
    const url = await uploadToBlob(`marque/${doc.id}.${ext}`, buf, f.type || (isPdf ? 'application/pdf' : 'application/octet-stream'))
    if (isPdf) sourcePdfUrl = url
    else imageUrl = url
    await prisma.document.update({ where: { id: doc.id }, data: { imageUrl, sourcePdfUrl } })
  }

  await reindexDocument(doc.id)
  await audit({ action: 'DOC_PUBLISHED', actorId: user.id, targetType: 'Document', targetId: doc.id, meta: { type: 'MARQUE', nom, holder, hasFile: !!(imageUrl || sourcePdfUrl), via: 'marques-admin' } })

  return NextResponse.json({ ok: true, id: doc.id, nom, imageUrl, sourcePdfUrl })
}

/** DELETE ?id= → retire une marque (journal DOC_DELETED). */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'MASTER_ADMIN') return apiError('unauthorized', 401)
  const id = (req.nextUrl.searchParams.get('id') ?? '').trim()
  if (!id) return apiError('invalidFields', 400)
  const doc = await prisma.document.findUnique({ where: { id }, select: { id: true, type: true, titleFr: true } })
  if (!doc || doc.type !== 'MARQUE') return apiError('notFound', 404)
  await prisma.document.delete({ where: { id } })
  await audit({ action: 'DOC_DELETED', actorId: user.id, targetType: 'Document', targetId: id, meta: { type: 'MARQUE', titleFr: doc.titleFr, via: 'marques-admin' } })
  return NextResponse.json({ ok: true })
}
