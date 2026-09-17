/**
 * Un instant s'affiche en heure de Port-au-Prince, quel que soit le fuseau du processus —
 * `npm run test:tz` rejoue cette suite sous Kiritimati (UTC+14), Midway (UTC−11) et
 * Port-au-Prince. Les deux valeurs attendues ont été vérifiées avec `Intl` le 16 sept. 2026 ;
 * l'IANA porte l'heure d'été, le test ne calcule rien.
 */
import { describe, it, expect } from 'vitest'
import { formatDate, formatInstant, FUSEAU_HAITI } from './format'

describe('formatInstant — heure de Port-au-Prince', () => {
  it('19:49Z un 16 septembre → 15 h 49 (heure d’été haïtienne, UTC−4)', () => {
    expect(formatInstant('fr', new Date('2026-09-16T19:49:00Z'), { hour: '2-digit', minute: '2-digit' })).toBe('15:49')
  })
  it('19:49Z un 16 janvier → 14 h 49 (UTC−5)', () => {
    expect(formatInstant('fr', new Date('2026-01-16T19:49:00Z'), { hour: '2-digit', minute: '2-digit' })).toBe('14:49')
  })
  it('un instant de 02:30Z tombe la VEILLE à Port-au-Prince — la date suit l’heure', () => {
    expect(formatInstant('fr', new Date('2026-09-17T02:30:00Z'), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })).toMatch(/^16 septembre/)
  })
  it('le créole retombe sur le français, comme formatDate', () => {
    expect(formatInstant('ht', new Date('2026-09-16T19:49:00Z'))).toBe(formatInstant('fr', new Date('2026-09-16T19:49:00Z')))
  })
  it('accepte une chaîne ISO, rend « — » pour null ou une date invalide', () => {
    expect(formatInstant('fr', '2026-09-16T19:49:00Z', { hour: '2-digit', minute: '2-digit' })).toBe('15:49')
    expect(formatInstant('fr', null)).toBe('—')
    expect(formatInstant('fr', 'pas une date')).toBe('—')
  })
  it('la zone est nommée une fois pour toutes', () => {
    expect(FUSEAU_HAITI).toBe('America/Port-au-Prince')
  })
})

describe('formatDate reste en UTC — une date juridique ne recule jamais d’un jour', () => {
  it('minuit UTC reste le même jour', () => {
    expect(formatDate('fr', new Date('2026-09-16T00:00:00Z'))).toBe('16 septembre 2026')
  })
})
