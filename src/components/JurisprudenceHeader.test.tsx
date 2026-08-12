import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { JurisprudenceHeader } from './JurisprudenceHeader'

/**
 * Ce que ces tests protègent, un coup d'œil à l'écran ne le montrerait pas : les deux
 * branches DANGEREUSES du bandeau sont celles où l'éditeur ne s'est PAS prononcé, et
 * celle où le glyphe partirait seul.
 */

const vide = {
  decisionAttaquee: null, dispositif: null, traitement: null, traitementNote: null,
  portee: null, porteeNote: null, noteRedaction: null, noteRedactionBy: null, recueilRef: null,
}
const arret5 = {
  ...vide,
  decisionAttaquee: 'Arrêt de la Cour d’Appel de Port-au-Prince du 6 juillet 1961',
  dispositif: 'Rejet du pourvoi.',
}

describe('JurisprudenceHeader', () => {
  it('ne rend RIEN pour un document sans champ de décision', () => {
    // Les 29 000 autres documents passent par la même page : le bandeau ne doit pas
    // s'inviter sur une loi ou une circulaire.
    expect(renderToStaticMarkup(<JurisprudenceHeader doc={vide} locale="fr" />)).toBe('')
  })

  it('met en évidence décision attaquée et dispositif', () => {
    const html = renderToStaticMarkup(<JurisprudenceHeader doc={arret5} locale="fr" />)
    expect(html).toContain('Décision attaquée')
    expect(html).toContain('Cour d’Appel de Port-au-Prince')
    expect(html).toContain('Dispositif')
    expect(html).toContain('Rejet du pourvoi.')
  })

  it('N’AFFICHE AUCUNE PASTILLE quand l’éditeur ne s’est pas prononcé', () => {
    // Un blanc n'est pas un « neutre » : une pastille par défaut ferait passer une
    // absence d'évaluation pour une évaluation — le défaut le plus grave du lot.
    const html = renderToStaticMarkup(<JurisprudenceHeader doc={arret5} locale="fr" />)
    expect(html).not.toContain('Citée sans prise de position')
    expect(html).not.toContain('➖')
    expect(html).not.toContain('Décision d’espèce')
  })

  it('le glyphe ne voyage JAMAIS seul : libellé présent et glyphe aria-hidden', () => {
    const html = renderToStaticMarkup(
      <JurisprudenceHeader doc={{ ...arret5, traitement: 'NEGATIF', portee: 'JURISPRUDENCE' }} locale="fr" />,
    )
    expect(html).toContain('Renversée, critiquée')
    expect(html).toContain('Fait jurisprudence')
    expect(html).toContain('<span aria-hidden="true">⚠️</span>')
    expect(html).toContain('<span aria-hidden="true">⚖️</span>')
  })

  it('ignore une valeur de qualification inconnue au lieu de planter', () => {
    // Une valeur héritée ou saisie hors vocabulaire ne doit pas casser la lecture de l'arrêt.
    const html = renderToStaticMarkup(
      <JurisprudenceHeader doc={{ ...arret5, traitement: 'PARTIELLEMENT', portee: 'XX' }} locale="fr" />,
    )
    expect(html).toContain('Rejet du pourvoi.')
    expect(html).not.toContain('undefined')
  })

  it('distingue la note de la rédaction du texte de l’arrêt', () => {
    const html = renderToStaticMarkup(
      <JurisprudenceHeader
        doc={{ ...arret5, noteRedaction: 'La solution est constante depuis 1953.', noteRedactionBy: 'Me C. Vaval' }}
        locale="fr"
      />,
    )
    expect(html).toContain('Note de la rédaction')
    expect(html).toContain('Me C. Vaval')
    expect(html).toContain('La solution est constante depuis 1953.')
  })

  it('traduit les libellés', () => {
    const en = renderToStaticMarkup(<JurisprudenceHeader doc={{ ...arret5, portee: 'ESPECE' }} locale="en" />)
    expect(en).toContain('Decision under appeal')
    expect(en).toContain('Decision on the facts')
    const ht = renderToStaticMarkup(<JurisprudenceHeader doc={arret5} locale="ht" />)
    expect(ht).toContain('Desizyon atake')
  })
})
