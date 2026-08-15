import { describe, it, expect } from 'vitest'
import { cleMagistrat, lireComposition } from './composition'

/**
 * Toutes les lignes ci-dessous sont RELEVÉES du recueil 1964-1965, sans retouche. Les
 * inventer aurait fait passer le seul piège qui compte : la prose du ministère public,
 * qui nomme des magistrats n'ayant pas siégé.
 */

describe('cleMagistrat', () => {
  it('rapproche les graphies d’un même magistrat', () => {
    const noel = ['Ulrick Is. NOEL', 'Ulrick IS. NOEL', 'Ulrick NOEL', 'Ulrick Noël', 'Ulrick Is. Noël']
    expect(new Set(noel.map(cleMagistrat)).size).toBe(1)
    expect(cleMagistrat('Louis B. VILGRAIN')).toBe(cleMagistrat('Louis VILGRAIN'))
    expect(cleMagistrat('Jh. Marthyl ST JULIEN')).toBe(cleMagistrat('Jh. Marthyl Saint-Julien'))
  })

  it('SUGGÈRE le rapprochement sans le décider — « Louis J. BANATTE » rejoint « Louis BANATTE »', () => {
    // L'initiale ne suffit pas à faire deux hommes : la clé les rapproche, ce qui EST son
    // office. Le garde-fou n'est pas ici — il est dans le versement, qui doit signaler
    // tout regroupement de graphies au lieu de l'appliquer en silence.
    expect(cleMagistrat('Louis BANATTE')).toBe(cleMagistrat('Louis J. BANATTE'))
  })

  it('NE confond PAS deux patronymes distincts', () => {
    // « Duplessy » et « Duplessis » ne diffèrent que d'une lettre : les fondre
    // attribuerait des arrêts à quelqu'un qui ne les a pas rendus.
    expect(cleMagistrat('Max Duplessy')).not.toBe(cleMagistrat('Max DUPLESSIS'))
    expect(cleMagistrat('Frédéric Robinson')).not.toBe(cleMagistrat('André Rousseau'))
    expect(cleMagistrat('Félix Soray')).not.toBe(cleMagistrat('Félix Diambois'))
  })
})

describe('lireComposition — gabarit A (Première Section)', () => {
  const c = lireComposition(
    'Composition : Luc Boivert, Président ; Ludovic Magloire, Louis B. Vilgrain, Ulrick Noël, ' +
      'Frédéric Robinson, Juges — Ministère Public : Anthony Rivière, Substitut du Commissaire du Gouvernement',
  )
  it('distingue le président des juges', () => {
    expect(c.membres[0]).toMatchObject({ nameAsWritten: 'Luc Boivert', role: 'PRESIDENT' })
    expect(c.membres.filter((m) => m.role === 'JUGE').map((m) => m.nameAsWritten)).toEqual([
      'Ludovic Magloire', 'Louis B. Vilgrain', 'Ulrick Noël', 'Frédéric Robinson',
    ])
  })
  it('range le ministère public à part du siège', () => {
    const mp = c.membres.find((m) => m.role === 'MINISTERE_PUBLIC')
    expect(mp).toMatchObject({ nameAsWritten: 'Anthony Rivière', qualite: 'Substitut du Commissaire du Gouvernement' })
    expect(c.avertissements).toEqual([])
  })
  it('reconnaît le juge faisant fonction de président', () => {
    for (const forme of ['faisant fonction de Président', 'remplissant les fonctions de Président']) {
      const x = lireComposition(
        `Composition : Ludovic Magloire, Juge, ${forme} ; Louis B. Vilgrain, Ulrick Is. Noël, Juges`,
      )
      expect(x.membres[0]).toMatchObject({ nameAsWritten: 'Ludovic Magloire', role: 'PRESIDENT_FF' })
      expect(x.avertissements).toEqual([])
    }
  })
})

