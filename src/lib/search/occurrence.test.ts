/**
 * La 1ʳᵉ occurrence et l'ARTICLE qui la contient (R3 du 24 oct. 2026) — le lien du résultat mène au
 * passage (`#art-N`), l'extrait dit où (« Article 1382 — … »). Textes FICTIFS.
 */
import { describe, expect, it } from 'vitest'
import { designationEntete, extraitLocalise, localiserOccurrence } from './occurrence'
import { indexDepart, indexVoisin } from './navigation-occurrences'
import { expandQuery } from './synonyms'

const CODE = [
  'TITRE IV — DES OBLIGATIONS',
  'Article 1381.- Celui qui reçoit par erreur ce qui ne lui est pas dû s’oblige à le restituer.',
  'Article 1382.- Tout fait quelconque de l’homme qui cause à autrui un dommage,',
  'oblige celui par la faute duquel il est arrivé, à le réparer : c’est la responsabilité.',
  'Article 1383.- Chacun est responsable du dommage qu’il a causé.',
].join('\n')

describe('désignation d’un en-tête', () => {
  it('Article, forme abrégée, ordinal, bis, section ; une phrase n’est pas un en-tête', () => {
    expect(designationEntete('Article 1382.- Tout fait…')).toBe('Article 1382')
    expect(designationEntete('Art. 2047 - Le cautionnement')).toBe('Article 2047')
    expect(designationEntete('Article 1er.- Champ')).toBe('Article 1er')
    expect(designationEntete('Article 95 bis.- Ajouté')).toBe('Article 95 bis')
    expect(designationEntete('Section 3 — Des preuves')).toBe('Section 3')
    expect(designationEntete('Le présent article abroge…')).toBeNull()
  })
})

describe('localiser la 1ʳᵉ occurrence', () => {
  it('l’article qui la contient, même quand elle est sur une ligne de suite', () => {
    expect(localiserOccurrence(CODE, ['responsabilite'])).toMatchObject({ ancre: 'art-1382', article: 'Article 1382' })
  })
  it('sur la ligne même de l’en-tête', () => {
    expect(localiserOccurrence(CODE, ['restituer'])).toMatchObject({ ancre: 'art-1381', article: 'Article 1381' })
  })
  it('accents repliés et synonymes : le MÊME motif que le surlignage', () => {
    // « responsable » est atteint par la requête comme par la page.
    expect(localiserOccurrence(CODE, expandQuery('chacun responsable'))).toMatchObject({ ancre: expect.stringMatching(/^art-138[23]$/) })
    expect(localiserOccurrence('Article 4.- La Société anonyme…', ['societe'])).toMatchObject({ ancre: 'art-4' })
  })
  it('sans en-tête (décision, circulaire) : localisée, sans ancre ; absente : null', () => {
    expect(localiserOccurrence('Attendu que la responsabilité du gardien…', ['responsabilite'])).toEqual({ index: 15, ancre: null, article: null })
    expect(localiserOccurrence(CODE, ['inexistant'])).toBeNull()
    expect(localiserOccurrence(null, ['x'])).toBeNull()
  })
})

describe('extrait du résultat', () => {
  it('préfixé de l’article, termes marqués, HTML échappé', () => {
    const e = extraitLocalise(CODE, ['responsabilite'])!
    expect(e.ancre).toBe('art-1382')
    expect(e.snippet.startsWith('<strong class="font-semibold text-ank">Article 1382</strong> — ')).toBe(true)
    expect(e.snippet).toContain('<mark class="hl">responsabilité</mark>')
    expect(extraitLocalise('Article 2.- <script>x</script> la faute', ['faute'])!.snippet).not.toContain('<script>')
  })
  it('terme absent du corps (titre, résumé, annotations) : null — l’appelant garde son extrait', () => {
    expect(extraitLocalise(CODE, ['cautionnement'])).toBeNull()
  })
})

describe('navigation entre occurrences', () => {
  it('départ : la 1ʳᵉ après l’article désigné par l’adresse, sinon la 1ʳᵉ', () => {
    expect(indexDepart([false, false, true, true])).toBe(2)
    expect(indexDepart([false, false])).toBe(0)
    expect(indexDepart([])).toBe(0)
  })
  it('suivante / précédente en boucle', () => {
    expect(indexVoisin(4, 3, 1)).toBe(0)
    expect(indexVoisin(4, 0, -1)).toBe(3)
    expect(indexVoisin(4, 1, 1)).toBe(2)
    expect(indexVoisin(4, -1, -1)).toBe(3)
    expect(indexVoisin(0, -1, 1)).toBe(-1)
  })
})
