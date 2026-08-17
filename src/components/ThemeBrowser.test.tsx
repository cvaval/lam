import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThemeBrowser, modesPour, type Rubrique } from './ThemeBrowser'

/**
 * Ce navigateur a servi UNE rubrique pendant un an, et tout ce qui la désignait y était
 * écrit en dur : son titre, son vocabulaire, l'adresse de son API, ses clés de stockage.
 * Rien de cela ne se voyait tant qu'il n'y avait qu'une rubrique. Le jour où les
 * Circulaires de la BRH ont reçu la leur, chacune de ces constantes est devenue un défaut :
 * la page BRH aurait affiché « Législation annotée » en titre, compté des « textes » là où
 * la Banque publie des circulaires, et interrogé le mauvais corpus.
 *
 * On rend donc le composant, avec les deux rubriques, et on lit ce qui sort.
 */

interface Noeud {
  id: string; slug: string; labelFr: string; labelEn: string | null; labelHt: string | null
  color: string | null; active: boolean; children: Noeud[]
}
const noeud = (id: string, labelFr: string, children: Noeud[] = []): Noeud => ({
  id, slug: id, labelFr, labelEn: null, labelHt: null, color: null, active: true, children,
})

/** Les deux axes de la BRH, tels que la base les porte réellement. */
const arbreBrh = [
  noeud('brh-matiere', 'Circulaires BRH — par matière', [
    noeud('brh-reserves', 'Réserves obligatoires'),
    noeud('brh-credit', 'Crédit à la clientèle'),
  ]),
  noeud('brh-assujetti', 'Circulaires BRH — par assujetti', [noeud('brh-banques', 'Banques')]),
]

const brh: Rubrique = {
  slug: 'circulaires',
  titre: 'Circulaires de la BRH',
  sousTitre: 'Classement de la BRH : par matière, ou par assujetti.',
  lexique: {
    unite: 'circulaire', unites: 'circulaires', sousTheme: 'rubrique', sousThemes: 'rubriques',
    vide: 'Aucune circulaire pour le moment',
    videTheme: 'Aucune circulaire accessible dans cette rubrique pour le moment.',
    videPlat: 'Aucune circulaire accessible pour le moment.',
  },
  statuts: { ABROGE: 'Abrogé', EN_VIGUEUR: 'En vigueur' },
  ordre: 'position',
  monoType: true,
  racinesOuvertes: true,
}

const rendre = (p: Partial<Parameters<typeof ThemeBrowser>[0]> = {}) =>
  renderToStaticMarkup(
    <ThemeBrowser
      locale="fr"
      rubrique={brh}
      tree={arbreBrh}
      counts={{ 'brh-reserves': 34, 'brh-credit': 12, 'brh-banques': 112 }}
      subtotals={{ 'brh-matiere': 45, 'brh-reserves': 34, 'brh-credit': 12, 'brh-assujetti': 45, 'brh-banques': 112 }}
      recentThemeIds={[]}
      allDocs={[]}
      {...p}
    />,
  )

describe('la rubrique porte son nom et son vocabulaire', () => {
  it('le titre vient de la rubrique, pas du composant', () => {
    const html = rendre()
    expect(html).toContain('Circulaires de la BRH')
    // La régression la plus voyante possible : le titre de la rubrique voisine.
    expect(html).not.toContain('Législation annotée')
  })

  it('on compte des CIRCULAIRES et des RUBRIQUES, pas des textes et des sous-thèmes', () => {
    // La BRH ne publie pas des « textes » au sens de la rubrique voisine ; emprunter son
    // lexique brouille la frontière que la correction du 17 août venait d'établir.
    const html = rendre()
    expect(html).toContain('2 rubriques · 45 circulaires')
    expect(html).not.toContain('textes')
    expect(html).not.toContain('sous-thèmes')
  })

  it('le singulier reste le singulier', () => {
    const html = rendre({ subtotals: { 'brh-matiere': 1, 'brh-assujetti': 1 }, counts: {} })
    expect(html).toContain('1 circulaire')
    expect(html).not.toContain('1 circulaires')
  })
})

