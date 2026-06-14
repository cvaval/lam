import { notFound } from 'next/navigation'
import { PublicationArticle } from '@/components/PublicationArticle'
import { getPublication } from '@/lib/publications'
import { dictFor } from '@/lib/i18n/server'

// Page publique — billet éditorial (FR par défaut, ?lang=en pour l'anglais).
export default function PublicationPage({
  params,
  searchParams,
}: {
  params: { locale: string; slug: string }
  searchParams: { lang?: string }
}) {
  const { locale, t } = dictFor(params.locale)
  const pub = getPublication(params.slug)
  if (!pub) notFound()
  const lang = searchParams.lang === 'en' ? 'en' : 'fr'
  return <PublicationArticle pub={pub} locale={locale} t={t} lang={lang} />
}
