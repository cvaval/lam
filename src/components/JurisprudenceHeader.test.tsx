import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { JurisprudenceHeader } from './JurisprudenceHeader'

/**
 * Ce que ces tests protègent, un coup d'œil à l'écran ne le montrerait pas : les deux
 * branches DANGEREUSES du bandeau sont celles où l'éditeur ne s'est PAS prononcé, et
 * celle où le glyphe partirait seul.
 *
 * Décision attaquée et dispositif ont rejoint le sommaire : voir
 * `JurisprudenceSommaire.test.tsx`.
 */

const vide = {
  traitement: null, traitementNote: null,
  portee: null, porteeNote: null, noteRedaction: null, noteRedactionBy: null, recueilRef: null,
}

describe('JurisprudenceHeader', () => {
  it('ne rend RIEN pour un document sans qualification', () => {
    // Les 29 000 autres documents passent par la même page : le bandeau ne doit pas
    // s'inviter sur une loi ou une circulaire.
    expect(renderToStaticMarkup(<JurisprudenceHeader doc={vide} locale="fr" />)).toBe('')
  })

  it('ne rend RIEN d’une décision que l’éditeur n’a pas encore qualifiée', () => {
    // Le bandeau ne portant plus que des qualifications, une décision versée mais non
    // encore appréciée ne doit pas laisser un cadre vide au-dessus du sommaire.
    expect(renderToStaticMarkup(<JurisprudenceHeader doc={vide} locale="fr" />)).toBe('')
  })

  it('N’AFFICHE AUCUNE PASTILLE quand l’éditeur ne s’est pas prononcé', () => {
    // Un blanc n'est pas un « neutre » : une pastille par défaut ferait passer une
    // absence d'évaluation pour une évaluation — le défaut le plus grave du lot.
    const html = renderToStaticMarkup(
      <JurisprudenceHeader doc={{ ...vide, noteRedaction: 'Note.' }} locale="fr" />,
    )
    expect(html).not.toContain('Citée sans prise de position')
    expect(html).not.toContain('➖')
    expect(html).not.toContain('Décision d’espèce')
  })

  it('le glyphe ne voyage JAMAIS seul : libellé présent et glyphe aria-hidden', () => {
    const html = renderToStaticMarkup(
      <JurisprudenceHeader doc={{ ...vide, traitement: 'NEGATIF', portee: 'JURISPRUDENCE' }} locale="fr" />,
    )
    expect(html).toContain('Renversée, critiquée')
    expect(html).toContain('Fait jurisprudence')
    expect(html).toContain('<span aria-hidden="true">⚠️</span>')
    expect(html).toContain('<span aria-hidden="true">⚖️</span>')
  })

  it('ignore une valeur de qualification inconnue au lieu de planter', () => {
    // Une valeur héritée ou saisie hors vocabulaire ne doit pas casser la lecture de l'arrêt.
    const html = renderToStaticMarkup(
      <JurisprudenceHeader
        doc={{ ...vide, traitement: 'PARTIELLEMENT', portee: 'XX', noteRedaction: 'Note.' }}
        locale="fr"
      />,
    )
    expect(html).toContain('Note.')
    expect(html).not.toContain('undefined')
  })

  it('distingue la note de la rédaction du texte de l’arrêt', () => {
    const html = renderToStaticMarkup(
      <JurisprudenceHeader
        doc={{ ...vide, noteRedaction: 'La solution est constante depuis 1953.', noteRedactionBy: 'Me C. Vaval' }}
        locale="fr"
      />,
    )
    expect(html).toContain('Note de la rédaction')
    expect(html).toContain('Me C. Vaval')
    expect(html).toContain('La solution est constante depuis 1953.')
  })

  it('traduit les libellés', () => {
    const en = renderToStaticMarkup(<JurisprudenceHeader doc={{ ...vide, portee: 'ESPECE' }} locale="en" />)
    expect(en).toContain('Decision on the facts')
    const ht = renderToStaticMarkup(
      <JurisprudenceHeader doc={{ ...vide, noteRedaction: 'Nòt.' }} locale="ht" />,
    )
    expect(ht).toContain('Nòt redaksyon an')
  })
})
