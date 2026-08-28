import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { OfficialText } from './OfficialText'

/**
 * La PASTILLE des articles ajoutés, éprouvée par le chemin de rendu réel.
 *
 * Un texte modificatif peut faire trois choses à un article : le réécrire, l'abroger, ou en
 * AJOUTER un qui n'existait pas. Les deux premières se lisent d'elles-mêmes — l'ancienne
 * rédaction se replie sous « ✎ modifié », l'article abrogé est barré. La troisième ne se
 * voyait NULLE PART : l'article 23.1 du Décret sur l'Administration Centrale se lisait comme
 * s'il avait toujours été là, alors qu'il date de 2016 et que le décret est de 2005.
 *
 * ⚠️ ET LA PASTILLE EST UN LIEN, PAS UNE ÉTIQUETTE. Deux décrets ont été signés le
 * 6 janvier 2016 — l'amendement à l'Administration Centrale et celui sur l'administration
 * électronique, publiés dans deux Moniteurs consécutifs. La date seule ne désigne donc RIEN :
 * le titre complet est dans l'infobulle, et la destination lève l'ambiguïté pour de bon.
 */
const CORPS = [
  'Article 23.- Le Secrétariat Général de la Primature est un organe de coordination.',
  'Article 23.1.- Le Secrétariat Général comprend le Bureau du Secrétaire Général.',
].join('\n')

const AJOUT = new Map([
  [
    'art-23-1',
    {
      label: 'Ajout — Décret du 6 janvier 2016',
      title: 'Article ajouté par : Décret du 6 janvier 2016 portant amendement du Décret du 17 mai 2005 portant organisation de l’Administration Centrale de l’État',
      href: '/fr/doc/cmtest',
    },
  ],
])

const rendu = (props: Parameters<typeof OfficialText>[0]) => renderToStaticMarkup(<OfficialText {...props} />)

describe('pastille « Ajout — … »', () => {
  it('marque l’article ajouté, et lui seul', () => {
    const html = rendu({ text: CORPS, addedAnchors: AJOUT })
    expect(html).toContain('Ajout — Décret du 6 janvier 2016')
    // Un seul article en porte une : l'article 23, d'origine, n'est pas touché.
    expect(html.match(/Ajout —/g)?.length).toBe(1)
  })

  it('la pastille renvoie à l’acte modificatif et porte son TITRE COMPLET', () => {
    const html = rendu({ text: CORPS, addedAnchors: AJOUT })
    expect(html).toContain('href="/fr/doc/cmtest"')
    expect(html).toContain('portant amendement du Décret du 17 mai 2005')
  })

  /**
   * ⚠️ « ✎ modifié » renvoie à l'historique (#hist-art-N) — un article ajouté n'en a pas.
   * Le marqueur y mènerait à une ancre morte, et affirmerait une ancienne rédaction qui
   * n'a jamais existé.
   */
  it('un article AJOUTÉ ne porte jamais « ✎ modifié »', () => {
    const html = rendu({ text: CORPS, addedAnchors: AJOUT, amendedAnchors: new Set(['art-23']) })
    expect(html).toContain('✎ modifié')
    const apres231 = html.slice(html.indexOf('id="art-23-1"'))
    expect(apres231).not.toContain('✎ modifié')
    expect(apres231).toContain('Ajout —')
  })

  it('sans ajout déclaré, le rendu est inchangé', () => {
    expect(rendu({ text: CORPS })).toBe(rendu({ text: CORPS, addedAnchors: new Map() }))
  })
})
