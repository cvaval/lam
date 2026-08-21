import Link from 'next/link'
import type { Metadata } from 'next'
import { PublicHeader } from '@/components/PublicHeader'
import { CookieBanner } from '@/components/CookieBanner'
import { DelaiCalculateurPublic } from '@/components/delais/DelaiCalculateurPublic'
import type { RechercheDelai } from '@/components/delais/noyau-calculateur'
import { dictFor } from '@/lib/i18n/server'
import { isLocale, LOCALES } from '@/lib/types'

/**
 * § 6.2 — LE CALCULATEUR DE DÉLAIS, page PUBLIQUE. **Hors du groupe `(app)` : pas de compte,
 * pas de quota, pas de journal.** C'est un outil, pas une recherche : il n'écrit rien.
 *
 * ⚠️ **DEUX CHAMPS : la date de réception de l'acte, et le nombre de jours francs.** Pas de
 * menu du répertoire, pas de lien vers lui. Le répertoire des 393 délais — ses entrées, leurs
 * libellés, leurs fondements — est réservé à l'espace connecté (`/{locale}/outils/delais`),
 * et `calculPublic()` refuse ici tout slug d'entrée. D'où un `intro` propre à cette page :
 * celui de l'espace connecté commence par « Choisissez l'article », ce qui n'a plus de sens.
 *
 * ⚠️ **CE QUE LE CALCUL FAIT ICI : FRANC, PUIS REPORT EN CASCADE.** Départ + N + 1 (le délai
 * est franc), puis, si ce jour-là est un dimanche, une fête légale du décret du 11 décembre
 * 2024 ou une fête nationale de l'article 275.1 de la Constitution, report au jour suivant —
 * **et l'on recommence jusqu'au premier jour qui n'est aucun des trois**. Le samedi n'est pas
 * un jour de report ; les jours À SURVEILLER n'en sont pas non plus ; une entrée chômée
 * seulement « à partir de midi » (le Lundi Gras) ne reporte pas la tête d'affiche, et la
 * lecture nommée `DEMI_JOURNEE` porte la date qu'elle aurait si elle la reportait.
 *
 * ⚠️ **CET EN-TÊTE A ANNONCÉ LE CONTRAIRE PENDANT UNE JOURNÉE**, et c'est le défaut 14 de la
 * troisième recette : il énonçait « LE CALCUL Y EST FRANC PUR — départ + N + 1, et rien
 * d'autre […] Ni prorogation », c'est-à-dire la décision du MATIN du 20 août 2026 (« les délais
 * pouvant être prorogés n'ont aucune incidence sur le calculateur public »). Me Vaval l'a
 * REPRISE le même jour, après avoir vu une date limite tomber un dimanche : « il faut la
 * proroger au prochain jour ouvrable, donc le lundi 6 juillet ». Le code fait la seconde
 * décision depuis ce jour-là ; seule cette page continuait d'énoncer la première comme un
 * fait. `franc-pur.ts` prend soin d'avertir que son NOM est historique ; cet en-tête, non.
 *
 * Le calculateur du PORTAIL (`/{locale}/outils/delais`), lui, garde tout le reste — le
 * raisonnement, les lectures nommées, le bloc praticable, les avertissements, le permalien —
 * parce qu'il calcule sur une entrée du répertoire, où chacun a un fondement.
 *
 * ⚠️ **ET ELLE N'AFFICHE QUE LA DATE** (Me Vaval, 20 août 2026 : « Le portail public doit
 * uniquement afficher la date. Pas besoin de rediriger l'utilisateur vers une autre page, ou
 * de lui expliquer le raisonnement qui a mené au résultat. Si la date calculée tombe un jour
 * férié, le résultat l'affichera en petits caractères. »). Cette page DEMEURE — un lien
 * direct doit continuer de marcher —, mais elle porte exactement ce que porte le héros de
 * l'accueil : les deux champs, la date, la règle de droit. Le raisonnement, les jours écartés,
 * les lectures nommées, le jour praticable, les avertissements, le permalien, l'impression et
 * le presse-papiers restent au PORTAIL (`/{locale}/outils/delais`), qui n'a rien perdu.
 *
 * ⚠️ **`publicIntro` a été retiré avec eux** : « la plateforme rend la date, et le raisonnement
 * qui la fonde » promettait ce que cette page ne fait plus. Le titre suffit ; la clé a quitté
 * les trois catalogues plutôt que d'y attendre un usage.
 *
 * ⚠️ **Piège de routage.** `src/app/[locale]/(app)/` est un groupe de routes : ses enfants
 * résolvent sous `/{locale}/…`. La surface connectée est donc à `(app)/outils/delais` — une
 * page `(app)/delais` entrerait en collision avec CELLE-CI et le build échouerait.
 *
 * L'URL porte l'état de la saisie — `?d=…&n=…` —, et un permalien du portail rouvert ici
 * continue d'être lu. Aucune écriture serveur, un `GET` pur.
 */

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const { locale, t } = dictFor(params.locale)
  const languages = Object.fromEntries(LOCALES.map((l) => [l, `/${l}/delais`]))
  return {
    title: t.delais.metaTitle,
    // ⚠️ `metaDescriptionPublique`, pas `metaDescription` : celle du portail annonce des
    // lectures nommées et la prorogation de l'art. 991, montrées « à côté » de la date. Cette
    // page-ci n'en rend aucune depuis `franc-pur.ts` — elle promettrait ce qu'elle ne fait pas.
    description: t.delais.metaDescriptionPublique,
    alternates: {
      canonical: `/${locale}/delais`,
      languages: { ...languages, 'x-default': '/fr/delais' },
    },
  }
}

