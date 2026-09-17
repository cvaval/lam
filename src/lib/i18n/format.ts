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

/**
 * Le DÉBUT DE LA JOURNÉE en cours à Port-au-Prince, comme instant UTC — pour compter « les
 * recherches d'aujourd'hui ». Sur Vercel, `new Date().setHours(0,0,0,0)` donnait minuit UTC : à
 * 20 h à Port-au-Prince, la journée était déjà « finie » et le compteur affichait 0 pendant que
 * 92 recherches avaient été faites dans la journée (16 sept. 2026).
 */
export function debutDeJourneeHaiti(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU_HAITI, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  // Minuit local = maintenant − (heures, minutes, secondes locales écoulées). Exact quel que
  // soit le décalage (UTC−4 / UTC−5), puisqu'on soustrait le temps écoulé, pas un décalage supposé.
  const ecoule = (v('hour') * 3600 + v('minute') * 60 + v('second')) * 1000 + now.getMilliseconds()
  return new Date(now.getTime() - ecoule)
}
