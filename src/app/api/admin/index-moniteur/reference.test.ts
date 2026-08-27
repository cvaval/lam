import { describe, it, expect } from 'vitest'

/**
 * Copie de `editionNumber` (la route n'exporte rien : elle n'expose que GET/POST).
 * ⚠️ Si la route change, ce test ne le verra pas — il garde la RÈGLE, pas le code.
 */
function editionNumber(annee: number, numero: string, special: boolean): string {
  const brut = numero.trim().replace(/^SP/i, '').replace(/\s+/g, '')
  const m = /^(\d+)-?([A-Za-z])?$/.exec(brut)
  const n = m ? `${m[1]}${m[2] ? `-${m[2].toUpperCase()}` : ''}` : brut
  return special ? `LM${annee}-SP${n}` : `LM${annee}-${n}`
}

describe('référence d’édition saisie au back-office', () => {
  /**
   * ⚠️ LA RÈGLE QUI A COÛTÉ 130 RENUMÉROTATIONS. Deux graphies du même fascicule —
   * « LM2026-SP43A » et « LM2026-SP43-A » — ont cohabité dans le corpus, et le
   * dédoublonnage qui compare à la lettre a recréé 73 éditions spéciales en double.
   */
  it('toutes les façons d’écrire un suffixe donnent la même référence', () => {
    for (const saisie of ['43-A', '43A', '43a', '43 A', '43-a', 'SP43-A', ' 43A ']) {
      expect(editionNumber(2026, saisie, true), `saisie « ${saisie} »`).toBe('LM2026-SP43-A')
    }
  })

  it('un numéro sans suffixe reste nu', () => {
    expect(editionNumber(2026, '43', true)).toBe('LM2026-SP43')
    expect(editionNumber(2026, '121', false)).toBe('LM2026-121')
  })

  it('une régulière suffixée suit la même règle', () => {
    expect(editionNumber(2025, '147d', false)).toBe('LM2025-147-D')
  })

  /** Une saisie qu'on ne sait pas lire passe telle quelle : mieux vaut une référence
   *  inattendue et visible qu'une référence silencieusement amputée. */
  it('une saisie hors format n’est pas mutilée', () => {
    expect(editionNumber(2026, '76+77', false)).toBe('LM2026-76+77')
  })
})
