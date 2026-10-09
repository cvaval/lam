import { describe, it, expect, beforeEach } from 'vitest'
import { emojiDessinable, emojiPuckImage, oublierSondes, type CanvasFactory, type Ctx2D } from './marker-canvas'

/**
 * Le marqueur 👤 est peint sur canvas ; l'environnement de test n'en a pas. Un DOUBLE de
 * contexte 2D enregistre les opérations et rend, à `getImageData`, ce qu'un système donné
 * aurait dessiné : un emoji, rien du tout, ou le même carré pour tout caractère (« tofu »).
 * On vérifie les DEUX branches : l'emoji quand il se dessine, la silhouette sinon.
 */
type Systeme = 'emoji' | 'sans-police' | 'tofu'

function fabrique(systeme: Systeme) {
  const journal: Array<{ op: string; args: unknown[] }> = []
  const make: CanvasFactory = (w, h) => {
    let dernierTexte: string | null = null
    const ctx: Ctx2D = {
      fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', textAlign: 'start', textBaseline: 'alphabetic',
      beginPath: () => journal.push({ op: 'beginPath', args: [] }),
      arc: (...a: unknown[]) => journal.push({ op: 'arc', args: a }),
      moveTo: () => {}, lineTo: () => {}, closePath: () => {},
      fill: () => journal.push({ op: 'fill', args: [] }),
      stroke: () => journal.push({ op: 'stroke', args: [] }),
      save: () => {}, restore: () => {}, clip: () => {},
      fillText: (text: string, ...a: number[]) => { dernierTexte = text; journal.push({ op: 'fillText', args: [text, ...a] }) },
      measureText: () => ({ width: 20, actualBoundingBoxAscent: 16, actualBoundingBoxDescent: 4 }),
      getImageData: () => {
        const data = new Uint8ClampedArray(w * h * 4)
        if (dernierTexte !== null && systeme !== 'sans-police') {
          // « tofu » : le même carré quel que soit le caractère ; « emoji » : un rendu propre au caractère.
          const graine = systeme === 'tofu' ? 7 : dernierTexte.codePointAt(0)! % 251
          for (let i = 3; i < data.length; i += 40) data[i] = 255 - (graine % 3)
          data[0] = graine
        }
        return { width: w, height: h, data }
      },
    }
    return { getContext: () => ctx }
  }
  return { make, journal }
}

const COULEURS = { paper: '#FFFFFF', ink: '#152E38' }

beforeEach(() => oublierSondes())

describe('sonde : le système sait-il dessiner 👤 ?', () => {
  it('oui quand le rendu a des pixels et diffère d’un caractère absent', () => {
    expect(emojiDessinable(fabrique('emoji').make, '👤')).toBe(true)
  })
  it('non quand aucun pixel n’est opaque (aucune police emoji)', () => {
    expect(emojiDessinable(fabrique('sans-police').make, '👤')).toBe(false)
  })
  it('non quand le rendu ne se distingue pas d’un caractère absent (tofu)', () => {
    expect(emojiDessinable(fabrique('tofu').make, '👤')).toBe(false)
  })
})

describe('image du marqueur', () => {
  it('pastille blanche cernée d’encre (2 px CSS), puis l’emoji, à 2× la taille CSS', () => {
    const { make, journal } = fabrique('emoji')
    const img = emojiPuckImage(make, '👤', 22, COULEURS)
    expect(img.fallback).toBe(false)
    expect([img.width, img.height]).toEqual([44, 44])
    const textes = journal.filter((j) => j.op === 'fillText').map((j) => j.args[0])
    expect(textes.at(-1)).toBe('👤')
  })

  it('REPLI : sans police emoji, une silhouette tête-épaules — jamais d’image vide ni de fillText', () => {
    const { make, journal } = fabrique('sans-police')
    const img = emojiPuckImage(make, '👤', 22, COULEURS)
    expect(img.fallback).toBe(true)
    // La sonde écrit (pour mesurer) ; l'image, elle, ne contient AUCUN texte après la pastille.
    const iPastille = journal.findIndex((j) => j.op === 'stroke')
    expect(journal.slice(iPastille).some((j) => j.op === 'fillText')).toBe(false)
    // pastille + clip + tête + épaules : au moins quatre arcs, et des remplissages.
    expect(journal.slice(iPastille).filter((j) => j.op === 'arc').length).toBeGreaterThanOrEqual(3)
    expect(journal.slice(iPastille).filter((j) => j.op === 'fill').length).toBeGreaterThanOrEqual(2)
  })

  it('REPLI aussi devant un tofu', () => {
    expect(emojiPuckImage(fabrique('tofu').make, '👤', 18, COULEURS).fallback).toBe(true)
  })
})
