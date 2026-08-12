import { UsersManager } from '@/components/UsersManager'
import { toAdminUser, type AdminUser } from '@/lib/admin/mappers'
import { dictFor } from '@/lib/i18n/server'
import { redirect } from 'next/navigation'
import { requireCapability } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default async function AdminOverview({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  // La vue d'ensemble reste au master admin ; un éditeur est mené à SON premier écran
  // plutôt que renvoyé au tableau de bord — sortir quelqu'un de la console parce qu'il a
  // atterri sur sa page d'accueil se lit comme un refus d'accès.
  const user = await requireCapability(locale, 'upload.publish')
  if (user.role !== 'MASTER_ADMIN') redirect(`/${locale}/admin/jurisprudence`)

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
      <h1 className="text-xl font-semibold text-ank">{t.admin.overview}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-chabon/10 bg-white p-5">
            <p className="font-mono text-4xl font-semibold tracking-tight text-ank">{k.value.toLocaleString('fr')}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-ank/80">{k.label}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ank">{t.admin.pending}</h2>
        <UsersManager users={pendingUsers} t={t} locale={locale} mode="pending" />
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-ank/80">{t.admin.activateNote}</p>
      </section>
    </div>
  )
}
