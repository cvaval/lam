import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnnotatedText } from './AnnotatedText'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { Annotations } from '@/lib/legislation/annotated'
import type { RichBlock } from '@/lib/doc/richblocks'

// Corps type d'une circulaire BRH : deux divisions numérotées, une annexe dont l'intitulé
// est une SECTION (donc dans un autre bloc que les rangées du tableau), et deux tableaux
// aplatis. C'est exactement la forme qui avait fait rendre 20 tableaux 22 fois.
const body = [
  '1.- Objet de la présente circulaire.',
  '2.- Les institutions financières transmettent les informations prévues à l’annexe.',
  'ANNEXE 1',
  'Tableau 1 – Communes',
  'Code | Commune',
  '0611 | HINCHE',
  'Tableau 2 – Pays',
  'Code | Pays',
  'HT | HAÏTI',
  'Fin de l’annexe.',
].join('\n')

const table = (caption: string, rows: string[][], after: string, until: string): RichBlock =>
  ({
    type: 'table',
    caption,
    afterText: after,
    untilText: until,
    rows: rows.map((r, i) => r.map((text) => ({ text, ...(i === 0 ? { header: true } : {}) }))),
  }) as RichBlock

const rich: RichBlock[] = [
  table('Tableau 1 – Communes', [['Code', 'Commune'], ['0611', 'HINCHE']], 'Tableau 1 – Communes', 'Tableau 2 – Pays'),
  table('Tableau 2 – Pays', [['Code', 'Pays'], ['HT', 'HAÏTI']], 'Tableau 2 – Pays', 'Fin de l’annexe.'),
]

const annotations: Annotations = {
  title: 'Circulaire type',
  annotationAuthor: 'Lam Veritab',
  navToc: [],
  toc: [
    { level: 1, label: 'ANNEXE 1', anchor: 'sec-1', kind: 'connexe' },
    { level: 3, label: 'Tableau 1 – Communes', anchor: 'sec-2', kind: 'connexe' },
    { level: 3, label: 'Tableau 2 – Pays', anchor: 'sec-3', kind: 'connexe' },
  ],
  connexes: [],
  jurisprudence: {},
  indexEntries: [],
  labels: { 'art-1': 'Point 1', 'art-2': 'Point 2' },
  pointAnchors: ['1', '2'],
}

const render = (r: RichBlock[]) =>
  renderToStaticMarkup(<AnnotatedText text={body} annotations={annotations} locale="fr" rich={r} />)

describe('AnnotatedText — rendu des tableaux', () => {
  it('rend chaque tableau UNE SEULE FOIS', () => {
    const html = render(rich)
    expect((html.match(/<table/g) ?? []).length).toBe(rich.length)
  })

  it('ne signale aucun « emplacement approximatif »', () => {
    // Un tableau dont l'ancre n'est pas retrouvée est rendu en fin de bloc avec cette
    // mention : 433 en étaient apparues sur la circulaire 105-2.
    const t = getDictionary('fr')
    expect(render(rich)).not.toContain(t.doc ? 'emplacement approximatif' : 'emplacement approximatif')
  })

  it('ne laisse aucune rangée aplatie « a | b » en texte brut', () => {
    const html = render(rich)
    for (const ligne of ['0611 | HINCHE', 'HT | HAÏTI']) expect(html).not.toContain(ligne)
  })

  it('affiche bien le contenu des rangées', () => {
    const html = render(rich)
    for (const v of ['HINCHE', 'HAÏTI', '0611']) expect(html).toContain(v)
  })

  it('sans tableaux, les rangées restent du texte (aucune perte)', () => {
    const html = render([])
    expect(html).toContain('HINCHE')
    expect((html.match(/<table/g) ?? []).length).toBe(0)
  })

  it('ancre chaque division déclarée dans pointAnchors', () => {
    const html = render(rich)
    for (const id of ['art-1', 'art-2']) expect(html).toContain(`id="${id}"`)
  })
})
