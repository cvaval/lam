import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * La feuille du tableau de bord ne doit toucher QUE le tableau de bord (Me Vaval, 9 oct. 2026) :
 * chargée par la page, elle peut rester en mémoire après une navigation côté client — chaque
 * sélecteur est donc préfixé par une classe propre à l'écran, ou par `body:has(.ag-dashboard)`.
 */
const css = readFileSync(resolve(__dirname, 'dashboard.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const selecteurs = [...css.matchAll(/(?:^|})\s*([^@{}][^{}]*?)\s*\{/g)]
  .map((m) => m[1].trim())
  .filter((s) => s && !s.startsWith('@') && !/^(from|to|\d)/.test(s))
  .flatMap((s) => s.split(',').map((x) => x.trim()))
const PREFIXES = /^(\.ag-dashboard|\.ag-deadline-|\.ag-result-count|\.ag-favorites-empty|body:has\(\.ag-dashboard\))/

describe('dashboard.css', () => {
  it('chaque sélecteur est propre au tableau de bord', () => {
    expect(selecteurs.length).toBeGreaterThan(20)
    expect(selecteurs.filter((s) => !PREFIXES.test(s))).toEqual([])
  })
  it('le contour de focus reste celui de la maison : aucun focus coloré ici', () => {
    expect(css).not.toMatch(/focus/)
  })
  it('une seule frise, ligne de sol au bord inférieur, opacités 0,15 / 0,12, sans intercepter de clic', () => {
    expect(css.match(/landmarks-haiti-market-first\.png/g)).toHaveLength(1)
    expect(css).toContain('center bottom -91px/1440px auto')
    expect(css).toContain('background-position:center bottom -63px')
    expect(css).toMatch(/opacity:\.15/)
    expect(css).toMatch(/opacity:\.12/)
    expect(css).toMatch(/::after\{[^}]*pointer-events:none/)
  })
  it('pied de page sans filet au-dessus de la frise', () => {
    expect(css).toContain('body:has(.ag-dashboard) footer>div{border-top:0')
  })
})
