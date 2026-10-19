import { describe, it, expect } from 'vitest'
import { analyserNotices, separerDispositif, dateDeLaNotice, mentionMarginale, mentionHorsSiege, RUBRIQUES } from './notices'

/**
 * Ce que l'analyseur doit TOLÉRER (continuations, tirets, apostrophes typographiques) et ce
 * qu'il doit REFUSER d'inventer (une rubrique hors liste, un dispositif quand il y en a deux).
 */
const lot = [
  'COUR DE CASSATION', 'SOMMAIRE ANALYTIQUE', 'Arrêts Nos 1 à 2',
  'INTRODUCTION',
  'Le présent lot réunit deux décisions : No 1 et No 2 — on ne doit pas lire ceci comme une tête.',
  'No 1 — Maison Luciani-Berhmann c. Laurent Benoit',
  'Date du prononcé : 17 novembre 1965 (jour de semaine non indiqué) : « Ainsi jugé … ».',
  'Date portée sur l’extrait : 17 novembre 1965 ; mention marginale de matière : « Civ. » ; les deux dates coïncident.',
  'Juridiction : Cour de Cassation, Première Section.',
  'Décision attaquée / objet de la saisine : Pourvoi contre un arrêt du 5 août 1963.',
  'Composition : Siège : Ludovic Magloire, Juge faisant fonction de Président ; Louis B. Vilgrain, Juge. Ministère Public : Anthony Rivière, Substitut. Greffe : Clément Romulus, Commis-Greffier.',
  'Domaines du droit : Procédure civile.',
  'Analyse : Premier paragraphe de l’analyse.',
  'Suite de l’analyse sur un second paragraphe.',
  'Règle de droit (Rule of Law) : 1°) La règle.',
  'Question de droit (Issue) : 1°) La question ?',
  'Solution et motifs (Holding and Reasoning) : 1°) Non. Les motifs. Dispositif : rejet du pourvoi ; dépens. Anomalies de source conservées : le jugement est daté deux fois.',
  'No 2 – Berthaud Debrosse c. Charles Fils',
  'Date du prononcé : 24 janvier 1966.',
  'Solution et motifs (Holding and Reasoning) : Oui. Cassation sans renvoi.',
  'Observations : ceci n’est pas une rubrique du gabarit.',
]

describe('analyserNotices', () => {
  const r = analyserNotices(lot)
  it('lit une notice par tête « No N — parties », sans se tromper sur la prose qui cite des numéros', () => {
    expect(r.notices.map((n) => n.numero)).toEqual(['1', '2'])
    expect(r.notices[0].parties).toBe('Maison Luciani-Berhmann c. Laurent Benoit')
    expect(r.notices[1].parties).toBe('Berthaud Debrosse c. Charles Fils') // tiret demi-cadratin
  })
  it('reconnaît les dix rubriques malgré l’apostrophe typographique, et joint les continuations', () => {
    const n = r.notices[0]
    expect(n.manquantes).toEqual([])
    expect(Object.keys(n.rubriques)).toHaveLength(RUBRIQUES.length)
    expect(n.rubriques["Date portée sur l'extrait"]).toMatch(/^17 novembre 1965/)
    expect(n.rubriques.Analyse).toBe('Premier paragraphe de l’analyse.\nSuite de l’analyse sur un second paragraphe.')
  })
  it('n’invente pas de rubrique : un libellé hors liste est fondu et SIGNALÉ', () => {
    const n = r.notices[1]
    expect(n.rubriques['Solution et motifs (Holding and Reasoning)']).toContain('Observations : ceci')
    expect(r.avertissements.some((a) => a.includes('libellé inconnu « Observations »'))).toBe(true)
    expect(n.manquantes).toHaveLength(RUBRIQUES.length - 2)
  })
})

describe('separerDispositif', () => {
  it('détache « Dispositif : » et « Anomalies de source conservées : » sans toucher au reste', () => {
    const s = separerDispositif('1°) Non. Les motifs. Dispositif : rejet du pourvoi ; dépens. Anomalies de source conservées : le jugement est daté deux fois.')
    expect(s.motifs).toBe('1°) Non. Les motifs.')
    expect(s.dispositif).toBe('rejet du pourvoi ; dépens.')
    expect(s.anomalies).toBe('le jugement est daté deux fois.')
    expect(s.libelleAnomalies).toBe('Anomalies de source conservées')
    expect(s.defaut).toBeNull()
  })
  it('lit aussi la graphie « Dispositif, <incise> : … » et garde l’incise telle quelle', () => {
    const s = separerDispositif('Troisième moyen non fondé. Dispositif, sur conclusions conformes du Ministère Public : rejet du pourvoi ; dépens.')
    expect(s.motifs).toBe('Troisième moyen non fondé.')
    expect(s.dispositif).toBe('sur conclusions conformes du Ministère Public : rejet du pourvoi ; dépens.')
  })
  it('ne mord pas sur « le dispositif intermédiaire » en milieu de phrase', () => {
    const s = separerDispositif('Le juge vise le dispositif : il le confirme. Dispositif : rejet.')
    expect(s.motifs).toBe('Le juge vise le dispositif : il le confirme.')
    expect(s.dispositif).toBe('rejet.')
  })
  it('rend dispositif null quand la notice n’en porte pas (n° 13) et garde les anomalies éventuelles', () => {
    const s = separerDispositif('Oui. Jonction prononcée. Anomalie de source : la date manque.')
    expect(s.dispositif).toBeNull()
    expect(s.motifs).toBe('Oui. Jonction prononcée.')
    expect(s.anomalies).toBe('la date manque.')
  })
  it('refuse de trancher entre deux « Dispositif : »', () => {
    const s = separerDispositif('A. Dispositif : rejet. B. Dispositif : cassation.')
    expect(s.defaut).toMatch(/2 sous-mentions/)
    expect(s.dispositif).toBeNull()
    expect(s.motifs).toBe('A. Dispositif : rejet. B. Dispositif : cassation.')
  })
})

describe('dates et mentions', () => {
  it('lit la première date en clair, ignore le millésime en toutes lettres', () => {
    expect(dateDeLaNotice('17 novembre 1965 (jour de semaine non indiqué) : « … Dix-Sept Novembre Mil Neuf Cent Soixante-Cinq ».')).toBe('1965-11-17')
    expect(dateDeLaNotice('1er février 1966.')).toBe('1966-02-01')
    expect(dateDeLaNotice('date non indiquée')).toBeNull()
  })
  it('extrait la mention marginale de matière', () => {
    expect(mentionMarginale('17 novembre 1965 ; mention marginale de matière : « Civ. » ; les deux dates coïncident.')).toBe('Civ.')
    expect(mentionMarginale('28 mars 1966 ; mention marginale de matière : « C.T. »')).toBe('C.T.')
    expect(mentionMarginale('28 mars 1966.')).toBeNull()
  })
  it('garde de la composition ce qui n’est pas le siège', () => {
    expect(mentionHorsSiege('Siège : A, Président ; B, Juge. Ministère Public : C, Substitut. Greffe : D.')).toBe('Ministère Public : C, Substitut. Greffe : D.')
    expect(mentionHorsSiege('Ministère Public : C.')).toBe('Ministère Public : C.')
    expect(mentionHorsSiege('Siège : A, Président.')).toBe('Siège : A, Président.')
  })
})
