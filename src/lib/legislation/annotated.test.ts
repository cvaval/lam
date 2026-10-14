import { describe, it, expect } from 'vitest'
import { segmentAnnotated, pointAnchorFromHeading, parseAnnotations, type TocEntry } from './annotated'

// Corps type d'une circulaire BRH : divisions numérotées « N.- » / « N.M »,
// puis des annexes qui REPRENNENT les mêmes formes numériques sans être des divisions.
const circulaire = [
  'AUX INSTITUTIONS FINANCIÈRES',
  '1.- Dans le cadre de la présente circulaire, on entend par :',
  '2.- Les institutions financières sont tenues de transmettre au BIC.',
  '9.1. Retard de transmission',
  'À défaut de transmettre les informations exigées à l’article 2, une amende est due.',
  'ANNEXE 2',
  '1. Entreprise/Responsable/Actionnaire/Crédit',
  '2 segments par enregistrement :',
].join('\n')

const toc: TocEntry[] = [
  { level: 1, label: 'ANNEXE 2', anchor: 'sec-1', kind: 'code' },
  { level: 2, label: '1. Entreprise/Responsable/Actionnaire/Crédit', anchor: 'sec-2', kind: 'code' },
]
const POINTS = ['1', '2', '9.1']

describe('pointAnchorFromHeading', () => {
  const allow = new Set(POINTS)
  it('reconnaît les formes « 1.- », « 9.1. » et « 4.2.1 »', () => {
    expect(pointAnchorFromHeading('1.- Dans le cadre…', allow)).toBe('art-1')
    expect(pointAnchorFromHeading('9.1. Retard de transmission', new Set(['9.1']))).toBe('art-9-1')
    expect(pointAnchorFromHeading('4.2.1 Composition du conseil', new Set(['4.2.1']))).toBe('art-4-2-1')
  })
  it('refuse toute désignation hors liste blanche', () => {
    expect(pointAnchorFromHeading('7. Autre chose', allow)).toBeUndefined()
    expect(pointAnchorFromHeading('Les institutions financières…', allow)).toBeUndefined()
  })
})

describe('segmentAnnotated — mode pointAnchors', () => {
  it('sans liste blanche, aucune tête numérotée n’est ancrée (comportement historique)', () => {
    const blocks = segmentAnnotated(circulaire, toc)
    expect(blocks.filter((b) => b.kind === 'body' && b.anchor).length).toBe(0)
    expect(blocks.filter((b) => b.kind === 'section').map((b) => b.anchor)).toEqual(['sec-1', 'sec-2'])
  })

  it('avec liste blanche, chaque point déclaré porte son ancre art-…', () => {
    const blocks = segmentAnnotated(circulaire, toc, POINTS)
    const anchors = blocks.filter((b) => b.kind === 'body' && b.anchor).map((b) => b.anchor)
    expect(anchors).toEqual(['art-1', 'art-2', 'art-9-1'])
  })

  it('une désignation répétée en annexe reste du texte — ni ancre en double, ni faux article', () => {
    const blocks = segmentAnnotated(circulaire, toc, POINTS)
    // « 2 segments par enregistrement : » a la même forme que le point 2 : il ne doit
    // produire NI un second bloc ancré art-2, NI un bloc de corps distinct.
    expect(blocks.filter((b) => b.anchor === 'art-2').length).toBe(1)
    const tail = blocks[blocks.length - 1]
    expect(tail.anchor).toBeNull()
    expect(tail.text).toContain('2 segments par enregistrement')
  })

  it('le TOC garde la priorité : une tête numérotée listée au sommaire reste une section', () => {
    const blocks = segmentAnnotated(circulaire, toc, [...POINTS, '1'])
    const sec2 = blocks.find((b) => b.anchor === 'sec-2')
    expect(sec2?.kind).toBe('section')
    expect(sec2?.text).toBe('1. Entreprise/Responsable/Actionnaire/Crédit')
  })
})

describe('parseAnnotations — acheminement des champs', () => {
  // La coercition est une LISTE BLANCHE : tout champ oublié disparaît sans erreur. Ce test
  // part d'une CHAÎNE (comme la base), seul chemin qu'emprunte réellement la page.
  const json = JSON.stringify({
    title: 'Circulaire',
    toc: [],
    labels: { 'art-1': 'Point 1' },
    pointAnchors: ['1', '9.1', 42, null],
  })
  it('conserve pointAnchors — sans lui le lecteur annoté est inerte', () => {
    const a = parseAnnotations(json)!
    expect(a.pointAnchors).toEqual(['1', '9.1']) // les valeurs non textuelles sont écartées
  })
  it('bout en bout : la chaîne stockée suffit à ancrer les divisions', () => {
    const a = parseAnnotations(json)!
    const blocks = segmentAnnotated('1.- Objet du texte.\n9.1. Retard', a.toc, a.pointAnchors)
    expect(blocks.filter((b) => b.kind === 'body' && b.anchor).map((b) => b.anchor)).toEqual(['art-1', 'art-9-1'])
  })
})

/**
 * Code fiscal 2026 : le Journal officiel imprime DEUX FOIS « Article 406.- » (Spécial N° 48-A,
 * p. 123-124), et « Article129.- » sans espace. Le texte reste tel quel ; la fiche déclare une
 * ancre technique pour la 2ᵉ occurrence.
 */
describe('segmentAnnotated — têtes répétées et têtes collées (Code fiscal 2026)', () => {
  const corps = [
    'Article 128.- Premier.',
    'Article129.- Sont soumis à la taxe…',
    'Article 405.- Avant.',
    'Article 406.- 1. Le contribuable…',
    'Article 406.- 1. Lorsque la vérification… au 2. de l’article 405.',
    'Article 407.- Après.',
  ].join('\n')
  const ancres = (b: ReturnType<typeof segmentAnnotated>) =>
    b.filter((x) => x.kind === 'body' && x.anchor && !x.noAnchors).map((x) => (x.kind === 'body' ? x.anchor : ''))
  it('sans déclaration : la répétition perd son ancre (comportement historique)', () => {
    const b = segmentAnnotated(corps, [])
    expect(ancres(b)).toEqual(['art-128', 'art-129', 'art-405', 'art-406', 'art-407'])
    expect(b.filter((x) => x.kind === 'body').length).toBe(6) // le second 406 reste un bloc, sans ancre
  })
  it('avec repeatedHeads : deux ancres distinctes, texte inchangé', () => {
    const b = segmentAnnotated(corps, [], undefined, { 'art-406': ['art-406-2'] })
    expect(ancres(b)).toEqual(['art-128', 'art-129', 'art-405', 'art-406', 'art-406-2', 'art-407'])
    expect(b.map((x) => x.text).join('\n')).toBe(corps)
    const second = b.find((x) => x.kind === 'body' && x.anchor === 'art-406-2')
    expect(second?.kind === 'body' && second.jurisKey).toBe('sec-0|art-406-2')
  })
  it('parseAnnotations conserve repeatedHeads (liste blanche)', () => {
    const a = parseAnnotations(JSON.stringify({ toc: [], repeatedHeads: { 'art-406': ['art-406-2', 7] } }))!
    expect(a.repeatedHeads).toEqual({ 'art-406': ['art-406-2'] })
    expect(parseAnnotations(JSON.stringify({ toc: [] }))!.repeatedHeads).toBeUndefined()
  })
})
