import { Fragment } from 'react'
import Link from 'next/link'
import { ResultCard } from '@/components/ResultCard'
import { Pastille } from '@/components/TypeBadge'
import { ContextualFilters, qs, type SP } from '@/components/ContextualFilters'
import { AlertButton } from '@/components/AlertButton'
import { QuotaChip } from '@/components/QuotaChip'
import { AdvancedSearch } from '@/components/AdvancedSearch'
import { prisma } from '@/lib/db'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { runSearch } from '@/lib/search'
import { PAGE_SIZE, parseYearParam, parseYearRange } from '@/lib/search/types'
import { consumeSearchQuota, remainingQuota } from '@/lib/quota'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { RateLimitNotice } from '@/components/RateLimitNotice'
import { can } from '@/lib/rbac'
import { accessibleTypes, isIndexOnly } from '@/lib/access'
import { DOC_TYPE_LIST, DOC_TYPE_META } from '@/lib/brand'
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

  // ?q peut arriver en tableau (lien forgé « ?q=a&q=b ») malgré le type SP : normaliser.
  const rawQ = Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q
  const q = (rawQ ?? '').slice(0, 300)
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
  const sortParam = (['sig', 'eff', 'num-asc', 'num-desc', 'recent'] as const).find((s) => s === searchParams.sort)
  // Critères propres aux DÉCISIONS. Bornés en longueur : ce sont des noms, pas des textes.
  const critere = (v: string | undefined, max = 80) => v?.trim().slice(0, max) || undefined
  const parties = critere(searchParams.parties)
  const domaine = critere(searchParams.domaine)
  const magistrat = critere(searchParams.judge)
  const ministerePublic = critere(searchParams.mp)
  const judgeId = critere(searchParams.judgeId, 40)
  const judgeRole = (['PRESIDENCE', 'SIEGE', 'MINISTERE_PUBLIC', 'GREFFE'] as const).find(
    (r) => r === searchParams.judgeRole,
  )
  // Slug CANONIQUE du type courant : un alias (« brh », « moniteur », « 3 »…)
  // dans l'URL doit redonner l'option correspondante du panneau avancé — sinon
  // le <select> retomberait sur « Tous les types » et perdrait le filtre.
  const canonicalSlug = selectedType ? DOC_TYPE_META[selectedType].slug : undefined

  // Recherche avancée : période « entre l'année X et Y » (validation + remise en
  // ordre partagées avec la route API — parseYearRange, source unique).
  const { yearFrom, yearTo } = parseYearRange(searchParams.yearFrom, searchParams.yearTo)
  // Le panneau s'ouvre via ?adv=1, dès qu'une borne est active, ou quand un
  // critère SANS interface visible pour le type courant est actif (statut hors
  // Législation, numéro hors BRH) — aucun filtre ne doit agir invisiblement.
  const advOpen =
    searchParams.adv === '1' ||
    !!parties || !!domaine || !!magistrat || !!ministerePublic ||
    yearFrom != null ||
    yearTo != null ||
    (!!searchParams.status && selectedType !== 'LEGISLATION') ||
    (!!searchParams.num && selectedType !== 'CIRCULAIRE_BRH')
  const hasAdvancedCriteria =
    yearFrom != null || yearTo != null || !!searchParams.status || !!searchParams.num ||
    !!parties || !!domaine || !!magistrat || !!ministerePublic

  // Quota mensuel (Sitwayen). `quotaRemaining` reflète la consommation de CETTE
  // requête (le user chargé par requireUser est un instantané pré-recherche —
  // sans cela, la puce afficherait « 1 restante » quand il en reste 0).
  let quotaBlocked = false
  let quotaRemaining = remainingQuota(user.monthlyQuota, user.quotaUsed)
  if (q.trim()) {
    const quota = await consumeSearchQuota(user.id, user.role)
    quotaBlocked = !quota.allowed
    quotaRemaining = quota.remaining
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
          year: parseYearParam(searchParams.year),
          // Puce « sans date » : exclusive de toute année (les liens l'assurent côté UI,
          // et l'année a de toute façon la précédence si les deux arrivaient ensemble).
          noDate: searchParams.sansDate === '1' && !searchParams.year ? true : undefined,
          // Axe ENTRÉE EN VIGUEUR — cumulable avec l'axe signature.
          effYear: parseYearParam(searchParams.effYear),
          noEffDate: searchParams.effSansDate === '1' && !searchParams.effYear ? true : undefined,
          yearFrom,
          yearTo,
          num: searchParams.num?.trim().slice(0, 20) || undefined,
          parties,
          domaine,
          judge: magistrat,
          mp: ministerePublic,
          judgeId,
          judgeRole,
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
  let brhSansDate = 0
  let brhEffYears: string[] = []
  let brhEffSansDate = 0
  if (selectedType === 'CIRCULAIRE_BRH') {
    const rows = await prisma.document.findMany({
      where: { type: 'CIRCULAIRE_BRH', publicationDate: { not: null } },
      select: { publicationDate: true },
    })
    brhYears = [...new Set(rows.map((r) => String(r.publicationDate!.getUTCFullYear())))].sort((a, b) => Number(b) - Number(a))
    // ⚠️ Les fiches SANS date ne tombent sous aucune puce d'année : sans cette puce-ci,
    // aucun filtre ne les ramène. On n'affiche la puce que s'il y en a — un filtre qui
    // ne rend jamais rien vaut moins que pas de filtre.
    brhSansDate = await prisma.document.count({ where: { type: 'CIRCULAIRE_BRH', publicationDate: null } })
    // Axe ENTRÉE EN VIGUEUR : mêmes règles — les années viennent des données, et les
    // fiches sans date d'effet ont leur propre puce, sans quoi 88 des 141 circulaires
    // seraient hors de cet axe.
    const eff = await prisma.document.findMany({
      where: { type: 'CIRCULAIRE_BRH', effectiveDate: { not: null } },
      select: { effectiveDate: true },
    })
    brhEffYears = [...new Set(eff.map((r) => String(r.effectiveDate!.getUTCFullYear())))].sort((a, b) => Number(b) - Number(a))
    brhEffSansDate = await prisma.document.count({ where: { type: 'CIRCULAIRE_BRH', effectiveDate: null } })
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

  // Critères conservés quand on navigue entre types/filtres/pages. Valeurs
  // NORMALISÉES (slug canonique, bornes d'années validées et remises dans
  // l'ordre) : les liens régénérés et le panneau avancé restent cohérents.
  // Renvoi d'abrogation dans les LISTES : la pastille « Abrogée » ne disait pas PAR QUOI.
  // Résolu ici, côté serveur, en une requête pour la page affichée — plutôt que d'ajouter
  // le champ aux deux moteurs de recherche (et de réindexer tout le corpus pour cela).
  const abrogatedIds = result.hits.filter((h) => h.kind === 'document' && h.status === 'ABROGE').map((h) => h.id)
  const abrogatedBy = new Map<string, string>()
  if (abrogatedIds.length) {
    const rows = await prisma.document.findMany({
      where: { id: { in: abrogatedIds }, abrogatedByNumber: { not: null } },
      select: { id: true, abrogatedByNumber: true },
    })
    for (const r of rows) abrogatedBy.set(r.id, r.abrogatedByNumber!)
  }

  const baseParams: SP = {
    q,
    type: canonicalSlug,
    num: searchParams.num,
    year: searchParams.year,
    sansDate: searchParams.sansDate,
    effYear: searchParams.effYear,
    effSansDate: searchParams.effSansDate,
    sort: searchParams.sort,
    yearFrom: yearFrom?.toString(),
    yearTo: yearTo?.toString(),
    status: searchParams.status,
    parties,
    domaine,
    judge: magistrat,
    mp: ministerePublic,
    judgeId,
    judgeRole,
  }
  const totalPages = Math.ceil(result.total / PAGE_SIZE)

  // Retour vers l'accueil de la section quand la recherche est filtrée sur un type qui
  // en possède une (ex. « Législation annotée » → /legislationannotee, « Éditions Le
  // Moniteur » → /editionsmoniteur).
  const landingSlug = selectedType
    ? ({ DOCTRINE: 'legislationannotee', LEGISLATION: 'editionsmoniteur', TARIF_DOUANIER: 'tarifs' } as Partial<Record<DocType, string>>)[selectedType]
    : undefined

  return (
    <div className="space-y-5">
      {landingSlug && selectedType && (
        <Link href={`/${locale}/${landingSlug}`} className="inline-flex items-center gap-1 text-sm font-medium text-chabon hover:underline">
          ← {DOC_TYPE_META[selectedType].label[locale]}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-ank/80">
            {result.total} {t.search.results} {q && <>· {t.search.resultsFor} « {q} »</>}
          </p>
          <p className="mt-0.5 text-xs text-ank/80">{t.search.translingualNote}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Quota Sitwayen proactif + alerte de veille sur la recherche courante */}
          <QuotaChip locale={locale} monthlyQuota={user.monthlyQuota} remaining={quotaRemaining} t={t} />
          {/* Une alerte ne mémorise que requête + section (v1) : masquée quand des
              critères avancés (période/statut/n°) sont actifs — pas de perte silencieuse. */}
          {q.trim() && !quotaBlocked && !hasAdvancedCriteria && can(user.role, 'alerts') && (
            <AlertButton q={q} type={selectedType} locale={locale} t={t} />
          )}
        </div>
      </div>

      {/* Recherche avancée : section + période + numéro + statut (§07) */}
      <AdvancedSearch
        locale={locale}
        t={t}
        allowed={allowed}
        values={{
          q,
          type: canonicalSlug,
          yearFrom: yearFrom?.toString(),
          yearTo: yearTo?.toString(),
          num: searchParams.num,
          status: searchParams.status,
          parties,
          domaine,
          judge: magistrat,
          mp: ministerePublic,
        }}
        open={advOpen}
      />

      {/* Filtres par type (navigation par couleur §01) */}
      {indexOnly ? (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-chabon px-3 py-1 text-xs font-medium text-white">
          <Pastille type="INDEX" /> {t.search.indexOnlyBadge}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${locale}/search?${qs(baseParams, { type: undefined, status: undefined, juridiction: undefined, matiere: undefined, fiscalYear: undefined, niceClass: undefined, category: undefined, num: undefined, year: undefined, sansDate: undefined, effYear: undefined, effSansDate: undefined, yearFrom: undefined, yearTo: undefined })}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              !selectedType ? 'border-liy bg-chabon text-white' : 'border-chabon/15 bg-white text-ank/70 hover:border-chabon/40'
            }`}
          >
            {t.search.allTypes}
          </Link>
          {/* Changer de section conserve les critères transverses (période,
              statut, n°) — c'est la promesse du panneau avancé. */}
          {DOC_TYPE_LIST.filter((m) => allowed.includes(m.type)).map((m) => (
            <Link
              key={m.type}
              href={`/${locale}/search?${qs(baseParams, { type: m.slug })}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                selectedType === m.type ? 'border-liy bg-chabon text-white' : 'border-chabon/15 bg-white text-ank/70 hover:border-chabon/40'
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
        <ContextualFilters type={selectedType} locale={locale} base={baseParams} active={searchParams} t={t} fiscalYears={fiscalYears} niceClasses={niceClasses} brhYears={brhYears} brhSansDate={brhSansDate} brhEffYears={brhEffYears} brhEffSansDate={brhEffSansDate} />
      )}

      {quotaBlocked && (
        <div className="rounded-2xl border border-chabon/40 bg-pil p-5 text-sm text-ank">{t.errors.quota}</div>
      )}

      {!quotaBlocked && result.hits.length === 0 && (
        <div className="rounded-2xl border border-chabon/10 bg-white p-10 text-center text-ank/80">{t.search.noResults}</div>
      )}

      <div className="grid gap-3">
        {result.hits.map((h, i) => {
          const showFuzzyDivider = h.fuzzy && !result.hits[i - 1]?.fuzzy
          return (
            <Fragment key={`${h.kind}-${h.id}`}>
              {showFuzzyDivider && (
                <div className="flex items-center gap-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-chabon">
                  <span className="h-px flex-1 bg-chabon/30" />≈ {t.search.fuzzySection}
                  <span className="h-px flex-1 bg-chabon/30" />
                </div>
              )}
              <ResultCard hit={h} locale={locale} t={t} q={q} abrogatedByNumber={abrogatedBy.get(h.id)} />
            </Fragment>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2 text-sm">
          {page > 1 && (
            <Link
              href={`/${locale}/search?${qs(searchParams, { page: String(page - 1) })}`}
              className="rounded-lg border border-chabon/15 bg-white px-3 py-1.5 text-ank"
            >
              ←
            </Link>
          )}
          <span className="text-ank/80">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/${locale}/search?${qs(searchParams, { page: String(page + 1) })}`}
              className="rounded-lg border border-chabon/15 bg-white px-3 py-1.5 text-ank"
            >
              →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
