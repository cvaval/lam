import { LOCALES, DEFAULT_LOCALE, isLocale, type Locale } from '../types'

export { LOCALES, DEFAULT_LOCALE, isLocale }
export type { Locale }

/** Nom du cookie de préférence de langue (middleware + LocaleSwitcher). */
export const LOCALE_COOKIE = 'lv_locale'

export const LOCALE_NAMES: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  ht: 'Kreyòl',
}

// Libellé court affiché dans le sélecteur de la TopBar (§02).
export const LOCALE_SHORT: Record<Locale, string> = {
  fr: 'FR',
  en: 'EN',
  ht: 'KR', // affichage « KR » (Kreyòl) — le code de locale reste « ht »
}

export function resolveLocale(input?: string | null): Locale {
  return input && isLocale(input) ? input : DEFAULT_LOCALE
}
