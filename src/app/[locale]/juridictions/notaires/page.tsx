import Link from 'next/link'
import type { Metadata } from 'next'
import { AgoraPublicHeader } from '@/components/AgoraPublicHeader'
import '@/components/agora-portal.css'
import { dictFor } from '@/lib/i18n/server'
import { isLocale, LOCALES } from '@/lib/types'
import { lireParamsAnnuaire } from '@/lib/jurisdictions/annuaire-notaires'
import { chargerAnnuaire } from '@/lib/jurisdictions/annuaire-chargement'
import { AnnuaireListe } from '@/components/jurisdictions/NotaryAnnuaireView'
import { AncreHeritee } from '@/components/jurisdictions/AncreHeritee'
import { lienDemande } from '@/components/jurisdictions/NotariesSection'
import { demandesOuvertes } from '@/lib/jurisdictions/notaires-demandes'
import { FicheNotaireModale } from '@/components/jurisdictions/FicheNotaireModale'
import { libellesModale } from '@/components/jurisdictions/fiche-libelles'
import { ficheInitiale, metadonneesFiche } from '@/lib/jurisdictions/fiche-chargement'

export const dynamic = 'force-dynamic'

/**
 * Page d'ANNUAIRE des notaires (`/juridictions/notaires`, adresse conservée). Elle présente LA MÊME
 * liste que l'onglet « Notaires » de la carte (`AnnuaireListe`) : mêmes données, même classement
 * (juridiction, adresse exacte d'abord, nom de famille), mêmes filtres (`?q=`, `?juridiction=`,
 * `?commune=`, `?page=`). La carte n'y figure pas : « Situer la commune » mène à l'onglet. Les
 * anciennes ancres (`#court-…`, `#commune-…`) deviennent le filtre correspondant (`AncreHeritee`).
 * `?notaire=<id>` : la fiche de ce notaire, ouverte en fenêtre modale au-dessus de la liste
 * (`FicheNotaireModale`). Rendu serveur, lisible sans JavaScript.
 */
export async function generateMetadata({ params, searchParams }: { params: { locale: string }; searchParams: Record<string, string | string[] | undefined> }): Promise<Metadata> {
  const { locale, t } = dictFor(params.locale)
  const fiche = await metadonneesFiche(searchParams.notaire, locale, t)
  if (fiche) return fiche
  const languages = Object.fromEntries(LOCALES.map((l) => [l, `/${l}/juridictions/notaires`]))
  return {
    title: t.judicial.annuaireMetaTitle,
    description: t.judicial.annuaireMetaDescription,
    alternates: { canonical: `/${locale}/juridictions/notaires`, languages: { ...languages, 'x-default': '/fr/juridictions/notaires' } },
  }
}

export default async function AnnuaireNotairesPage({
  params, searchParams,
}: { params: { locale: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const { locale, t } = dictFor(isLocale(params.locale) ? params.locale : 'fr')
  const j = t.judicial
  const [{ etat, params: p, communeInconnue }, initialFiche] = await Promise.all([
    chargerAnnuaire(lireParamsAnnuaire(searchParams)),
    ficheInitiale(searchParams.notaire),
  ])

  return (
    <div className="agora-portal min-h-screen bg-koton">
      <AgoraPublicHeader locale={locale} />
      <AncreHeritee />

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6 md:px-8">
        <nav aria-label="Fil d’Ariane" className="text-sm text-ank/80">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href={`/${locale}`} className="inline-flex min-h-[44px] items-center transition hover:text-chabon hover:underline">{j.breadcrumbHome}</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href={`/${locale}/juridictions`} className="inline-flex min-h-[44px] items-center transition hover:text-chabon hover:underline">{j.breadcrumbHere}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-ank">{j.annuaireTitle}</li>
          </ol>
        </nav>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 id="ag-annuaire-titre" tabIndex={-1} className="font-serif text-3xl font-semibold text-chabon lg:text-4xl">{j.annuaireTitle}</h1>
            <p className="mt-1 font-serif text-lg text-[#52656B]">{j.annuairePageSubtitle}</p>
          </div>
          <Link
            href={`/${locale}/juridictions?vue=notaires`}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-2 self-start rounded-lg border border-chabon bg-white px-4 text-sm font-medium text-chabon transition hover:bg-[#E9EDE7] sm:self-auto"
          >
            {j.annuaireShowMap} <span aria-hidden="true">→</span>
          </Link>
        </div>

        {communeInconnue && (
          <p role="status" className="mt-4 rounded-xl border border-chabon/40 bg-pil px-4 py-3 text-sm text-ank/80">{j.notFoundCommune}</p>
        )}

        <div className="mt-6">
          <AnnuaireListe locale={locale} t={t} etat={etat} params={p} ou="page" sansTitre />
        </div>

        {demandesOuvertes() && (
          <p className="mt-6 text-[12px] text-ank/80">
            <Link href={lienDemande(locale, { type: 'inscription' })} className="inline-flex min-h-[44px] items-center underline underline-offset-2 transition hover:text-chabon">
              {j.notaryRequestLinkListing}
            </Link>
          </p>
        )}
      </main>

      <footer className="border-t border-chabon/10 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ank/80 md:px-8">
          <span>© 2026 Agora</span>
          <nav className="flex flex-wrap gap-x-4">
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/cgu`}>{t.legal.cgu}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/confidentialite`}>{t.legal.confidentialite}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/mentions-legales`}>{t.legal.mentions}</Link>
            <a className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href="mailto:legal@agora.ht">legal@agora.ht</a>
          </nav>
        </div>
      </footer>

      <FicheNotaireModale
        locale={locale} l={libellesModale(t)} demandes={demandesOuvertes()} contexte="page" initial={initialFiche}
        titres={{ page: j.annuaireMetaTitle, fiche: j.notaryMetaTitle }}
      />
    </div>
  )
}
