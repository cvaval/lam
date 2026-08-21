import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { dictFor } from '@/lib/i18n/server'
import { Landing } from '@/components/Landing'
import { lireHerosDelais } from '@/components/delais/noyau-calculateur'
import type { RechercheDelai } from '@/components/delais/noyau-calculateur'

export const dynamic = 'force-dynamic'

/**
 * Accueil public du portail : landing pour les visiteurs ; tableau de bord si connecté.
 *
 * § 6.1 — **LE HÉROS DES DÉLAIS CALCULE SUR PLACE, ET C'EST ICI QUE LE CALCUL EST FAIT.**
 * Son formulaire est un `GET` qui revient sur cette page avec `?d=…&n=…` : rien ne navigue,
 * rien n'est requêté depuis le navigateur, et le résultat est dans le HTML initial — donc il
 * existe script désactivé. `lireHerosDelais` rend `null` quand la requête ne porte pas les
 * deux champs : **une visite ordinaire de l'accueil ne touche toujours pas à la base.**
 *
 * ⚠️ La frontière asynchrone est ICI, et nulle part plus bas : `Landing` et `DelaisHeroSlide`
 * restent des composants synchrones (voir `Landing.test.tsx`).
 */
export default async function LocaleRoot({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: RechercheDelai
}) {
  const { locale, t } = dictFor(params.locale)
  const user = await getCurrentUser()
  if (user) redirect(`/${locale}/dashboard`)
  const delais = await lireHerosDelais({ locale, t, recherche: searchParams ?? {} })
  return <Landing locale={locale} t={t} delais={delais} />
}
