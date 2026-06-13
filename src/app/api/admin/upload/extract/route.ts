import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { PDFParse } from 'pdf-parse'
import { getCurrentUser } from '@/lib/auth/session'
import { getClientCtx } from '@/lib/auth/request'
import { can } from '@/lib/rbac'
import { guard } from '@/lib/security/ratelimit'
import { extractDocument, isAiConfigured } from '@/lib/ai/extract'

export const runtime = 'nodejs'
export const maxDuration = 120 // l'analyse IA d'un scan peut prendre du temps

const MAX_PDF_BYTES = 30 * 1024 * 1024
const MAX_BODY_CHARS = 250_000

// Analyse d'un document téléversé — édition du Moniteur (numéro, type d'édition,
// date, titres des publications) ou circulaire BRH (numéro, date, objet, matière),
// détecté automatiquement (IA si configurée, heuristique sinon) + couche texte
// pour pré-remplir l'éditeur (orthographe corrigeable avant publication).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !can(user.role, 'upload.publish')) return apiError('forbidden', 403)

  // L'analyse IA est coûteuse : plafond dédié par compte.
  if (!(await guard({ action: 'extract', subject: user.id, limit: 10, windowMs: 60_000 }, { actorId: user.id, ip: getClientCtx(req).ip }))) {
    return apiError('rate', 429)
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return apiError('noFile', 400)
  if (file.size > MAX_PDF_BYTES) return apiError('tooLarge', 413)

  const bytes = new Uint8Array(await file.arrayBuffer())

  // Couche texte (peut être vide sur un pur scan — l'IA, elle, lit l'image).
  let fullText = ''
  let firstPageText = ''
  try {
    const parser = new PDFParse({ data: bytes })
    const result = await parser.getText()
    fullText = result.text.slice(0, MAX_BODY_CHARS)
    firstPageText = result.pages[0]?.text ?? ''
    await parser.destroy()
  } catch {
    /* PDF sans couche texte exploitable */
  }

  try {
    const outcome = await extractDocument(bytes, firstPageText)
    return NextResponse.json({
      ok: true,
      ...outcome,
      bodyText: fullText,
      textLayer: fullText.trim().length > 0,
    })
  } catch (e) {
    // L'IA a échoué (clé invalide, réseau…) : repli heuristique plutôt qu'un échec sec.
    const { heuristicExtract, toOutcome } = await import('@/lib/ai/extract')
    return NextResponse.json({
      ok: true,
      ...toOutcome(heuristicExtract(firstPageText), false),
      aiError: isAiConfigured() ? String((e as Error).message ?? e).slice(0, 200) : undefined,
      bodyText: fullText,
      textLayer: fullText.trim().length > 0,
    })
  }
}
