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

/**
 * Fuseau de la plateforme pour les INSTANTS — connexions, événements du journal.
 * L'IANA porte l'heure d'été haïtienne (UTC−4 l'été, UTC−5 l'hiver) : aucun décalage n'est
 * codé ici, et aucun ne doit l'être.
 */
export const FUSEAU_HAITI = 'America/Port-au-Prince'

/**
 * Un INSTANT en heure de Port-au-Prince — jamais une date juridique.
 *
 * ⚠️ POURQUOI UNE SECONDE FONCTION ET PAS UNE CORRECTION DE `formatDate`. `formatDate` force
 * UTC à dessein : les dates du corpus (`publicationDate`, `adoptionDate`) sont stockées à minuit
 * UTC, et les convertir en heure locale ferait reculer d'un jour tout texte de loi de la
 * plateforme. Un instant, lui, s'est produit à une heure précise et le lecteur vit à
 * Port-au-Prince : la page « Logs de sécurité » affichait 19 h 49 pour une connexion faite à
 * 15 h 49. Deux notions, deux fonctions — et l'écran nomme la zone une fois, en tête.
 */
export function formatInstant(
  locale: Locale,
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(intlLocale(locale), { ...options, timeZone: FUSEAU_HAITI }).format(d)
}
