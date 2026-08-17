import { describe, it, expect } from 'vitest'
import { quantiemeEnLettres, anneeEnLettres, dateDeLArret } from './numeraux'

/**
 * Les cas de ce fichier sont TIRÉS DU RECUEIL, pas imaginés : le recueil de l'exercice
 * 1965-1966 écrit ses dates de vingt façons — casse flottante, trait d'union facultatif,
 * jour de la semaine intercalé, « Trente et Un » en trois mots.
 */

describe('le quantième du mois', () => {
  it('lit les formes simples', () => {
    expect(quantiemeEnLettres('Six')).toBe(6)
    expect(quantiemeEnLettres('quinze')).toBe(15)
    expect(quantiemeEnLettres('Trente')).toBe(30)
  })

  it('additionne les composés, avec ou sans trait d’union', () => {
    expect(quantiemeEnLettres('Dix-Sept')).toBe(17)
    expect(quantiemeEnLettres('dix huit')).toBe(18)
    expect(quantiemeEnLettres('Vingt-Deux')).toBe(22)
    expect(quantiemeEnLettres('Vingt Six')).toBe(26)
  })

  it('traverse le « et » de vingt et un et de trente et un', () => {
    expect(quantiemeEnLettres('Vingt et Un')).toBe(21)
    expect(quantiemeEnLettres('Vingt-et Un')).toBe(21)
    expect(quantiemeEnLettres('Trente et Un')).toBe(31)
  })

  it('ignore le jour de la semaine, qui précède parfois le quantième', () => {
    // « à l'audience publique du Mardi Vingt-Six Avril » — le recueil l'écrit ainsi 4 fois.
    expect(quantiemeEnLettres('Mardi Vingt-Six')).toBe(26)
    expect(quantiemeEnLettres('Jeudi Vingt-et Un')).toBe(21)
    expect(quantiemeEnLettres('Vendredi Huit')).toBe(8)
  })

  it('accepte « premier » — le 1er du mois ne s’écrit pas « un »', () => {
    expect(quantiemeEnLettres('Premier')).toBe(1)
    expect(quantiemeEnLettres('première')).toBe(1)
  })

  it('les accents et la casse ne changent rien', () => {
    expect(quantiemeEnLettres('DIX-SEPT')).toBe(17)
    expect(quantiemeEnLettres('vingt-neuf')).toBe(29)
  })

  it('REFUSE plutôt que de deviner', () => {
    // Un mot inconnu, un nombre hors bornes : aucune date vaut mieux qu'une date inventée.
    expect(quantiemeEnLettres('Novembre')).toBeNull()
    expect(quantiemeEnLettres('quarante')).toBeNull() // 40 : aucun mois ne l'atteint
    expect(quantiemeEnLettres('soixante-cinq')).toBeNull()
    expect(quantiemeEnLettres('')).toBeNull()
    expect(quantiemeEnLettres('Vingt-Sept Novembre')).toBeNull()
  })
})

describe('le millésime', () => {
  it('lit les deux années du recueil, avec et sans trait d’union', () => {
    expect(anneeEnLettres('Mil Neuf Cent Soixante-Cinq')).toBe(1965)
    expect(anneeEnLettres('Mil Neuf Cent Soixante Cinq')).toBe(1965)
    expect(anneeEnLettres('mil neuf cent soixante-six')).toBe(1966)
  })

  it('multiplie ce qui précède « cent » — la somme seule donnerait 109', () => {
    expect(anneeEnLettres('mil neuf cent')).toBe(1900)
    expect(anneeEnLettres('mil huit cent vingt-cinq')).toBe(1825)
  })

  it('sait lire quatre-vingt, seule multiplication du français sous cent', () => {
    expect(anneeEnLettres('mil neuf cent quatre-vingt-sept')).toBe(1987)
  })

  it('REFUSE ce qui n’est pas un millésime plausible', () => {
    expect(anneeEnLettres('Soixante-Cinq')).toBeNull() // 65, sans le millier
    expect(anneeEnLettres('mil neuf cent ROBINSON')).toBeNull()
    expect(anneeEnLettres('')).toBeNull()
  })
})

