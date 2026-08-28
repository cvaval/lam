import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { OfficialText, type ArticleMark } from './OfficialText'

/**
 * LES TROIS PASTILLES D'ÉTAT, éprouvées par le chemin de rendu réel.
 *
 * Un texte modificatif peut faire trois choses à un article : le RÉÉCRIRE, l'ABROGER, ou en
 * AJOUTER un qui n'existait pas.
 *
 * ⚠️ Le marqueur unique d'avant les confondait toutes les trois. Il posait « ✎ modifié » sur
 * « Article 110.- [Abrogé] » — contredisant la ligne qu'il suivait — sur 95 articles répartis
 * dans six textes : Code civil (60), Code de commerce (13), décret Casinos de 1960 (9),
 * Administration Centrale (5), loi Loterie de 1958 (4), Code pénal (4). Et un article ajouté
 * y menait à une ancre d'historique qui n'existe pas : il n'a pas d'ancienne version.
 *
 * ⚠️ ET LA PASTILLE EST UN LIEN, PAS UNE ÉTIQUETTE. Deux décrets ont été signés le
 * 6 janvier 2016 — l'amendement à l'Administration Centrale et celui sur l'administration
 * électronique, publiés dans deux Moniteurs consécutifs. La date seule ne désigne donc RIEN :
 * le titre complet est dans l'infobulle, et la destination lève l'ambiguïté pour de bon.
 */
const CORPS = [
  'Article 23.- Le Secrétariat Général de la Primature est un organe de coordination.',
  'Article 23.1.- Le Secrétariat Général comprend le Bureau du Secrétaire Général.',
  'Article 110.- [Abrogé — Décret du 6 janvier 2016]',
].join('\n')

const TITRE = 'Décret du 6 janvier 2016 portant amendement du Décret du 17 mai 2005 portant organisation de l’Administration Centrale de l’État'

const MARQUES = new Map<string, ArticleMark>([
  ['art-23', { kind: 'modifie', label: 'Modifié', title: `Article amendé par : ${TITRE} — voir l’ancienne rédaction`, href: '#hist-art-23' }],
  ['art-23-1', { kind: 'ajout', label: 'Ajout — Décret du 6 janvier 2016', title: `Article ajouté par : ${TITRE}`, href: '/fr/doc/cmtest' }],
  ['art-110', { kind: 'abroge', label: 'Texte abrogé', title: `Article abrogé par : ${TITRE} — voir le texte abrogé`, href: '#hist-art-110' }],
])

