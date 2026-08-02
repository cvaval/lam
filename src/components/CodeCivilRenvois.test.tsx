import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { OfficialText } from './OfficialText'

/**
 * Renvois INTERNES du Code civil, éprouvés par le chemin de rendu réel.
 *
 * Deux défauts constatés sur le document en production, invisibles autrement :
 *
 *  1. `civRefs` et `artRefs` s'excluaient : le Code civil liait « C. civ., 969 » mais
 *     laissait « conformément à l'article 170 » en texte mort (arts 48, 79, 173, 183,
 *     323…). La chaîne de rendu les enchaîne désormais.
 *  2. Le garde anti-renvoi-externe écarte tout « article N du Code … » — protection
 *     nécessaire contre les autres codes, mais qui aveuglait « l'article 311 du Code
 *     civil » CITÉ DANS le Code civil. `ownCode` nomme le code courant, et lui seul
 *     échappe au garde.
 *
 * S'y ajoute la graphie « Civ., 51 et s » : le recueil laisse tomber le « C. » dix fois.
 */
const ARTS = new Set(Array.from({ length: 2047 }, (_, i) => `art-${i + 1}`))

function liens(texte: string, ownCode?: string): string[] {
  const html = renderToStaticMarkup(
    <OfficialText
      text={texte}
      civRefs
      artRefs={ARTS}
      noAnchors
      ownCode={ownCode}
      codeHrefs={{ cpc: '/fr/doc/CPC', cp: '/fr/doc/CP' }}
    />,
  )
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
}

describe('renvois internes du Code civil', () => {
  it('lie « l’article N » alors même que les renvois « C. civ., N » sont actifs', () => {
    // Art. 173 : les deux grammaires cohabitent dans le même document.
    expect(liens("Dans tous les cas où, conformément à l'article 170, l'action en nullité peut être intentée.")).toEqual(['#art-170'])
    expect(liens('Si néanmoins, dans les cas des articles 180 et 181, il existe des enfants.')).toEqual(['#art-180', '#art-181'])
    // Art. 323 : renvoi en toutes lettres PUIS renvoi abrégé, sur la même ligne.
    expect(liens("par voie de réquisition en la forme prescrite par l'article 317.- C. civ., 324.")).toEqual(['#art-317', '#art-324'])
  })

  it('lie « du Code civil » quand on EST dans le Code civil, jamais les autres codes', () => {
    const art48 = "Ces dispositions ne dérogent en rien à l'article 311 du Code civil qui interdit la recherche de la paternité."
    expect(liens(art48, 'civil')).toEqual(['#art-311'])
    expect(liens(art48)).toEqual([]) // sans `ownCode`, le garde reprend la main
    // Les renvois à un AUTRE texte restent inertes, même avec `ownCode`.
    expect(liens("Décret du 29 mai 1968 modifiant l'article 813 du Code de procédure civile.", 'civil')).toEqual([])
    expect(liens("puni conformément à l'article 240 du Code pénal.", 'civil')).toEqual([])
    expect(liens("conformément à l'article 5 du décret du 8 octobre 1982.", 'civil')).toEqual([])
  })

  it('lie « Civ., N » sans le « C. », sans confondre avec la procédure civile', () => {
    expect(liens('elles pourront se faire représenter.- Civ., 19, 46, 50.')).toEqual(['#art-19', '#art-46', '#art-50'])
    // « C. p. c. » et « C. p. civ. » désignent le Code de procédure civile : lien SORTANT.
    expect(liens("mention en sera faite en marge de l'acte réformé.- Civ., 41.- C. p. c. 809.")).toEqual([
      '#art-41',
      '/fr/doc/CPC',
      '/fr/doc/CPC#art-809',
    ])
    expect(liens('il viole l’art. 148 C. p. civ. quand il autorise le demandeur.')).not.toContain('#art-148')
  })
})
