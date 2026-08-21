/**
 * § 4.1 — LE TYPE DE DATE DU CALCULATEUR DE DÉLAIS. **AUCUN `Date` DANS CE FICHIER.**
 *
 * Vercel tourne en UTC, Haïti est en UTC−5/−4. Une date saisie « 2026-11-01 » construite en
 * `new Date()` puis relue localement redescend au 31 octobre. Sur un délai de recours, un jour
 * perdu est une **déchéance**. Le corpus en porte déjà la trace : les `publicationDate` de
 * l'INDEX sont stockées à minuit UTC.
 *
 * Toute l'arithmétique passe donc par le **jour julien** (entier), et par lui seul :
 * pas d'heure, pas de fuseau, pas de changement d'heure, pas d'`Intl`.
 *
 * Interdits, contrôlés par `noyau-pur.test.ts` (bloc 6 du § 9) :
 * `new Date`, `Date.now`, `Date.UTC`, `getTimezoneOffset`, `toLocaleDateString`, `Intl.`.
 */

/** Une date civile : l'année, le mois (1..12) et le quantième. Rien d'autre. */
export type CivilDate = { y: number; m: number; d: number }

/** Jours de chaque mois, février mis à part. */
const JOURS_MOIS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Règle grégorienne complète : 2000 est bissextile, 1900 ne l'est pas. */
export function estBissextile(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/** Nombre de jours du mois `m` (1..12) de l'année `y`. */
export function joursDansLeMois(y: number, m: number): number {
  if (m < 1 || m > 12) return 0
  if (m === 2) return estBissextile(y) ? 29 : 28
  return JOURS_MOIS[m - 1]
}

/** Une valeur est-elle une date civile RÉELLE ? Le 31 février n'en est pas une. */
export function isValidCivil(v: unknown): v is CivilDate {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  const { y, m, d } = o
  if (typeof y !== 'number' || typeof m !== 'number' || typeof d !== 'number') return false
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false
  if (m < 1 || m > 12) return false
  return d >= 1 && d <= joursDansLeMois(y, m)
}

/**
 * Jour julien (Fliegel & Van Flandern), en arithmétique ENTIÈRE. Le calendrier est
 * grégorien proleptique : le calculateur ne sert de toute façon aucun dossier antérieur
 * au 22 juin 1989 (§ 4.3), les six arrêts de 1962-1966 exceptés.
 */
export function toJdn(date: CivilDate): number {
  const a = Math.floor((14 - date.m) / 12)
  const y = date.y + 4800 - a
  const m = date.m + 12 * a - 3
  return (
    date.d +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  )
}

/** Inverse de `toJdn`. */
export function fromJdn(jdn: number): CivilDate {
  const a = jdn + 32044
  const b = Math.floor((4 * a + 3) / 146097)
  const c = a - Math.floor((146097 * b) / 4)
  const d2 = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * d2) / 4)
  const m2 = Math.floor((5 * e + 2) / 153)
  return {
    d: e - Math.floor((153 * m2 + 2) / 5) + 1,
    m: m2 + 3 - 12 * Math.floor(m2 / 10),
    y: 100 * b + d2 - 4800 + Math.floor(m2 / 10),
  }
}

/** Ajoute (ou retranche) des jours CALENDAIRES. Jamais de « jours ouvrés » : § 2.9. */
export function addDays(date: CivilDate, n: number): CivilDate {
  return fromJdn(toJdn(date) + n)
}

/** Écart en jours : `a − b`. Négatif si `a` précède `b`. */
export function diffDays(a: CivilDate, b: CivilDate): number {
  return toJdn(a) - toJdn(b)
}

/** 0 = dimanche, 1 = lundi … 6 = samedi. Recoupé contre `Date` au bloc 7 du § 9. */
export function dayOfWeek(date: CivilDate): number {
  const r = (toJdn(date) + 1) % 7
  return r < 0 ? r + 7 : r
}

/** Le dimanche est le SEUL jour de la semaine que l'art. 991 proroge. */
export function estDimanche(date: CivilDate): boolean {
  return dayOfWeek(date) === 0
}

/**
 * Le samedi n'est pas prorogé (§ 2.9) : deux derniers jours utiles fixés par la Cour de
 * cassation tombent un samedi sans aucun report (23 juin 1962, 2 novembre 1963).
 * Cette fonction ne sert qu'à RÉDIGER l'étape du raisonnement, jamais à décaler une date.
 */
export function estSamedi(date: CivilDate): boolean {
  return dayOfWeek(date) === 6
}

/** Ordre chronologique : < 0, 0 ou > 0. */
export function comparer(a: CivilDate, b: CivilDate): number {
  return toJdn(a) - toJdn(b)
}

export function egales(a: CivilDate, b: CivilDate): boolean {
  return a.y === b.y && a.m === b.m && a.d === b.d
}

export function avant(a: CivilDate, b: CivilDate): boolean {
  return comparer(a, b) < 0
}

export function apres(a: CivilDate, b: CivilDate): boolean {
  return comparer(a, b) > 0
}

/** La plus PRÉCOCE de deux dates — la doctrine du § 4.6 en dépend. */
export function laPlusPrecoce(a: CivilDate, b: CivilDate): CivilDate {
  return comparer(a, b) <= 0 ? a : b
}

/** La plus TARDIVE de deux dates (ligne « lecture la plus large »). */
export function laPlusTardive(a: CivilDate, b: CivilDate): CivilDate {
  return comparer(a, b) >= 0 ? a : b
}

function deuxChiffres(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** `YYYY-MM-DD`. Forme de stockage, de permalien et de test. */
export function formatIso(date: CivilDate): string {
  const y = String(date.y).padStart(4, '0')
  return `${y}-${deuxChiffres(date.m)}-${deuxChiffres(date.d)}`
}

/** Lit `YYYY-MM-DD` STRICTEMENT. Une date impossible rend `null`, jamais une date rattrapée. */
export function parseIso(s: string): CivilDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s ?? '').trim())
  if (!m) return null
  const date = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
  return isValidCivil(date) ? date : null
}

/**
 * Lit un `JJ/MM/AAAA`, tolérant aux séparateurs `/ . -` et aux espaces. **Jamais MM/JJ** :
 * l'ambiguïté anglo-saxonne est exactement l'erreur d'un jour que ce produit existe pour
 * éviter. L'année s'écrit en quatre chiffres : « 26 » est refusé plutôt qu'interprété.
 *
 * ⚠️ **Ce n'est plus la forme du CHAMP de saisie.** Le § 8.3 est désormais un
 * `<input type="date">` natif, dont la valeur est toujours `AAAA-MM-JJ` quelle que soit la
 * locale du poste — le format n'y varie qu'à l'AFFICHAGE. Cette fonction ne survit que pour
 * relire une adresse tapée à la main, ou un permalien venu d'une autre origine, qui peuvent
 * encore porter du JJ/MM/AAAA (voir l'en-tête de `DelaiDateField.tsx`).
 */
export function parseFrSaisie(s: string): CivilDate | null {
  const t = (s ?? '').trim()
  const m = /^(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4})$/.exec(t)
  if (!m) return null
  const date = { y: Number(m[3]), m: Number(m[2]), d: Number(m[1]) }
  return isValidCivil(date) ? date : null
}
