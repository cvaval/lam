import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { getClientCtx } from '@/lib/auth/request'
import { canReadService } from '@/lib/access'
import { guard } from '@/lib/security/ratelimit'
import { extractSommaire } from '@/lib/doc/sommaire'
import { ocrSommaire } from '@/lib/ai/extract'
import { isAiConfigured } from '@/lib/ai/provider'
import { isBlobUrl, getPrivateBlob } from '@/lib/storage/blob'
import type { DocType } from '@/lib/types'

export const runtime = 'nodejs'
// L'OCR à la demande de la 1re page d'un scan peut prendre quelques secondes.
export const maxDuration = 60

// Un fascicule non encore océrisé porte un corps « marque-page » (~170 c) au lieu du
// texte. On ne déclenche l'OCR que dans ce cas (corps trop court ou mention explicite).
function needsOcr(body: string | null): boolean {
  const b = body || ''
  return b.length < 400 || /non encore océrisé|fascicule scanné|sans couche texte/i.test(b)
}

/**
 * Aperçu (sommaire / table des matières) d'une édition du Moniteur, pour la
 * prévisualisation au clic sur un numéro (§07). Sources, par ordre de préférence :
 *  1. sommaire présent dans le texte officiel (éditions déjà océrisées) ;
 *  2. entrées de l'Index du Moniteur de cette édition (même numéro) ;
 *  3. OCR forcé de la 1re page du PDF original (éditions scannées non océrisées) —
 *     mis en cache (Document.sommaireOcr) pour ne l'exécuter qu'une fois ;
 *  4. repli : début du texte.
 * Accès gardé par service ; bodyOriginal n'est jamais modifié (§02).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: { type: true, number: true, bodyOriginal: true, sourcePdfUrl: true, sommaireOcr: true },
  })
  if (!doc) return apiError('notFound', 404)
  if (!canReadService(user, doc.type as DocType)) return apiError('forbidden', 403)

  // 1) Sommaire présent dans le texte officiel (éditions déjà océrisées).
  const fromText = extractSommaire(doc.bodyOriginal)
  if (fromText) return NextResponse.json({ ok: true, source: 'text', text: fromText })

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

  // 3) OCR forcé de la 1re page du scan original (cache Document.sommaireOcr).
  let ocrText = doc.sommaireOcr
  if (!ocrText && needsOcr(doc.bodyOriginal) && isBlobUrl(doc.sourcePdfUrl) && isAiConfigured()) {
    // Garde-fou anti-abus : l'OCR IA est coûteux. En cas de dépassement, on n'échoue
    // pas l'aperçu — on bascule sur le repli (extrait) ci-dessous.
    const allowed = await guard(
      { action: 'ocr-sommaire', subject: user.id, limit: 12, windowMs: 60_000 },
      { actorId: user.id, ip: getClientCtx(req).ip },
    )
    if (allowed) {
      try {
        const blob = await getPrivateBlob(doc.sourcePdfUrl!).catch(() => null)
        if (blob?.stream) {
          const bytes = new Uint8Array(await new Response(blob.stream).arrayBuffer())
          const raw = (await ocrSommaire(bytes)).trim()
          if (raw) {
            ocrText = raw
            // Cache (affichage seulement) — idempotent, bodyOriginal intact (§02).
            await prisma.document.update({ where: { id: params.id }, data: { sommaireOcr: raw } }).catch(() => {})
          }
        }
      } catch {
        // OCR indisponible / PDF illisible → repli silencieux.
      }
    }
  }
  if (ocrText) {
    const som = extractSommaire(ocrText)
    if (som) return NextResponse.json({ ok: true, source: 'text', text: som })
    const excerpt = ocrText.replace(/\n{3,}/g, '\n\n').trim().slice(0, 1500)
    if (excerpt) return NextResponse.json({ ok: true, source: 'ocr', text: excerpt })
  }

  // 4) Repli : début du texte officiel (corps réel, sinon marque-page).
  const excerpt = (doc.bodyOriginal || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 900)
  return NextResponse.json({ ok: true, source: excerpt ? 'excerpt' : 'none', text: excerpt || null })
}