describe('la date de l’arrêt, lue dans sa formule de clôture', () => {
  const cloture = (d: string) =>
    `PAR CES MOTIFS, la Cour rejette le pourvoi. Ainsi jugé et prononcé par Nous, Frédéric ` +
    `ROBINSON, Président, Louis B. VILGRAIN, Juges, en audience publique du ${d}, en présence ` +
    `de Mr. Ewald ALEXIS, Substitut du Commissaire du Gouvernement, avec l'assistance de ` +
    `Monsieur Clément ROMULUS, Commis-Greffier.-`

  it('lit la date des arrêts réels du recueil', () => {
    expect(dateDeLArret(cloture('Dix-Sept Novembre Mil Neuf Cent Soixante-Cinq'))).toBe('1965-11-17')
    expect(dateDeLArret(cloture('Six Décembre Mil Neuf Cent Soixante Cinq'))).toBe('1965-12-06')
    expect(dateDeLArret(cloture('Trente et Un Janvier Mil Neuf Cent Soixante-Six'))).toBe('1966-01-31')
    expect(dateDeLArret(cloture('Mardi Vingt-Six Avril Mil Neuf Cent Soixante-Six'))).toBe('1966-04-26')
  })

  it('accepte les variantes d’audience du recueil', () => {
    for (const f of [
      "à l'audience publique du Quinze Décembre Mil Neuf Cent Soixante-Cinq,",
      'en audience publique et solennelle du Quinze Décembre Mil Neuf Cent Soixante-Cinq,',
      'en audience publique extraordinaire du Quinze Décembre Mil Neuf Cent Soixante-Cinq.',
    ]) {
      expect(dateDeLArret(`Ainsi jugé et prononcé par Nous, X, Juges, ${f} en présence de Y`)).toBe('1965-12-15')
    }
  })

  it('⚠️ NE PREND PAS la date d’une audience antérieure citée dans le corps', () => {
    // Le défaut qui a failli passer : l'arrêt n° 1 de la Première Section, rendu le
    // 17 novembre 1965, mentionne d'abord « l'audience publique du dix-huit Octobre » — celle
    // où le rapporteur a lu son rapport. Un ancrage sur la première date en lettres du texte
    // datait donc l'arrêt d'un mois trop tôt.
    const arret =
      "Ouï, à l'audience publique du dix-huit Octobre mil neuf cent soixante cinq, Me. Joseph " +
      "CARRE Fils, en la lecture de son rapport ; Vu les pièces ; Attendu que … ; " +
      cloture('Dix-Sept Novembre Mil Neuf Cent Soixante-Cinq')
    expect(dateDeLArret(arret)).toBe('1965-11-17')
  })

  it('refuse un quantième qui n’existe pas dans son mois', () => {
    expect(dateDeLArret(cloture('Trente et Un Septembre Mil Neuf Cent Soixante-Six'))).toBeNull()
  })

  it('rend null quand la formule de clôture ne porte pas de date lisible', () => {
    expect(dateDeLArret('Ainsi jugé et prononcé par Nous, X, Juges, en audience publique.')).toBeNull()
    expect(dateDeLArret('Attendu que le pourvoi est recevable ;')).toBeNull()
    expect(dateDeLArret('')).toBeNull()
  })
})

describe('les variantes de la formule de clôture', () => {
  it('« Prononcé par Nous » sans « Ainsi jugé » est reconnu', () => {
    // 2ᵉ Section n° 9 : le seul arrêt des 82 à ouvrir ainsi. Sans cette variante, la lecture
    // retombait sur la première audience du texte et le datait de deux mois et demi trop tôt.
    const arret =
      "Ouï à l'audience publique du 14 Octobre 1965, Me. X en son rapport ; Attendu que … ; " +
      'PAR CES MOTIFS, la Cour admet le déssaisissement. ' +
      'Prononcé par Nous, Félix DIAMBOIS, Vice-Président, Léonce PIERRE-ANTOINE, Malherbe ' +
      'DANIEL, André ROUSSEAU et Louis J. BANATTE, Juges, en audience publique du Jeudi ' +
      'Vingt-Trois Decembre Mil Neuf Cent Soixante-Cinq, en présence de Monsieur Y.'
    expect(dateDeLArret(arret)).toBe('1965-12-23')
  })

  it('le quantième et le millésime peuvent être en chiffres, même mêlés aux lettres', () => {
    const base = (d: string) => `Ainsi jugé et prononcé par Nous, X, Juges, en audience publique du ${d}`
    // 1re Section n° 17 : chiffres, puis la même date entre parenthèses en toutes lettres.
    expect(dateDeLArret(base('30 Mai 1966, (Trente Mai Mil Neuf Cent Soixante Six), en présence de Y'))).toBe('1966-05-30')
    // 1re Section n° 20 : quantième en chiffres, millésime en lettres.
    expect(dateDeLArret(base('20 Juin Mil Neuf Cent Soixante-Six, en présence de Y'))).toBe('1966-06-20')
  })

  it('c’est la DERNIÈRE formule qui fait foi, pas une formule citée en cours de route', () => {
    const arret =
      'Attendu que le jugement attaqué portait : « Ainsi jugé et prononcé par Nous, Z, en ' +
      'audience publique du Deux Janvier Mil Neuf Cent Soixante » ; Attendu que … ; ' +
      'Ainsi jugé et prononcé par Nous, X, Juges, en audience publique du Quatre Mai Mil Neuf ' +
      'Cent Soixante-Six, en présence de Y.'
    expect(dateDeLArret(arret)).toBe('1966-05-04')
  })
})
