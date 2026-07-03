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
