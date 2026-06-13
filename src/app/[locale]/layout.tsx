import { notFound } from 'next/navigation'
import { HtmlLang } from '@/components/HtmlLang'
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
      {children}
    </>
  )
}
