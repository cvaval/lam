import { redirect } from 'next/navigation'
import { Pastille } from '@/components/TypeBadge'
import { TariffTable } from '@/components/TariffTable'
import { prisma } from '@/lib/db'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { RateLimitNotice } from '@/components/RateLimitNotice'
import { canReadService } from '@/lib/access'

export const dynamic = 'force-dynamic'

const INITIAL = 100 // = MAX de TariffTable / de l'API de recherche

export default async function TarifsPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)

  // Accès par service (§03).
  if (!canReadService(user, 'TARIF_DOUANIER')) redirect(`/${locale}/search?type=index`)
  // Anti-scraping (§09).
  if (!(await guard({ action: 'doc', subject: user.id, ...LIMITS.doc }, { actorId: user.id }))) {
    return <RateLimitNotice t={t} />
  }

  const [rows, total, docCount] = await Promise.all([
    prisma.customsTariff.findMany({
      orderBy: [{ chapter: 'asc' }, { position: 'asc' }, { code: 'asc' }],
      take: INITIAL,
      select: { id: true, code: true, designation: true, unite: true, dd: true, tca: true, accises: true, note: true },
    }),
    prisma.customsTariff.count(),
    prisma.document.count({ where: { type: 'TARIF_DOUANIER' } }),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Pastille type="TARIF_DOUANIER" />
            <h1 className="text-lg font-semibold text-lank">{t.tarifs.title}</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-lank/55">{t.tarifs.subtitle}</p>
        </div>
        <span className="hidden h-1.5 w-16 shrink-0 rounded-full bg-kannel sm:block" />
      </div>

      <TariffTable locale={locale} t={t} initialRows={rows} initialTotal={total} docCount={docCount} />
    </div>
  )
}
