import './dashboard.css'
import Link from 'next/link'
import { SearchBox } from '@/components/SearchBox'
import { Pastille, TypeBadge } from '@/components/TypeBadge'
import { SectionTiles, type SectionTile } from '@/components/SectionTiles'
import { QuotaChip } from '@/components/QuotaChip'
import { remainingQuota } from '@/lib/quota'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { DOC_TYPE_LIST } from '@/lib/brand'
import { accessibleTypes, orderTypes } from '@/lib/access'
import type { DocType } from '@/lib/types'

// Écran 3 — Tableau de bord : accès rapides + Nouveauté (§07). Mise en forme propre au tableau
// de bord dans dashboard.css (classes `ag-dashboard*`, pied de page et frise via
// `body:has(.ag-dashboard)`) : aucun autre écran n'est touché.
export default async function DashboardPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)

  const fifteenDaysAgo = new Date(Date.now() - 15 * 86400_000)
  // Accès par service (§03) : on ne montre que les types accordés (l'Index toujours).
  const allowed = accessibleTypes(user)
  const newWhere = { createdAt: { gte: fifteenDaysAgo }, type: { in: allowed } }

  const [recent, favorites, newCount, newDocs, newByTypeRaw] = await Promise.all([
    prisma.searchLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      distinct: ['query'],
      take: 6,
    }),
    prisma.favorite.findMany({
      // Défense en profondeur (§03) : ne jamais afficher un favori d'un service non accordé
      // (titre/type) même si la création a contourné le contrôle (cf. /api/favorite).
      where: { userId: user.id, document: { type: { in: allowed } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { document: true },
    }),
    prisma.document.count({ where: newWhere }),
    prisma.document.findMany({ where: newWhere, orderBy: { createdAt: 'desc' }, take: 8 }),
    // Nouveautés par rubrique (même fenêtre de 15 jours) → tag sur les tuiles.
    prisma.document.groupBy({ by: ['type'], where: newWhere, _count: { _all: true } }),
  ])
  const newByType = new Map(newByTypeRaw.map((g) => [g.type, g._count._all]))

  // Tuiles d'accès : services accordés + l'Index (toujours), dans l'ORDRE choisi par
  // l'utilisateur (glisser-déposer, persisté côté compte) ; nouveaux onglets à la fin.
  const metaByType = new Map(DOC_TYPE_LIST.map((m) => [m.type, m]))
  const tiles: SectionTile[] = orderTypes(
    DOC_TYPE_LIST.filter((m) => allowed.includes(m.type)).map((m) => m.type),
    user.sectionOrder,
  ).map((type) => {
    const m = metaByType.get(type)!
    return {
      type,
      slug: m.slug,
      num: m.num,
      label: m.label[locale],
      feature: m.feature[locale],
      newCount: newByType.get(type) ?? 0,
    }
  })

  return (
    <div className="ag-dashboard space-y-8">
      <div className="ag-dashboard-hero">
        <p className="text-sm text-ank/80">
          {t.dashboard.greeting}
          {user.name ? `, ${user.name.split(' ')[0]}` : ''}.
        </p>
        <h1>{t.dashboard.workspaceTitle}</h1>
        <p className="ag-dashboard-subtitle">{t.dashboard.workspaceSub}</p>
        <div className="ag-dashboard-search mt-3">
          <SearchBox locale={locale} placeholder={t.dashboard.searchPlaceholder} advancedLabel={t.search.advanced} size="lg" />
        </div>
        {/* Quota Sitwayen : visible AVANT d'atteindre le mur (audit UX 15 juil.).
            La puce ne rend rien pour les paliers illimités. */}
        <div className="mt-3">
          <QuotaChip locale={locale} monthlyQuota={user.monthlyQuota} remaining={remainingQuota(user.monthlyQuota, user.quotaUsed)} t={t} />
        </div>
      </div>

      <section className="ag-dashboard-collections">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ank/80">{t.dashboard.quickAccess}</h2>
          <span className="text-[11px] text-ank/80">{t.dashboard.reorderTip}</span>
        </div>
        <SectionTiles
          tiles={tiles}
          locale={locale}
          labels={{
            whatsNew: t.dashboard.whatsNew,
            newEntries: t.dashboard.newEntries,
            reorderHint: t.dashboard.reorderHint,
            moved: t.dashboard.reorderMoved,
            position: t.dashboard.reorderPosition,
            of: t.dashboard.reorderOf,
            saveError: t.dashboard.reorderSaveError,
          }}
        />
      </section>

      {/* Outils — hors des tuiles de corpus : `User.sectionOrder` / `orderTypes` ne
          concernent que les TYPES de documents, et le calculateur n'en est pas un (§ 6.4).
          La carte entière est UN lien ; « Calculer une échéance » n'est qu'une présentation
          (span), jamais un bouton dans un lien. L'icône est décorative. */}
      <section className="ag-dashboard-tools">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ank/80">{t.delais.toolsTitle}</h2>
        <Link href={`/${locale}/outils/delais`} className="ag-deadline-card">
          <span className="ag-deadline-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-12 4 2 2 4-4"/></svg>
          </span>
          <span className="ag-deadline-copy">
            <span className="ag-deadline-title">{t.delais.navLabel}</span>
            <span className="ag-deadline-description">{t.delais.dashboardCardDescription}</span>
            <span className="ag-deadline-detail">{t.delais.dashboardCardDetail}</span>
          </span>
          <span className="ag-deadline-action">{t.delais.dashboardCardAction}<span aria-hidden="true"> →</span></span>
        </Link>
      </section>

      {/* Nouveauté — données importées ces 15 derniers jours */}
      {newCount > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ank">
                <span className="inline-flex h-5 items-center rounded-full bg-chabon px-2 text-[10px] font-bold uppercase tracking-wide text-koton">
                  {t.dashboard.whatsNew}
                </span>
                <span className="text-ank/80">
                  {newCount.toLocaleString('fr')} {newCount === 1 ? t.dashboard.newEntryOne : t.dashboard.newEntries}
                </span>
              </h2>
              <p className="mt-1 text-xs text-ank/80">{t.dashboard.whatsNewSub}</p>
            </div>
            <Link href={`/${locale}/search?type=index`} className="text-xs font-medium text-chabon hover:underline">
              {t.dashboard.viewAll} →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {newDocs.map((d) => (
              <Link
                key={d.id}
                href={`/${locale}/doc/${d.id}`}
                className="flex items-start gap-3 rounded-xl border border-chabon/10 bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:border-chabon"
              >
                <TypeBadge type={d.type as DocType} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm text-ank">{d.titleFr}</span>
                  {d.moniteurRef && <span className="mt-0.5 block truncate text-[11px] text-ank/80">{d.moniteurRef}</span>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="ag-dashboard-personal grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ank/80">{t.dashboard.recent}</h2>
          <div className="rounded-2xl border border-chabon/10 bg-white p-2">
            {recent.length === 0 && <p className="px-3 py-6 text-center text-sm text-ank/80">{t.dashboard.recentEmpty}</p>}
            {recent.map((r) => (
              <Link
                key={r.id}
                href={`/${locale}/search?q=${encodeURIComponent(r.query)}`}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-ank hover:bg-koton"
              >
                <span className="truncate">{r.query}</span>
                <span className="ag-result-count ml-2 shrink-0 text-xs text-ank/80">{r.resultsCount}</span>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ank/80">{t.dashboard.favorites}</h2>
          <div className="rounded-2xl border border-chabon/10 bg-white p-2">
            {favorites.length === 0 && (
              <div className="ag-favorites-empty"><span aria-hidden="true">☆</span><p>{t.dashboard.favoritesEmpty}</p><p>{t.dashboard.favoritesEmptyHint}</p></div>
            )}
            {favorites.map((f) => (
              <Link
                key={f.id}
                href={`/${locale}/doc/${f.documentId}`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ank hover:bg-koton"
              >
                <Pastille type={f.document.type as DocType} />
                <span className="truncate">{f.document.titleFr}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
