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
 * Rubrique « Circulaires de la BRH » — navigation par la taxonomie de la BRH elle-même.
 *
 * La porte manquante. Les 142 circulaires étaient classées depuis longtemps selon le
 * recueil de la Banque (Moniteur Spécial n° 18 du 6 juin 2017), sur DEUX axes de lecture —
 * par matière (15 rubriques) et par assujetti (6) —, mais ce classement n'était atteignable
 * que par la Législation annotée, où il n'avait rien à faire. En rendant à chaque rubrique
 * son corpus le 17 août 2026, on a coupé ce chemin sans en ouvrir un autre : 295
 * rattachements sont devenus invisibles. Cette page est l'autre chemin.
 *
 * ⚠️ DEUX AXES, PAS DEUX MOITIÉS. Chaque circulaire est classée sur les deux à la fois :
 * 142 documents pour 285 rattachements. Additionner les compteurs des deux entrées
 * afficherait un fonds deux fois plus grand qu'il n'est. Chaque axe se compte pour lui-même,
 * en documents distincts — c'est ce que garantit `navigationThemes`.
 *
 * ⚠️ On ne part PAS du nœud parent « Banques & institutions financières » : il porte
 * 27 textes de loi en plus de ses circulaires. Le corpus les écarterait, mais une frontière
 * éditoriale ne se confie pas à un filtre. Les racines sont déclarées avec la rubrique,
 * dans DOC_TYPE_META.
 */
const L = {
  sousTitre: {
    fr: 'Parcourez les circulaires de la Banque de la République d’Haïti selon le classement de la BRH : par matière, ou par établissement assujetti.',
    en: 'Browse the circulars of the Bank of the Republic of Haiti using the BRH’s own classification: by subject, or by regulated institution.',
    ht: 'Gade sikilè Bank Repiblik d Ayiti yo dapre klasman BRH la : dapre matyè, oswa dapre enstitisyon ki konsène.',
  },
  searchAll: {
    fr: 'Rechercher dans toutes les circulaires',
    en: 'Search all circulars',
    ht: 'Chèche nan tout sikilè yo',
  },
  unite: { fr: 'circulaire', en: 'circular', ht: 'sikilè' },
  unites: { fr: 'circulaires', en: 'circulars', ht: 'sikilè' },
  sousTheme: { fr: 'rubrique', en: 'heading', ht: 'ribrik' },
  sousThemes: { fr: 'rubriques', en: 'headings', ht: 'ribrik' },
  vide: { fr: 'Aucune circulaire pour le moment', en: 'No circular yet', ht: 'Pa gen sikilè pou kounye a' },
  videTheme: {
    fr: 'Aucune circulaire accessible dans cette rubrique pour le moment.',
    en: 'No accessible circular in this heading yet.',
    ht: 'Pa gen sikilè aksesib nan ribrik sa a pou kounye a.',
  },
  videPlat: {
    fr: 'Aucune circulaire accessible pour le moment.',
    en: 'No accessible circular yet.',
    ht: 'Pa gen sikilè aksesib pou kounye a.',
  },
} as const

const META = DOC_TYPE_META.CIRCULAIRE_BRH

export default async function CirculairesPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)
  if (!canReadService(user, 'CIRCULAIRE_BRH')) redirect(`/${locale}/dashboard`)

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
          // La BRH classe ses rubriques du plus spécifique au plus général : un ordre qui
          // porte un sens, et qu'un tri alphabétique effacerait sans le dire.
          ordre: 'position',
          // Rubrique à type unique : le badge « BRH » sur chacune des 142 lignes ne
          // distinguerait rien, et un tri « par type » ne rendrait qu'un seul groupe.
          monoType: true,
          // Deux entrées seulement, larges et peu profondes : les replier cacherait toute
          // la taxonomie derrière un chevron.
          racinesOuvertes: true,
        }}
        tree={nav.tree}
        counts={nav.counts}
        subtotals={nav.subtotals}
        recentThemeIds={nav.recentThemeIds}
        allDocs={flatDocs}
      />
      {/* La recherche filtrée garde ce que l'arbre n'offre pas : le champ « numéro », les
          deux axes de date (signature et entrée en vigueur) et les cinq tris. */}
      <Link href={`/${locale}/search?type=${META.slug}`} className="inline-block text-sm font-medium text-chabon hover:underline">
        {L.searchAll[locale]} →
      </Link>
    </div>
  )
}
