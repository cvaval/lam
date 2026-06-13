import Link from 'next/link'
import { SearchBox } from '@/components/SearchBox'
import { Pastille, TypeBadge } from '@/components/TypeBadge'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { DOC_TYPE_LIST, COLOR_CLASSES } from '@/lib/brand'
import type { DocType } from '@/lib/types'

// Écran 3 — Tableau de bord : accès rapides + Nouveauté (§07).
export default async function DashboardPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)

  const fifteenDaysAgo = new Date(Date.now() - 15 * 86400_000)
  // Accès « Index seulement » : restreint l'affichage à l'Index.
  const newWhere = user.indexOnly
    ? { createdAt: { gte: fifteenDaysAgo }, type: 'INDEX' }
    : { createdAt: { gte: fifteenDaysAgo } }

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

  // Tuiles d'accès : 6 services + Index, ou Index seul si accès restreint.
  const tiles = user.indexOnly ? DOC_TYPE_LIST.filter((m) => m.type === 'INDEX') : DOC_TYPE_LIST

  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-2xl pt-2 text-center">
        <p className="text-sm text-lank/55">
          {t.dashboard.greeting}
          {user.name ? `, ${user.name.split(' ')[0]}` : ''}.
        </p>
        <div className="mt-3">
          <SearchBox locale={locale} placeholder={t.dashboard.omnibox} size="lg" remember />
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-lank/45">{t.dashboard.quickAccess}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((m) => (
            <Link
              key={m.type}
              href={`/${locale}/type/${m.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-lank/10 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className={`absolute inset-x-0 top-0 h-1 ${COLOR_CLASSES[m.color].dot}`} />
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-lank/40">0{m.num}</span>
                <span className="flex items-center gap-2">
                  {(newByType.get(m.type) ?? 0) > 0 && (
                    <span
                      title={`${(newByType.get(m.type) ?? 0).toLocaleString('fr')} ${t.dashboard.newEntries}`}
                      className="inline-flex h-5 items-center rounded-full bg-sitwon px-2 text-[10px] font-bold uppercase tracking-wide text-lank"
                    >
                      {t.dashboard.whatsNew}
                    </span>
                  )}
                  <Pastille type={m.type as DocType} />
                </span>
              </div>
              <h3 className="mt-3 font-semibold leading-snug text-lank">{m.label[locale]}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-lank/55">{m.feature[locale]}</p>
            </Link>
          ))}
        </div>
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
