import { redirect } from 'next/navigation'
import { resolveLocale } from '@/lib/i18n/config'

// Accès rapide à un type (§07) → vue recherche filtrée sur ce type.
export default function TypePage({ params }: { params: { locale: string; type: string } }) {
  const locale = resolveLocale(params.locale)
  redirect(`/${locale}/search?type=${encodeURIComponent(params.type)}`)
}
