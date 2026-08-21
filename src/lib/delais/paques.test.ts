/**
 * Bloc 4 du § 9 — le comput de Pâques et les SEPT décalages.
 *
 * Sept, et non quatre : le Mercredi des Cendres, le Jeudi Saint et l'Ascension ne prorogent
 * pas (aucun texte ne les institue), mais ils sont au calendrier en catégorie
 * `A_SURVEILLER` (§ 4.13) et doivent donc être CALCULÉS. « Calculé » et « prorogeant » ne
 * sont pas la même chose.
 */
import { describe, it, expect } from 'vitest'
import { dayOfWeek, formatIso } from './civil'
import { DECALAGES_PAQUES, jourMobile, paques } from './paques'

/** Table indépendante (§ 4.2) — les douze millésimes exigés, tous des dimanches. */
const TABLE_PAQUES: Record<number, string> = {
  1962: '1962-04-22',
  1963: '1963-04-14',
  1964: '1964-03-29',
  1965: '1965-04-18',
  1966: '1966-04-10',
  2000: '2000-04-23',
  2024: '2024-03-31',
  2025: '2025-04-20',
  2026: '2026-04-05',
  2027: '2027-03-28',
  2028: '2028-04-16',
  2032: '2032-03-28',
}

describe('Pâques — algorithme grégorien anonyme (Meeus/Butcher)', () => {
  it('tombe sur les douze millésimes figés de la table indépendante', () => {
    for (const [annee, iso] of Object.entries(TABLE_PAQUES)) {
      expect(formatIso(paques(Number(annee)))).toBe(iso)
    }
  })

  it('tombe TOUJOURS un dimanche, sur 200 années consécutives', () => {
    for (let y = 1900; y < 2100; y++) expect(dayOfWeek(paques(y))).toBe(0)
  })
})

describe('Les sept décalages', () => {
  it('porte exactement les sept, avec leurs valeurs', () => {
    expect(DECALAGES_PAQUES).toEqual({
      'lundi-gras': -48,
      'mardi-gras': -47,
      'mercredi-des-cendres': -46,
      'jeudi-saint': -3,
      'vendredi-saint': -2,
      ascension: 39,
      'fete-dieu': 60,
    })
    expect(Object.keys(DECALAGES_PAQUES)).toHaveLength(7)
  })

  it('place chaque jour mobile sur le bon jour de la semaine', () => {
    for (let y = 1990; y < 2060; y++) {
      expect(dayOfWeek(jourMobile('lundi-gras', y))).toBe(1)
      expect(dayOfWeek(jourMobile('mardi-gras', y))).toBe(2)
      expect(dayOfWeek(jourMobile('mercredi-des-cendres', y))).toBe(3)
      expect(dayOfWeek(jourMobile('jeudi-saint', y))).toBe(4)
      expect(dayOfWeek(jourMobile('vendredi-saint', y))).toBe(5)
      expect(dayOfWeek(jourMobile('ascension', y))).toBe(4)
      expect(dayOfWeek(jourMobile('fete-dieu', y))).toBe(4)
    }
  })

  it('rend les contrôles nominatifs de 2026', () => {
    expect(formatIso(jourMobile('lundi-gras', 2026))).toBe('2026-02-16')
    expect(formatIso(jourMobile('mardi-gras', 2026))).toBe('2026-02-17')
    expect(formatIso(jourMobile('mercredi-des-cendres', 2026))).toBe('2026-02-18')
    expect(formatIso(jourMobile('jeudi-saint', 2026))).toBe('2026-04-02')
    expect(formatIso(jourMobile('vendredi-saint', 2026))).toBe('2026-04-03')
    expect(formatIso(jourMobile('ascension', 2026))).toBe('2026-05-14')
    expect(formatIso(jourMobile('fete-dieu', 2026))).toBe('2026-06-04')
  })

  it('rend les contrôles nominatifs de 2027', () => {
    expect(formatIso(jourMobile('mercredi-des-cendres', 2027))).toBe('2027-02-10')
    expect(formatIso(jourMobile('lundi-gras', 2027))).toBe('2027-02-08')
    expect(formatIso(jourMobile('mardi-gras', 2027))).toBe('2027-02-09')
    expect(formatIso(jourMobile('jeudi-saint', 2027))).toBe('2027-03-25')
    expect(formatIso(jourMobile('ascension', 2027))).toBe('2027-05-06')
    expect(formatIso(jourMobile('fete-dieu', 2027))).toBe('2027-05-27')
  })
})
