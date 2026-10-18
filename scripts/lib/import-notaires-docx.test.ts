/**
 * Import « Notaires.docx » — lecture, coordonnées, rapprochement, plan. ⚠️ Le dépôt est PUBLIC :
 * aucun numéro ni courriel réel ici — des valeurs FICTIVES de même forme que celles du document.
 * Les noms de notaires sont ceux de la liste publique du MJSP.
 */
import { describe, expect, it } from 'vitest'
import { cleProposition, lireAdresse, lireCourriels, lireDecisions, lireEntrees, lireTelephones, planifier, rapprocher, texteDepuisHtml, type NotaireRef } from './import-notaires-docx'

const DOC = [
  'Patrick VICTOR',
  'Tel: +(509) 2000-0001 / +(509) 3000-0002/+(509) 2000-0003',
  'Email: etude@exemple.ht',
  'Adresse: 14, Rue Fictive, Bourdon, Port-au-Prince, Haïti',
  'Garry Brisson CASSAGNOL',
  'Tel: +(509) 2000-0011 /+(509) 2000-0012 / +(509) 2000-0013\n+(509) 3000-0014 / +(509) 2000-0015\n+(509) 3000-0016 (pers) A.Tiers\n2000- 0013 / 0015',
  'Email: a@exemple.ht, b@exemple.ht',
  'Adresse: 52, Bois Fictif, Port-au-Prince, Haïti, P.O.Box 1',
  'Jean Joseph Frantz CÉANT',
  'Tel: +(509) 2000-0021\nEmail: ceant@exemple.ht',
  'Adresse: 390, Route Fictive, Port-au-Prince, Haïti',
].join('\n\n')

const NOTAIRES: NotaireRef[] = [
  { id: 'n11', fullName: 'Patrick VICTOR', displayName: null, active: true, communeName: 'Port-au-Prince' },
  { id: 'n5', fullName: 'Garry BRISSON CASSAGNOL', displayName: null, active: true, communeName: 'Port-au-Prince' },
  { id: 'n13', fullName: 'Jean-Joseph Frantz CÉANT', displayName: null, active: true, communeName: 'Port-au-Prince' },
  { id: 'n32', fullName: 'Jean M. E. Lesly ALPHONSE', displayName: null, active: true, communeName: 'Pétion-Ville' },
  { id: 'n1', fullName: 'Guy Mario GAY', displayName: null, active: true, communeName: 'Port-au-Prince' },
  { id: 'n10', fullName: 'Mrie Alice C. B. BEAULIEU', displayName: null, active: true, communeName: 'Port-au-Prince' },
  { id: 'n228', fullName: 'Marie Carmel BEAULIEU', displayName: null, active: true, communeName: 'Jacmel' },
  { id: 'n24', fullName: 'Mrie Lourdes B. BAUDIN FRANCILLON', displayName: null, active: true, communeName: 'Delmas' },
  { id: 'n2', fullName: 'Danielle Giordani ADÉ', displayName: null, active: true, communeName: 'Port-au-Prince' },
  { id: 'n115', fullName: 'Duvot PAUL', displayName: null, active: true, communeName: 'Cap-Haïtien' },
  { id: 'n7', fullName: 'Sabine MORPEAU', displayName: null, active: true, communeName: 'Port-au-Prince' },
  { id: 'a1', fullName: 'Jean AVIN', displayName: null, active: true, communeName: 'Delmas' },
  { id: 'a2', fullName: 'Jean AVIN', displayName: null, active: true, communeName: 'Port-au-Prince' },
  { id: 'x37', fullName: 'Patrick VICTOR', displayName: null, active: false, communeName: 'Cité Soleil' },
]

