/**
 * § 4.1 et § 8.2 — LES NOMS DE JOURS ET DE MOIS, ET LEUR UNIQUE COPIE (défaut 17 a).
 *
 * Ils étaient en dur dans `format.ts` sous un commentaire « À MIGRER », alors que le § 8.2
 * les veut dans le dictionnaire i18n, dans les trois locales, et que l'avertissement A6 les
 * emploie DÉJÀ pour dater en toutes lettres. Ils sont maintenant dans `t.delais.*` des trois
 * fichiers de locale — qui les IMPORTENT d'ici, pour que le noyau reste sans dépendance au
 * catalogue (§ 4.1) et qu'il n'y ait jamais deux listes à maintenir.
 *
 * Ce test garde les deux bouts : les douze mois et les sept jours existent dans les trois
 * langues, et le dictionnaire dit exactement la même chose que le noyau.
 */
import { describe, expect, it } from 'vitest'
import { JOURS, MOIS, dateComplete, dateEnToutesLettres, nomJour, nomMois } from './format'
import type { Locale } from './format'
import { en } from '../i18n/locales/en'
import { fr } from '../i18n/locales/fr'
import { ht } from '../i18n/locales/ht'

const LOCALES: Locale[] = ['fr', 'en', 'ht']
const DICOS = { fr, en, ht } as const

describe('§ 8.2 — les noms de jours et de mois sont dans les TROIS locales', () => {
  it('chaque locale porte 7 jours et 12 mois, tous non vides', () => {
    for (const l of LOCALES) {
      expect(DICOS[l].delais.jours, l).toHaveLength(7)
      expect(DICOS[l].delais.mois, l).toHaveLength(12)
      for (const n of [...DICOS[l].delais.jours, ...DICOS[l].delais.mois]) {
        expect(n.trim().length, `${l} : « ${n} »`).toBeGreaterThan(1)
      }
    }
  })

  it('le dictionnaire et le noyau disent LA MÊME CHOSE — une seule copie, aucune dérive', () => {
    for (const l of LOCALES) {
      expect(DICOS[l].delais.jours, l).toEqual(JOURS[l])
      expect(DICOS[l].delais.mois, l).toEqual(MOIS[l])
    }
  })

  it('aucun nom n’est le même dans deux cases de la même langue', () => {
    for (const l of LOCALES) {
      expect(new Set(JOURS[l]).size, `${l} jours`).toBe(7)
      expect(new Set(MOIS[l]).size, `${l} mois`).toBe(12)
    }
  })
})

describe('§ 6.3 a) — la date en toutes lettres', () => {
  it('« lundi 6 juillet 2026 », et « 1er » au premier du mois', () => {
    expect(dateEnToutesLettres({ y: 2026, m: 7, d: 6 })).toBe('lundi 6 juillet 2026')
    expect(dateEnToutesLettres({ y: 2026, m: 11, d: 1 })).toBe('dimanche 1er novembre 2026')
    expect(dateEnToutesLettres({ y: 2026, m: 11, d: 1 }, 'en')).toBe('Sunday 1 November 2026')
    expect(dateEnToutesLettres({ y: 2026, m: 11, d: 1 }, 'ht')).toBe('dimanch 1er novanm 2026')
  })

  it('le gabarit complet du § 6.3 a) : les lettres PUIS les chiffres', () => {
    expect(dateComplete({ y: 2026, m: 7, d: 6 })).toBe('lundi 6 juillet 2026 — 06/07/2026')
  })

  it('`nomJour` et `nomMois` sont les mêmes données, indexées comme il faut', () => {
    // 0 = dimanche ; janvier = 1 et non 0. Une erreur d'indice décalerait toutes les dates
    // écrites en lettres sans toucher au calcul : personne ne s'en apercevrait sur un test
    // de date ISO.
    expect(nomJour({ y: 2026, m: 7, d: 5 })).toBe('dimanche')
    expect(nomMois(1)).toBe('janvier')
    expect(nomMois(12)).toBe('décembre')
    expect(nomMois(12, 'ht')).toBe('desanm')
  })
})
