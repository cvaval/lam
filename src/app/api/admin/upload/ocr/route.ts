import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth/session'
import { getClientCtx } from '@/lib/auth/request'
import { can } from '@/lib/rbac'
import { guard } from '@/lib/security/ratelimit'
import { ocrDocument, isAiConfigured } from '@/lib/ai/extract'

export const runtime = 'nodejs'
export const maxDuration = 300 // l'OCR intégral d'un scan de plusieurs pages est long

const MAX_PDF_BYTES = 30 * 1024 * 1024

// Reconnaissance de texte (OCR) d'un PDF numérisé sans couche texte exploitable —
// transcription intégrale via Claude (vision PDF). Renvoie le texte pour
// pré-remplir l'éditeur du studio avant publication.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !can(user.role, 'upload.publish')) return apiError('forbidden', 403)
  if (!isAiConfigured()) return apiError('aiUnavailable', 503)

  // L'OCR IA est coûteux : plafond dédié, plus strict que l'analyse.
  if (!(await guard({ action: 'ocr', subject: user.id, limit: 5, windowMs: 60_000 }, { actorId: user.id, ip: getClientCtx(req).ip }))) {
    return apiError('rate', 429)
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return apiError('noFile', 400)
  if (file.size > MAX_PDF_BYTES) return apiError('tooLarge', 413)

  try {
    const { text, pages, truncated } = await ocrDocument(new Uint8Array(await file.arrayBuffer()))
    return NextResponse.json({ ok: true, text, pages, truncated })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message ?? e).slice(0, 200) }, { status: 502 })
  }
}
