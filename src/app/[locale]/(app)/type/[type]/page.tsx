import { redirect } from 'next/navigation'
import { resolveLocale } from '@/lib/i18n/config'

// Accès rapide à un type (§07) → vue recherche filtrée sur ce type.
// Exception : la Législation ouvre la navigation dédiée Moniteur (année → mois → numéro).
export default function TypePage({ params }: { params: { locale: string; type: string } }) {
  const locale = resolveLocale(params.locale)
  if (params.type === 'legislation') redirect(`/${locale}/legislation`)
  redirect(`/${locale}/search?type=${encodeURIComponent(params.type)}`)
}
