import Link from 'next/link'
import { redirect } from 'next/navigation'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { canReadService } from '@/lib/access'
import { DOC_TYPE_META } from '@/lib/brand'
import { navigationThemes, allThemedDocuments } from '@/lib/legislation/themes'
import { ThemeBrowser } from '@/components/ThemeBrowser'

export const dynamic = 'force-dynamic'

/**
 * Rubrique « Recueil de jurisprudence » — l'entrée PAR MATIÈRE.
 *
 * La rubrique annonçait depuis sa création des « filtres par juridiction et par matière » et
 * n'avait que le premier. Les 745 notions du *Recueil alphabétique d'extraits de
 * jurisprudence haïtienne* (J.-F. Salès, octobre 1963 – décembre 1989) sont ce second axe :
 * un arbre propre à la jurisprudence — lettre → notion → sous-notion —, déclaré avec la
 * rubrique dans `DOC_TYPE_META.JURISPRUDENCE.racinesThemes`, et nulle part ailleurs.
 *
 * ⚠️ UN ARRÊT SOUS PLUSIEURS NOTIONS. 1 283 arrêts pour 2 818 rattachements : un même arrêt
 * est rangé sous chaque notion qu'il touche (jusqu'à 15). Les compteurs des notions ne
 * s'additionnent donc pas en un total du fonds — `navigationThemes` compte des documents
 * DISTINCTS par nœud, et c'est le seul compte honnête.
 *
 * ⚠️ AUCUNE CLÉ I18N NOUVELLE : les fichiers de locale appartiennent à une session
 * parallèle. Les libellés propres à la page vivent ici, comme pour les circulaires.
 */
const L = {
  sousTitre: {
    fr: 'Parcourez les arrêts de la Cour de Cassation par notion juridique, selon le Recueil alphabétique d’extraits de jurisprudence haïtienne (J.-F. Salès, 1963-1989) — ou ouvrez un arrêt pour lire ses extraits.',
    en: 'Browse the rulings of the Court of Cassation by legal notion, following the Alphabetical Digest of Haitian Case-Law Extracts (J.-F. Salès, 1963-1989) — or open a ruling to read its extracts.',
    ht: 'Gade desizyon Kou Kasasyon yo dapre nosyon jiridik, dapre Rekèy alfabetik ekstrè jirispridans ayisyen an (J.-F. Salès, 1963-1989) — oswa ouvri yon desizyon pou li ekstrè li yo.',
  },
  searchAll: { fr: 'Rechercher dans tous les arrêts', en: 'Search all rulings', ht: 'Chèche nan tout desizyon yo' },
  unite: { fr: 'arrêt', en: 'ruling', ht: 'desizyon' },
  unites: { fr: 'arrêts', en: 'rulings', ht: 'desizyon' },
  sousTheme: { fr: 'notion', en: 'notion', ht: 'nosyon' },
  sousThemes: { fr: 'notions', en: 'notions', ht: 'nosyon' },
  vide: { fr: 'Aucun arrêt pour le moment', en: 'No ruling yet', ht: 'Pa gen desizyon pou kounye a' },
  videTheme: {
    fr: 'Aucun arrêt accessible sous cette notion pour le moment.',
    en: 'No accessible ruling under this notion yet.',
    ht: 'Pa gen desizyon aksesib anba nosyon sa a pou kounye a.',
  },
  videPlat: { fr: 'Aucun arrêt accessible pour le moment.', en: 'No accessible ruling yet.', ht: 'Pa gen desizyon aksesib pou kounye a.' },
} as const

const META = DOC_TYPE_META.JURISPRUDENCE

export default async function JurisprudencePage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)
  if (!canReadService(user, 'JURISPRUDENCE')) redirect(`/${locale}/dashboard`)

  const [nav, allDocs] = await Promise.all([
    navigationThemes(user, { corpus: META.corpus, racines: META.racinesThemes }),
    allThemedDocuments(user, { corpus: META.corpus }),
  ])
  if (allDocs.length >= 3000) console.warn(`[${META.slug}] allThemedDocuments a atteint la borne (${allDocs.length}) — vues à plat potentiellement tronquées.`)
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
          // Ordre du livre : alphabétique, porté par `position` au versement.
          ordre: 'position',
          // Rubrique à type unique : un badge « JUR » sur chaque ligne ne distinguerait rien.
          monoType: true,
          // Une racine, vingt lettres : ouvrir la racine montre l'alphabet, c'est l'entrée.
          racinesOuvertes: true,
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
