import { describe, it, expect } from 'vitest'
import { analyserRecueil, dateFrVersISO } from './parse'
import { deduireSolution } from './constants'

/**
 * Ces tests fixent la TOLÉRANCE de l'analyseur — sa raison d'être. Un analyseur câblé sur
 * un seul document passerait ces cas nominaux et échouerait au recueil suivant ; ce qui
 * est vérifié ici, ce sont les variantes de gabarit qu'on rencontrera.
 */

const nominal = [
  'SOMMAIRE ANALYTIQUE DES DÉCISIONS',
  'No.', 'Intitulé', 'Date', // fragments du tableau récapitulatif, à ignorer
  'ARRÊT NO. 2',
  'Jules CESAR c. Fleurant LALANNE',
  'Juridiction : Cour de Cassation, Première Section',
  'Date de l’arrêt : 28 octobre 1964',
  'Décision attaquée : Trois jugements du Tribunal de Paix d’Aquin',
  'Solution : Déchéance du pourvoi.',
  'Résumé de la décision',
  'Le pourvoyant n’a jamais consigné l’amende.',
  'Domaine(s) du droit',
  'Procédure civile (voies de recours).',
]

describe('analyserRecueil', () => {
  it('lit une décision complète et ignore ce qui précède le premier arrêt', () => {
    const r = analyserRecueil(nominal)
    expect(r.decisions).toHaveLength(1)
    const d = r.decisions[0]
    expect(d.numero).toBe('2')
    expect(d.intitule).toBe('Jules CESAR c. Fleurant LALANNE')
    expect(d.dateISO).toBe('1964-10-28')
    expect(d.decisionAttaquee).toContain('Tribunal de Paix')
    expect(d.solution).toBe('DECHEANCE')
    expect(d.dispositif).toBe('Déchéance du pourvoi.')
    expect(d.resume).toContain('consigné')
    expect(d.domaines).toContain('Procédure civile')
    expect(d.manquants).toEqual([])
  })

  it("accepte l'apostrophe DROITE comme la typographique", () => {
    // Le piège qui avait laissé les quinze dates du recueil de référence à null.
    const variante = nominal.map((l) => l.replace(/’/g, "'"))
    expect(analyserRecueil(variante).decisions[0].dateISO).toBe('1964-10-28')
  })

  it('accepte casse, accents manquants et absence d’espace avant les deux-points', () => {
    const variante = [
      'ARRET N° 7',
      'Banque c. PHILIPPEAUX',
      'DATE DE L ARRET: 16 novembre 1964',
      'DECISION ATTAQUEE:Arrêt de la Cour d’Appel',
      'SOLUTION: Rejet du pourvoi.',
      'RESUME DE LA DECISION',
      'Texte du résumé.',
      'DOMAINES DU DROIT',
      'Responsabilité civile.',
    ]
    const d = analyserRecueil(variante).decisions[0]
    expect(d.numero).toBe('7')
    expect(d.dateISO).toBe('1964-11-16')
    expect(d.decisionAttaquee).toBe('Arrêt de la Cour d’Appel')
    expect(d.solution).toBe('REJET')
    expect(d.domaines).toBe('Responsabilité civile.')
  })

  it('NE DEVINE RIEN : un champ absent reste vide et remonte en manquant', () => {
    const ampute = ['ARRÊT NO. 9', 'Dame X c. Y', 'Solution : Rejet du pourvoi.']
    const d = analyserRecueil(ampute).decisions[0]
    expect(d.dateISO).toBeNull()
    expect(d.resume).toBeNull()
    expect(d.manquants).toContain('date')
    expect(d.manquants).toContain('résumé')
    expect(d.manquants).toContain('domaines')
  })

  it('signale un document au format inattendu au lieu de rendre un résultat vide', () => {
    const r = analyserRecueil(['Un texte quelconque', 'sans en-tête d’arrêt'])
    expect(r.decisions).toHaveLength(0)
    expect(r.avertissements[0]).toMatch(/format attendu/)
  })

  it('sépare les décisions et capte la synthèse finale', () => {
    const deux = [
      ...nominal,
      'ARRÊT NO. 3', 'A c. B',
      'Date de l’arrêt : 9 novembre 1964',
      'Décision attaquée : Arrêt du 19 août 1963',
      'Solution : Rejet du pourvoi.',
      'Résumé de la décision', 'Résumé 3.',
      'Domaine(s) du droit', 'Procédure civile.',
      'SYNTHÈSE PAR DOMAINE DU DROIT',
      'Le contentieux est dominé par la procédure civile.',
    ]
    const r = analyserRecueil(deux)
    expect(r.decisions.map((d) => d.numero)).toEqual(['2', '3'])
    expect(r.synthese).toContain('procédure civile')
    // La synthèse ne doit pas être happée par la dernière décision.
    expect(r.decisions[1].domaines).toBe('Procédure civile.')
  })
})

