import { describe, it, expect } from 'vitest'
import { parseOfficialText } from './officiel'

// Code du travail, art. 45 (Salès, 1992, p. 46) : le barème du préavis, cinq lignes à points de conduite, sans marqueur.
// Avant la règle du barème, ces lignes commençant en minuscule étaient recousues en un seul paragraphe.
const art45 = [
  'Ce préavis sera calculé de la manière suivante :',
  'de 3 mois à 12 mois de service . . . 15 jours',
  'de 1 an à 3 ans de service . . . 1 mois',
  'de 3 ans à 6 ans de service . . . 2 mois',
  'de 6 ans à 10 ans de service . . . 3 mois',
  'et à partir de 10 ans de service . . . 4 mois',
].join('\n')

describe('parseOfficialText — barème à points de conduite', () => {
  it('chaque ligne du barème reste seule, jamais en intertitre', () => {
    const b = parseOfficialText(art45)
    expect(b).toHaveLength(6)
    for (const x of b.slice(1)) expect(x).toMatchObject({ kind: 'p', heading: false })
    expect(b[5]).toMatchObject({ text: 'et à partir de 10 ans de service . . . 4 mois' })
  })

  it('une ligne à points de conduite isolée (sommaire du Moniteur) garde son rendu', () => {
    const t = 'Décret créant la commission\ndu travail ........ 12'
    expect(parseOfficialText(t)).toEqual([{ kind: 'p', text: 'Décret créant la commission du travail ........ 12', heading: false }])
  })

  it('les marqueurs du livre font la liste (« a) », « 1) », « 1. »)', () => {
    const b = parseOfficialText('contiendra les énonciations suivantes :\na) les noms, prénoms ;\nb) la durée.')
    expect(b[1]).toMatchObject({ kind: 'ol', items: [{ marker: 'a)' }, { marker: 'b)' }] })
  })
})
