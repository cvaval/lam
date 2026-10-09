import Link from 'next/link'
import type { Metadata } from 'next'
import { AgoraPublicHeader } from '@/components/AgoraPublicHeader'
import '@/components/agora-portal.css'
import { dictFor } from '@/lib/i18n/server'
import { isLocale, LOCALES } from '@/lib/types'
import { getNotaryDirectory } from '@/lib/jurisdictions/data'
import { NotaryDirectoryView } from '@/components/jurisdictions/NotaryDirectoryView'

export const dynamic = 'force-dynamic'

/**
 * Notaires PAR JURIDICTION — la liste textuelle de la couche « notaires ». La carte n'est
 * jamais le seul accès à l'information : cette page est COMPLÈTE, lisible sans JavaScript et
 * imprimable. Classement : par TPI (déduit du rattachement TPI_COMPETENT de la commune), puis
 * par commune, puis par numéro de liste. Une ancre par TPI (l'identifiant de la juridiction),
 * visée depuis la carte du TPI de chaque fiche.
 */
export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const { locale, t } = dictFor(params.locale)
  const languages = Object.fromEntries(LOCALES.map((l) => [l, `/${l}/juridictions/notaires`]))
  return {
    title: t.judicial.notariesMetaTitle,
    description: t.judicial.notariesMetaDescription,
    alternates: { canonical: `/${locale}/juridictions/notaires`, languages: { ...languages, 'x-default': '/fr/juridictions/notaires' } },
  }
}

export default async function NotairesParJuridictionPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(isLocale(params.locale) ? params.locale : 'fr')
  const j = t.judicial
  const dir = await getNotaryDirectory()

  return (
    <div className="agora-portal min-h-screen bg-koton">
      <AgoraPublicHeader locale={locale} />

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 md:px-8">
        <nav aria-label="Fil d’Ariane" className="text-sm text-ank/80">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href={`/${locale}`} className="inline-flex min-h-[44px] items-center transition hover:text-chabon hover:underline">{j.breadcrumbHome}</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href={`/${locale}/juridictions`} className="inline-flex min-h-[44px] items-center transition hover:text-chabon hover:underline">{j.breadcrumbHere}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-ank">{j.notaries}</li>
          </ol>
        </nav>

        <h1 className="mt-3 font-serif text-3xl font-semibold text-ank lg:text-4xl">
          <span aria-hidden="true" className="mr-2">👤</span>{j.notariesByJurisdiction}
        </h1>
        <p className="mt-2 max-w-3xl leading-relaxed text-grafit">{j.notariesIntro}</p>

        <NotaryDirectoryView dir={dir} locale={locale} t={t} />

        <p className="mt-8">
          <Link href={`/${locale}/juridictions`} className="inline-flex min-h-[44px] items-center text-sm font-medium text-ank underline underline-offset-2 transition hover:text-chabon">
            ← {j.notariesBackToMap}
          </Link>
        </p>
      </main>

      <footer className="border-t border-chabon/10 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ank/80 md:px-8">
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
