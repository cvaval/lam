import { prisma } from '@/lib/db'
import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { TariffAdmin } from '@/components/TariffAdmin'

export const dynamic = 'force-dynamic'

// Master Admin — édition de la table des tarifs douaniers (§08).
export default async function AdminTarifsPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { q?: string | string[] }
}) {
  const { locale, t } = dictFor(params.locale)
  await requireAdmin(locale)

  const rawQ = Array.isArray(searchParams?.q) ? searchParams.q[0] : searchParams?.q
  const q = (rawQ ?? '').trim().slice(0, 120)
  const where = q
    ? { OR: [{ code: { contains: q, mode: 'insensitive' as const } }, { designation: { contains: q, mode: 'insensitive' as const } }] }
    : {}
  const [total, rows] = await Promise.all([
    prisma.customsTariff.count({ where }),
    prisma.customsTariff.findMany({
      where,
      orderBy: [{ chapter: 'asc' }, { position: 'asc' }, { code: 'asc' }],
      take: 500,
      select: { id: true, code: true, designation: true, unite: true, dd: true, tca: true, accises: true, note: true, chapter: true, position: true },
    }),
  ])

  return <TariffAdmin locale={locale} t={t} q={q} total={total} rows={rows} />
}
