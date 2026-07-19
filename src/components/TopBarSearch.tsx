'use client'

import { usePathname } from 'next/navigation'
import { SearchBox } from './SearchBox'
import type { Locale } from '@/lib/types'

/**
 * Barre de recherche du TopBar — UNE seule barre par page (audit 17 juil.) :
 * masquée sur le tableau de bord, dont le grand omnibox central EST la barre
 * de la page. Partout ailleurs, c'est celle-ci qui sert.
 */
export function TopBarSearch({ locale, placeholder, advancedLabel }: { locale: Locale; placeholder: string; advancedLabel: string }) {
  const pathname = usePathname()
  if (pathname === `/${locale}/dashboard`) return null
  return <SearchBox locale={locale} placeholder={placeholder} advancedLabel={advancedLabel} />
}
