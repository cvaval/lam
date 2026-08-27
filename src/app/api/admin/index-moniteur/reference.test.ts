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

/**
 * Copie de `frDateLabel` — même raison que ci-dessus : la route n'exporte rien.
 */
function frDateLabel(d: Date): string {
  const s = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

describe('date d’une entrée d’Index', () => {
  /**
   * ⚠️ LE MOIS RESTE EN MINUSCULE. Le corpus historique écrit « Jeudi 15 Octobre 1981 »
   * (22 372 entrées), mais tout ce qui est versé depuis 2020 écrit « jeudi 15 octobre » —
   * 272 sur 272 en 2020, 76 sur 76 en 2023 — et c'est la typographie française. Le
   * back-office capitalisait chaque mot : deux dates différentes pour un même fascicule
   * selon qu'on passait par l'écran ou par un script.
   */
  it('seul le jour de la semaine prend la majuscule', () => {
    expect(frDateLabel(new Date('2026-08-13T00:00:00Z'))).toBe('Jeudi 13 août 2026')
    expect(frDateLabel(new Date('2026-08-21T00:00:00Z'))).toBe('Vendredi 21 août 2026')
    expect(frDateLabel(new Date('2026-01-05T00:00:00Z'))).toBe('Lundi 5 janvier 2026')
    expect(frDateLabel(new Date('2026-12-24T00:00:00Z'))).toBe('Jeudi 24 décembre 2026')
  })

  it('la forme produite est celle des quatre entrées d’août 2026', () => {
    const ref = `Le Moniteur · LM2026-SP43-A · ${frDateLabel(new Date('2026-08-21T00:00:00Z'))}`
    expect(ref).toBe('Le Moniteur · LM2026-SP43-A · Vendredi 21 août 2026')
  })
})
