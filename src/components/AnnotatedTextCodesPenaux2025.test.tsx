import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnnotatedText } from './AnnotatedText'
import { CodeSidebar } from './CodeSidebar'
import { parseAnnotations } from '@/lib/legislation/annotated'
import { articleAnchorFromNum } from '@/lib/doc/anchors'

/**
 * Les Codes pénal et de procédure pénale révisés (Décrets du 24 juin 2025, Le Moniteur Spéciaux N° 44
 * et 44-A) RENDUS tel que les fiches les serviront — les données versées, pas un échantillon. Ce que les
 * mesures en base ne voient pas :
 *  - les têtes irrégulières du J.O. portent leur ancre et leur pastille : « Article 704- » (sans point),
 *    les deux « Article 562 » (art-562 et art-562-2), et aucun 563 ni 698 n'est inventé ;
 *  - les sous-articles composés ont leur ancre propre : 649.1, 30-1, 1128.1 ;
 *  - le sommaire affiche des plages d'ARTICLES, jamais une page ; l'index n'a aucun lien mort.
 */
const charger = (code: 'cp' | 'cpp') => {
  const dir = join(__dirname, '../../scripts/data/codes-penaux-2025', code)
  const corps = readFileSync(join(dir, 'bodyOriginal.txt'), 'utf8')
  const annotations = parseAnnotations(readFileSync(join(dir, 'annotations.json'), 'utf8'))!
  const html = renderToStaticMarkup(<AnnotatedText text={corps} annotations={annotations} locale="fr" linkArtRefs hideInlineIndex />)
  const article = (a: string) => {
    const i = html.indexOf(`id="${a}"`)
    const debut = html.lastIndexOf('<article', i)
    const fin = html.indexOf('<article', i)
    return html.slice(debut, fin < 0 ? undefined : fin)
  }
  const menu = renderToStaticMarkup(<CodeSidebar docId="d" groups={annotations.navToc} indexEntries={annotations.indexEntries} locale="fr" refDisplay={annotations.refDisplay} />)
  return { corps, annotations, html, article, menu }
}
const cp = charger('cp')
const cpp = charger('cpp')

describe('Code pénal révisé (2025) — rendu du lecteur annoté', () => {
  it('1 035 ancres d’article, chacune une fois ; deux « Article 562 », ni 563 ni 698', () => {
    const ancres = Object.keys(cp.annotations.labels ?? {})
    expect(ancres.length).toBe(1035)
    for (const a of ancres) expect(cp.html.split(`id="${a}"`).length - 1).toBe(1)
    expect(cp.annotations.labels?.['art-562-2']).toBe('Article 562')
    expect(cp.annotations.refDisplay?.['562-2']).toBe('562 (2ᵉ)')
    expect(cp.html).not.toContain('id="art-563"')
    expect(cp.html).not.toContain('id="art-698"')
  })

  it('les têtes sans point et le sous-article composé portent leur pastille', () => {
    expect(cp.article('art-704')).toContain('>Article 704<')
    expect(cp.article('art-704')).not.toContain('Article 704-')
    expect(cp.article('art-752')).toContain('>Article 752<')
    expect(cp.annotations.labels?.['art-649-1']).toBe('Article 649.1')
  })

  it('les deux irrégularités du J.O. sont signalées en note à leur division', () => {
    expect(cp.html).toContain('aucun article 698 n’y est imprimé')
    expect(cp.html).toContain('imprime deux fois « Article 562 »')
  })

  it('le sommaire porte des plages d’articles, aucun numéro de page', () => {
    for (const p of ['art. 1 à 231', 'art. 232 à 480', 'art. 1021 à 1035']) expect(cp.menu).toContain(p)
    expect(cp.menu).not.toMatch(/\bp\.\s?\d/)
  })

  it('aucune trace de la mise en page du fascicule ni de l’OCR', () => {
    expect(cp.corps).not.toMatch(/LE MONITEUR|Spécial N° 44 -|<\/?answer>|end_conversation/)
    expect(cp.corps).not.toContain("'")
  })
})

describe('Code de procédure pénale révisé (2025) — rendu du lecteur annoté', () => {
  it('1 386 ancres d’article, dont les sous-articles composés', () => {
    const ancres = Object.keys(cpp.annotations.labels ?? {})
    expect(ancres.length).toBe(1386)
    for (const a of ancres) expect(cpp.html.split(`id="${a}"`).length - 1).toBe(1)
    expect(cpp.annotations.labels?.['art-30-1']).toBe('Article 30-1')
    expect(cpp.annotations.labels?.['art-1128-1']).toBe('Article 1128.1')
    expect(cpp.article('art-1128-1')).toContain('arrestation ou d’une détention illégale')
  })

  it('le sommaire porte des plages d’articles, y compris composées', () => {
    for (const p of ['art. 1 à 30-4', 'art. 1128.1 à 1128.4', 'art. 1358 à 1365']) expect(cpp.menu).toContain(p)
    expect(cpp.menu).not.toMatch(/\bp\.\s?\d/)
  })

  it('le corps finit à la dernière signature, sans la mention de l’imprimeur', () => {
    expect(cpp.corps.trimEnd().endsWith('Jean Michel MOÏSE')).toBe(true)
    expect(cpp.corps).not.toContain('Achevé d’imprimer')
  })
})

describe('Index des deux codes', () => {
  it.each([
    ['cp', cp],
    ['cpp', cpp],
  ] as const)('%s : aucun lien mort', (_c, x) => {
    const ancres = new Set(Object.keys(x.annotations.labels ?? {}))
    const renvois = x.annotations.indexEntries.flatMap((e) => e.ctRefs.map(String))
    expect(renvois.length).toBeGreaterThan(1000)
    expect(renvois.filter((r) => !ancres.has(articleAnchorFromNum(r)))).toEqual([])
  })
})
