import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { apiError } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth/session'
import { can } from '@/lib/rbac'
import { uploadToBlob } from '@/lib/storage/blob'
import { wordToHtmlVersion } from '@/lib/doc/word'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BYTES = 80 * 1024 * 1024 // 80 Mo

/**
 * Téléversement d'une pièce pour le studio de publication :
 *  - kind=pdf  → stocke le PDF original dans le Blob privé, renvoie { sourcePdfUrl }
 *  - kind=word → convertit le .docx en « version HTML » : renvoie { bodyClean, richBlocks }
 * L'admin relit/édite ensuite avant de publier (POST /api/admin/upload).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !can(user.role, 'upload.publish')) return apiError('forbidden', 403)

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const kind = String(form?.get('kind') ?? '')
  if (!(file instanceof Blob) || (kind !== 'pdf' && kind !== 'word')) return apiError('invalidFields', 400)
  if (file.size > MAX_BYTES) return apiError('tooLarge', 413)

  const buf = Buffer.from(await file.arrayBuffer())

  if (kind === 'pdf') {
    if (!buf.subarray(0, 5).toString('latin1').startsWith('%PDF')) return apiError('notPdf', 400)
    try {
      const url = await uploadToBlob(`source-pdf/uploads/${randomUUID()}.pdf`, buf, 'application/pdf', {
        multipart: buf.length > 20_000_000,
      })
      return NextResponse.json({ ok: true, kind: 'pdf', sourcePdfUrl: url })
    } catch (e) {
      console.error('upload PDF → Blob échec :', e)
      return apiError('blobUpload', 502)
    }
  }

  // kind === 'word' : .docx (zip → commence par « PK »)
  if (buf.subarray(0, 2).toString('latin1') !== 'PK') return apiError('notDocx', 400)
  try {
    const { bodyClean, richBlocks, warnings } = await wordToHtmlVersion(buf)
    if (!bodyClean.trim()) return apiError('emptyDoc', 400)
    return NextResponse.json({
      ok: true,
      kind: 'word',
      bodyClean,
      richBlocksJson: richBlocks.length ? JSON.stringify(richBlocks) : null,
      tableCount: richBlocks.filter((b) => b.type === 'table').length,
      warnings,
    })
  } catch (e) {
    console.error('word→html échec :', e)
    return apiError('wordParse', 422)
  }
}
