import { describe, it, expect } from 'vitest'
import { ART_REF_RE, ART_OR_SEC_REF_RE } from './artrefs'

/** Toutes les captures d'un texte, la regex étant globale et à état (lastIndex). */
function hits(re: RegExp, s: string): string[] {
  re.lastIndex = 0
  return [...s.matchAll(re)].map((m) => m[0])
}

describe('ART_REF_RE — non-régression du corpus existant', () => {
  it('capture les renvois simples et les listes', () => {
    expect(hits(ART_REF_RE, 'Voir l’article 240 du présent code.')).toEqual(['article 240'])
    expect(hits(ART_REF_RE, 'les articles 63, 64 et 68')).toEqual(['articles 63, 64 et 68'])
    expect(hits(ART_REF_RE, 'art. 2047')).toEqual(['art. 2047'])
  })
  it('conserve les suffixes de la réforme du Code de commerce et du Décret minier', () => {
    expect(hits(ART_REF_RE, 'article 1136-15')).toEqual(['article 1136-15'])
    expect(hits(ART_REF_RE, 'les articles 54, 54.1, 54.2')).toEqual(['articles 54, 54.1, 54.2'])
    expect(hits(ART_REF_RE, 'article 95 bis')).toEqual(['article 95 bis'])
  })
  it('refuse toujours le décimal suivi d’une parenthèse (« article 17.2) »)', () => {
    expect(hits(ART_REF_RE, 'article 17.2) de la Convention')).toEqual(['article 17'])
  })
  it('ne voit pas le mot « section » sans activation explicite', () => {
    expect(hits(ART_REF_RE, 'à la section 7 de la présente circulaire')).toEqual([])
  })
  it('capture désormais les désignations à trois niveaux (Constitution, circulaires)', () => {
    expect(hits(ART_REF_RE, 'article 31.1.1')).toEqual(['article 31.1.1'])
  })
})

describe('ART_OR_SEC_REF_RE — renvois « section N » des circulaires BRH', () => {
  it('capture les sections, seules ou en liste', () => {
    expect(hits(ART_OR_SEC_REF_RE, 'exigé à la section 7 de la présente circulaire')).toEqual(['section 7'])
    expect(hits(ART_OR_SEC_REF_RE, 'énoncés aux sections 4.2.1 et 5.3')).toEqual(['sections 4.2.1 et 5.3'])
  })
  it('capture toujours les articles comme la variante de base', () => {
    expect(hits(ART_OR_SEC_REF_RE, 'délai établi à l’article 2')).toEqual(['article 2'])
  })
})
