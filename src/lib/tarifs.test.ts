import { describe, it, expect } from 'vitest'
import { digitsOnly, tariffSynonymTargets, tariffWhere, TARIF_SYNONYMES } from './tarifs'

/**
 * Le défaut mesuré en production le 9 septembre 2026 : sur 5 918 positions, « ordinateur »,
 * « informatique », « imprimante », « laptop », « logiciel », « serveur » et « disque dur »
 * rendaient CHACUN zéro ligne — la nomenclature du Système harmonisé ne les emploie pas.
 */
describe('vocabulaire ordinaire → nomenclature douanière', () => {
  it('« ordinateur » ouvre la position 84.71, que la nomenclature ne nomme jamais ainsi', () => {
    expect(tariffSynonymTargets('ordinateur').codes).toContain('8471')
  })

  it('les sept mots qui ne rendaient rien visent tous au moins une position', () => {
    for (const mot of ['ordinateur', 'informatique', 'imprimante', 'laptop', 'logiciel', 'serveur', 'disque dur'])
      expect(tariffSynonymTargets(mot).codes.length, mot).toBeGreaterThan(0)
  })

  it('l’accent et la casse ne changent rien — « ÉCRAN », « écran » et « ecran » ouvrent la même porte', () => {
    const a = tariffSynonymTargets('écran').codes
    expect(tariffSynonymTargets('ecran').codes).toEqual(a)
    expect(tariffSynonymTargets('ÉCRAN').codes).toEqual(a)
    expect(a).toContain('852842')
  })

  it('« portable » est ambigu et vise LES DEUX familles — ordinateur ET téléphone', () => {
    const c = tariffSynonymTargets('portable').codes
    expect(c).toContain('847130') // ordinateur portable
    expect(c).toContain('851713') // téléphone portable
  })

  it('une requête composée cumule les familles', () => {
    const c = tariffSynonymTargets('ordinateur et imprimante').codes
    expect(c).toContain('8471')
    expect(c).toContain('844331')
  })

  it('un repère ne s’allume pas au milieu d’un mot', () => {
    // « pc » est un repère ; « epcot » n'est pas une demande d'ordinateur.
    expect(tariffSynonymTargets('epcot').codes).toEqual([])
    // « disque » oui, « disquette » non (repère distinct, pas un fragment).
    expect(tariffSynonymTargets('disque').codes.length).toBeGreaterThan(0)
  })

  it('un mot hors vocabulaire ne vise rien — la recherche littérale reste seule', () => {
    expect(tariffSynonymTargets('bananes').codes).toEqual([])
    expect(tariffSynonymTargets('a').codes).toEqual([])
  })
})

describe('tariffWhere', () => {
  it('ajoute les positions du vocabulaire SANS retirer la recherche littérale', () => {
    const w = tariffWhere('ordinateur') as { AND: { OR: Record<string, unknown>[] }[] }
    const or = w.AND[0].OR
    expect(or.some((c) => 'designation' in c)).toBe(true) // littérale conservée
    expect(or.some((c) => JSON.stringify(c).includes('8471'))).toBe(true) // vocabulaire ajouté
  })

  it('un code chiffré reste cherché tel quel', () => {
    const w = tariffWhere('8471.30') as { AND: { OR: Record<string, unknown>[] }[] }
    expect(JSON.stringify(w.AND[0].OR)).toContain('847130')
  })

  it('le chapitre seul filtre sans clause de texte', () => {
    expect(tariffWhere('', '84')).toEqual({ AND: [{ chapter: '84' }] })
  })

  it('sans critère, aucun filtre', () => {
    expect(tariffWhere('')).toEqual({})
  })
})

describe('garde-fous de la table de vocabulaire', () => {
  it('tous les repères sont déjà repliés (minuscules, sans accent)', () => {
    for (const e of TARIF_SYNONYMES)
      for (const r of e.repères) expect(r, r).toBe(r.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
  })

  it('tous les codes visés sont des chiffres seuls — jamais de code pointé', () => {
    for (const e of TARIF_SYNONYMES) for (const c of e.codes) expect(c, c).toMatch(/^\d{4,8}$/)
  })

  it('digitsOnly ne garde que les chiffres', () => {
    expect(digitsOnly('0101.21 00')).toBe('01012100')
  })
})
