import type { Locale } from '../types'

/**
 * Formatage de dates localisé. Intl ne couvre pas bien le créole haïtien :
 * le français sert de repli d'affichage pour `ht` (décision unique, ici).
 */
export function intlLocale(locale: Locale): string {
  return locale === 'ht' ? 'fr' : locale
}

export function formatDate(
  locale: Locale,
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' },
): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: 'UTC', ...options }).format(d)
}