describe('lecture du document — une source de données', () => {
  it('trois entrées, champs rattachés, lignes de continuation comprises', () => {
    const { entrees, orphelins } = lireEntrees(DOC)
    expect(orphelins).toEqual([])
    expect(entrees.map((e) => e.nom)).toEqual(['Patrick VICTOR', 'Garry Brisson CASSAGNOL', 'Jean Joseph Frantz CÉANT'])
    expect(entrees[1].tel).toHaveLength(4)
    // « Email » sur une ligne du paragraphe « Tel » : rattaché au bon champ.
    expect(entrees[2].email).toEqual(['ceant@exemple.ht'])
  })

  it('numéros accolés, séparateurs irréguliers, annotation personnelle, fragment abrégé', () => {
    const t = lireTelephones(lireEntrees(DOC).entrees[1].tel)
    expect(t.filter((x) => x.statut === 'BUREAU').map((x) => x.e164)).toEqual(['+50920000011', '+50920000012', '+50920000013', '+50930000014', '+50920000015'])
    expect(t.find((x) => x.statut === 'PERSONNEL')).toMatchObject({ e164: '+50930000016', note: expect.stringContaining('personnel ou attribué à un tiers') })
    expect(t.filter((x) => x.statut === 'DOUBLON').map((x) => x.e164)).toEqual(['+50920000013'])
    expect(t.find((x) => x.statut === 'ININTERPRETABLE')).toMatchObject({ brut: '0015' })
  })

  it('sauts de ligne perdus (texte brut) : numéros collés et champ « Email » collé récupérés', () => {
    const { entrees } = lireEntrees('Jean Joseph Frantz CÉANT\n\nTel: +(509) 2000-0021+(509) 3000-0022\n\nTel: +(509) 2000-0023Email: ceant@exemple.ht')
    expect(lireTelephones(entrees[0].tel).map((t) => t.e164)).toEqual(['+50920000021', '+50930000022', '+50920000023'])
    expect(entrees[0].email).toEqual(['ceant@exemple.ht'])
  })

  it('HTML de mammoth : <p> = paragraphe, <br> = saut de ligne, entités décodées', () => {
    expect(texteDepuisHtml('<p>Garry Brisson CASSAGNOL</p><p>Tel: +(509) 2000-0011<br />+(509) 3000-0016 (pers) A.Tiers</p><p>Adresse: 245, Ave Fictive,&nbsp;Lalue &amp; co</p>'))
      .toBe('Garry Brisson CASSAGNOL\n\nTel: +(509) 2000-0011\n+(509) 3000-0016 (pers) A.Tiers\n\nAdresse: 245, Ave Fictive, Lalue & co\n\n')
  })

  it('courriels : séparés, validés, dédoublonnés', () => {
    expect(lireCourriels(['a@exemple.ht, b@exemple.ht; A@exemple.ht', 'pas-un-courriel']).map((c) => c.statut)).toEqual(['VALIDE', 'VALIDE', 'DOUBLON', 'INVALIDE'])
  })

  it('adresse : pays retiré, rien d’autre réécrit ; valeur factice ou imprécise signalée', () => {
    expect(lireAdresse(['52, Bois Fictif, Port-au-Prince, Haïti, P.O.Box 1']).valeur).toBe('52, Bois Fictif, Port-au-Prince, P.O.Box 1')
    expect(lireAdresse(['67, Rue Fictive, Entrée Péguy Ville, P.V., Haïti']).valeur).toBe('67, Rue Fictive, Entrée Péguy Ville, P.V.')
    expect(lireAdresse(['Adresse de démonstration'])).toMatchObject({ valeur: null, anomalie: expect.stringContaining('factice') })
    expect(lireAdresse(['Bourdon, Port-au-Prince'])).toMatchObject({ valeur: null, anomalie: expect.stringContaining('imprécise') })
  })
})

describe('rapprochement — avant toute création, jamais de fusion d’office', () => {
  it.each([
    ['VICTOR Patrick', 'EXACT', 'n11'],
    ['Paul Duvot', 'EXACT', 'n115'],
    ['Jean Joseph Frantz CÉANT', 'EXACT', 'n13'],
    ['Garry Brisson CASSAGNOL', 'EXACT', 'n5'],
    ['Marie Carmel BEAULIEU', 'EXACT', 'n228'],
  ])('« %s » → %s (%s) : inversions, tirets, accents, noms composés', (nom, niveau, id) => {
    expect(rapprocher(nom, NOTAIRES)).toMatchObject({ niveau, notaryId: id })
  })

  it('une inscription RETIRÉE n’est pas un candidat', () => {
    expect(rapprocher('Patrick VICTOR', NOTAIRES).notaryId).toBe('n11')
  })

  it.each([
    ['Guy Mario GAI', 'VARIANTE', 'n1'],
    ['Lesly ALPHONSE', 'PROBABLE', 'n32'],
    ['Sabine Duvivier MORPEAU', 'PROBABLE', 'n7'],
    ['Danielle GIORDANI', 'PROBABLE', 'n2'],
    ['Bettina Baudin FRANCILLON', 'PARTIEL', 'n24'],
    ['Marie Alice Coradin BÉLISAIRE', 'PARTIEL', 'n10'],
  ])('« %s » → %s, candidat %s, AUCUNE écriture', (nom, niveau, id) => {
    const r = rapprocher(nom, NOTAIRES)
    expect(r).toMatchObject({ niveau, notaryId: null })
    expect(r.candidats[0].id).toBe(id)
  })

  it('initiales compatibles signalées (« C. B. » / Coradin Bélisaire)', () => {
    expect(rapprocher('Marie Alice Coradin BÉLISAIRE', NOTAIRES).candidats[0].motif).toMatch(/initiales C\. B\. compatibles/)
  })

  it('homonymes ou inscriptions multiples : MULTIPLE, aucune fusion', () => {
    const r = rapprocher('Jean AVIN', NOTAIRES)
    expect(r).toMatchObject({ niveau: 'MULTIPLE', notaryId: null })
    expect(r.candidats.map((c) => c.id).sort()).toEqual(['a1', 'a2'])
  })

  it('aucun rapprochement : AUCUN', () => {
    expect(rapprocher('Personne INCONNUE', NOTAIRES)).toMatchObject({ niveau: 'AUCUN', notaryId: null, candidats: [] })
  })
})

