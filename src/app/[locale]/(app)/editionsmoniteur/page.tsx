import Link from 'next/link'
import { redirect } from 'next/navigation'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { canReadService } from '@/lib/access'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Navigation Législation (Le Moniteur) : liste des années disponibles.
// Cliquer une année → ventilation par mois puis par numéro (legislation/[year]).
const L = {
  title: { fr: 'Éditions Le Moniteur', en: 'Le Moniteur editions', ht: 'Edisyon Le Moniteur' },
  sub: {
    fr: 'Le Moniteur — journal officiel. Choisissez une année pour parcourir les éditions par mois et par numéro.',
    en: 'Le Moniteur — official journal. Pick a year to browse editions by month and number.',
    ht: 'Le Moniteur — jounal ofisyèl. Chwazi yon ane pou gade edisyon yo pa mwa ak pa nimewo.',
  },
  editions: { fr: 'éditions', en: 'editions', ht: 'edisyon' },
  empty: { fr: 'Aucune année disponible pour le moment.', en: 'No year available yet.', ht: 'Pa gen ane disponib pou kounye a.' },
  searchAll: { fr: 'Rechercher dans toute la législation', en: 'Search all legislation', ht: 'Chèche nan tout lejislasyon an' },
} as const

export default async function LegislationPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)
  if (!canReadService(user, 'LEGISLATION')) redirect(`/${locale}/dashboard`)

  // Une source MONITEUR_PDF_{année} par année cataloguée → année + nombre d'éditions.
  const groups = await prisma.document.groupBy({
    by: ['source'],
    where: { source: { startsWith: 'MONITEUR_PDF_' } },
    _count: { _all: true },
  })
  const years = groups
    .map((g) => ({ year: Number((g.source ?? '').replace('MONITEUR_PDF_', '')), count: g._count._all }))
    .filter((y) => Number.isFinite(y.year))
    .sort((a, b) => b.year - a.year)

  return (
    <div className="space-y-6">
      <header className="border-l-4 border-lank pl-4">
        <h1 className="text-2xl font-bold text-lank">{L.title[locale]}</h1>
        <p className="mt-1 max-w-2xl text-sm text-lank/55">{L.sub[locale]}</p>
      </header>

      {years.length === 0 ? (
        <p className="rounded-2xl border border-lank/10 bg-white px-4 py-10 text-center text-sm text-lank/40 shadow-card">
          {L.empty[locale]}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {years.map((y) => (
            <Link
              key={y.year}
              href={`/${locale}/editionsmoniteur/${y.year}`}
              className="group flex flex-col items-center rounded-2xl border border-lank/10 bg-white px-4 py-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="text-3xl font-bold tracking-tight text-lank group-hover:text-endeks-700">{y.year}</span>
              <span className="mt-1 text-xs text-lank/50">
                {y.count.toLocaleString('fr')} {L.editions[locale]}
              </span>
            </Link>
          ))}
        </div>
      )}

      <Link href={`/${locale}/search?type=editionsmoniteur`} className="inline-block text-sm font-medium text-endeks-700 hover:underline">
        {L.searchAll[locale]} →
      </Link>
    </div>
  )
}
