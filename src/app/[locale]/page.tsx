import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { dictFor } from '@/lib/i18n/server'
import { Landing } from '@/components/Landing'

export const dynamic = 'force-dynamic'

// Accueil public du portail : landing pour les visiteurs ; tableau de bord si connecté.
export default async function LocaleRoot({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await getCurrentUser()
  if (user) redirect(`/${locale}/dashboard`)
  return <Landing locale={locale} t={t} />
}
