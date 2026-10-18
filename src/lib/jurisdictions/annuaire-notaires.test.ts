import { describe, expect, it } from 'vitest'
import {
  adresseExacte, classerAnnuaire, filtrerAnnuaire, filtresActifs, lireParamsAnnuaire, lireRetourAnnuaire, nomDeFamille, paginerAnnuaire, qsAnnuaire, retourAnnuaire,
  type AnnuaireEntry,
} from './annuaire-notaires'

const e = (id: string, name: string, over: Partial<AnnuaireEntry> = {}): AnnuaireEntry => ({
  id, name, mention: null, communeId: 'port-au-prince', communeName: 'Port-au-Prince', department: 'Ouest',
  jurisdictionId: 'tpi-port-au-prince', jurisdictionLabel: 'Port-au-Prince', address: null, hasContact: false, addedByEditors: false,
  confirmedOn: null, ...over,
})

describe('nomDeFamille — convention du MJSP (capitales finales)', () => {
  it.each([
    ['Guy Mario GAY', 'GAY', 'Guy Mario'],
    ['Garry BRISSON CASSAGNOL', 'BRISSON CASSAGNOL', 'Garry'],
    ['Ronald E. PIERRE-LOUIS', 'PIERRE-LOUIS', 'Ronald E.'],
    ['Jean-Joseph Frantz CÉANT', 'CÉANT', 'Jean-Joseph Frantz'],
    ['Mrie Lourdes B. BAUDIN FRANCILLON', 'BAUDIN FRANCILLON', 'Mrie Lourdes B.'],
    ['Alliette N . S . BALTHAZAR', 'BALTHAZAR', 'Alliette N . S .'],
    ['Danielle Giordani ADÉ', 'ADÉ', 'Danielle Giordani'],
  ])('%s → famille « %s »', (nom, famille, prenoms) => {
    expect(nomDeFamille(nom)).toEqual({ famille, prenoms, marque: true })
  })

  it('REPLI : aucun mot final en capitales → le nom ENTIER, rien de deviné', () => {
    expect(nomDeFamille('Jean Fitzner')).toEqual({ famille: 'Jean Fitzner', prenoms: '', marque: false })
  })

  it('une initiale finale (« S ») n’est pas un nom de famille', () => {
    expect(nomDeFamille('Jean Robert S').marque).toBe(false)
  })
})

describe('adresseExacte — adresse de l’étude, pas une position', () => {
  it.each([
    ['14 rue Marcadieux, Bourdon, Port-au-Prince', true],
    ['#52, Avenue Lamartinière, Bois-Verna, Port-au-Prince', true],
    ['route de Bourdon', true],
    ['Delmas 33', true],
  ])('« %s » → %s', (a, attendu) => expect(adresseExacte(a)).toBe(attendu))

  it.each([
    [null], [''], ['   '], ['Bourdon'], ['Pétion-Ville'],
  ])('« %s » n’est pas une adresse exacte', (a) => expect(adresseExacte(a, ['Pétion-Ville', 'Ouest'])).toBe(false))

  it('la commune ou le département seuls ne suffisent pas, même à la casse et aux accents près', () => {
    expect(adresseExacte('PETION VILLE', ['Pétion-Ville'])).toBe(false)
    expect(adresseExacte('ouest', ['Pétion-Ville', 'Ouest'])).toBe(false)
  })
})

