import { describe, it, expect } from 'vitest'
import { compte, formatConsultations, nomJuridiction } from './notaires-format'

describe('provenance en clair', () => {
  const deux = ['2026-10-09', '2026-09-08']
  it('français : « le 8 septembre et le 9 octobre 2026 » (ordre chronologique, année une fois)', () => {
    expect(formatConsultations(deux, 'fr')).toBe('le 8 septembre et le 9 octobre 2026')
  })
  it('anglais et créole', () => {
    expect(formatConsultations(deux, 'en')).toBe('on 8 September and 9 October 2026')
    expect(formatConsultations(deux, 'ht')).toBe('8 septanm ak 9 oktòb 2026')
  })
  it('une seule date ; « 1er » en français ; années différentes répétées', () => {
    expect(formatConsultations(['2026-10-01'], 'fr')).toBe('le 1er octobre 2026')
    expect(formatConsultations(['2025-12-30', '2026-01-02'], 'fr')).toBe('le 30 décembre 2025 et le 2 janvier 2026')
  })
  it('aucune date ⇒ chaîne vide (la ligne se dit alors sans dates)', () => {
    expect(formatConsultations([], 'fr')).toBe('')
  })
})

describe('singulier / pluriel', () => {
  it('français : 0 et 1 au singulier', () => {
    expect(compte(0, 'fr', '{n} notaire', '{n} notaires')).toBe('0 notaire')
    expect(compte(1, 'fr', '{n} notaire', '{n} notaires')).toBe('1 notaire')
    expect(compte(57, 'fr', '{n} notaire', '{n} notaires')).toBe('57 notaires')
  })
  it('anglais : 1 seul au singulier', () => {
    expect(compte(0, 'en', '{n} notary', '{n} notaries')).toBe('0 notaries')
  })
})

describe('nom de la juridiction, sans « TPI »', () => {
  it('les 23 ressorts', () => {
    const attendu: Record<string, string> = {
      'TPI de l’Anse-à-Veau': 'Anse-à-Veau', 'TPI d’Aquin': 'Aquin', 'TPI de Belladère': 'Belladère',
      'TPI du Cap-Haïtien': 'Cap-Haïtien', 'TPI des Cayes': 'Les Cayes', 'TPI des Côteaux': 'Les Côteaux',
      'TPI de la Croix-des-Bouquets': 'Croix-des-Bouquets', 'TPI de Fort-Liberté': 'Fort-Liberté',
      'TPI des Gonaïves': 'Les Gonaïves', 'TPI de La Gonâve': 'La Gonâve',
      'TPI de la Grande-Rivière-du-Nord': 'Grande-Rivière-du-Nord', 'TPI de Hinche': 'Hinche',
      'TPI de Jacmel': 'Jacmel', 'TPI de Jean-Rabel': 'Jean-Rabel', 'TPI de Jérémie': 'Jérémie',
      'TPI de Limbé': 'Limbé', 'TPI de Miragoâne': 'Miragoâne', 'TPI de Mirebalais': 'Mirebalais',
      'TPI de Ouanaminthe': 'Ouanaminthe', 'TPI de Petit-Goâve': 'Petit-Goâve', 'TPI de Port-de-Paix': 'Port-de-Paix',
      'TPI de Port-au-Prince': 'Port-au-Prince', 'TPI de Saint-Marc': 'Saint-Marc',
    }
    for (const [tribunal, juridiction] of Object.entries(attendu)) expect(nomJuridiction(tribunal), tribunal).toBe(juridiction)
  })
  it('La Gonâve : le nom du ressort, pas son siège (Anse-à-Galets)', () => {
    expect(nomJuridiction('TPI de La Gonâve')).toBe('La Gonâve')
  })
})
