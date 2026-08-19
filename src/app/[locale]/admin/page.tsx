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

  // ⚠️ LA FILE D'ATTENTE EST LE SEUL KPI QUI COÛTE À QUELQU'UN. Les trois autres se
  // consultent ; celui-ci se traite. Mesuré le 19 août 2026 : quatre demandes attendaient
  // depuis 30 à 43 jours, affichées sur cette page même — mais noyées sous la liste, sans
  // chiffre ni ancienneté. On donne donc le nombre ET l'âge de la plus ancienne, et on
  // l'accentue en Wouj dès qu'il y en a une : c'est un état à corriger, pas une mesure.
  const jours = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000)
  const attente = pending.length ? jours(pending[0].requestedAt ?? pending[0].createdAt) : 0
  const kpis = [
    { label: t.admin.kpiUsers, value: registered, note: null, alerte: false },
    { label: t.admin.kpiSearches, value: searchesToday, note: null, alerte: false },
    { label: t.admin.kpiScraping, value: scrapingAlerts, note: null, alerte: false },
    {
      label: t.admin.kpiPending,
      value: pending.length,
      note: pending.length ? t.admin.pendingOldest.replace('{n}', String(attente)) : t.admin.pendingNone,
      alerte: pending.length > 0,
    },
  ]

  const pendingUsers: AdminUser[] = pending.map(toAdminUser)

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-ank">{t.admin.overview}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`rounded-2xl border bg-white p-5 ${k.alerte ? 'border-wouj' : 'border-chabon/10'}`}
          >
            <p className={`font-mono text-4xl font-semibold tracking-tight ${k.alerte ? 'text-wouj' : 'text-ank'}`}>
              {k.value.toLocaleString('fr')}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-ank/80">{k.label}</p>
            {/* La couleur ne porte jamais l'information seule : l'ancienneté est écrite. */}
            {k.note && <p className="mt-1 text-xs text-grafit">{k.note}</p>}
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