describe('les chiffres affichés', () => {
  it('les sous-totaux du SERVEUR l’emportent sur la somme des enfants', () => {
    // 34 + 12 = 46 rattachements, mais 45 documents distincts : une circulaire est classée
    // sous deux matières. Le composant sommait, et annonçait donc un document de trop.
    const html = rendre()
    expect(html).toContain('45 circulaires')
    expect(html).not.toContain('46 circulaires')
  })

  it('sans sous-totaux fournis, le repli reste la somme — jamais zéro', () => {
    // Un appelant qui ne les fournit pas doit obtenir l'ancien comportement, pas un blanc.
    const html = rendre({ subtotals: undefined })
    expect(html).toContain('46 circulaires')
  })
})

describe('les choix propres à une rubrique à type unique', () => {
  it('le tri « par type » n’est pas proposé : il ne rendrait qu’un seul groupe', () => {
    // ⚠️ Vérifié sur la LISTE des modes, pas sur le HTML : le menu ne se peuple qu'au clic,
    // si bien qu'un `not.toContain('Par type')` sur le rendu passerait de toute façon —
    // il ne prouverait rien. Un test qui réussit pour la mauvaise raison ne protège rien.
    expect(modesPour(true)).not.toContain('type')
    expect(modesPour(true)).toContain('theme')
  })

  it('il l’est pour une rubrique qui mêle plusieurs types', () => {
    expect(modesPour(false)).toContain('type')
    expect(modesPour(undefined)).toContain('type')
  })

  it('les axes sont dépliés dès le PREMIER rendu, sans saut', () => {
    // Appliqué dans un effet, le dépliage se serait vu : la page s'affiche repliée, puis
    // s'ouvre. Ici le sous-thème doit être présent dans le HTML initial.
    expect(rendre()).toContain('Réserves obligatoires')
  })

  it('sans dépliage demandé, les enfants restent cachés au premier rendu', () => {
    expect(rendre({ rubrique: { ...brh, racinesOuvertes: false } })).not.toContain('Réserves obligatoires')
  })
})

describe('l’ordre d’affichage', () => {
  it('« position » respecte le classement éditorial reçu du serveur', () => {
    // La BRH classe du plus spécifique au plus général. Le serveur trie par position ;
    // le client le défaisait par un A→Z silencieux.
    const html = rendre()
    expect(html.indexOf('Réserves obligatoires')).toBeLessThan(html.indexOf('Crédit à la clientèle'))
  })

  it('« alpha » trie par libellé, comme avant', () => {
    const html = rendre({ rubrique: { ...brh, ordre: 'alpha' } })
    expect(html.indexOf('Crédit à la clientèle')).toBeLessThan(html.indexOf('Réserves obligatoires'))
  })
})

describe('un nœud vide', () => {
  it('affiche la phrase de la rubrique, pas « Aucun texte pour le moment » en dur', () => {
    const html = rendre({ tree: [noeud('vide', 'Rubrique sans contenu')], subtotals: { vide: 0 }, counts: {} })
    expect(html).toContain('Aucune circulaire pour le moment')
    expect(html).not.toContain('Aucun texte pour le moment')
  })
})


describe('le compteur des sous-thèmes', () => {
  it('accorde aussi le nom des sous-thèmes — « 1 rubriques » n’existe pas', () => {
    const html = rendre()
    expect(html).toContain('1 rubrique · ')
    expect(html).not.toContain('1 rubriques')
  })

  it('chaque SOUS-THÈME porte son propre total, pas zéro', () => {
    // Défaut trouvé par ce fichier : le total du serveur court-circuitait la descente dans
    // les enfants, le mémo ne recevait que les racines et tous les sous-thèmes affichaient
    // « 0 » — donc grisés et incliquables. Toute la taxonomie était morte à l'écran, et
    // aucune vérification sur les DONNÉES ne pouvait le voir : la faute était dans la vue.
    const html = rendre()
    expect(html).toContain('Réserves obligatoires<span class="ml-2 text-xs font-normal text-ank/80">34 circulaires')
    expect(html).toContain('112 circulaires')
    expect(html).not.toContain('0 circulaires')
    // Et donc : aucun sous-thème désactivé alors qu'il porte des documents.
    expect(html).not.toContain('disabled=""')
  })
})
