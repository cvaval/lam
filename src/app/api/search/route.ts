import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth/session'
import { getClientCtx } from '@/lib/auth/request'
import { runSearch } from '@/lib/search'
import { PAGE_SIZE } from '@/lib/search/types'
import { consumeSearchQuota } from '@/lib/quota'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { can } from '@/lib/rbac'
import { TYPE_SLUGS, isDocType, isIndexCategory, type DocType, type DocStatus } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)

  // Anti-scraping : limitation de débit + alerte (§09).
  const ctx = getClientCtx(req)
  if (!(await guard({ action: 'search', subject: user.id, ...LIMITS.search }, { actorId: user.id, ip: ctx.ip }))) {
    return apiError('rate', 429)
  }

  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').slice(0, 300)

  // Quota mensuel (Sitwayen). N'est consommé que pour une vraie requête texte.
  if (q.trim()) {
    const quota = await consumeSearchQuota(user.id, user.role)
    if (!quota.allowed) return apiError('quota', 429)
  }

  const typeParam = sp.get('type')
  let types: DocType[] | undefined
  if (typeParam) {
    const resolved = TYPE_SLUGS[typeParam] ?? (isDocType(typeParam) ? (typeParam as DocType) : undefined)
    if (resolved) types = [resolved]
  }
  // Accès « Index seulement » : verrouille la recherche sur l'Index.
  if (user.indexOnly) types = ['INDEX']

  const fiscalYearRaw = sp.get('fiscalYear')
  const result = await runSearch(
    {
      q,
      locale: user.locale,
      types,
      status: (sp.get('status') as DocStatus) || undefined,
      juridiction: sp.get('juridiction') || undefined,
      matiere: sp.get('matiere') || undefined,
      fiscalYear: fiscalYearRaw ? Number(fiscalYearRaw) : undefined,
      niceClass: sp.get('niceClass') || undefined,
      category: isIndexCategory(sp.get('category') ?? '') ? sp.get('category')! : undefined,
      includeCompanies: can(user.role, 'index.companies'),
      page: Number(sp.get('page') ?? '1'),
      size: PAGE_SIZE,
    },
    user.id,
  )

  return NextResponse.json({ ok: true, ...result })
}