const rendu = (props: Parameters<typeof OfficialText>[0]) => renderToStaticMarkup(<OfficialText {...props} />)
const html = () => rendu({ text: CORPS, articleMarks: MARQUES })
/** Le fragment de rendu d'un article, de sa tête à la suivante. */
const bloc = (h: string, id: string) => {
  const d = h.indexOf(`id="${id}"`)
  const s = h.slice(d)
  const f = s.slice(1).search(/<p [^>]*id="art-/)
  return f < 0 ? s : s.slice(0, f + 1)
}

describe('les trois pastilles d’état', () => {
  it('chaque état porte SON libellé, et un seul', () => {
    const h = html()
    expect(bloc(h, 'art-23')).toContain('Modifié')
    expect(bloc(h, 'art-23-1')).toContain('Ajout — Décret du 6 janvier 2016')
    expect(bloc(h, 'art-110')).toContain('Texte abrogé')
  })

  /** ⚠️ LE DÉFAUT CORRIGÉ : « Article 110.- [Abrogé] ✎ modifié » se contredisait. */
  it('un article ABROGÉ ne se dit jamais « modifié »', () => {
    const b = bloc(html(), 'art-110')
    expect(b).toContain('[Abrogé — Décret du 6 janvier 2016]')
    expect(b).not.toContain('Modifié')
    expect(b).not.toContain('✎')
  })

  /** ⚠️ Un article ajouté n'a pas d'ancienne version : #hist-art-23-1 n'existe pas. */
  it('un article AJOUTÉ mène à l’acte, les deux autres à l’historique', () => {
    const h = html()
    expect(bloc(h, 'art-23-1')).toContain('href="/fr/doc/cmtest"')
    expect(bloc(h, 'art-23')).toContain('href="#hist-art-23"')
    expect(bloc(h, 'art-110')).toContain('href="#hist-art-110"')
  })

  it('l’infobulle porte le TITRE COMPLET de l’acte', () => {
    expect(html()).toContain('portant amendement du Décret du 17 mai 2005')
  })

  /**
   * ⚠️ Placée en fin de paragraphe, la pastille atterrissait quinze lignes sous la tête de
   * l'article 23.1 — parfois seule sur sa ligne. Elle s'adresse à qui PARCOURT les têtes.
   */
  it('la pastille suit le NUMÉRO de l’article, pas la fin du paragraphe', () => {
    const h = html()
    const i = h.indexOf('Ajout —')
    expect(h.slice(0, i)).toContain('Article 23.1.-')
    expect(h.slice(0, i)).not.toContain('Le Secrétariat Général comprend')
    expect(h.slice(i)).toContain('Le Secrétariat Général comprend')
  })

  /**
   * ⚠️ SITWON EST RATIONNÉ À UNE OCCURRENCE PAR ÉCRAN (charte Klinik v3, avenant AV-02) et
   * appartient au CERTIFICATEUR. Le Code civil afficherait à lui seul 60 articles abrogés.
   */
  it('aucune pastille n’emprunte d’accent de marque', () => {
    const h = html()
    expect(h).not.toMatch(/bg-sitwon|bg-wouj|text-sitwon|text-wouj/)
    expect(h).toContain('border-liy-fonse')
    expect(h).toContain('bg-pil')
  })

  /**
   * ⚠️ ERGONOMIE. 11 px de texte font 17 px de haut : la pastille se manque au doigt, et se
   * perdait au clavier faute d'anneau de focus. La cible est étendue par un pseudo-élément —
   * un `py` suffisant écarterait les lignes de TOUT le corpus.
   */
  it('elle se prend au doigt et au clavier, et ne se coupe jamais', () => {
    const h = html()
    expect(h).toContain('after:-inset-y-[11px]')
    expect(h).toContain('focus-visible:outline')
    expect(h).toContain('whitespace-nowrap')
  })

  it('sans état déclaré, le rendu est inchangé', () => {
    expect(rendu({ text: CORPS })).toBe(rendu({ text: CORPS, articleMarks: new Map() }))
  })
})

/**
 * ⚠️ LE MOTIF DE TÊTE D'ARTICLE — éprouvé sur les quatre conventions du corpus.
 *
 * Il coupait les numéros à tiret en deux : « Art. 1774- [Ajout] 1 Une sûreté est… ». Les 57
 * articles insérés au Code civil par le décret des sûretés et les trois du décret des régimes
 * matrimoniaux étaient tous dans ce cas — défaut invisible aux tests comme à la base, vu à
 * l'écran seulement.
 */
describe('placement de la pastille sur les quatre formes de tête', () => {
  const CAS: [string, string][] = [
    ['Article 23.1.- Le Secrétariat Général comprend le Bureau.', 'Article 23.1.-'],
    ['Art. 1774-1 Une sûreté est l’affectation au bénéfice d’un créancier.', 'Art. 1774-1'],
    ['Article 110.- [Abrogé — Décret du 6 janvier 2016]', 'Article 110.-'],
    ['Art. 1294 (D. du 13 mai 2020) Les créanciers de la communauté.', 'Art. 1294 (D. du 13 mai 2020)'],
    ['Art. 55 (D. du 14 novembre 1988, art. 1) Les déclarations de naissance.', 'Art. 55 (D. du 14 novembre 1988, art. 1)'],
    ['Art. 3 Aucune loi ne peut être abrogée ni suspendue que par une autre loi.', 'Art. 3'],
  ]
  for (const [ligne, tete] of CAS) {
    it(`« ${tete} »`, () => {
      const anchor = /Art\w*\.?\s+(\d+(?:[.-]\d+)*)/.exec(ligne)![1].replace('.', '-')
      const h = renderToStaticMarkup(
        <OfficialText
          text={ligne}
          articleMarks={new Map([[`art-${anchor}`, { kind: 'modifie', label: 'Modifié', title: 't', href: '#h' }]])}
        />,
      )
      const i = h.indexOf('Modifié')
      const avant = h.slice(0, i).replace(/<[^>]+>/g, '')
      // La pastille suit la tête ENTIÈRE, et rien de plus.
      expect(avant.trim()).toBe(tete)
    })
  }
})
