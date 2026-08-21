/**
 * § 4.1 et § 8.2 — LE FORMATAGE D'AFFICHAGE. **Ni `Date`, ni `Intl`.**
 *
 * `Intl` ne couvre pas le créole haïtien (cf. `src/lib/i18n/format.ts`, qui replie `ht` sur
 * `fr`), et un `toLocaleDateString` reconstruit une date à partir d'un fuseau — exactement le
 * piège du § 4.1. Les noms de mois et de jours sont donc des DONNÉES, ici.
 *
 * ⚠️ CORRECTIF (défaut 17 a du cahier de recette). Le § 8.2 veut ces noms DANS le dictionnaire
 * i18n, dans les trois locales ; ils étaient ici, en dur, sous un commentaire « À MIGRER »,
 * alors que l'avertissement A6 les emploie DÉJÀ pour dater en toutes lettres. Ils y sont
 * maintenant : `t.delais.jours` et `t.delais.mois`, dans `fr.ts`, `en.ts` et `ht.ts`.
 *
 * Le sens de la dépendance est l'INVERSE de ce que suggérait le commentaire, et c'est
 * délibéré : ce sont les trois locales qui IMPORTENT `JOURS` et `MOIS` d'ici, et non ce
 * fichier qui va les chercher dans le dictionnaire. Le § 4.1 exige que le noyau puisse
 * rédiger la phrase de A6 sans dépendre du catalogue i18n (qui tire `BRAND` et toute
 * l'application avec lui) ; une seule copie existe donc, la dérive est impossible dans les
 * deux sens, et `format.test.ts` le prouve.
 *
 * ⚠️ **Les noms créoles n'ont TOUJOURS PAS été relus par la rédaction** : à faire relire avant
 * de les figer (§ 8.2). Les douze mois et les sept jours, un par un.
 */
import type { CivilDate } from './civil'
import { dayOfWeek, formatIso } from './civil'

export type Locale = 'fr' | 'en' | 'ht'

/** 0 = dimanche. Ré-exporté : `t.delais.jours` des trois locales part d'ici (§ 8.2). */
export const JOURS: Record<Locale, readonly string[]> = {
  fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ht: ['dimanch', 'lendi', 'madi', 'mèkredi', 'jedi', 'vandredi', 'samdi'],
}

/** Janvier = index 0. Ré-exporté : `t.delais.mois` des trois locales part d'ici (§ 8.2). */
export const MOIS: Record<Locale, readonly string[]> = {
  fr: [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  ht: [
    'janvye',
    'fevriye',
    'mas',
    'avril',
    'me',
    'jen',
    'jiyè',
    'out',
    'septanm',
    'oktòb',
    'novanm',
    'desanm',
  ],
}

/** Nom du jour de la semaine. */
export function nomJour(date: CivilDate, locale: Locale = 'fr'): string {
  return JOURS[locale][dayOfWeek(date)]
}

/** Nom du mois. */
export function nomMois(mois: number, locale: Locale = 'fr'): string {
  return MOIS[locale][mois - 1]
}

/**
 * « lundi 6 juillet 2026 ». Le jour de la semaine est OBLIGATOIRE dans ce produit (§ 6.3 a) :
 * c'est lui qui rend visible qu'un samedi n'a pas été prorogé, et qu'un dimanche l'a été.
 * Le 1er du mois s'écrit « 1er » en français.
 */
export function dateEnToutesLettres(date: CivilDate, locale: Locale = 'fr'): string {
  const jour = nomJour(date, locale)
  const mois = nomMois(date.m, locale)
  if (locale === 'en') return `${jour} ${date.d} ${mois} ${date.y}`
  const quantieme = date.d === 1 ? '1er' : String(date.d)
  return `${jour} ${quantieme} ${mois} ${date.y}`
}

/** « 06/07/2026 » — la forme que l'utilisatrice saisit et relit. */
export function dateEnChiffres(date: CivilDate): string {
  const d = date.d < 10 ? `0${date.d}` : String(date.d)
  const m = date.m < 10 ? `0${date.m}` : String(date.m)
  return `${d}/${m}/${date.y}`
}

/** « lundi 6 juillet 2026 — 06/07/2026 » : le gabarit vérifié du § 6.3 a). */
export function dateComplete(date: CivilDate, locale: Locale = 'fr'): string {
  return `${dateEnToutesLettres(date, locale)} — ${dateEnChiffres(date)}`
}

/** Forme de permalien et de stockage. Ré-exportée ici pour n'avoir qu'un point d'entrée. */
export { formatIso }