export default async function DelaisPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: RechercheDelai
}) {
  const { locale, t } = dictFor(isLocale(params.locale) ? params.locale : 'fr')
  const d = t.delais

  return (
    <div className="min-h-screen bg-koton">
      <PublicHeader locale={locale} t={t} width="max-w-7xl" />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6">
        <nav aria-label="Fil d’Ariane" className="no-print text-sm text-ank/80">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href={`/${locale}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center transition hover:text-chabon hover:underline">
                {d.breadcrumbHome}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-ank">{d.breadcrumbHere}</li>
          </ol>
        </nav>

        <h1 className="mt-3 font-serif text-3xl font-semibold text-ank lg:text-4xl">{d.title}</h1>

        {/* Composant serveur asynchrone, rendu en JSX : `@types/react` 18.3.31 le type
            (`ReactNode` accepte une promesse). L'ancien détour par un appel de fonction
            n'avait plus lieu d'être. */}
        <div className="mt-6">
          <DelaiCalculateurPublic locale={locale} t={t} recherche={searchParams} action={`/${locale}/delais`} />
        </div>

        <p className="mt-8 max-w-3xl text-xs leading-relaxed text-ank/80">{d.disclaimer}</p>
      </main>

      <footer className="no-print border-t border-chabon/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ank/80">
          <span>© 2026 Lam</span>
          <nav className="flex gap-4">
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/cgu`}>{t.legal.cgu}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/confidentialite`}>{t.legal.confidentialite}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/mentions-legales`}>{t.legal.mentions}</Link>
          </nav>
        </div>
      </footer>

      <CookieBanner
        text={locale === 'en'
          ? 'Lam uses strictly necessary cookies (session, authentication, language). With your consent, analytics cookies help us improve the Platform.'
          : locale === 'ht'
            ? 'Lam itilize cookies ki estrikteman nesesè (sesyon, otantifikasyon, lang). Ak akò ou, cookies analiz ede nou amelyore Platfòm nan.'
            : "Lam utilise des cookies strictement nécessaires (session, authentification, langue). Avec votre accord, des cookies d'analyse nous aident à améliorer la Plateforme."}
        accept={locale === 'en' ? 'Accept all' : locale === 'ht' ? 'Aksepte tout' : 'Tout accepter'}
        reject={locale === 'en' ? 'Reject non-essential' : locale === 'ht' ? 'Refize sa ki pa esansyèl' : 'Refuser les non essentiels'}
        manage={locale === 'en' ? 'Manage' : locale === 'ht' ? 'Jere' : 'Gérer'}
        manageHref={`/${locale}/confidentialite#s9`}
      />
    </div>
  )
}
