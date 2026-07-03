import { describe, it, expect } from 'vitest'
import { applyAmendments, splitArticles } from './segment'
import type { ArticleOverlay } from './amendments'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const overlay = (anchor: string, body: string): ArticleOverlay => ({
  anchor,
  label: null,
  inForce: { body } as any,
  history: [],
  amended: true,
  abrogated: false,
})

const body = [
  'Préambule.',
  'Article 1er.- Champ d’application.',
  'Article 2.- Texte original du Code.',
  '',
  'LOI ANNEXE',
  'Article 1er.- Autre loi.',
  'Article 2.- Texte de la loi annexe.',
].join('\n')

describe('applyAmendments', () => {
  it('ne remplace que la PREMIÈRE occurrence d’une ancre dupliquée', () => {
    const map = new Map<string, ArticleOverlay>([['art-2', overlay('art-2', 'Article 2.- VERSION EN VIGUEUR.')]])
    const out = applyAmendments(body, map)
    expect(out.match(/VERSION EN VIGUEUR/g)?.length).toBe(1) // pas 2
    expect(out).toContain('Texte de la loi annexe') // l’art. 2 de la loi annexe reste intact
  })
  it('sans amendement, renvoie le corps inchangé', () => {
    expect(applyAmendments(body, new Map())).toBe(body)
  })
})

describe('splitArticles', () => {
  it('segmente préambule + articles et voit les deux art-2', () => {
    const segs = splitArticles(body)
    expect(segs[0].anchor).toBeNull()
    expect(segs.filter((s) => s.anchor === 'art-2').length).toBe(2)
  })
})
