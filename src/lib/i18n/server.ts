import { getDictionary } from './dictionaries'
import { resolveLocale } from './config'
import type { Locale } from '../types'

/** Helper pour les Server Components : résout la locale du segment d'URL + le dictionnaire. */
export function dictFor(localeParam: string): { locale: Locale; t: ReturnType<typeof getDictionary> } {
  const locale = resolveLocale(localeParam)
  return { locale, t: getDictionary(locale) }
}
