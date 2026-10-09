import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { AgoraPublicHeader } from '@/components/AgoraPublicHeader'
import '@/components/agora-portal.css'
import { dictFor } from '@/lib/i18n/server'
import { isLocale, LOCALES } from '@/lib/types'
import { getNotaryProfile } from '@/lib/jurisdictions/data'
import { NotaryProfileView } from '@/components/jurisdictions/NotaryProfileView'

export const dynamic = 'force-dynamic'

/**
 * La page d'un notaire — le SEUL endroit où s'affichent les coordonnées de son étude (jamais
 * dans les points de la carte, les suggestions, la fiche de la commune ni la liste).
 *
 *  - entrée inconnue ou RETIRÉE (n° 37) : 404 ;
 *  - juridiction affichée sans « TPI » : les notaires ne dépendent pas des tribunaux de
 *    première instance (Me Vaval, 9 oct. 2026) ;
 *  - `noindex` : des coordonnées personnelles ne s'offrent pas aux moteurs de recherche tant
 *    que la cliente n'en a pas décidé autrement ;
 *  - rendu serveur, lisible sans JavaScript ; les téléphones sont des liens `tel:`.
 */
export async function generateMetadata({ params }: { params: { locale: string; id: string } }): Promise<Metadata> {
  const { locale, t } = dictFor(params.locale)
  const p = await getNotaryProfile(params.id)
  const languages = Object.fromEntries(LOCALES.map((l) => [l, `/${l}/juridictions/notaires/${params.id}`]))
  return {
    title: p ? t.judicial.notaryMetaTitle.replace('{name}', p.name) : t.judicial.notariesMetaTitle,
    robots: { index: false, follow: true },
    alternates: { canonical: `/${locale}/juridictions/notaires/${params.id}`, languages },
  }
}

export default async function NotairePage({ params }: { params: { locale: string; id: string } }) {
  const { locale, t } = dictFor(isLocale(params.locale) ? params.locale : 'fr')
  const j = t.judicial
  const p = await getNotaryProfile(params.id)
  if (!p) notFound()

  return (
    <div className="agora-portal min-h-screen bg-koton">
      <AgoraPublicHeader locale={locale} />

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 md:px-8">
        <nav aria-label="Fil d’Ariane" className="text-sm text-ank/80">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href={`/${locale}/juridictions`} className="inline-flex min-h-[44px] items-center transition hover:text-chabon hover:underline">{j.breadcrumbHere}</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href={`/${locale}/juridictions/notaires`} className="inline-flex min-h-[44px] items-center transition hover:text-chabon hover:underline">{j.notaries}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-ank">{p.name}</li>
          </ol>
        </nav>

        <NotaryProfileView p={p} locale={locale} t={t} />
      </main>

      <footer className="border-t border-chabon/10 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ank/80 md:px-8">
          <span>© 2026 Agora</span>
          <nav className="flex gap-4">
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/cgu`}>{t.legal.cgu}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/confidentialite`}>{t.legal.confidentialite}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/mentions-legales`}>{t.legal.mentions}</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
