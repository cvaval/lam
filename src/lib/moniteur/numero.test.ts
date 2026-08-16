import { describe, it, expect } from 'vitest'
import { parseNumeroMoniteur, comparerNumerosMoniteur } from './numero'

/** Range une liste de références comme la page d'année le ferait. */
function ordonner(refs: string[]): string[] {
  return refs
    .map((r) => ({ r, ...parseNumeroMoniteur(r) }))
    .sort(comparerNumerosMoniteur)
    .map((x) => x.r)
}

describe('numéro de fascicule du Moniteur', () => {
  it('lit les deux nomenclatures — suffixe collé et suffixe détaché', () => {
    expect(parseNumeroMoniteur('LM1991-3')).toEqual({ special: false, num: 3, suffix: '' })
    expect(parseNumeroMoniteur('LM2025-SP70B')).toEqual({ special: true, num: 70, suffix: 'B' })
    expect(parseNumeroMoniteur('LM1991-1-A')).toEqual({ special: false, num: 1, suffix: 'A' })
    expect(parseNumeroMoniteur('LM2026-24-D')).toEqual({ special: false, num: 24, suffix: 'D' })
    expect(parseNumeroMoniteur('LM2000-SP2-SUP')).toEqual({ special: true, num: 2, suffix: 'SUP' })
  })

  it('range le fascicule double sous son PREMIER numéro', () => {
    // « 78+79 » est UN fascicule portant deux numéros : il se lit à la place du 78.
    expect(parseNumeroMoniteur('LM1991-78+79')).toEqual({ special: false, num: 78, suffix: '' })
    expect(ordonner(['LM1991-80', 'LM1991-78+79', 'LM1991-77'])).toEqual([
      'LM1991-77',
      'LM1991-78+79',
      'LM1991-80',
    ])
  })

  it('⚠️ le suffixé suit son numéro, il ne le PRÉCÈDE pas', () => {
    // La régression : l'expression ancrée sur `$` rendait num=0 pour « 1-A », et les
    // 256 fascicules à suffixe détaché remontaient en tête de mois, dans le désordre.
    expect(ordonner(['LM1991-1-A', 'LM1991-8-A', 'LM1991-2-A', 'LM1991-9-A', 'LM1991-1', 'LM1991-2', 'LM1991-8', 'LM1991-9'])).toEqual([
      'LM1991-1',
      'LM1991-1-A',
      'LM1991-2',
      'LM1991-2-A',
      'LM1991-8',
      'LM1991-8-A',
      'LM1991-9',
      'LM1991-9-A',
    ])
  })

  it('trois parutions du même numéro se suivent dans l’ordre des lettres', () => {
    expect(ordonner(['LM1991-28-B', 'LM1991-28', 'LM1991-28-A'])).toEqual([
      'LM1991-28',
      'LM1991-28-A',
      'LM1991-28-B',
    ])
  })

  it('les éditions spéciales viennent après les régulières', () => {
    expect(ordonner(['LM2026-SP1', 'LM2026-9'])).toEqual(['LM2026-9', 'LM2026-SP1'])
  })

  it('aucune référence du corpus ne retombe à zéro', () => {
    // Les formes réellement présentes en base (relevé du 16 août 2026).
    for (const r of ['LM1991-3', 'LM2026-SP1', 'LM1991-1-A', 'LM2026-SP30A', 'LM1991-28-B',
                     'LM1991-78+79', 'LM1990-40-C', 'LM2026-31-E', 'LM2000-SP2-SUP', 'LM2026-31-I']) {
      expect(parseNumeroMoniteur(r).num, r).toBeGreaterThan(0)
    }
  })
})
