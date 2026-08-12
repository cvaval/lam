import { describe, it, expect } from 'vitest'
import { consoleHref } from './nav'

/**
 * Ce que ce test protège : un ÉDITEUR doit avoir une entrée vers la console, et elle doit
 * mener à une page qu'il peut ouvrir. Le défaut signalé — « les fonctions d'admin ne sont
 * pas disponibles » — n'était pas une absence de fonctions mais une absence de chemin.
 */
describe('consoleHref', () => {
  it('mène le MASTER ADMIN à la vue d’ensemble', () => {
    expect(consoleHref('MASTER_ADMIN', 'fr')).toBe('/fr/admin')
  })

  it('donne à l’ÉDITEUR une entrée, et vers une page qu’il peut ouvrir', () => {
    // « /admin » est gardée par requireAdmin : y envoyer un éditeur le renverrait au
    // tableau de bord. On l'amène donc à son premier écran.
    expect(consoleHref('EDITEUR', 'fr')).toBe('/fr/admin/jurisprudence')
    expect(consoleHref('EDITEUR', 'ht')).toBe('/ht/admin/jurisprudence')
  })

  it('ne montre AUCUNE entrée aux lecteurs', () => {
    for (const r of ['SITWAYEN', 'PWOFESYONEL', 'ENSTITISYON'] as const) {
      expect(consoleHref(r, 'fr')).toBeNull()
    }
  })
})
