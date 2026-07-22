import Link from 'next/link'
import { redirect } from 'next/navigation'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { canReadService, accessibleTypes } from '@/lib/access'
import { prisma } from '@/lib/db'
import { getThemeTree, allThemedDocuments } from '@/lib/legislation/themes'
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

  const RECENT_DAYS = 14
  const cutoff = new Date(Date.now() - RECENT_DAYS * 86400_000)
  const [tree, grouped, recent, allDocs] = await Promise.all([
    getThemeTree({ activeOnly: true }),
    // Compteurs « N textes » filtrés par accès §03 — sinon le badge pourrait inclure des docs
    // d'un type non accordé (écart compte↔liste, qui elle est filtrée par documentsInTheme).
    prisma.documentTheme.groupBy({
      by: ['themeId'],
      where: { document: { type: { in: accessibleTypes(user) } } },
      _count: { themeId: true },
    }),
    // Sous-thèmes ayant reçu un document récent (téléversé/thématisé ou modifié) — filtré accès §03.
    prisma.documentTheme.findMany({
      where: { document: { updatedAt: { gte: cutoff }, type: { in: accessibleTypes(user) } } },
      select: { themeId: true },
      distinct: ['themeId'],
    }),
    // Corpus à plat (accès §03) pour les vues A→Z / par type / récents.
    allThemedDocuments(user),
  ])
  const counts: Record<string, number> = {}
  for (const g of grouped) counts[g.themeId] = g._count.themeId
  const recentThemeIds = recent.map((r) => r.themeId)
  // Garde-fou de troncature : la borne (take) de allThemedDocuments est atteinte →
  // les vues à plat seraient incomplètes. On le journalise (aucun signal sinon).
  if (allDocs.length >= 3000) console.warn(`[doctrine] allThemedDocuments a atteint la borne (${allDocs.length}) — vues à plat potentiellement tronquées.`)
  // Sérialisable client : Date → ISO. `publicationDate` = date DU TEXTE (tri
  // chronologique juridique) ; `updatedAt` = dernière modification en base (repli
  // quand le texte n'a pas de date connue).
  const flatDocs = allDocs.map((d) => ({
    id: d.id, type: d.type, titleFr: d.titleFr, titleEn: d.titleEn, titleHt: d.titleHt,
    number: d.number, status: d.status,
    publicationDate: d.publicationDate ? d.publicationDate.toISOString() : null,
    updatedAt: d.updatedAt.toISOString(),
  }))

  return (
    <div className="space-y-5">
      <ThemeBrowser locale={locale} tree={tree} counts={counts} recentThemeIds={recentThemeIds} allDocs={flatDocs} />
      <Link href={`/${locale}/search?type=legislationannotee`} className="inline-block text-sm font-medium text-endeks-700 hover:underline">
        {L.searchAll[locale]} →
      </Link>
    </div>
  )
}
