import { UsersManager } from '@/components/UsersManager'
import { toAdminUser, type AdminUser } from '@/lib/admin/mappers'
import { CreateUserForm } from '@/components/CreateUserForm'
import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'

export default async function AdminUsersPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  await requireAdmin(locale)
  const all = await prisma.user.findMany({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] })

  const pending: AdminUser[] = []
  const active: AdminUser[] = []
  for (const u of all) {
    const row = toAdminUser(u)
    if (u.status === 'PENDING') pending.push(row)
    else active.push(row)
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-lank">{t.admin.users}</h1>

      <CreateUserForm t={t} />

      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-lank">{t.admin.pending}</h2>
          <UsersManager users={pending} t={t} locale={locale} mode="pending" />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-lank">{t.admin.allUsers}</h2>
        <UsersManager users={active} t={t} locale={locale} mode="all" />
      </section>
    </div>
  )
}
