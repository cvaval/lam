import Link from 'next/link'
import { redirect } from 'next/navigation'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { canReadService } from '@/lib/access'
import { prisma } from '@/lib/db'
import { getThemeTree } from '@/lib/legislation/themes'
import { ThemeBrowser } from '@/components/ThemeBrowser'

export const dynamic = 'force-dynamic'

// Section « Législation annotée » (DocType DOCTRINE) : page d'accueil = navigation des
// textes PAR THÈMES (arbre pliable domaine › sous-thème › sous-sous-thème ; clic = liste
// des textes du sous-arbre, filtrée par accès §03).
const L = {
  searchAll: {
    fr: 'Rechercher dans toute la législation annotée',
    en: 'Search all annotated legislation',
    ht: 'Chèche nan tout lejislasyon anote a',
  },
} as const

export default async function DoctrinePage({ params }: { params: { locale: string } }) {
  const { locale } = dictFor(params.locale)
  const user = await requireUser(locale)
  if (!canReadService(user, 'DOCTRINE')) redirect(`/${locale}/dashboard`)

  const [tree, grouped] = await Promise.all([
    getThemeTree({ activeOnly: true }),
    prisma.documentTheme.groupBy({ by: ['themeId'], _count: { themeId: true } }),
  ])
  const counts: Record<string, number> = {}
  for (const g of grouped) counts[g.themeId] = g._count.themeId

  return (
    <div className="space-y-5">
      <ThemeBrowser locale={locale} tree={tree} counts={counts} />
      <Link href={`/${locale}/search?type=doctrine`} className="inline-block text-sm font-medium text-endeks-700 hover:underline">
        {L.searchAll[locale]} →
      </Link>
    </div>
  )
}
