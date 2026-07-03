import { describe, it, expect } from 'vitest'
import { parseAmount, parsePct, tariffLabel } from './tarif-format'

describe('parseAmount (saisie FR + EN)', () => {
  it('interprète la décimale anglaise sans ×100', () => {
    expect(parseAmount('1500.50')).toBe(1500.5)
    expect(parseAmount('12.5')).toBe(12.5)
  })
  it('interprète la convention française', () => {
    expect(parseAmount('1 500,50')).toBe(1500.5)
    expect(parseAmount('1.500')).toBe(1500) // point = milliers (3 chiffres)
    expect(parseAmount('12.345.678')).toBe(12345678)
  })
  it('borne à ≥ 0 et gère le vide', () => {
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('-40')).toBe(0)
    expect(parseAmount('abc')).toBe(0)
  })
})

describe('parsePct', () => {
  it('lit un taux, virgule ou point', () => {
    expect(parsePct('10 %')).toBeCloseTo(0.1)
    expect(parsePct('3,5 %')).toBeCloseTo(0.035)
    expect(parsePct('Exonéré')).toBe(0)
    expect(parsePct(null)).toBe(0)
  })
})

describe('tariffLabel', () => {
  it('épure les tirets de hiérarchie', () => {
    expect(tariffLabel('-- Coqs et poules').label).toBe('Coqs et poules')
    expect(tariffLabel('-- Coqs et poules').level).toBe(2)
  })
})
