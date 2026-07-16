import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { formatDate } from '@/lib/i18n/format'
import { prisma } from '@/lib/db'
import { ACCESS_MATRIX, can, type Capability, type Grant } from '@/lib/rbac'
import { toAlertDto } from '@/lib/alerts'
import { remainingQuota } from '@/lib/quota'
import { RedeemPromo } from '@/components/RedeemPromo'
import { AlertsManager } from '@/components/AlertsManager'
import type { Dictionary } from '@/lib/i18n/dictionaries'

// Libellé traduit d'un grant de la matrice d'accès (§03).
function grantText(v: Grant, t: Dictionary): { label: string; ok: boolean } {
  const g = t.account.grants
  if (v === true || v === 'unlimited') return { label: g.yes, ok: true }
  if (v === 'extracts') return { label: g.extracts, ok: true }
  if (v === 'read') return { label: g.read, ok: true }
  if (v === 'sectoral') return { label: g.sectoral, ok: true }
  if (v === 'own') return { label: g.own, ok: true }
  return { label: g.no, ok: false }
}

export default async function AccountPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)

  const matrix = ACCESS_MATRIX[user.role]
  const remaining = remainingQuota(user.monthlyQuota, user.quotaUsed)
  // Alertes de veille (capacité Pwofesyonèl/Enstitisyon) — gérées ici, créées
  // depuis la page de recherche (« M'alerter sur cette recherche »).
  const alerts = can(user.role, 'alerts')
    ? (await prisma.alert.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })).map(toAlertDto)
    : null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="rounded-2xl border border-lank/10 bg-white p-6 shadow-card">
        <h1 className="text-xl font-semibold text-lank">{t.nav.account}</h1>
        <p className="mt-1 text-sm text-lank/60">{user.email}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-lank px-3 py-1 text-sm font-semibold text-white">{t.roles[user.role]}</span>
          {remaining != null && (
            <span className="text-sm text-lank/55">
              {remaining} / {user.monthlyQuota} {t.account.searchesRemaining}
            </span>
          )}
          {user.planExpiresAt && (
            <span className="rounded-full bg-sitwon-50 px-3 py-1 text-xs font-medium text-sitwon-700">
              {t.promo.planExpires} {formatDate(locale, user.planExpiresAt)}
            </span>
          )}
        </div>
      </header>

      <RedeemPromo t={t} />

      {alerts && (
        <section className="rounded-2xl border border-lank/10 bg-white p-6 shadow-card">
          <h2 className="text-sm font-semibold text-lank">{t.alerts.title}</h2>
          <p className="mb-4 mt-1 text-xs text-lank/50">{t.alerts.hint}</p>
          <AlertsManager initial={alerts} locale={locale} t={t} />
        </section>
      )}

      <section className="rounded-2xl border border-lank/10 bg-white p-6 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-lank">{t.account.capabilitiesTitle}</h2>
        <ul className="divide-y divide-lank/5">
          {(Object.keys(t.account.caps) as Capability[]).map((cap) => {
            const g = grantText(matrix[cap], t)
            return (
              <li key={cap} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-lank/75">{t.account.caps[cap]}</span>
                <span className={g.ok ? 'font-medium text-fey' : 'text-lank/35'}>{g.label}</span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
