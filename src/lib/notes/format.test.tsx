import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { analyserMiseEnForme, texteNu, type Segment } from './format'
import { NoteBody } from '@/components/NoteBody'

/** Résumé compact d'un arbre : `gras(texte)` — les tests restent lisibles. */
function forme(segments: Segment[]): string {
  return segments
    .map((s) => (s.type === 'texte' ? JSON.stringify(s.valeur) : `${s.type}(${forme(s.enfants)})`))
    .join('+')
}

describe('analyserMiseEnForme', () => {
  it('reconnaît le gras et l’italique', () => {
    expect(forme(analyserMiseEnForme('**gras**'))).toBe('gras("gras")')
    expect(forme(analyserMiseEnForme('*italique*'))).toBe('italique("italique")')
  })

  it('« ** » l’emporte sur « * »', () => {
    // Sans priorité au marqueur long, `**mot**` se lirait comme deux italiques vides.
    const r = analyserMiseEnForme('**mot**')
    expect(r).toHaveLength(1)
    expect(r[0].type).toBe('gras')
  })

  it('est NON GOURMAND : deux italiques, pas un seul', () => {
    expect(forme(analyserMiseEnForme('*a* et *b*'))).toBe('italique("a")+" et "+italique("b")')
  })

  it('un marqueur NON REFERMÉ reste du texte', () => {
    // On ne « répare » jamais en fermant à la fin : la note ne dirait plus ce que son
    // auteur a écrit.
    expect(forme(analyserMiseEnForme('Le taux est de 5*'))).toBe('"Le taux est de 5*"')
    expect(forme(analyserMiseEnForme('**abc*'))).toBe('"**abc*"')
  })

  it('une paire VIDE reste du texte', () => {
    for (const v of ['**', '****', '* *', '** **']) {
      expect(texteNu(analyserMiseEnForme(v))).toBe(v)
      expect(analyserMiseEnForme(v).every((s) => s.type === 'texte')).toBe(true)
    }
  })

  it('imbrique l’italique DANS le gras', () => {
    // La suite finale « *** » ferme l'italique puis le gras : ses étoiles en trop
    // appartiennent au contenu.
    expect(forme(analyserMiseEnForme('**très *important***'))).toBe('gras("très "+italique("important"))')
    expect(forme(analyserMiseEnForme('***les deux***'))).toBe('gras(italique("les deux"))')
    expect(forme(analyserMiseEnForme('**a *b* c**'))).toBe('gras("a "+italique("b")+" c")')
  })

  it('préserve les retours à la ligne', () => {
    expect(texteNu(analyserMiseEnForme('un\n\ndeux'))).toBe('un\n\ndeux')
    expect(forme(analyserMiseEnForme('**a**\nb'))).toBe('gras("a")+"\\nb"')
  })

  it('AUCUNE BALISE HTML ne peut naître du corps', () => {
    for (const v of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<b>x</b>']) {
      expect(analyserMiseEnForme(v)).toEqual([{ type: 'texte', valeur: v }])
    }
    // Une balise ENCADRÉE de marqueurs reste du texte, à l'intérieur d'un gras.
    expect(forme(analyserMiseEnForme('**<b>x</b>**'))).toBe('gras("<b>x</b>")')
  })

  it('rend inchangée une note écrite AVANT la mise en forme', () => {
    const ancienne = 'La solution est constante depuis 1953 ; voir aussi l’arrêt n° 12.'
    expect(texteNu(analyserMiseEnForme(ancienne))).toBe(ancienne)
    expect(forme(analyserMiseEnForme(ancienne))).toBe(JSON.stringify(ancienne))
  })
})

describe('NoteBody', () => {
  it('produit <strong> et <em>, et rien d’autre', () => {
    const html = renderToStaticMarkup(<NoteBody corps="**gras** et *italique*" />)
    expect(html).toContain('<strong')
    expect(html).toContain('<em>')
    expect(html).toContain('gras')
  })

  it('n’émet NI script, NI onerror, NI img à partir du corps', () => {
    // Le corps n'est jamais interprété comme du HTML : les chevrons ressortent échappés.
    const html = renderToStaticMarkup(
      <NoteBody corps={'<script>alert(1)</script><img src=x onerror=alert(1)>'} />,
    )
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    // Aucune BALISE ne porte l'attribut : « onerror » ne subsiste que dans du texte échappé.
    expect(html).not.toMatch(/<[a-z]+[^>]*\son[a-z]+=/i)
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('conserve les retours à la ligne', () => {
    expect(renderToStaticMarkup(<NoteBody corps="a\nb" />)).toContain('whitespace-pre-line')
  })
})
