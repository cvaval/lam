import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnnotatedText } from './AnnotatedText'
import { CodeSidebar } from './CodeSidebar'
import { parseAnnotations } from '@/lib/legislation/annotated'
import { parseRichBlocks } from '@/lib/doc/richblocks'

/**
 * Le Code fiscal de 2026 (Le Moniteur Spécial N° 48-A) RENDU tel que la fiche le servira — les
 * données versées, pas un échantillon. Ce que les mesures en base ne voient pas :
 *  - les neuf tableaux sont DANS leur article, à la place de leurs rangées (art. 293 : avant le
 *    « 2. » ; art. 403 : chacun sous son alinéa), et aucune rangée « a | b » ne reste en texte ;
 *  - les têtes du J.O. sans tiret (« Article 296. ») et collée (« Article129.- ») portent leur
 *    ancre et leur pastille ; les deux « Article 406 » ont deux ancres distinctes ;
 *  - le sommaire affiche des plages d'ARTICLES, jamais une page.
 */
const DIR = join(__dirname, '../../scripts/data/code-fiscal-2026')
const corps = readFileSync(join(DIR, 'bodyOriginal.txt'), 'utf8')
const annotations = parseAnnotations(readFileSync(join(DIR, 'annotations.json'), 'utf8'))!
const rich = parseRichBlocks(readFileSync(join(DIR, 'rich.json'), 'utf8'))
const html = renderToStaticMarkup(<AnnotatedText text={corps} annotations={annotations} rich={rich} locale="fr" linkArtRefs hideInlineIndex />)
/** Le HTML de l'article d'ancre `a` (de sa balise <article> à la suivante). */
const article = (a: string) => {
  const i = html.indexOf(`id="${a}"`)
  const debut = html.lastIndexOf('<article', i)
  const fin = html.indexOf('<article', i)
  return html.slice(debut, fin < 0 ? undefined : fin)
}

describe('Code fiscal 2026 — rendu du lecteur annoté', () => {
  it('542 ancres d’article, chacune une fois ; les deux « Article 406 » distinctes', () => {
    const ancres = Object.keys(annotations.labels ?? {})
    expect(ancres.length).toBe(542)
    for (const a of ancres) expect(html.split(`id="${a}"`).length - 1).toBe(1)
    expect(annotations.labels?.['art-406-2']).toBe('Article 406')
    expect(html).not.toContain('id="art-294"')
  })

  it('les têtes sans tiret et la tête collée portent leur pastille, le corps commence après', () => {
    expect(article('art-296')).toContain('>Article 296<')
    expect(article('art-296')).toContain('>1.</span><span>Les acheteurs')
    expect(article('art-129')).toContain('>Article 129<')
    expect(article('art-129')).not.toContain('Article129')
  })

  it('neuf tableaux, chacun dans son article, sans rangée aplatie', () => {
    expect((html.match(/<table/g) ?? []).length).toBe(9)
    const parArticle = (a: string) => (article(a).match(/<table/g) ?? []).length
    expect([154, 202, 230, 274, 293, 403].map((n) => parArticle(`art-${n}`))).toEqual([2, 1, 1, 1, 1, 3])
    for (const rangee of ['Gardien | 165', 'Bières | 20%', 'Oriflamme | 250']) expect(html).not.toContain(rangee)
  })

  it('le tableau est posé à la place de ses rangées, pas en fin d’article', () => {
    const a293 = article('art-293')
    expect(a293.indexOf('<table')).toBeLessThan(a293.indexOf('Le montant de l’impôt est égal à'))
    const a403 = article('art-403')
    const tables = [...a403.matchAll(/<table/g)].map((m) => m.index!)
    expect(tables[0]).toBeLessThan(a403.indexOf('Seuls sont pris en compte les employés'))
    expect(tables[1]).toBeGreaterThan(a403.indexOf('pour les résidences principales'))
    expect(tables[1]).toBeLessThan(a403.indexOf('Sont prises en compte toutes les résidences'))
  })

  it('le sommaire porte des plages d’articles, aucun numéro de page', () => {
    const menu = renderToStaticMarkup(<CodeSidebar docId="d" groups={annotations.navToc} indexEntries={annotations.indexEntries} locale="fr" />)
    for (const p of ['art. 1 à 297', 'art. 298 à 543', 'art. 1 à 44', 'art. 1 à 12']) expect(menu).toContain(p)
    expect(menu).not.toMatch(/\bp\.\s?\d/)
  })

  it('l’index renvoie au bon texte : « 405 » → 1er « Article 406 », « 406 » → le second, affiché « 406 (2ᵉ) »', () => {
    const tous = annotations.indexEntries.flatMap((e) => e.ctRefs.map(String))
    expect(tous).toContain('406-2')
    expect(tous.some((r) => r === '405' || r === '294')).toBe(false)
    // Rendu de l'index sous l'article 409 (« vérification inopinée : 406, 409, 414 ») : le renvoi
    // vers le second « Article 406 » porte son ancre propre et le libellé « 406 (2ᵉ) ».
    const avecIndex = renderToStaticMarkup(<AnnotatedText text={corps} annotations={annotations} rich={rich} locale="fr" linkArtRefs />)
    const i = avecIndex.indexOf('id="art-409"')
    const a409 = avecIndex.slice(i, avecIndex.indexOf('<article', i))
    expect(a409).toMatch(/<a href="#art-406-2"[^>]*>406 \(2ᵉ\)<\/a>/)
  })
})