describe('plan — l’existant prévaut, l’import ne fait que compléter', () => {
  const [victor, cassagnol, ceant] = lireEntrees(DOC).entrees

  it('fiche sans coordonnées : adresse, téléphones (4 au plus) et courriels complétés', () => {
    const p = planifier(victor, NOTAIRES, () => null)
    expect(p.completions).toEqual([
      { champ: 'address', valeur: '14, Rue Fictive, Bourdon, Port-au-Prince' },
      { champ: 'phones', valeur: ['+50920000001', '+50930000002', '+50920000003'] },
      { champ: 'emails', valeur: ['etude@exemple.ht'] },
    ])
  })

  it('adresse existante : jamais écrasée, la différence devient une proposition', () => {
    const p = planifier(ceant, NOTAIRES, () => ({ address: '390, ave Existante, Bourdon', phones: ['+50920000021'], emails: ['existant@exemple.ht'], active: true }))
    expect(p.completions).toEqual([])
    expect(p.propositions.map((x) => x.champ)).toEqual(['address', 'emails'])
    expect(p.propositions[0]).toMatchObject({ existant: '390, ave Existante, Bourdon', motif: expect.stringContaining('prévaut') })
  })

  it('adresse vide ou faite d’espaces : complétée', () => {
    const p = planifier(ceant, NOTAIRES, () => ({ address: '   ', phones: [], emails: [], active: true }))
    expect(p.completions.map((c) => c.champ)).toEqual(['address', 'phones', 'emails'])
  })

  it('plusieurs courriels : TOUS publiés (décision du 18 oct.) ; numéro personnel ou au-delà de 4 : jamais publié d’office', () => {
    const p = planifier(cassagnol, NOTAIRES, () => null)
    expect(p.completions.find((c) => c.champ === 'emails')?.valeur).toEqual(['a@exemple.ht', 'b@exemple.ht'])
    expect(p.completions.find((c) => c.champ === 'phones')?.valeur).toHaveLength(4)
    expect(p.completions.find((c) => c.champ === 'phones')?.valeur).not.toContain('+50930000016')
    expect(p.anomalies.map((a) => a.type)).toEqual(expect.arrayContaining(['TELEPHONE_PERSONNEL', 'TELEPHONE_ININTERPRETABLE', 'TELEPHONE_DOUBLON', 'TELEPHONE_AU_DELA']))
    expect(p.propositions.map((x) => x.champ)).toEqual(['phones'])
  })

  it('courriels : 4 au plus publiés (le reste proposé) ; une fiche qui en a déjà se voit PROPOSER les nouveaux', () => {
    const cinq = { ...victor, email: ['a@exemple.ht; b@exemple.ht; c@exemple.ht; d@exemple.ht; e@exemple.ht'] }
    const p = planifier(cinq, NOTAIRES, () => null)
    expect(p.completions.find((c) => c.champ === 'emails')?.valeur).toEqual(['a@exemple.ht', 'b@exemple.ht', 'c@exemple.ht', 'd@exemple.ht'])
    expect(p.propositions).toEqual([expect.objectContaining({ champ: 'emails', propose: 'e@exemple.ht' })])
    expect(p.anomalies.map((a) => a.type)).toContain('COURRIEL_AU_DELA')
    const q = planifier(cassagnol, NOTAIRES, () => ({ address: 'x 1', phones: ['+50920000011'], emails: ['A@exemple.ht'], active: true }))
    expect(q.completions.find((c) => c.champ === 'emails')).toBeUndefined()
    expect(q.propositions.filter((x) => x.champ === 'emails')).toEqual([expect.objectContaining({ propose: 'b@exemple.ht', existant: 'A@exemple.ht' })])
  })

  it('rapprochement incertain : une proposition, aucune complétion', () => {
    const e = { ...victor, nom: 'Guy Mario GAI' }
    const p = planifier(e, NOTAIRES, () => null)
    expect(p.completions).toEqual([])
    expect(p.propositions[0]).toMatchObject({ champ: 'inscription', motif: expect.stringContaining('variante') })
  })

  it('idempotence : relancé sur une fiche déjà complétée, rien à faire', () => {
    const p = planifier(victor, NOTAIRES, () => ({ address: '14, Rue Fictive, Bourdon, Port-au-Prince', phones: ['+50920000001', '+50930000002', '+50920000003'], emails: ['etude@exemple.ht'], active: true }))
    expect(p).toMatchObject({ completions: [], propositions: [], action: 'RIEN (déjà à jour)' })
  })

  it('clé de proposition stable (empreinte du fichier + rang)', () => {
    expect(cleProposition('2ccf77752b001d204ff649a41cc524f5c097c34c6cd425635ffbf2075e31b096', 3)).toBe('notaires-docx:2ccf77752b001d20:3')
  })
})

