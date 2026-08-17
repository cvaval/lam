import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth/session'
import { getClientCtx } from '@/lib/auth/request'
import { runSearch } from '@/lib/search'
import { PAGE_SIZE, parseYearRange, parseYearParam } from '@/lib/search/types'
import { consumeSearchQuota } from '@/lib/quota'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { can } from '@/lib/rbac'
import { accessibleTypes } from '@/lib/access'
import { corpusForSlug, corpusForType, isDocType, isIndexCategory, type DocType, type DocStatus } from '@/lib/types'

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

  // Services accessibles (l'Index toujours ; staff = tout). La recherche est TOUJOURS
  // bornée à ces types — un service non accordé ne doit jamais apparaître (§03).
  const allowed = accessibleTypes(user)
  const typeParam = sp.get('type')
  let types: DocType[]
  if (typeParam) {
    // Une rubrique ouvre sur tout le corpus qu'elle liste : « legislationannotee » =
    // législation + doctrine, et non la seule doctrine — 3 136 documents, pas 2.
    const resolved = corpusForSlug(typeParam) ?? (isDocType(typeParam) ? corpusForType(typeParam as DocType) : undefined)
    // INTERSECTION, jamais union : le corpus d'une rubrique RESTREINT les types accordés,
    // il n'en ouvre aucun. Type inconnu ou non accordé → repli sur tous les types
    // accordés (parité page/API), jamais au-delà de `allowed` (pas de fuite §03).
    const retenus = resolved?.filter((t) => allowed.includes(t)) ?? []
    types = retenus.length ? retenus : allowed
  } else {
    types = allowed
  }

  const fiscalYearRaw = sp.get('fiscalYear')
  // Période « entre l'année X et Y » (recherche avancée) — validation + remise en
  // ordre partagées avec la page (parseYearRange, source unique).
  const { yearFrom, yearTo } = parseYearRange(sp.get('yearFrom'), sp.get('yearTo'))
  const result = await runSearch(
    {
      q,
      locale: user.locale,
      types,
      status: (sp.get('status') as DocStatus) || undefined,
      noDate: sp.get('sansDate') === '1' || undefined,
      effYear: parseYearParam(sp.get('effYear')),
      noEffDate: sp.get('effSansDate') === '1' || undefined,
      juridiction: sp.get('juridiction') || undefined,
      matiere: sp.get('matiere') || undefined,
      // Critères propres aux décisions — mêmes bornes que la page de recherche.
      parties: sp.get('parties')?.trim().slice(0, 80) || undefined,
      domaine: sp.get('domaine')?.trim().slice(0, 60) || undefined,
      judge: sp.get('judge')?.trim().slice(0, 80) || undefined,
      mp: sp.get('mp')?.trim().slice(0, 80) || undefined,
      judgeId: sp.get('judgeId')?.trim().slice(0, 40) || undefined,
      judgeRole:
        (['PRESIDENCE', 'SIEGE', 'MINISTERE_PUBLIC', 'GREFFE'] as const).find((r) => r === sp.get('judgeRole')) ||
        undefined,
      fiscalYear: fiscalYearRaw ? Number(fiscalYearRaw) : undefined,
      yearFrom,
      yearTo,
      niceClass: sp.get('niceClass') || undefined,
      category: isIndexCategory(sp.get('category') ?? '') ? sp.get('category')! : undefined,
      includeCompanies: can(user.role, 'index.companies'),
      // Le tri voyage aussi par l'API : sans lui, une même URL rendait un ordre par la
      // page et un autre par la route — la seconde ignorait simplement le paramètre.
      sort:
        (['sig', 'eff', 'num-asc', 'num-desc', 'recent'] as const).find((x) => x === sp.get('sort')) || undefined,
      // Page bornée et sûre : un ?page non numérique ne doit pas propager NaN jusqu'à Prisma
      // (500 brut / contrat d'erreur rompu — constat d'audit §16).
      page: Math.max(1, Math.trunc(Number(sp.get('page'))) || 1),
      size: PAGE_SIZE,
    },
    user.id,
  )

  return NextResponse.json({ ok: true, ...result })
}
