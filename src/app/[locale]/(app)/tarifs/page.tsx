import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Pastille } from '@/components/TypeBadge'
import { TariffTable } from '@/components/TariffTable'
import { prisma } from '@/lib/db'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { RateLimitNotice } from '@/components/RateLimitNotice'
import { canReadService } from '@/lib/access'
import { chapterLabel } from '@/lib/sh-chapters'

export const dynamic = 'force-dynamic'

export default async function TarifsPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)

  // Accès par service (§03).
  if (!canReadService(user, 'TARIF_DOUANIER')) redirect(`/${locale}/search?type=index`)
  // Anti-scraping (§09).
  if (!(await guard({ action: 'doc', subject: user.id, ...LIMITS.doc }, { actorId: user.id }))) {
    return <RateLimitNotice t={t} />
  }

  const [grouped, docCount, total] = await Promise.all([
    prisma.customsTariff.groupBy({ by: ['chapter'], _count: { _all: true }, orderBy: { chapter: 'asc' } }),
    prisma.document.count({ where: { type: 'TARIF_DOUANIER' } }),
    prisma.customsTariff.count(),
  ])
  const chapters = grouped
    .filter((g) => g.chapter)
    .map((g) => ({ code: g.chapter as string, label: chapterLabel(g.chapter as string), count: g._count._all }))

  // Prélèvements connexes (à l'import, distincts du droit de douane, s'ajoutent à la
  // liquidation) — ALIGNÉS sur la calculatrice : mêmes charges/sigles, base = valeur en
  // douane. DD et accise (DAA) restent par position (dans le tableau des tarifs).
  const levies: { levy: string; scope: string }[] = [
    { levy: t.tarifs.calcFv, scope: t.tarifs.leviesScopeAll },
    { levy: t.tarifs.calcTca, scope: t.tarifs.leviesScopeAll },
    { levy: t.tarifs.calcCfgdct, scope: t.tarifs.leviesScopeAll },
    { levy: t.tarifs.calcDs, scope: t.tarifs.leviesScopeAll },
    { levy: t.tarifs.calcRinfo, scope: t.tarifs.leviesScopeAll },
    { levy: t.tarifs.calcTpi, scope: t.tarifs.calcVehicle },
    { levy: t.tarifs.calcTt, scope: t.tarifs.calcVehicle },
    { levy: t.tarifs.calcTpe, scope: t.tarifs.calcVehicleOld },
  ]

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

      <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl bg-lank/5" />}>
        <TariffTable locale={locale} t={t} chapters={chapters} total={total} docCount={docCount} />
      </Suspense>

      {/* Prélèvements connexes (référence) */}
      <details className="rounded-2xl border border-lank/10 bg-white shadow-card">
        <summary className="cursor-pointer list-none px-5 py-4">
          <span className="font-semibold text-lank">{t.tarifs.leviesTitle}</span>
          <span className="mt-0.5 block text-xs text-lank/55">{t.tarifs.leviesSub}</span>
        </summary>
        <div className="overflow-x-auto border-t border-lank/10">
          <table className="w-full border-collapse text-[13px] text-lank/90">
            <thead>
              <tr className="border-b border-lank/15 bg-paper text-left text-xs uppercase tracking-wide text-lank/55">
                <th scope="col" className="px-4 py-2 font-semibold">{t.tarifs.thLevy}</th>
                <th scope="col" className="px-4 py-2 font-semibold">{t.tarifs.thScope}</th>
              </tr>
            </thead>
            <tbody>
              {levies.map((l, i) => (
                <tr key={i} className={i % 2 === 1 ? 'bg-[rgba(27,31,61,0.025)]' : ''}>
                  <td className="px-4 py-1.5 font-medium text-lank">{l.levy}</td>
                  <td className="px-4 py-1.5 text-lank/75">{l.scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
