import { PromoManager, type PromoCodeRow, type AssignUser } from '@/components/PromoManager'
import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import type { Role } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AdminPromoPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  await requireAdmin(locale)

  const [codes, users] = await Promise.all([
    prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.user.findMany({ where: { status: 'ACTIVE' }, orderBy: { email: 'asc' }, take: 500 }),
  ])

  const codeRows: PromoCodeRow[] = codes.map((c) => ({
    id: c.id,
    code: c.code,
    label: c.label,
    grantsRole: c.grantsRole as Role,
    durationDays: c.durationDays,
    maxRedemptions: c.maxRedemptions,
    redeemedCount: c.redeemedCount,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    active: c.active,
  }))
  const assignUsers: AssignUser[] = users.map((u) => ({ id: u.id, email: u.email, role: u.role as Role }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-lank">{t.promo.title}</h1>
        <p className="mt-1 text-sm text-lank/55">{t.promo.subtitle}</p>
      </div>
      <PromoManager t={t} codes={codeRows} users={assignUsers} />
    </div>
  )
}