describe('lireComposition — gabarit B (Deuxième Section)', () => {
  const ligne =
    'Composition : Félix Diambois, Vice-Président ; Léonce Pierre-Antoine, Félix Soray, Malherbe Daniel ' +
    'et André Rousseau, Juges. Ministère Public : Catinat Sansaricq, Substitut du Commissaire du ' +
    'Gouvernement, présent au prononcé ; conclusions lues à l’audience du 6 octobre 1964 par ' +
    'Jh. Marthyl St Julien, Commissaire du Gouvernement. Greffe : Joseph Lucien, Commis-Greffier.'
  const c = lireComposition(ligne)

  it('LA DEUXIÈME SECTION EST PRÉSIDÉE PAR UN VICE-PRÉSIDENT — le rôle est relevé, pas rabattu', () => {
    expect(c.membres[0]).toMatchObject({ nameAsWritten: 'Félix Diambois', role: 'VICE_PRESIDENT' })
    expect(c.membres.map((m) => m.role)).not.toContain('PRESIDENT')
  })

  it('coupe « X et Y » sans couper « Jh. Marthyl St Julien »', () => {
    expect(c.membres.filter((m) => m.role === 'JUGE').map((m) => m.nameAsWritten)).toEqual([
      'Léonce Pierre-Antoine', 'Félix Soray', 'Malherbe Daniel', 'André Rousseau',
    ])
  })

  it('NE FAIT PAS SIÉGER celui qui a seulement lu les conclusions', () => {
    // Le piège du corpus : ce magistrat est nommé dans la ligne « Composition », mais il
    // n'a pas rendu l'arrêt. L'inscrire lui attribuerait une décision qui n'est pas la sienne.
    expect(c.membres.map((m) => m.nameAsWritten)).not.toContain('Jh. Marthyl St Julien')
    expect(c.note).toContain('Jh. Marthyl St Julien')
    expect(c.note).toContain('conclusions lues')
  })

  it('n’ouvre pas la mention par la ponctuation qui la précède', () => {
    // « , présent au prononcé et en la lecture de ses conclusions » : la virgule bornait
    // la qualité, elle n'ouvre pas la mention — elle se lisait telle quelle sur la fiche.
    const x = lireComposition(
      'Composition : A. B, Vice-Président ; C. D, Juges. Ministère Public : E. F, Substitut, ' +
        'présent au prononcé et en la lecture de ses conclusions à l’audience du 5 novembre 1964.',
    )
    expect(x.note).not.toMatch(/^[,;\s]/)
    expect(x.note).toMatch(/^présent au prononcé/)
  })

  it('retient le ministère public et le greffe, chacun avec sa qualité', () => {
    expect(c.membres.find((m) => m.role === 'MINISTERE_PUBLIC')).toMatchObject({
      nameAsWritten: 'Catinat Sansaricq',
      qualite: 'Substitut du Commissaire du Gouvernement',
    })
    expect(c.membres.find((m) => m.role === 'GREFFE')).toMatchObject({
      nameAsWritten: 'Joseph Lucien',
      qualite: 'Commis-Greffier',
    })
    expect(c.avertissements).toEqual([])
  })
})

describe('lireComposition — gabarit C (Première Section n° 2 à 16)', () => {
  const c = lireComposition(
    'Luc BOIVERT (Président), Ludovic MAGLOIRE, Louis B. VILGRAIN, Ulrick Is. NOEL et André ROUSSEAU, ' +
      'Juges — Ministère Public : Max DUPLESSY, Substitut du Commissaire du Gouvernement — ' +
      'Greffe : Clément ROMULUS, Commis-Greffier. (Le prononcé porte par erreur « Mil Neuf Cent ' +
      'Quatre-Vingt-Quatre » pour Soixante-Quatre.)',
  )
  it('lit la présidence entre parenthèses', () => {
    expect(c.membres[0]).toMatchObject({ nameAsWritten: 'Luc BOIVERT', role: 'PRESIDENT' })
    expect(c.membres.filter((m) => m.role === 'JUGE')).toHaveLength(4)
  })
  it('NE PREND PAS la mention d’erreur du recueil pour un greffier', () => {
    expect(c.membres.find((m) => m.role === 'GREFFE')).toMatchObject({ nameAsWritten: 'Clément ROMULUS' })
    expect(c.membres.every((m) => !/erreur|Quatre-Vingt/.test(m.nameAsWritten))).toBe(true)
    expect(c.note).toContain('erreur')
  })
})

