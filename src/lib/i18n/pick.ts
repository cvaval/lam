import type { Locale } from '../types'

/**
 * Sélectionne la variante linguistique d'un champ éditorial trilingue, avec repli
 * FR → EN → HT. Utilisé par le moteur de recherche et le visualiseur de documents.
 */
export function pickLocale(
  fr: string | null | undefined,
  en: string | null | undefined,
  ht: string | null | undefined,
  locale: Locale,
): string {
  if (locale === 'en') return en || fr || ht || ''
  if (locale === 'ht') return ht || fr || en || ''
  return fr || en || ht || ''
}