describe('décisions de la cliente (fichier privé, lié au document)', () => {
  const [victor, , ceant] = lireEntrees(DOC).entrees
  const D = (o: Record<string, unknown> = {}) => ({ rang: 1, decidedOn: '2026-10-18', par: 'Me Exemple', texte: 'garder ce nom', notaryId: 'n11', remplacer: [] as 'address'[], ajouter: [] as Array<'phones' | 'emails'>, ...o })

  it('le fichier vise CE document (empreinte), des entrées qui existent, une décision par entrée', () => {
    const brut = (o: Record<string, unknown> = {}) => ({ document: { fichier: 'N.docx', sha256: 'a'.repeat(64) }, decisions: [D(o)] })
    expect(lireDecisions(brut(), 'a'.repeat(64), [1, 2]).get(1)?.notaryId).toBe('n11')
    expect(() => lireDecisions(brut(), 'b'.repeat(64), [1])).toThrow(/le document a changé/)
    expect(() => lireDecisions(brut({ rang: 9 }), 'a'.repeat(64), [1])).toThrow(/aucune entrée n° 9/)
  })

  it('DÉSIGNE l’inscription parmi les candidats (jamais au-delà) ; l’adresse de la décision remplace celle du document', () => {
    const lesly = { ...victor, nom: 'Lesly ALPHONSE' }
    const refs = [...NOTAIRES, { id: 'n32', fullName: 'Jean M. E. Lesly ALPHONSE', displayName: null, active: true, communeName: 'Pétion-Ville' }]
    const p = planifier(lesly, refs, () => null, D({ notaryId: 'n32', adresse: '67, Rue Exemple (Entrée Fictive), Pétion-Ville' }))
    expect(p.rapprochement).toMatchObject({ niveau: 'DECISION', notaryId: 'n32' })
    expect(p.completions[0]).toEqual({ champ: 'address', valeur: '67, Rue Exemple (Entrée Fictive), Pétion-Ville' })
    expect(p.propositions).toEqual([])
    expect(() => planifier(lesly, refs, () => null, D({ notaryId: 'n12' }))).toThrow(/pas un candidat/)
  })

  it('REMPLACER une adresse publiée et AJOUTER des numéros : sur décision seulement, « avant » consigné, publiés d’abord', () => {
    const ex = { address: '390, ave Existante, Bourdon', phones: ['+50920000021'], emails: ['existant@exemple.ht'], active: true }
    const sans = planifier(ceant, NOTAIRES, () => ex)
    expect(sans.modifications).toEqual([])
    const p = planifier({ ...ceant, tel: ['+(509) 2000-0021 / 3000-0022'] }, NOTAIRES, () => ex, D({ rang: 3, notaryId: 'n13', adresse: '390, Avenue Fictive (Route Fictive), Port-au-Prince', remplacer: ['address'], ajouter: ['phones'] }))
    expect(p.modifications).toEqual([
      { champ: 'address', avant: '390, ave Existante, Bourdon', apres: '390, Avenue Fictive (Route Fictive), Port-au-Prince' },
      { champ: 'phones', avant: ['+50920000021'], apres: ['+50920000021', '+50930000022'] },
    ])
    // Le courriel différent n'est pas couvert par la décision : il reste une proposition.
    expect(p.propositions.map((x) => x.champ)).toEqual(['emails'])
    expect(p.action).toBe('MODIFIER address, phones (décision) + PROPOSITION')
  })
})
