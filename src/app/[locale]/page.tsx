import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { dictFor } from '@/lib/i18n/server'
import { Landing } from '@/components/Landing'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const title = params.locale === 'en'
    ? 'Agora — Haitian judicial map'
    : params.locale === 'ht'
      ? 'Agora — Kat jidisyè Ayiti a'
      : 'Agora — Carte judiciaire haïtienne'
  return {
    title,
    icons: {
      icon: [
        { url: '/brand/agora/favicon.svg?v=agora2', type: 'image/svg+xml' },
        { url: '/brand/agora/favicon.ico?v=agora2', sizes: 'any' },
      ],
      apple: '/brand/agora/apple-touch-icon.png?v=agora2',
    },
  }
}

/** Public judicial-map presentation; authenticated users enter the secure workspace. */
export default async function LocaleRoot({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await getCurrentUser()
  if (user) redirect(`/${locale}/dashboard`)
  return <Landing locale={locale} t={t} />
}