describe('lireComposition — les refus', () => {
  it('ne rend rien d’une ligne vide', () => {
    expect(lireComposition('').membres).toEqual([])
    expect(lireComposition('Composition :').membres).toEqual([])
  })
  it('AVERTIT au lieu de se taire quand un fragment n’est pas un nom', () => {
    // Un silence ici laisserait croire à une composition complète alors qu'il en manque un.
    const c = lireComposition('Composition : X, Président ; audience du 6 octobre 1964, Juges')
    expect(c.avertissements.length).toBeGreaterThan(0)
    expect(c.membres.every((m) => !/audience/.test(m.nameAsWritten))).toBe(true)
  })
  it('n’invente pas de rôle quand la présidence est inconnue', () => {
    const c = lireComposition('Composition : Jean DUPONT, Doyen ; Paul MARTIN, Juges')
    expect(c.avertissements.join(' ')).toMatch(/présidence non reconnue/i)
  })
})

describe('lireComposition — gabarit D (« Composition du siège », en prose)', () => {
  // 33 lignes de la Première Section. Aucune étiquette : ni « Ministère Public : » ni
  // « Greffe : », et la présidence séparée des juges par une simple virgule.
  const c = lireComposition(
    'Composition du siège : Ludovic Magloire, Juge, faisant fonction de Président, Louis B. Vilgrain, ' +
      'Ulrick Is. Noël, André Rousseau et Louis Banatte, Juges — en présence de M. Arsène Amisial, ' +
      'Substitut du Commissaire du Gouvernement, avec l’assistance de M. Clément Romulus, Commis-Greffier.',
  )
  it('lit la présidence bornée par le RÔLE, non par la ponctuation', () => {
    expect(c.membres[0]).toMatchObject({ nameAsWritten: 'Ludovic Magloire', role: 'PRESIDENT_FF' })
    expect(c.membres.filter((m) => m.role === 'JUGE').map((m) => m.nameAsWritten)).toEqual([
      'Louis B. Vilgrain', 'Ulrick Is. Noël', 'André Rousseau', 'Louis Banatte',
    ])
  })
  it('reconnaît « en présence de » et « avec l’assistance de » comme étiquettes', () => {
    expect(c.membres.find((m) => m.role === 'MINISTERE_PUBLIC')).toMatchObject({ nameAsWritten: 'Arsène Amisial' })
    expect(c.membres.find((m) => m.role === 'GREFFE')).toMatchObject({ nameAsWritten: 'Clément Romulus' })
  })
  it('NE FAIT PAS d’un fragment de phrase un magistrat', () => {
    // Le défaut du premier versement : « Juges — en présence de M. Arsène Amisial » était
    // devenu une fiche de magistrat à part entière.
    expect(c.membres.every((m) => !/Juges|présence|assistance/i.test(m.nameAsWritten))).toBe(true)
    expect(c.avertissements).toEqual([])
  })
  it('range la parenthèse éditoriale dans la note, pas dans le siège', () => {
    const x = lireComposition(
      'Composition du siège : Luc Boivert, Président (graphie de la source ; lecture à vérifier, ' +
        'possiblement « Boisvert »), Ludovic Magloire et Frédéric Robinson, Juges',
    )
    expect(x.membres[0]).toMatchObject({ nameAsWritten: 'Luc Boivert', role: 'PRESIDENT' })
    expect(x.membres.map((m) => m.nameAsWritten)).toEqual(['Luc Boivert', 'Ludovic Magloire', 'Frédéric Robinson'])
    expect(x.note).toContain('lecture à vérifier')
  })
})