describe('classerAnnuaire — juridiction, adresse exacte d’abord, nom de famille, prénoms, identifiant', () => {
  const liste = [
    e('n6', 'Zoé ALPHA', { jurisdictionId: 'tpi-jacmel', jurisdictionLabel: 'Jacmel' }),
    e('n1', 'Patrick VICTOR'),
    e('n2', 'Ange LADOUCEUR', { address: '14 rue Marcadieux' }),
    e('n3', 'Clermont DOSSOUS'),
    e('n4', 'Jean-Joseph Frantz CÉANT'),
    e('n5', 'Sabine MORPEAU', { address: '394, route de Bourdon' }),
    e('n7', 'Inconnu SANS', { jurisdictionId: null, jurisdictionLabel: null, communeId: null }),
  ]

  it('regroupe par juridiction (ordre alphabétique), la juridiction non déterminée en dernier', () => {
    const r = classerAnnuaire(liste).map((x) => x.jurisdictionLabel)
    expect(r).toEqual(['Jacmel', 'Port-au-Prince', 'Port-au-Prince', 'Port-au-Prince', 'Port-au-Prince', 'Port-au-Prince', null])
  })

  it('dans une juridiction : adresses exactes d’abord, puis les autres, chaque groupe par nom de famille', () => {
    const ppp = classerAnnuaire(liste).filter((x) => x.jurisdictionLabel === 'Port-au-Prince').map((x) => x.name)
    expect(ppp).toEqual(['Ange LADOUCEUR', 'Sabine MORPEAU', 'Jean-Joseph Frantz CÉANT', 'Clermont DOSSOUS', 'Patrick VICTOR'])
  })

  it('accents et casse neutralisés ; nom composé trié sur son premier élément', () => {
    const r = classerAnnuaire([e('a', 'Éric CÔTÉ'), e('b', 'Anne cote'), e('c', 'Garry BRISSON CASSAGNOL'), e('d', 'Marc BRISSON')]).map((x) => x.id)
    // « Anne cote » n'a pas de nom en capitales : sa clé est le nom entier (« anne cote »).
    expect(r).toEqual(['b', 'd', 'c', 'a'])
  })

  it('même nom de famille : les prénoms départagent, puis l’identifiant (classement stable)', () => {
    const r = classerAnnuaire([e('z', 'Paul AVIN'), e('b', 'Jean AVIN'), e('a', 'Jean AVIN')]).map((x) => x.id)
    expect(r).toEqual(['a', 'b', 'z'])
  })

  it('le badge « Confirmé » n’est PAS un critère de classement', () => {
    const sans = classerAnnuaire([e('a', 'Ange LADOUCEUR'), e('b', 'Patrick VICTOR')]).map((x) => x.id)
    const avec = classerAnnuaire([e('a', 'Ange LADOUCEUR'), e('b', 'Patrick VICTOR', { confirmedOn: '2026-10-18' })]).map((x) => x.id)
    expect(avec).toEqual(sans)
  })

  it('ne modifie ni la liste reçue ni les noms affichés', () => {
    const copie = liste.map((x) => ({ ...x }))
    classerAnnuaire(liste)
    expect(liste).toEqual(copie)
  })

  it('inscriptions multiples légitimes : deux communes, deux entrées conservées', () => {
    const r = classerAnnuaire([
      e('m1', 'Jean AVIN', { communeId: 'delmas', communeName: 'Delmas' }),
      e('m2', 'Jean AVIN', { communeId: 'petion-ville', communeName: 'Pétion-Ville' }),
    ])
    expect(r.map((x) => x.id)).toEqual(['m1', 'm2'])
  })
})

describe('pagination — le classement s’applique AVANT le découpage', () => {
  const beaucoup = Array.from({ length: 65 }, (_, i) =>
    e(`n${String(i).padStart(3, '0')}`, `Prénom NOM${String.fromCharCode(65 + (i % 26))}${i}`, {
      jurisdictionId: i < 40 ? 'tpi-a' : 'tpi-b', jurisdictionLabel: i < 40 ? 'Aquin' : 'Borgne',
    }),
  )
  const classes = classerAnnuaire(beaucoup)

  it('les pages se suivent sans trou ni doublon, dans l’ordre global', () => {
    const vus = [1, 2, 3].flatMap((p) => paginerAnnuaire(classes, p).groupes.flatMap((g) => g.entries.map((x) => x.id)))
    expect(vus).toEqual(classes.map((x) => x.id))
  })

  it('une juridiction coupée par la page est signalée « suite » sur la page suivante', () => {
    const p2 = paginerAnnuaire(classes, 2)
    expect(p2.groupes[0]).toMatchObject({ label: 'Aquin', suite: true })
    expect(p2.groupes[1]).toMatchObject({ label: 'Borgne', suite: false })
    expect(p2).toMatchObject({ page: 2, pages: 3, total: 65, de: 31, a: 60 })
  })

  it('page hors bornes → dernière page ; liste vide → une page vide', () => {
    expect(paginerAnnuaire(classes, 99).page).toBe(3)
    expect(paginerAnnuaire([], 4)).toMatchObject({ page: 1, pages: 1, total: 0, de: 0, a: 0, groupes: [] })
  })

  it('stabilité : deux calculs donnent les mêmes pages', () => {
    expect(paginerAnnuaire(classerAnnuaire([...beaucoup].reverse()), 2)).toEqual(paginerAnnuaire(classes, 2))
  })
})

