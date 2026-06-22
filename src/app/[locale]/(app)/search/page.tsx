import { Fragment } from 'react'
import Link from 'next/link'
import { ResultCard } from '@/components/ResultCard'
import { Pastille } from '@/components/TypeBadge'
import { ContextualFilters, qs, type SP } from '@/components/ContextualFilters'
import { prisma } from '@/lib/db'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { runSearch } from '@/lib/search'
import { PAGE_SIZE } from '@/lib/search/types'
import { consumeSearchQuota } from '@/lib/quota'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { RateLimitNotice } from '@/components/RateLimitNotice'
import { can } from '@/lib/rbac'
import { accessibleTypes, isIndexOnly } from '@/lib/access'
import { DOC_TYPE_LIST } from '@/lib/brand'
import { TYPE_SLUGS, isIndexCategory, type DocType, type DocStatus } from '@/lib/types'

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: SP
}) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)

  // Anti-scraping : limitation de débit (§09).
  if (!(await guard({ action: 'search', subject: user.id, ...LIMITS.search }, { actorId: user.id }))) {
    return <RateLimitNotice t={t} />
  }

  const q = (searchParams.q ?? '').slice(0, 300)
  const typeSlug = searchParams.type
  // Accès par service (§03) : la recherche est bornée aux types accordés (l'Index toujours).
  const allowed = accessibleTypes(user)
  const indexOnly = isIndexOnly(user)
  const requestedType = typeSlug ? TYPE_SLUGS[typeSlug] : undefined
  const selectedType = indexOnly
    ? ('INDEX' as DocType)
    : requestedType && allowed.includes(requestedType)
      ? requestedType
      : undefined
  const page = Math.max(1, Number(searchParams.page ?? '1') || 1)
  // Tri (navigation) : date de signature (défaut) / entrée en vigueur / numéro ↑↓.
  const sortParam = (['sig', 'eff', 'num-asc', 'num-desc'] as const).find((s) => s === searchParams.sort)

  // Quota mensuel (Sitwayen).
  let quotaBlocked = false
  if (q.trim()) {
    const quota = await consumeSearchQuota(user.id, user.role)
    quotaBlocked = !quota.allowed
  }

  const result = quotaBlocked
    ? { total: 0, hits: [], expandedTerms: [], provider: 'fts' as const }
    : await runSearch(
        {
          q,
          locale,
          // Sans type choisi : on cherche dans TOUS les types accordés (jamais au-delà).
          types: selectedType ? [selectedType] : allowed,
          status: (searchParams.status as DocStatus) || undefined,
          juridiction: searchParams.juridiction,
          matiere: searchParams.matiere,
          fiscalYear: searchParams.fiscalYear ? Number(searchParams.fiscalYear) : undefined,
          niceClass: searchParams.niceClass,
          category: searchParams.category && isIndexCategory(searchParams.category) ? searchParams.category : undefined,
          year: searchParams.year && /^\d{4}$/.test(searchParams.year) ? Number(searchParams.year) : undefined,
          num: searchParams.num?.trim().slice(0, 20) || undefined,
          includeCompanies: can(user.role, 'index.companies'),
          sort: sortParam,
          page,
          size: PAGE_SIZE,
        },
        user.id,
      )

  // Options des filtres contextuels dérivées des données (constat d'audit #33 :
  // les listes codées en dur dérivaient — exercices fiscaux arrêtés à 2024).
  let fiscalYears: string[] = []
  let niceClasses: string[] = []
  let brhYears: string[] = []
  if (selectedType === 'CIRCULAIRE_BRH') {
    const rows = await prisma.document.findMany({
      where: { type: 'CIRCULAIRE_BRH', publicationDate: { not: null } },
      select: { publicationDate: true },
    })
    brhYears = [...new Set(rows.map((r) => String(r.publicationDate!.getUTCFullYear())))].sort((a, b) => Number(b) - Number(a))
  }
  if (selectedType === 'LOI_FINANCES') {
    const rows = await prisma.document.findMany({
      where: { type: 'LOI_FINANCES', fiscalYear: { not: null } },
      select: { fiscalYear: true },
      distinct: ['fiscalYear'],
      orderBy: { fiscalYear: 'desc' },
    })
    fiscalYears = rows.map((r) => String(r.fiscalYear))
  } else if (selectedType === 'MARQUE') {
    const rows = await prisma.document.findMany({
      where: { type: 'MARQUE', niceClasses: { not: null } },
      select: { niceClasses: true },
      distinct: ['niceClasses'],
    })
    niceClasses = [...new Set(rows.flatMap((r) => (r.niceClasses ?? '').split(',').map((x) => x.trim()).filter(Boolean)))]
      .sort((a, b) => Number(a) - Number(b))
  }

  const baseParams: SP = { q, type: typeSlug, num: searchParams.num, year: searchParams.year, sort: searchParams.sort }
  const totalPages = Math.ceil(result.total / PAGE_SIZE)

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-lank/55">
          {result.total} {t.search.results} {q && <>· {t.search.resultsFor} « {q} »</>}
        </p>
        <p className="mt-0.5 text-xs text-lank/35">{t.search.translingualNote}</p>
      </div>

      {/* Filtres par type (navigation par couleur §01) */}
      {indexOnly ? (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-endeks px-3 py-1 text-xs font-medium text-white">
          <Pastille type="INDEX" /> {t.search.indexOnlyBadge}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${locale}/search?${qs(baseParams, { type: undefined, status: undefined, juridiction: undefined, matiere: undefined, fiscalYear: undefined, niceClass: undefined, category: undefined, num: undefined, year: undefined })}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              !selectedType ? 'border-lank bg-lank text-white' : 'border-lank/15 bg-white text-lank/70 hover:border-lank/40'
            }`}
          >
            {t.search.allTypes}
          </Link>
          {DOC_TYPE_LIST.filter((m) => allowed.includes(m.type)).map((m) => (
            <Link
              key={m.type}
              href={`/${locale}/search?${qs({ q }, { type: m.slug })}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                selectedType === m.type ? 'border-lank bg-lank text-white' : 'border-lank/15 bg-white text-lank/70 hover:border-lank/40'
              }`}
            >
              <Pastille type={m.type as DocType} />
              {m.badge}
            </Link>
          ))}
        </div>
      )}

      {/* Filtres contextuels du type sélectionné (y compris pour l'accès Index seul) */}
      {selectedType && (
        <ContextualFilters type={selectedType} locale={locale} base={baseParams} active={searchParams} t={t} fiscalYears={fiscalYears} niceClasses={niceClasses} brhYears={brhYears} />
      )}

      {quotaBlocked && (
        <div className="rounded-2xl border border-soley/40 bg-soley-50 p-5 text-sm text-lank">{t.errors.quota}</div>
      )}

      {!quotaBlocked && result.hits.length === 0 && (
        <div className="rounded-2xl border border-lank/10 bg-white p-10 text-center text-lank/45">{t.search.noResults}</div>
      )}

      <div className="grid gap-3">
        {result.hits.map((h, i) => {
          const showFuzzyDivider = h.fuzzy && !result.hits[i - 1]?.fuzzy
          return (
            <Fragment key={`${h.kind}-${h.id}`}>
              {showFuzzyDivider && (
                <div className="flex items-center gap-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-endeks-700">
                  <span className="h-px flex-1 bg-endeks/30" />≈ {t.search.fuzzySection}
                  <span className="h-px flex-1 bg-endeks/30" />
                </div>
              )}
              <ResultCard hit={h} locale={locale} t={t} q={q} />
            </Fragment>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2 text-sm">
          {page > 1 && (
            <Link
              href={`/${locale}/search?${qs(searchParams, { page: String(page - 1) })}`}
              className="rounded-lg border border-lank/15 bg-white px-3 py-1.5 text-lank"
            >
              ←
            </Link>
          )}
          <span className="text-lank/50">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/${locale}/search?${qs(searchParams, { page: String(page + 1) })}`}
              className="rounded-lg border border-lank/15 bg-white px-3 py-1.5 text-lank"
            >
              →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
