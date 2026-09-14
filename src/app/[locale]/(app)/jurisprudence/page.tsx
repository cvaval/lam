import Link from 'next/link'
import { redirect } from 'next/navigation'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { canReadService } from '@/lib/access'
import { DOC_TYPE_META } from '@/lib/brand'
import { navigationThemes, allThemedDocuments } from '@/lib/legislation/themes'
import { ThemeBrowser } from '@/components/ThemeBrowser'
import { prisma } from '@/lib/db'

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
 * ⚠️ LES VOLUMES D'ABORD, LES NOTIONS ENSUITE — ET TOUS LES ARRÊTS. Le premier jet ne
 * rendait que l'arbre des notions : 81 des 162 arrêts versés avant le recueil n'en portent
 * aucune, 42 n'ont aucun thème — ils ont disparu de la rubrique pendant une journée, encore
 * atteignables par la recherche seule. La rubrique est un recueil en TROIS VOLUMES
 * (`recueilRef`) : chaque volume se lit ici en entier, arrêt par arrêt, quelle que soit sa
 * classification. L'arbre des notions est une seconde entrée, pas la seule.
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
  volumes: { fr: 'Les volumes', en: 'The volumes', ht: 'Volim yo' },
  volumesSub: {
    fr: 'Chaque volume, arrêt par arrêt, dans l’ordre des décisions. Les notions du Répertoire alphabétique sont une seconde entrée, plus bas.',
    en: 'Each volume, ruling by ruling, in the order of the decisions. The notions of the Alphabetical Digest are a second entry, below.',
    ht: 'Chak volim, desizyon pa desizyon, nan lòd desizyon yo. Nosyon Repètwa alfabetik la se yon dezyèm antre, anba.',
  },
  parNotion: { fr: 'Par notion', en: 'By notion', ht: 'Pa nosyon' },
  parNotionSub: {
    fr: 'Les 745 notions du Répertoire alphabétique d’extraits de jurisprudence haïtienne (J.-F. Salès, 1963-1989) — lettre, notion, sous-notion.',
    en: 'The 745 notions of the Alphabetical Digest of Haitian Case-Law Extracts (J.-F. Salès, 1963-1989) — letter, notion, sub-notion.',
    ht: '745 nosyon Rekèy alfabetik ekstrè jirispridans ayisyen an (J.-F. Salès, 1963-1989) — lèt, nosyon, sou-nosyon.',
  },
  sansVolume: { fr: 'Hors volume', en: 'Outside any volume', ht: 'Deyò volim' },
  formationInconnue: { fr: 'formation non précisée', en: 'bench not stated', ht: 'fòmasyon pa presize' },
} as const
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const dateFr = (d: Date) => `${d.getUTCDate() === 1 ? '1er' : d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
/** Ordre des volumes : les exercices d'abord (texte intégral), le Répertoire ensuite. */
const rangVolume = (r: string) => (/exercice/i.test(r) ? 0 : /Salès/.test(r) ? 1 : 2)

const META = DOC_TYPE_META.JURISPRUDENCE

export default async function JurisprudencePage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)
  if (!canReadService(user, 'JURISPRUDENCE')) redirect(`/${locale}/dashboard`)

  const [nav, allDocs, tousLesArrets] = await Promise.all([
    navigationThemes(user, { corpus: META.corpus, racines: META.racinesThemes }),
    allThemedDocuments(user, { corpus: META.corpus }),
    // TOUS les arrêts de la rubrique, thématisés ou non — la vue par volume ne dépend
    // d'aucune classification.
    prisma.document.findMany({
      where: { type: 'JURISPRUDENCE', status: 'PUBLIE' },
      select: { id: true, titleFr: true, chambre: true, publicationDate: true, recueilRef: true },
      orderBy: [{ publicationDate: 'asc' }, { titleFr: 'asc' }],
    }),
  ])
  const volumes = new Map<string, typeof tousLesArrets>()
  for (const a of tousLesArrets) { const k = a.recueilRef ?? ''; volumes.set(k, [...(volumes.get(k) ?? []), a]) }
  const volumesTries = [...volumes.entries()].sort((x, y) => rangVolume(x[0]) - rangVolume(y[0]) || x[0].localeCompare(y[0], 'fr'))
  const lt = (o: { fr: string; en: string; ht: string }) => (locale === 'en' ? o.en : locale === 'ht' ? o.ht : o.fr)
  if (allDocs.length >= 3000) console.warn(`[${META.slug}] allThemedDocuments a atteint la borne (${allDocs.length}) — vues à plat potentiellement tronquées.`)
  const flatDocs = allDocs.map((d) => ({
    id: d.id, type: d.type, titleFr: d.titleFr, titleEn: d.titleEn, titleHt: d.titleHt,
    number: d.number, status: d.status,
    publicationDate: d.publicationDate ? d.publicationDate.toISOString() : null,
    updatedAt: d.updatedAt.toISOString(),
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ank">{META.label[locale]}</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-ank/80">{L.sousTitre[locale]}</p>
      </div>
      <section className="rounded-2xl border border-chabon/10 bg-white p-5" aria-labelledby="volumes-titre">
        <h2 id="volumes-titre" className="text-lg font-semibold text-ank">{lt(L.volumes)}</h2>
        <p className="mt-1 max-w-2xl text-sm text-ank/80">{lt(L.volumesSub)}</p>
        <div className="mt-4 space-y-3">
          {volumesTries.map(([ref, arrets]) => (
            /* Les exercices (≈ 80 arrêts) s'ouvrent ; le Répertoire (1 201) se replie, ses
               notions sont juste dessous. */
            <details key={ref || '∅'} open={rangVolume(ref) === 0} className="rounded-xl border border-chabon/10">
              <summary className="cursor-pointer list-none px-4 py-3">
                <span className="font-medium text-ank">{ref || lt(L.sansVolume)}</span>
                <span className="ml-2 text-xs text-grafit">{arrets.length.toLocaleString('fr')} {arrets.length > 1 ? lt(L.unites) : lt(L.unite)}</span>
              </summary>
              <ul className="divide-y divide-chabon/10 border-t border-chabon/10">
                {arrets.map((a) => (
                  <li key={a.id}>
                    <Link href={`/${locale}/doc/${a.id}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2 text-sm hover:bg-pil/40">
                      <span className="font-mono text-[11px] text-grafit">{a.publicationDate ? dateFr(a.publicationDate) : '—'}</span>
                      <span className="text-xs text-grafit">{a.chambre ?? lt(L.formationInconnue)}</span>
                      <span className="text-ank">{a.titleFr}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
      {/* ThemeBrowser rend son propre en-tête : il devient l'en-tête de la SECONDE entrée. */}
      <ThemeBrowser
        locale={locale}
        rubrique={{
          slug: META.slug,
          titre: lt(L.parNotion),
          sousTitre: lt(L.parNotionSub),
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
