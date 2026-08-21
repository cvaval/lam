/**
 * Bloc 6 (partiel) et bloc 7 du § 9 — le type de date civile.
 *
 * Pourquoi ce fichier existe : Vercel tourne en UTC, Haïti en UTC−5/−4. Une date saisie
 * « 2026-11-01 » construite en `new Date()` puis relue localement redescend au 31 octobre.
 * Sur un délai de recours, un jour perdu est une déchéance. Le noyau n'emploie donc AUCUN
 * `Date` — et ce fichier le vérifie contre `Date` lui-même, ce qui est précisément son objet.
 */
import { describe, it, expect } from 'vitest'
import {
  addDays,
  comparer,
  dayOfWeek,
  diffDays,
  egales,
  estBissextile,
  formatIso,
  fromJdn,
  isValidCivil,
  joursDansLeMois,
  parseFrSaisie,
  parseIso,
  toJdn,
} from './civil'

describe('CivilDate — validité', () => {
  it('accepte une date réelle et refuse le 31 février', () => {
    expect(isValidCivil({ y: 2026, m: 2, d: 28 })).toBe(true)
    expect(isValidCivil({ y: 2026, m: 2, d: 31 })).toBe(false)
    expect(isValidCivil({ y: 2026, m: 13, d: 1 })).toBe(false)
    expect(isValidCivil({ y: 2026, m: 0, d: 1 })).toBe(false)
    expect(isValidCivil({ y: 2026, m: 4, d: 31 })).toBe(false)
  })

  it('connaît les années bissextiles, y compris la règle séculaire', () => {
    expect(estBissextile(2024)).toBe(true)
    expect(estBissextile(1900)).toBe(false)
    expect(estBissextile(2000)).toBe(true)
    expect(joursDansLeMois(2024, 2)).toBe(29)
    expect(joursDansLeMois(1900, 2)).toBe(28)
    expect(isValidCivil({ y: 2024, m: 2, d: 29 })).toBe(true)
    expect(isValidCivil({ y: 2023, m: 2, d: 29 })).toBe(false)
  })

  it('refuse les valeurs qui ne sont pas des entiers', () => {
    expect(isValidCivil({ y: 2026, m: 1.5, d: 1 })).toBe(false)
    expect(isValidCivil({ y: 2026, m: 1, d: NaN })).toBe(false)
    expect(isValidCivil(null)).toBe(false)
    expect(isValidCivil('2026-01-01')).toBe(false)
  })
})

describe('CivilDate — arithmétique en jour julien', () => {
  it('fait l’aller-retour toJdn / fromJdn sur 20 000 jours consécutifs', () => {
    let jdn = toJdn({ y: 1990, m: 1, d: 1 })
    for (let i = 0; i < 20_000; i++) {
      const d = fromJdn(jdn + i)
      expect(toJdn(d)).toBe(jdn + i)
      expect(isValidCivil(d)).toBe(true)
    }
  })

  it('franchit les fins de mois, les fins d’année et le 29 février', () => {
    expect(addDays({ y: 2026, m: 12, d: 31 }, 1)).toEqual({ y: 2027, m: 1, d: 1 })
    expect(addDays({ y: 2024, m: 2, d: 28 }, 1)).toEqual({ y: 2024, m: 2, d: 29 })
    expect(addDays({ y: 2023, m: 2, d: 28 }, 1)).toEqual({ y: 2023, m: 3, d: 1 })
    expect(addDays({ y: 2026, m: 1, d: 1 }, -1)).toEqual({ y: 2025, m: 12, d: 31 })
  })

  it('compte les écarts dans les deux sens', () => {
    expect(diffDays({ y: 2026, m: 7, d: 6 }, { y: 2026, m: 6, d: 4 })).toBe(32)
    expect(diffDays({ y: 2026, m: 6, d: 4 }, { y: 2026, m: 7, d: 6 })).toBe(-32)
    expect(diffDays({ y: 2026, m: 6, d: 4 }, { y: 2026, m: 6, d: 4 })).toBe(0)
  })

  it('ordonne et compare', () => {
    expect(comparer({ y: 2026, m: 1, d: 1 }, { y: 2026, m: 1, d: 2 })).toBeLessThan(0)
    expect(comparer({ y: 2026, m: 2, d: 1 }, { y: 2026, m: 1, d: 2 })).toBeGreaterThan(0)
    expect(egales({ y: 2026, m: 1, d: 1 }, { y: 2026, m: 1, d: 1 })).toBe(true)
  })
})

/**
 * Bloc 7 — recoupement du jour de la semaine. Ce test a le DROIT d'employer `Date` :
 * c'est son objet. Le noyau, lui, ne l'emploie jamais (bloc 6, `noyau-pur.test.ts`).
 */
describe('dayOfWeek — recoupé contre Date sur 20 000 jours (1990-2044)', () => {
  it('coïncide jour pour jour', () => {
    const debut = toJdn({ y: 1990, m: 1, d: 1 })
    for (let i = 0; i < 20_000; i++) {
      const d = fromJdn(debut + i)
      const attendu = new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay()
      expect(dayOfWeek(d)).toBe(attendu)
    }
  })

  it('place le dimanche à 0 sur des dates connues', () => {
    expect(dayOfWeek({ y: 2026, m: 7, d: 5 })).toBe(0) // dimanche
    expect(dayOfWeek({ y: 2026, m: 7, d: 6 })).toBe(1) // lundi
    expect(dayOfWeek({ y: 1962, m: 6, d: 23 })).toBe(6) // samedi (arrêt Germeil)
    expect(dayOfWeek({ y: 1963, m: 11, d: 2 })).toBe(6) // samedi (Brown and Root)
  })
})

describe('Entrées / sorties de dates — jamais Intl, jamais Date', () => {
  it('lit et écrit la forme ISO', () => {
    expect(parseIso('2026-06-04')).toEqual({ y: 2026, m: 6, d: 4 })
    expect(formatIso({ y: 2026, m: 6, d: 4 })).toBe('2026-06-04')
    expect(formatIso({ y: 987, m: 1, d: 1 })).toBe('0987-01-01')
  })

  it('refuse une forme ISO impossible plutôt que de la rattraper', () => {
    expect(parseIso('2026-02-31')).toBeNull()
    expect(parseIso('2026-6-4')).toBeNull()
    expect(parseIso('')).toBeNull()
    expect(parseIso('hier')).toBeNull()
  })

  it('lit la saisie française JJ/MM/AAAA, tolérante aux séparateurs / . -', () => {
    expect(parseFrSaisie('04/06/2026')).toEqual({ y: 2026, m: 6, d: 4 })
    expect(parseFrSaisie('4.6.2026')).toEqual({ y: 2026, m: 6, d: 4 })
    expect(parseFrSaisie('04-06-2026')).toEqual({ y: 2026, m: 6, d: 4 })
    expect(parseFrSaisie(' 4 / 6 / 2026 ')).toEqual({ y: 2026, m: 6, d: 4 })
  })

  it('ne devine JAMAIS le mois : 06/04 n’est pas le 4 juin', () => {
    // Le format ambigu JJ/MM vs MM/JJ est exactement l'erreur d'un jour qu'on cherche à
    // éviter (§ 8.3). La saisie française est lue en JJ/MM, sans exception.
    expect(parseFrSaisie('06/04/2026')).toEqual({ y: 2026, m: 4, d: 6 })
    expect(parseFrSaisie('31/02/2026')).toBeNull()
    expect(parseFrSaisie('04/06/26')).toBeNull()
  })
})
