import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { JurisprudenceComposition, type MembreAffiche } from './JurisprudenceComposition'

const m = (id: string, nameAsWritten: string, role: string | null, qualite: string | null = null): MembreAffiche => ({
  id, nameAsWritten, role, qualite,
})

const formation = [
  m('1', 'Félix Diambois', 'VICE_PRESIDENT', 'Vice-Président'),
  m('2', 'Léonce Pierre-Antoine', 'JUGE', 'Juges'),
  m('3', 'André Rousseau', 'JUGE', 'Juges'),
  m('4', 'Catinat Sansaricq', 'MINISTERE_PUBLIC', 'Substitut du Commissaire du Gouvernement'),
  m('5', 'Joseph Lucien', 'GREFFE', 'Commis-Greffier'),
]

describe('JurisprudenceComposition', () => {
  it('ne rend rien quand la formation est inconnue', () => {
    // 0/80 décisions en avaient une avant le 15 août : le bloc devait déjà se taire, et
    // il doit continuer à le faire pour tout recueil versé sans composition.
    expect(renderToStaticMarkup(<JurisprudenceComposition membres={[]} note={null} locale="fr" />)).toBe('')
  })

  it('SÉPARE le ministère public et le greffe du siège', () => {
    // Les aligner avec les juges donnerait à lire une formation fausse, où le substitut
    // du commissaire du gouvernement aurait jugé.
    const html = renderToStaticMarkup(<JurisprudenceComposition membres={formation} note={null} locale="fr" />)
    const iSiege = html.indexOf('Composition')
    const iMp = html.indexOf('Ministère public')
    const iGreffe = html.indexOf('Greffe')
    expect(iSiege).toBeGreaterThanOrEqual(0)
    expect(iMp).toBeGreaterThan(iSiege)
    expect(iGreffe).toBeGreaterThan(iMp)
    // Le substitut ne doit pas figurer dans la même définition que les juges.
    const blocSiege = html.slice(iSiege, iMp)
    expect(blocSiege).toContain('Félix Diambois')
    expect(blocSiege).not.toContain('Catinat Sansaricq')
  })

  it('dit « vice-président » quand le recueil dit vice-président', () => {
    const html = renderToStaticMarkup(<JurisprudenceComposition membres={formation} note={null} locale="fr" />)
    expect(html).toContain('vice-président')
    expect(html).not.toContain('(président)')
  })

  it('garde la graphie de CET arrêt', () => {
    // « Louis B. VILGRAIN » ici, « Louis VILGRAIN » ailleurs : le nom retenu par la
    // rédaction ne doit pas se substituer à celui de la décision.
    const html = renderToStaticMarkup(
      <JurisprudenceComposition membres={[m('1', 'Louis B. VILGRAIN', 'JUGE')]} note={null} locale="fr" />,
    )
    expect(html).toContain('Louis B. VILGRAIN')
  })

  it('AFFICHE un magistrat sans rôle, sans lui en inventer un', () => {
    // Le taire parce qu'on ignore sa fonction ferait lire une formation amputée — plus
    // grave qu'une formation incomplètement qualifiée.
    const html = renderToStaticMarkup(
      <JurisprudenceComposition
        membres={[m('1', 'Jean DUPONT', null), m('2', 'Paul MARTIN', 'JUGE')]}
        note={null}
        locale="fr"
      />,
    )
    expect(html).toContain('Jean DUPONT')
    expect(html).toContain('Paul MARTIN')
    // Aucune qualité accolée à un nom : ni parenthèse, ni virgule qualifiante.
    expect(html).not.toMatch(/Jean DUPONT<\/span>\s*<span[^>]*>\s*\(/)
    expect(html).not.toContain('undefined')
  })

  it('range la mention du recueil à part de la formation', () => {
    // Cette prose nomme des magistrats qui n'ont PAS siégé — celui qui a lu les
    // conclusions. La confondre avec la formation attribuerait l'arrêt à un tiers.
    const html = renderToStaticMarkup(
      <JurisprudenceComposition
        membres={formation}
        note="conclusions lues à l’audience du 6 octobre 1964 par Jh. Marthyl St Julien, Commissaire du Gouvernement"
        locale="fr"
      />,
    )
    expect(html).toContain('Mention du recueil')
    const iMention = html.indexOf('Mention du recueil')
    expect(html.slice(0, iMention)).not.toContain('Jh. Marthyl St Julien')
  })

  it('traduit les libellés', () => {
    const en = renderToStaticMarkup(<JurisprudenceComposition membres={formation} note={null} locale="en" />)
    expect(en).toContain('Bench')
    expect(en).toContain('Public prosecutor')
    expect(en).toContain('vice-president')
    const ht = renderToStaticMarkup(<JurisprudenceComposition membres={formation} note={null} locale="ht" />)
    expect(ht).toContain('Konpozisyon')
    expect(ht).toContain('Ministè piblik')
  })
})

describe('JurisprudenceComposition — les liens vers le magistrat', () => {
  it('mène de chaque nom à la fiche du magistrat', () => {
    const html = renderToStaticMarkup(
      <JurisprudenceComposition
        membres={[
          { ...m('1', 'Félix Diambois', 'VICE_PRESIDENT'), judgeId: 'jg1' },
          { ...m('2', 'Catinat Sansaricq', 'MINISTERE_PUBLIC'), judgeId: 'jg2' },
        ]}
        note={null}
        locale="fr"
      />,
    )
    expect(html).toContain('href="/fr/juge/jg1"')
    // Le ministère public a sa fiche lui aussi : on le cherche par son nom (critère 4).
    expect(html).toContain('href="/fr/juge/jg2"')
  })

  it('N’INVENTE PAS de lien quand le magistrat n’a pas de fiche', () => {
    // Un lien mort sur un nom propre laisserait croire à une fiche vide plutôt qu'à une
    // absence de rapprochement.
    const html = renderToStaticMarkup(
      <JurisprudenceComposition membres={[m('1', 'Jean DUPONT', 'JUGE')]} note={null} locale="fr" />,
    )
    expect(html).toContain('Jean DUPONT')
    expect(html).not.toContain('<a')
    expect(html).not.toContain('/juge/')
  })

  it('respecte la langue du lecteur dans l’adresse', () => {
    const html = renderToStaticMarkup(
      <JurisprudenceComposition
        membres={[{ ...m('1', 'Félix Diambois', 'JUGE'), judgeId: 'jg1' }]}
        note={null}
        locale="ht"
      />,
    )
    expect(html).toContain('href="/ht/juge/jg1"')
  })
})
