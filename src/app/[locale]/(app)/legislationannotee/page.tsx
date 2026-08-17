import Link from 'next/link'
import { redirect } from 'next/navigation'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { canReadService } from '@/lib/access'
import { DOC_TYPE_META } from '@/lib/brand'
import { navigationThemes, allThemedDocuments } from '@/lib/legislation/themes'
import { ThemeBrowser } from '@/components/ThemeBrowser'

export const dynamic = 'force-dynamic'

// Section « Législation annotée » (DocType DOCTRINE) : page d'accueil = navigation des
// textes PAR THÈMES (arbre pliable domaine › sous-thème › sous-sous-thème ; clic = liste
// des textes du sous-arbre, filtrée par accès §03 puis par le corpus de la rubrique).
const L = {
  searchAll: {
    fr: 'Rechercher dans toute la législation annotée',
    en: 'Search all annotated legislation',
    ht: 'Chèche nan tout lejislasyon anote a',
  },
  sousTitre: {
    fr: 'Explorez les lois, décrets et arrêtés par domaine. Dépliez un domaine, puis ouvrez un thème pour voir ses textes.',
    en: 'Browse laws, decrees and orders by domain. Expand a domain, then open a theme to see its texts.',
    ht: 'Gade lwa, dekrè ak arete pa domèn. Louvri yon domèn, epi louvri yon tèm pou wè tèks li yo.',
  },
  unite: { fr: 'texte', en: 'text', ht: 'tèks' },
  unites: { fr: 'textes', en: 'texts', ht: 'tèks' },
  sousTheme: { fr: 'sous-thème', en: 'sub-theme', ht: 'sou-tèm' },
  sousThemes: { fr: 'sous-thèmes', en: 'sub-themes', ht: 'sou-tèm' },
  vide: { fr: 'Aucun texte pour le moment', en: 'No text yet', ht: 'Pa gen tèks pou kounye a' },
  videTheme: {
    fr: 'Aucun texte accessible dans ce thème pour le moment.',
    en: 'No accessible text in this theme yet.',
    ht: 'Pa gen tèks aksesib nan tèm sa a pou kounye a.',
  },
  videPlat: {
    fr: 'Aucun texte accessible pour le moment.',
    en: 'No accessible text yet.',
    ht: 'Pa gen tèks aksesib pou kounye a.',
  },
} as const

const META = DOC_TYPE_META.DOCTRINE

export default async function DoctrinePage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)
  if (!canReadService(user, 'DOCTRINE')) redirect(`/${locale}/dashboard`)

  // ⚠️ UN SEUL PÉRIMÈTRE POUR TOUTE LA RUBRIQUE. L'arbre, les compteurs, la fraîcheur et
  // les vues à plat sortent du même corpus, déclaré avec la rubrique. Quatre requêtes
  // séparées portaient auparavant leurs propres filtres : c'est ainsi qu'un badge a pu
  // annoncer autre chose que la liste qu'il surmontait.
  const [nav, allDocs] = await Promise.all([
    navigationThemes(user, { corpus: META.corpus, racines: META.racinesThemes }),
    allThemedDocuments(user, { corpus: META.corpus }),
  ])
  // Garde-fou de troncature : la borne (take) de allThemedDocuments est atteinte →
  // les vues à plat seraient incomplètes. On le journalise (aucun signal sinon).
  if (allDocs.length >= 3000) console.warn(`[${META.slug}] allThemedDocuments a atteint la borne (${allDocs.length}) — vues à plat potentiellement tronquées.`)
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
      <ThemeBrowser
        locale={locale}
        rubrique={{
          slug: META.slug,
          titre: META.label[locale],
          sousTitre: L.sousTitre[locale],
          lexique: {
            unite: L.unite[locale], unites: L.unites[locale],
            sousTheme: L.sousTheme[locale], sousThemes: L.sousThemes[locale],
            vide: L.vide[locale], videTheme: L.videTheme[locale], videPlat: L.videPlat[locale],
          },
          statuts: t.statuses,
        }}
        tree={nav.tree}
        counts={nav.counts}
        subtotals={nav.subtotals}
        recentThemeIds={nav.recentThemeIds}
        allDocs={flatDocs}
      />
      <Link href={`/${locale}/search?type=${META.slug}`} className="inline-block text-sm font-medium text-chabon hover:underline">
        {L.searchAll[locale]} →
      </Link>
    </div>
  )
}
