/**
 * Marqueur `emoji` de la carte judiciaire : un caractère (👤 pour les notaires, choix de
 * Me Vaval du 9 oct. 2026) peint sur canvas au centre d'une pastille blanche cernée d'encre.
 *
 * ⚠️ POURQUOI DU CANVAS ET NON UNE COUCHE `text-field`. Le style de la carte ne déclare
 * aucune source de glyphes PBF : une couche texte MapLibre ne rendrait rien. On procède donc
 * comme pour les formes des juridictions (`shapeIcon`) : l'image est dessinée UNE fois hors
 * DOM puis enregistrée par `map.addImage()`. Aucune image externe (ni Twemoji ni Noto) : la
 * carte reste sans origine tierce.
 *
 * ⚠️ L'EMOJI DÉPEND DU SYSTÈME DU VISITEUR. Un buste gris-bleu sur Apple, gris ailleurs :
 * accepté. Mais un système sans police emoji dessine un carré vide (« tofu »), ou rien. On
 * SONDE donc le rendu : aucun pixel opaque, ou un rendu indiscernable de celui d'un caractère
 * absent, et l'on dessine à la place une silhouette tête-et-épaules en encre. Jamais d'image
 * vide.
 *
 * La fabrique de canevas est INJECTÉE : la carte passe `document.createElement('canvas')`,
 * les tests un double qui simule l'une ou l'autre branche.
 */

import { BRAND_COLORS } from '../brand-colors'

export const EMOJI_FONT_STACK = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'

/**
 * Caractère du plan à usage privé 15 : aucune police courante n'y dessine quoi que ce soit.
 * C'est l'étalon du « caractère absent ».
 */
const ABSENT = '\u{F0000}'

/** Le sous-ensemble du contexte 2D dont on se sert (le double de test l'implémente). */
export interface Ctx2D {
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  beginPath(): void
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  closePath(): void
  fill(): void
  stroke(): void
  save(): void
  restore(): void
  clip(): void
  fillText(text: string, x: number, y: number): void
  measureText(text: string): Pick<TextMetrics, 'width'> & Partial<Pick<TextMetrics, 'actualBoundingBoxAscent' | 'actualBoundingBoxDescent'>>
  getImageData(x: number, y: number, w: number, h: number): { width: number; height: number; data: Uint8ClampedArray }
}

export type CanvasFactory = (width: number, height: number) => { getContext(kind: '2d'): Ctx2D | null }

export interface MarkerImage {
  width: number
  height: number
  data: Uint8ClampedArray
  /** true = le système n'a pas su dessiner l'emoji : silhouette de repli. */
  fallback: boolean
}

const opaques = (d: Uint8ClampedArray) => {
  let n = 0
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++
  return n
}

const memeRendu = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function peindreSeul(make: CanvasFactory, text: string, px: number) {
  const ctx = make(px, px).getContext('2d')
  if (!ctx) return null
  ctx.font = `${Math.round(px * 0.7)}px ${EMOJI_FONT_STACK}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = BRAND_COLORS.chabon // la sonde ne s'affiche jamais ; n'importe quelle encre opaque
  ctx.fillText(text, px / 2, px / 2)
  return ctx.getImageData(0, 0, px, px).data
}

/**
 * Le système sait-il dessiner `glyph` ? Mémoïsé par caractère : la sonde coûte deux
 * canevas, on ne la refait pas pour chacune des trois tailles.
 */
const sondes = new Map<string, boolean>()
export function emojiDessinable(make: CanvasFactory, glyph: string): boolean {
  const deja = sondes.get(glyph)
  if (deja !== undefined) return deja
  const px = 48
  const g = peindreSeul(make, glyph, px)
  const a = peindreSeul(make, ABSENT, px)
  const ok = g != null && opaques(g) > 0 && !(a != null && memeRendu(g, a))
  sondes.set(glyph, ok)
  return ok
}

/** Pour les tests : oublie les sondes mémorisées. */
export function oublierSondes() {
  sondes.clear()
}

/**
 * Pastille blanche cernée d'encre, portant `glyph` ou, à défaut, une silhouette en encre.
 * `cssSize` est la taille CSS voulue ; le canevas est à 2× (`pixelRatio: 2` à l'enregistrement)
 * — même règle que `shapeIcon` : un tracé déclaré à 1× sortait sous-pixellaire.
 */
export function emojiPuckImage(
  make: CanvasFactory,
  glyph: string,
  cssSize: number,
  colors: { paper: string; ink: string },
): MarkerImage {
  // Sonde AVANT le dessin : elle travaille sur ses propres canevas.
  const fallback = !emojiDessinable(make, glyph)
  const size = cssSize * 2
  const ctx = make(size, size).getContext('2d')
  if (!ctx) throw new Error('canvas 2D indisponible')
  const c = size / 2
  const stroke = 4 // 2 px CSS, comme `MARKER_STROKE` sur les formes des juridictions
  const r = c - stroke / 2 - 1

  ctx.beginPath()
  ctx.arc(c, c, r, 0, Math.PI * 2)
  ctx.fillStyle = colors.paper
  ctx.fill()
  ctx.lineWidth = stroke
  ctx.strokeStyle = colors.ink
  ctx.stroke()

  if (!fallback) {
    ctx.font = `${Math.round(size * 0.56)}px ${EMOJI_FONT_STACK}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    // Centrage sur la boîte RÉELLE du glyphe quand le moteur la donne (`middle` place les
    // emoji trop haut sur certains systèmes).
    const m = ctx.measureText(glyph)
    const asc = m.actualBoundingBoxAscent
    const desc = m.actualBoundingBoxDescent
    const y = asc != null && desc != null && asc + desc > 0 ? c + (asc - desc) / 2 : c + size * 0.2
    ctx.fillText(glyph, c, y)
  } else {
    // Silhouette tête-et-épaules, en encre, contenue dans la pastille.
    ctx.save()
    ctx.beginPath()
    ctx.arc(c, c, r - stroke / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = colors.ink
    ctx.beginPath()
    ctx.arc(c, c - r * 0.22, r * 0.3, 0, Math.PI * 2) // tête
    ctx.fill()
    ctx.beginPath()
    ctx.arc(c, c + r * 0.78, r * 0.62, Math.PI, 0) // épaules
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  const img = ctx.getImageData(0, 0, size, size)
  return { width: img.width, height: img.height, data: img.data, fallback }
}

/** Tailles CSS des trois images d'un marqueur dimensionné (`-s`, `-m`, `-l`). */
export const EMOJI_SIZES = { s: 18, m: 22, l: 27 } as const
