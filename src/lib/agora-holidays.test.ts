import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { CALENDRIER_COURANT } from '@/lib/delais/feries'
import { fetesDeLAnnee, prochaineFete } from './agora-holidays'

/**
 * Le portail public présente le calendrier du calculateur — jamais une seconde liste. Les
 * quatre témoins ci-dessous sont les quatre erreurs de la liste Equinox livrée avec la
 * maquette (8 oct. 2026) : s'ils retombaient, c'est qu'une autre source serait revenue.
 */
describe('fêtes du portail = calendrier de la plateforme', () => {
  const f2026 = fetesDeLAnnee(CALENDRIER_COURANT, 2026, 'fr')
  const le = (m: number, d: number) => f2026.filter((f) => f.date.m === m && f.date.d === d)

  it('Jour de Dessalines au 20 SEPTEMBRE, rien au 20 octobre', () => {
    expect(le(9, 20).map((f) => f.libelle)).toEqual(['Jour de Dessalines'])
    expect(le(10, 20)).toEqual([])
  })

  it('le 14 août (Bois-Caïman) est une fête légale', () => {
    expect(le(8, 14).map((f) => f.categorie)).toEqual(['legale'])
  })

  it('la Toussaint est une fête légale, pas « sous réserve »', () => {
    expect(le(11, 1).map((f) => f.categorie)).toEqual(['legale'])
  })

  it('le Lundi Gras est une demi-journée (16 février 2026)', () => {
    const [lundi] = le(2, 16)
    expect(lundi.libelle).toBe('Lundi Gras')
    expect(lundi.demiJournee).toBe(true)
  })

  it('les cinq fêtes nationales y sont, et cinq jours « par arrêté » seulement', () => {
    expect(f2026.filter((f) => f.categorie === 'nationale')).toHaveLength(5)
    expect(f2026.filter((f) => f.categorie === 'legale')).toHaveLength(11)
    expect(f2026.filter((f) => f.categorie === 'arrete')).toHaveLength(5)
  })

  it('un jour « par arrêté » n’est jamais la prochaine fête', () => {
    // 18 février 2026 = mercredi des Cendres (à surveiller) ; la suivante est Vendredi saint.
    const suivante = prochaineFete(CALENDRIER_COURANT, { y: 2026, m: 2, d: 18 }, 'fr')
    expect(suivante?.libelle).toBe('Vendredi Saint')
    expect(suivante?.date).toEqual({ y: 2026, m: 4, d: 3 })
  })

  it('après Noël, la prochaine est le 1er janvier suivant', () => {
    expect(prochaineFete(CALENDRIER_COURANT, { y: 2026, m: 12, d: 26 }, 'fr')?.date).toEqual({ y: 2027, m: 1, d: 1 })
  })

  it('la liste copiée d’une autre application n’est plus dans le dépôt', () => {
    expect(existsSync(join(__dirname, '..', 'data', 'agora', 'CT_HOLIDAYS.json'))).toBe(false)
  })
})
