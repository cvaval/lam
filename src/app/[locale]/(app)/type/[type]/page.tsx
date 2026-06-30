import { redirect } from 'next/navigation'
import { resolveLocale } from '@/lib/i18n/config'

// Accès rapide à un type (§07) → vue recherche filtrée sur ce type.
// Exception : la Législation ouvre la navigation dédiée Moniteur (année → mois → numéro).
export default function TypePage({ params }: { params: { locale: string; type: string } }) {
  const locale = resolveLocale(params.locale)
  if (params.type === 'legislation') redirect(`/${locale}/legislation`)
  // « Législation annotée » (DOCTRINE) : la tuile ouvre la navigation par thèmes.
  if (params.type === 'doctrine') redirect(`/${locale}/doctrine`)
  // Tarifs douaniers : la tuile ouvre la table de tarifs (+ lien vers le corpus).
  if (params.type === 'tarifs') redirect(`/${locale}/tarifs`)
  redirect(`/${locale}/search?type=${encodeURIComponent(params.type)}`)
}
