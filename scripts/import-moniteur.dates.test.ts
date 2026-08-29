import { describe, it, expect } from 'vitest'
import { parseFrenchDate } from './import-moniteur'

const iso = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Le rabattage `Math.min(day || 1, 28)` a fabriqué 2 137 dates fausses dans l'Index du
 * Moniteur, mesurées le 28 août 2026 — et personne ne pouvait s'en apercevoir, puisque la
 * date rabattue reste une date valide. Ces cas sont donc écrits en TÉMOINS : chacun échoue
 * si le rabattage revient.
 */
describe('parseFrenchDate — le quantième ne se rabat pas', () => {
  it('garde le 29, le 30 et le 31 (rabattus au 28 jusqu’au 28 août 2026)', () => {
    expect(iso(parseFrenchDate('Vendredi 29 Juin 2012', 2012))).toBe('2012-06-29')
    expect(iso(parseFrenchDate('30 juin 1980', 1980))).toBe('1980-06-30')
    expect(iso(parseFrenchDate('Mardi 31 Décembre 1974', 1974))).toBe('1974-12-31')
  })

  it('le cas réel LM2012-104 : l’arrêté des seuils, reproduit pour erreur matérielle', () => {
    expect(iso(parseFrenchDate('Le Moniteur · LM2012-104 · Vendredi 29 Juin 2012', 2012))).toBe('2012-06-29')
  })

  it('REFUSE une date impossible au lieu de la déplacer', () => {
    // Date.UTC(2012, 1, 30) rend le 1er mars : c’est exactement ce que l’aller-retour rattrape.
    expect(iso(parseFrenchDate('30 février 2012', 2012))).toBe('2012-01-01')
    expect(iso(parseFrenchDate('31 avril 1999', 1999))).toBe('1999-01-01')
    expect(iso(parseFrenchDate('29 février 2013', 2013))).toBe('2013-01-01')
  })

  it('accepte le 29 février d’une année bissextile', () => {
    expect(iso(parseFrenchDate('29 février 2012', 2012))).toBe('2012-02-29')
  })

  it('se replie sur le 1er janvier quand il n’y a rien à lire', () => {
    expect(iso(parseFrenchDate(undefined, 1988))).toBe('1988-01-01')
    expect(iso(parseFrenchDate('sans date', 1988))).toBe('1988-01-01')
    expect(iso(parseFrenchDate('12 brumaire 1988', 1988))).toBe('1988-01-01')
    expect(iso(parseFrenchDate('0 juin 1988', 1988))).toBe('1988-01-01')
  })

  it('lit les accents et la casse du Moniteur', () => {
    expect(iso(parseFrenchDate('JEUDI 30 DÉCEMBRE 2021', 2021))).toBe('2021-12-30')
    expect(iso(parseFrenchDate('lundi 31 aout 1992', 1992))).toBe('1992-08-31')
  })
})