describe('dateFrVersISO', () => {
  it('convertit, « 1er » compris', () => {
    expect(dateFrVersISO('28 octobre 1964')).toBe('1964-10-28')
    expect(dateFrVersISO('1er décembre 1961')).toBe('1961-12-01')
    expect(dateFrVersISO('9 novembre 1964')).toBe('1964-11-09')
  })
  it('rend null plutôt qu’une date fausse', () => {
    expect(dateFrVersISO('sans date')).toBeNull()
    expect(dateFrVersISO('32 brumaire 1964')).toBeNull()
  })
})

describe('deduireSolution', () => {
  it('distingue cassation avec et sans renvoi', () => {
    expect(deduireSolution('Cassation ; renvoi devant le Tribunal de Saint-Marc.')).toBe('CASSATION_AVEC_RENVOI')
    expect(deduireSolution('Cassation sans renvoi ; rejet des demandes.')).toBe('CASSATION_SANS_RENVOI')
  })

  // ⚠️ NON-RÉGRESSION — cinq fiches ont porté en production un renvoi qui n'a jamais eu
  // lieu. La Cour d'Haïti casse le plus souvent SANS renvoyer : elle retient la cause et
  // juge « en vertu de l'article 116 de la Constitution ». L'ancienne fonction rendait
  // CASSATION_AVEC_RENVOI par défaut ; ces quatre libellés sont ceux des fiches fautives.
  it('une cassation suivie d’un jugement au fond est SANS renvoi', () => {
    expect(deduireSolution('Cassation ; au fond, ROC débouté de ses réclamations contre la demanderesse.')).toBe('CASSATION_SANS_RENVOI')
    expect(deduireSolution('Cassation du jugement du 17 juillet 1964 ; statuant à fond en vertu de l’art. 116 de la Constitution, rejet de toutes les demandes.')).toBe('CASSATION_SANS_RENVOI')
    expect(deduireSolution('Cassation ; avant faire droit au fond, enquête ordonnée, fixée à l’audience du 9 février 1965.')).toBe('CASSATION_SANS_RENVOI')
    expect(deduireSolution('Cassation ; au fond, maintenue en possession des pourvoyantes.')).toBe('CASSATION_SANS_RENVOI')
  })
  it('ne conclut au renvoi que s’il porte sur la cause, les parties ou une juridiction', () => {
    // « renvoie des liens de la prévention » est une relaxe, pas un renvoi après cassation.
    expect(deduireSolution('Cassation ; au fond, plainte non fondée, renvoi des liens de la prévention.')).toBe('CASSATION_SANS_RENVOI')
    expect(deduireSolution('Cassation du jugement ; renvoi de la cause et des parties devant le Tribunal Civil de Saint-Marc.')).toBe('CASSATION_AVEC_RENVOI')
  })
  it('une cassation muette sur la suite ne se devine pas', () => {
    expect(deduireSolution('Cassation du jugement du 3 mai 1962.')).toBeNull()
  })

  it('« rejet de la fin de non-recevoir » reste un REJET', () => {
    // Le mot « recevoir » ne doit pas l'emporter sur « rejet ».
    expect(deduireSolution('Rejet de la fin de non-recevoir et du pourvoi.')).toBe('REJET')
  })
  it('« rejet de la nullité » reste un REJET', () => {
    expect(deduireSolution('Rejet de la nullité ; compétence de la juridiction du travail retenue.')).toBe('REJET')
  })
  it('« déchu ; dit sans objet l’incident » reste une DÉCHÉANCE', () => {
    expect(deduireSolution('Déchéance du pourvoi ; dit sans objet l’incident soulevé.')).toBe('DECHEANCE')
  })

  // ── Arrêts qui ne tranchent aucun pourvoi, ou pas encore ────────────────────────
  it('reconnaît les arrêts hors pourvoi', () => {
    expect(deduireSolution('Pas lieu à poursuivre.')).toBe('NON_ADMISSION')
    expect(deduireSolution('Pas lieu d’admettre la requête en prise à partie.')).toBe('NON_ADMISSION')
    expect(deduireSolution('Désistement constaté ; pourvoi sans objet.')).toBe('NON_LIEU_A_STATUER')
    expect(deduireSolution('Nullité de la déclaration de pourvoi ; confiscation de l’amende.')).toBe('NULLITE')
    expect(deduireSolution('Dessaisissement admis ; désignation du Tribunal Civil des Gonaïves.')).toBe('RENVOI_JURIDICTION')
  })
  it('reconnaît les arrêts qui ne dessaisissent pas la Cour', () => {
    expect(deduireSolution('Sursis à statuer.')).toBe('AVANT_DIRE_DROIT')
    expect(deduireSolution('Avant faire droit, enquête ordonnée ; dépens réservés.')).toBe('AVANT_DIRE_DROIT')
    expect(deduireSolution('Avant dire droit, comparution du juge ordonnée en Chambre du Conseil.')).toBe('AVANT_DIRE_DROIT')
  })

  it('rend null plutôt que de deviner', () => {
    expect(deduireSolution('Condamnation aux dépens liquidés à la somme de 500 gourdes.')).toBeNull()
    expect(deduireSolution('')).toBeNull()
  })
})
