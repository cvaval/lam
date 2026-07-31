import { describe, it, expect } from 'vitest'
import { normalizePlaceName, compactPlaceName, normalizePostalCode, boundedEditDistance } from './normalize-place'

describe('normalizePlaceName', () => {
  it('équivalences imposées par le cahier des charges', () => {
    for (const v of ['Port-au-Prince', 'port au prince', 'PORT AU PRINCE']) {
      expect(normalizePlaceName(v)).toBe('port au prince')
    }
    expect(compactPlaceName('Port-au-Prince')).toBe('portauprince')
    for (const v of ['Pétion-Ville', 'petion ville']) expect(normalizePlaceName(v)).toBe('petion ville')
    expect(compactPlaceName('Pétion-Ville')).toBe('petionville')
    expect(normalizePlaceName('Môle-Saint-Nicolas')).toBe('mole saint nicolas')
  })
  it('apostrophes droites et typographiques, ponctuation, espaces multiples', () => {
    expect(normalizePlaceName("Grand'Anse")).toBe('grand anse')
    expect(normalizePlaceName('Grand’Anse')).toBe('grand anse')
    expect(normalizePlaceName("  L'Asile  ")).toBe('l asile')
    expect(normalizePlaceName('Croix-des-Bouquets…!!')).toBe('croix des bouquets')
  })
  it('ne conserve que des caractères alphanumériques et espaces', () => {
    expect(normalizePlaceName('<script>alert(1)</script>')).toBe('script alert 1 script')
    expect(normalizePlaceName('☠️💥')).toBe('')
  })
})

describe('normalizePostalCode', () => {
  it('reconnaît HT6110 sous ses variantes', () => {
    expect(normalizePostalCode('HT6110')).toBe('HT6110')
    expect(normalizePostalCode('ht6110')).toBe('HT6110')
    expect(normalizePostalCode('HT 6110')).toBe('HT6110')
  })
  it('rejette tout le reste', () => {
    for (const v of ['6110', 'HT61', 'HT61100', 'XX6110', 'HT61a0']) expect(normalizePostalCode(v)).toBeNull()
  })
})

describe('boundedEditDistance', () => {
  it('distances exactes et bornées', () => {
    expect(boundedEditDistance('jacmel', 'jacmel', 2)).toBe(0)
    expect(boundedEditDistance('jeremie', 'jeremi', 2)).toBe(1)
    expect(boundedEditDistance('jermeie', 'jeremie', 2)).toBe(1) // transposition adjacente
    expect(boundedEditDistance('cite solei', 'cite soleil', 2)).toBe(1)
    expect(boundedEditDistance('aaaa', 'zzzz', 2)).toBe(3) // borne dépassée → max+1
  })
})