describe('filtres et paramètres d’URL', () => {
  const liste = classerAnnuaire([
    e('a', 'Ange LADOUCEUR'),
    e('b', 'Zoé ALPHA', { jurisdictionId: 'tpi-jacmel', jurisdictionLabel: 'Jacmel', communeId: 'jacmel', communeName: 'Jacmel' }),
    e('c', 'Paul AVIN', { communeId: 'delmas', communeName: 'Delmas' }),
  ])

  it('les filtres se cumulent et gardent l’ordre', () => {
    expect(filtrerAnnuaire(liste, { juridiction: 'tpi-port-au-prince' }).map((x) => x.id)).toEqual(['c', 'a'])
    expect(filtrerAnnuaire(liste, { commune: 'delmas' }).map((x) => x.id)).toEqual(['c'])
    expect(filtrerAnnuaire(liste, { ids: new Set(['a', 'b']), juridiction: 'tpi-jacmel' }).map((x) => x.id)).toEqual(['b'])
  })

  it('lecture tolérante : valeurs invalides ignorées, recherche bornée', () => {
    const p = lireParamsAnnuaire({ q: '  Céant  ', juridiction: '<script>', commune: 'delmas', page: '-3' })
    expect(p).toEqual({ q: 'Céant', juridiction: null, commune: 'delmas', page: 1 })
    expect(lireParamsAnnuaire({ q: 'x'.repeat(200) }).q).toHaveLength(80)
    expect(filtresActifs(p)).toBe(2)
  })

  it('l’URL partageable commence par vue=notaires et omet la page 1', () => {
    expect(qsAnnuaire({ q: 'Victor', commune: 'delmas', page: 1 })).toBe('vue=notaires&q=Victor&commune=delmas')
    expect(qsAnnuaire({ juridiction: 'tpi-jacmel', page: 3 })).toBe('vue=notaires&juridiction=tpi-jacmel&page=3')
  })
})

describe('retour depuis une fiche — état de l’annuaire relu, jamais recopié', () => {
  it('onglet de la carte : reconstruit recherche, filtres et page', () => {
    expect(lireRetourAnnuaire('onglet:vue=notaires&q=Victor&juridiction=tpi-jacmel&page=2')).toBe('/juridictions?vue=notaires&q=Victor&juridiction=tpi-jacmel&page=2')
    // Forme antérieure, sans préfixe : l'onglet.
    expect(lireRetourAnnuaire('vue=notaires&q=Victor')).toBe('/juridictions?vue=notaires&q=Victor')
  })
  it('page d’annuaire historique : même état, sans `vue`', () => {
    expect(lireRetourAnnuaire('page:q=Victor&commune=delmas')).toBe('/juridictions/notaires?q=Victor&commune=delmas')
    expect(lireRetourAnnuaire('page:')).toBe('/juridictions/notaires')
  })
  it('écarte ce qui n’appartient pas à l’annuaire', () => {
    expect(lireRetourAnnuaire('https://example.com')).toBeNull()
    expect(lireRetourAnnuaire('vue=juridictions&commune=delmas')).toBeNull()
    expect(lireRetourAnnuaire('onglet:vue=notaires&commune=<x>&redirect=//evil&layers=;drop')).toBe('/juridictions?vue=notaires')
    expect(lireRetourAnnuaire('vue=notaires&' + 'q='.padEnd(500, 'a'))).toBeNull()
  })
  it('retourAnnuaire et lireRetourAnnuaire s’accordent', () => {
    const p = lireParamsAnnuaire({ q: 'Céant', page: '2' })
    expect(lireRetourAnnuaire(retourAnnuaire(p, 'page'))).toBe('/juridictions/notaires?q=C%C3%A9ant&page=2')
    expect(lireRetourAnnuaire(retourAnnuaire(p, 'onglet', 'paix,notaires'))).toBe('/juridictions?vue=notaires&q=C%C3%A9ant&layers=paix%2Cnotaires&page=2')
  })
})
