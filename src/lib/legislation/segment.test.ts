import { describe, it, expect } from 'vitest'
import { applyAmendments, splitArticles } from './segment'
import type { ArticleOverlay } from './amendments'

const overlay = (anchor: string, body: string): ArticleOverlay => ({
  anchor,
  label: null,
  inForce: { body } as any,
  history: [],
  added: null,
  amended: true,
  abrogated: false,
})

/** Article INSÉRÉ par un texte modificatif : sa rédaction est déjà dans le corps. */
const ajout = (anchor: string, par: string): ArticleOverlay => ({
  anchor,
  label: null,
  inForce: null,
  history: [],
  added: { body: '', amendedByNumber: par } as any,
  amended: false,
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

  /**
   * ⚠️ LE PIÈGE DE LA PASTILLE. Un article ajouté porte une ligne d'overlay pour NOMMER
   * l'acte qui l'a inséré — pas pour remplacer quoi que ce soit. Sans la garde, l'overlay
   * (inForce vide, abrogated faux) retombait sur le cas général ; à la moindre évolution du
   * repli, il réduirait l'article à son seul libellé.
   */
  it('un article seulement AJOUTÉ laisse le corps intact', () => {
    const map = new Map<string, ArticleOverlay>([['art-2', ajout('art-2', 'D. du 6 janvier 2016')]])
    expect(applyAmendments(body, map)).toBe(body)
  })
})

describe('splitArticles', () => {
  it('segmente préambule + articles et voit les deux art-2', () => {
    const segs = splitArticles(body)
    expect(segs[0].anchor).toBeNull()
    expect(segs.filter((s) => s.anchor === 'art-2').length).toBe(2)
  })
})
