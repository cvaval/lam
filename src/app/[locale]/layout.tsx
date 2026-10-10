import { notFound } from 'next/navigation'
import { HtmlLang } from '@/components/HtmlLang'
import { CadreAvecFrise } from '@/components/CadreAvecFrise'
import { isLocale } from '@/lib/types'

export function generateStaticParams() {
  return [{ locale: 'fr' }, { locale: 'en' }, { locale: 'ht' }]
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  if (!isLocale(params.locale)) notFound()
  return (
    <>
      <HtmlLang locale={params.locale} />
      {/* Frise des monuments au bas de toutes les pages, sauf l'accueil, la connexion et la
          demande de coordonnées d'un notaire (qui ont la leur) — voir src/lib/frise.ts. */}
      <CadreAvecFrise>{children}</CadreAvecFrise>
    </>
  )
}
