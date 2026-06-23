import Link from 'next/link'
import { SearchBox } from '@/components/SearchBox'
import { Pastille, TypeBadge } from '@/components/TypeBadge'
import { SectionTiles, type SectionTile } from '@/components/SectionTiles'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { DOC_TYPE_LIST } from '@/lib/brand'
import { accessibleTypes, orderTypes } from '@/lib/access'
import type { DocType } from '@/lib/types'

// Écran 3 — Tableau de bord : accès rapides + Nouveauté (§07).
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
      where: { userId: user.id },
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
      color: m.color,
      label: m.label[locale],
      feature: m.feature[locale],
      newCount: newByType.get(type) ?? 0,
    }
  })

  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-2xl pt-2 text-center">
        <p className="text-sm text-lank/55">
          {t.dashboard.greeting}
          {user.name ? `, ${user.name.split(' ')[0]}` : ''}.
        </p>
        <div className="mt-3">
          <SearchBox locale={locale} placeholder={t.dashboard.omnibox} size="lg" />
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-lank/45">{t.dashboard.quickAccess}</h2>
          <span className="text-[11px] text-lank/35">{t.dashboard.reorderTip}</span>
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

      {/* Nouveauté — données importées ces 15 derniers jours */}
      {newCount > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-lank">
                <span className="inline-flex h-5 items-center rounded-full bg-sitwon px-2 text-[10px] font-bold uppercase tracking-wide text-lank">
                  {t.dashboard.whatsNew}
                </span>
                <span className="text-lank/55">
                  {newCount.toLocaleString('fr')} {t.dashboard.newEntries}
                </span>
              </h2>
              <p className="mt-1 text-xs text-lank/40">{t.dashboard.whatsNewSub}</p>
            </div>
            <Link href={`/${locale}/search?type=index`} className="text-xs font-medium text-endeks-700 hover:underline">
              {t.dashboard.viewAll} →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {newDocs.map((d) => (
              <Link
                key={d.id}
                href={`/${locale}/doc/${d.id}`}
                className="flex items-start gap-3 rounded-xl border border-lank/10 bg-white px-4 py-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <TypeBadge type={d.type as DocType} />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm text-lank">{d.titleFr}</span>
                  {d.moniteurRef && <span className="mt-0.5 block truncate text-[11px] text-lank/40">{d.moniteurRef}</span>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-lank/45">{t.dashboard.recent}</h2>
          <div className="rounded-2xl border border-lank/10 bg-white p-2 shadow-card">
            {recent.length === 0 && <p className="px-3 py-6 text-center text-sm text-lank/40">{t.dashboard.empty}</p>}
            {recent.map((r) => (
              <Link
                key={r.id}
                href={`/${locale}/search?q=${encodeURIComponent(r.query)}`}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-lank hover:bg-paper"
              >
                <span className="truncate">{r.query}</span>
                <span className="ml-2 shrink-0 text-xs text-lank/35">{r.resultsCount}</span>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-lank/45">{t.dashboard.favorites}</h2>
          <div className="rounded-2xl border border-lank/10 bg-white p-2 shadow-card">
            {favorites.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-lank/40">{t.dashboard.empty}</p>
            )}
            {favorites.map((f) => (
              <Link
                key={f.id}
                href={`/${locale}/doc/${f.documentId}`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-lank hover:bg-paper"
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
