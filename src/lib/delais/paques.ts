/**
 * § 4.2 — LE COMPUT DE PÂQUES ET LES SEPT DÉCALAGES. **AUCUN `Date` DANS CE FICHIER.**
 *
 * Quatre des sept jours mobiles prorogent (Mardi Gras, Vendredi Saint, Fête Dieu par le
 * décret du 23 mai 1989 et, depuis le 11 décembre 2024, le Lundi Gras). Les trois
 * autres — Mercredi des Cendres, Jeudi Saint, Ascension — **ne prorogent pas** : aucun texte
 * ne les institue. Ils sont néanmoins CALCULÉS, parce qu'ils figurent au calendrier en
 * catégorie `A_SURVEILLER` (§ 4.13) et déclenchent l'avertissement A6.
 *
 * Ne confonds pas « calculé » et « prorogeant ».
 */
import type { CivilDate } from './civil'
import { addDays } from './civil'

/**
 * Dimanche de Pâques (calendrier grégorien), algorithme anonyme dit de Meeus/Butcher,
 * en arithmétique entière. Vérifié contre une table indépendante sur douze millésimes
 * (§ 4.2) et contre le jour de la semaine sur deux siècles.
 */
export function paques(annee: number): CivilDate {
  const a = annee % 19
  const b = Math.floor(annee / 100)
  const c = annee % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const t = h + l - 7 * m + 114
  return { y: annee, m: Math.floor(t / 31), d: (t % 31) + 1 }
}

/** Les sept jours mobiles que le calendrier connaît. */
export type CleMobile =
  | 'lundi-gras'
  | 'mardi-gras'
  | 'mercredi-des-cendres'
  | 'jeudi-saint'
  | 'vendredi-saint'
  | 'ascension'
  | 'fete-dieu'

/**
 * Décalages par rapport au dimanche de Pâques, vérifiés (§ 4.2).
 * Le calendrier n'admet aucun autre décalage : `DelaiFerie.offsetPaques` est contrôlé
 * contre cette table à la graine.
 */
export const DECALAGES_PAQUES: Record<CleMobile, number> = {
  'lundi-gras': -48,
  'mardi-gras': -47,
  'mercredi-des-cendres': -46,
  'jeudi-saint': -3,
  'vendredi-saint': -2,
  ascension: 39,
  'fete-dieu': 60,
}

/** Date d'un jour mobile pour une année donnée. */
export function jourMobile(cle: CleMobile, annee: number): CivilDate {
  return addDays(paques(annee), DECALAGES_PAQUES[cle])
}

/** Décalage admis ? Garde-fou du back-office et de la graine. */
export function decalageConnu(offset: number): boolean {
  return Object.values(DECALAGES_PAQUES).includes(offset)
}
