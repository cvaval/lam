import './calculateur.css'
import Link from 'next/link'
import type { Metadata } from 'next'
import { DelaiCalculateurConnecte } from '@/components/delais/DelaiCalculateurConnecte'
import type { RechercheDelai } from '@/components/delais/DelaiCalculateur'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { isLocale, LOCALES } from '@/lib/types'

/**
 * § 6.4 — LE CALCULATEUR DANS LE CHROME APPLICATIF. Même moteur, mêmes composants ; deux
 * différences seulement :
 *   - les **liens profonds vers les Codes sont actifs** (pas de mur de connexion) ;
 *   - le formulaire pointe sur `/{locale}/outils/delais`, donc le permalien partagé depuis
 *     ici reste dans l'espace connecté.
 *
 * ⚠️ **Le segment `outils` est OBLIGATOIRE.** `src/app/[locale]/(app)/` est un groupe de
 * routes : une page `(app)/delais` résoudrait sous `/{locale}/delais`, exactement comme la
 * page publique, et le build échouerait sur « two parallel pages that resolve to the same
 * path ».
 *
 * ⚠️ **Garde propre malgré le layout.** `(app)/layout.tsx` appelle déjà `requireUser`, mais
 * un layout n'est pas une garde : la page le redemande pour son propre compte. C'est la règle
 * des deux gardes du dépôt, et elle vaut aussi entre une page et son layout.
 *
 * Ce calculateur **n'écrit rien** et **ne consomme aucun quota**, même connecté : c'est un
 * outil, pas une recherche (§ 4).
 */

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const { locale, t } = dictFor(params.locale)
  const languages = Object.fromEntries(LOCALES.map((l) => [l, `/${l}/outils/delais`]))
  return {
    title: t.delais.metaTitle,
    description: t.delais.metaDescription,
    alternates: {
      canonical: `/${locale}/outils/delais`,
      languages: { ...languages, 'x-default': '/fr/outils/delais' },
    },
  }
}

export default async function OutilDelaisPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: RechercheDelai
}) {
  const { locale, t } = dictFor(isLocale(params.locale) ? params.locale : 'fr')
  await requireUser(locale)
  const d = t.delais

  // Mise en page du portail (9 oct. 2026, aperçu Agora) : fil d'Ariane, titre en Source Serif 4,
  // une phrase d'orientation et un filet. La note de prudence (`d.intro`) n'est plus ici : elle
  // ouvre la colonne d'aide (« Avant de commencer : comment lire la date »), au mot près.
  // Styles propres à cette page : `calculateur.css` (préfixe `.ag-calculator-`).
  return (
    <div className="ag-calculator-page">
      <nav aria-label={t.common.breadcrumb} className="no-print text-[13px] text-grafit">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href={`/${locale}/dashboard`} className="inline-flex min-h-[44px] items-center transition hover:text-ank hover:underline">
              {t.nav.dashboard}
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="text-ank">{d.breadcrumbHere}</li>
        </ol>
      </nav>

      <header className="ag-calculator-heading border-b border-liy pb-6">
        <h1 className="font-serif text-[30px] font-semibold leading-tight tracking-[-0.5px] text-ank lg:text-[38px]">{d.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-grafit">{d.portalSubtitle}</p>
      </header>

      {/* Composant serveur asynchrone, rendu en JSX : `@types/react` 18.3.31 le type. */}
      <div className="mt-8">
        <DelaiCalculateurConnecte locale={locale} t={t} recherche={searchParams} action={`/${locale}/outils/delais`} />
      </div>

      <p className="mt-10 max-w-3xl text-xs leading-relaxed text-ank/80">{d.disclaimer}</p>
    </div>
  )
}
