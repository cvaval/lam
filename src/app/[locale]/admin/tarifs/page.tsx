import { prisma } from '@/lib/db'
import { dictFor } from '@/lib/i18n/server'
import { requireCapability } from '@/lib/auth/guard'
import { tariffWhere } from '@/lib/tarifs'
import { tariffFoldedIds } from '@/lib/tarifs-db'
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
  await requireCapability(locale, 'corpus.manage')

  const rawQ = Array.isArray(searchParams?.q) ? searchParams.q[0] : searchParams?.q
  const q = (rawQ ?? '').trim().slice(0, 120)
  // Même repli d'accents que la recherche publique : l'écran d'édition doit trouver ce que
  // le lecteur trouve, sinon on corrige une ligne qu'on ne sait pas atteindre.
  const where = tariffWhere(q, null, await tariffFoldedIds(q))
  const [total, rows] = await Promise.all([
    prisma.customsTariff.count({ where }),
    prisma.customsTariff.findMany({
      where,
      orderBy: [{ chapter: 'asc' }, { position: 'asc' }, { code: 'asc' }],
      take: 500,
      select: { id: true, code: true, designation: true, unite: true, dd: true, ddRef: true, tca: true, accises: true, note: true, chapter: true, position: true },
    }),
  ])

  return <TariffAdmin locale={locale} t={t} q={q} total={total} rows={rows} />
}
