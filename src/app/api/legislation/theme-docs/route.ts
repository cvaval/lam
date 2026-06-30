import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth/session'
import { documentsInTheme } from '@/lib/legislation/themes'

export const runtime = 'nodejs'

/** Textes rattachés à un thème (sous-arbre compris), filtrés par accès §03. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)
  const themeId = req.nextUrl.searchParams.get('themeId') ?? ''
  if (!themeId) return apiError('invalidFields', 400)

  const docs = await documentsInTheme(themeId, user, { take: 300 })
  return NextResponse.json({
    ok: true,
    docs: docs.map((d) => ({ id: d.id, type: d.type, titleFr: d.titleFr, titleEn: d.titleEn, titleHt: d.titleHt, number: d.number, status: d.status })),
  })
}
