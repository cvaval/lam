import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { canReadService } from '@/lib/access'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import type { DocType } from '@/lib/types'
import { getCodeArticles, matchArticles, expandThemes } from '@/lib/legislation/code-search'

export const runtime = 'nodejs'

/**
 * Recherche dynamique dans un texte annoté (Code du travail) : renvoie les articles
 * applicables à `q`. Avec `ai=1`, étend la requête à des thèmes proches (Gemini ↔ Claude).
 * Accès filtré (§03) : le type du document doit être lisible par l'utilisateur.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)
  const docId = req.nextUrl.searchParams.get('docId') ?? ''
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 100).trim()
  let useAi = req.nextUrl.searchParams.get('ai') === '1'
  if (!docId || q.length < 2) return NextResponse.json({ ok: true, results: [], themes: [] })

  // Anti-abus (§09) : frein large sur la recherche, bucket SÉPARÉ et serré sur l'IA (coût
  // Gemini). Dépassement IA → on dégrade vers la recherche littérale plutôt que d'échouer.
  if (!(await guard({ action: 'code-search', subject: user.id, ...LIMITS.codeSearch }, { actorId: user.id })))
    return apiError('rate', 429)
  if (useAi && !(await guard({ action: 'code-search-ai', subject: user.id, ...LIMITS.codeSearchAi }, { actorId: user.id })))
    useAi = false

  const doc = await prisma.document.findUnique({ where: { id: docId }, select: { type: true } })
  if (!doc || !canReadService(user, doc.type as DocType)) return apiError('unauthorized', 403)

  const articles = await getCodeArticles(docId)
  const numQuery = /^\d{1,3}$/.test(q) ? Number(q) : null
  const baseTerms = q.split(/\s+/).filter((w) => w.length >= 2)
  const themes = useAi ? await expandThemes(q) : []
  const results = matchArticles(articles, [...baseTerms, ...themes], numQuery)

  return NextResponse.json({
    ok: true,
    themes,
    results: results.map((r) => ({ n: r.n, anchor: r.anchor, label: r.label, snippet: r.snippet })),
  })
}
