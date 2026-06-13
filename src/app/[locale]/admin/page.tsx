import { UsersManager } from '@/components/UsersManager'
import { toAdminUser, type AdminUser } from '@/lib/admin/mappers'
import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default async function AdminOverview({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  await requireAdmin(locale)

  const [registered, searchesToday, scrapingAlerts, pending] = await Promise.all([
    prisma.user.count(),
    prisma.searchLog.count({ where: { createdAt: { gte: startOfToday() } } }),
    prisma.auditLog.count({ where: { action: 'SCRAPING_ALERT' } }),
    prisma.user.findMany({ where: { status: 'PENDING' }, orderBy: { requestedAt: 'asc' } }),
  ])

  const kpis = [
    { label: t.admin.kpiUsers, value: registered },
    { label: t.admin.kpiSearches, value: searchesToday },
    { label: t.admin.kpiScraping, value: scrapingAlerts },
  ]

  const pendingUsers: AdminUser[] = pending.map(toAdminUser)

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-lank">{t.admin.overview}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
            <p className="font-mono text-4xl font-semibold tracking-tight text-lank">{k.value.toLocaleString('fr')}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-lank/45">{k.label}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-lank">{t.admin.pending}</h2>
        <UsersManager users={pendingUsers} t={t} locale={locale} mode="pending" />
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-lank/45">{t.admin.activateNote}</p>
      </section>
    </div>
  )
}
