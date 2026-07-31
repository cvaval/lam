import { describe, expect, it } from 'vitest'
import { fr } from './locales/fr'
import { en } from './locales/en'
import { ht } from './locales/ht'

/**
 * Le héros « Carte judiciaire » affiche le titre COUPÉ (`titleLead` + `titleAccent`,
 * ce dernier en Sitwon) alors que le nom accessible du lien utilise `title` entier.
 * Si les deux divergent, l'utilisatrice au lecteur d'écran entend une phrase que
 * personne ne voit — c'est exactement ce qui était arrivé en kreyòl (« Toupatou nan
 * Ayiti » à l'écran contre « Toupatou ann Ayiti » dans l'aria-label).
 */
const LOCALES = { fr, en, ht }

describe('hero.map — titre coupé', () => {
  for (const [code, dict] of Object.entries(LOCALES)) {
    const m = dict.hero.map

    it(`${code} : titleLead + titleAccent reconstitue exactement title`, () => {
      expect(`${m.titleLead} ${m.titleAccent}`).toBe(m.title)
    })

    it(`${code} : l'accent est la fin du titre, pas un fragment arbitraire`, () => {
      expect(m.title.endsWith(m.titleAccent)).toBe(true)
      expect(m.titleAccent.trim()).not.toBe('')
      // un accent d'un seul mot (deux au plus) : au-delà, la coupe n'est plus une accroche
      expect(m.titleAccent.trim().split(/\s+/).length).toBeLessThanOrEqual(2)
    })

    it(`${code} : les libellés du héros sont tous renseignés`, () => {
      for (const cle of ['eyebrow', 'description', 'cta', 'note', 'openRecord', 'featureFuzzy', 'featureByCommune', 'featureVerified'] as const) {
        expect(m[cle], `${code}.hero.map.${cle}`).toBeTruthy()
      }
    })
  }
})
