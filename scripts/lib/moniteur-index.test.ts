import { describe, expect, it } from 'vitest'
import { classify, cleFascicule, enTeteSeul, harmoniser, lireCsv, rapprocher, ressemblance, versCsv } from './moniteur-index'

describe('classify — copie du classifieur de l’Index', () => {
  it.each([
    ['Extraits du registre des marques de fabrique et de commerce', 'MARQUE'],
    ['Avis autorisant le fonctionnement de la société anonyme dénommée « X S.A. »', 'SOCIETE'],
    ['Décret portant création de l’Autorité nationale des jeux', 'DECRET'],
    ['Arrêté nommant un conseil d’administration', 'ARRETE'],
    ['Loi de finances de l’exercice 2022-2023', 'LOI'],
    ['Avis de concours', 'AVIS'],
    ['SOGEBANK - Bilan consolidé au 31 décembre 2019', 'AUTRE'],
  ])('%s → %s', (titre, cat) => {
    expect(classify(titre).category).toBe(cat)
  })
})

describe('harmoniser — la casse des formules suit l’Index existant', () => {
  it.each([
    ['Avis autorisant le fonctionnement de la Société Anonyme dénommée « CARIBBEAN REAL ESTATE, S.A. » — Acte constitutif et Statuts y annexés.', 'Avis autorisant le fonctionnement de la société anonyme dénommée « CARIBBEAN REAL ESTATE, S.A. » — Acte constitutif et statuts y annexés'],
    ['Avis approuvant la modification apportée aux Statuts de la Société Anonyme Dénommée « WINGAZ S.A. » — Procès-verbal y annexé.', 'Avis approuvant la modification apportée aux statuts de la société anonyme dénommée « WINGAZ S.A. » — Procès-verbal y annexé'],
    ['Décret électoral', 'Décret électoral'],
  ])('%s', (avant, apres) => {
    expect(harmoniser(avant)).toBe(apres)
  })
})

describe('cleFascicule', () => {
  it('ignore tirets et casse', () => {
    expect(cleFascicule('LM2020-99-A')).toBe(cleFascicule('LM2020-99A'))
    expect(cleFascicule('lm2026-sp43-a')).toBe('LM2026SP43A')
  })
})

describe('rapprocher — un titre du sommaire face à l’Index existant', () => {
  const existantes = [
    'Avis autorisant le fonctionnement de la société anonyme dénommée : "Global Asia Motors S.A." - Acte constitutif et statuts y annexés',
    'Extraits du registre des marques de fabrique et de commerce',
  ]
  it('le même acte, autrement ponctué, est déjà à l’Index', () => {
    const r = rapprocher('Avis autorisant le fonctionnement de la Société Anonyme dénommée « GLOBAL ASIA MOTORS S.A. » — Acte constitutif et Statuts y annexés', existantes)
    expect(r.statut).toBe('deja-a-l-index')
  })
  it('un autre acte est à créer', () => {
    expect(rapprocher('Décret portant réglementation des jeux de hasard et d’argent', existantes).statut).toBe('a-creer')
  })
  it('deux sociétés différentes sous la même formule ne se confondent pas', () => {
    const r = rapprocher('Avis autorisant le fonctionnement de la société anonyme dénommée « BRIGHTER HAITI S.A. » - Acte constitutif et statuts y annexés', existantes)
    expect(r.statut).not.toBe('deja-a-l-index')
  })
  it('la ponctuation du nom ne sépare pas deux écritures de la même société', () => {
    expect(rapprocher('Avis autorisant le fonctionnement de la société anonyme dénommée « GLOBAL ASIA MOTORS, S.A. » — Acte constitutif et statuts y annexés', existantes).statut).toBe('deja-a-l-index')
  })
  it('une société citée dans une entrée groupée est déjà à l’Index', () => {
    const groupee = ['Avis autorisant le fonctionnement des sociétés anonymes dénommées : 1) "Mécanique Précision Center S.A."; 2) "Ikofa S.A."']
    expect(rapprocher('Avis autorisant le fonctionnement de la société anonyme dénommée « IKOFA S.A. » — Acte constitutif et statuts y annexés', groupee).statut).toBe('deja-a-l-index')
    expect(rapprocher('Avis autorisant le fonctionnement de la société anonyme dénommée « FÉSHA S.A. »', groupee).statut).toBe('a-creer')
  })
  it('œ = oe : « Cœur » et « Coeur », « Bœufs » et « Boeufs » sont le même acte', () => {
    expect(rapprocher('Arrêté créant un parc national marin dénommé : « Parc des Trois Baies et des Lagons aux Bœufs »', ['Arrêté créant un parc national marin dénommé : "Parc des Trois Baies et des Lagons aux Boeufs"']).statut).toBe('deja-a-l-index')
  })
  it('la formule seule se compare entière des deux côtés (marques)', () => {
    expect(rapprocher('Extraits du registre des marques de fabrique et de commerce', ['Extraits du registre des marques de fabrique et de commerce (v. => Reproduction pour erreur matérielle dans LM2013-81)']).statut).toBe('deja-a-l-index')
    expect(rapprocher('Extraits du registre des marques de fabrique et de commerce', ['Avis autorisant le fonctionnement des sociétés anonymes dénommées : 1) "Ibt Haiti S.A."']).statut).toBe('a-creer')
  })
  it('un arrêté individuel figure dans l’entrée groupée qui le cite', () => {
    const g = ["Arrêtés autorisant l'adoption des mineurs suivants: Widelyne Desgranges, Eliane Joseph, Tamara Bellefleur Théodat, Parker Stanley Pierrelus"]
    expect(rapprocher("Arrêté autorisant l'adoption de la mineure Tamara Bellefleur THEODAT", g).statut).toBe('deja-a-l-index')
    expect(rapprocher("Arrêté autorisant l'adoption du mineur Jacques EXALUS", g).statut).not.toBe('deja-a-l-index')
  })
  it('un sigle ou un mot de plus ne sépare pas deux écritures de la même société', () => {
    const g = ['Avis autorisant le fonctionnement des sociétés anonymes dénommées : 1) "Radio Tele Vlaw S.A."; 2) "Biocare S.A."']
    expect(rapprocher('Avis autorisant le fonctionnement de la société anonyme dénommée « RADIO TELE VLAW, S.A. » (RTV S.A.) — Acte constitutif et statuts y annexés', g).statut).toBe('deja-a-l-index')
  })
  it('un en-tête de rubrique nu se reconnaît, et retrouve l’entrée groupée qui le développe', () => {
    expect(enTeteSeul("Arrêtés autorisant l'adoption des mineurs suivants")).toBe(true)
    expect(enTeteSeul("Arrêté autorisant l'adoption du mineur Jacques EXALUS")).toBe(false)
    expect(rapprocher("Arrêtés autorisant l'adoption des mineurs suivants", ["Arrêtés autorisant l'adoption des mineurs suivants: Edson François, Michaël François"]).statut).toBe('deja-a-l-index')
  })
  it('ressemblance symétrique et bornée', () => {
    expect(ressemblance('abc def', 'abc def')).toBe(1)
    expect(ressemblance('', 'x')).toBe(0)
  })
})

describe('CSV', () => {
  it('aller-retour avec virgules, guillemets et retours à la ligne', () => {
    const lignes = [['a', 'b, c', 'd "e"'], ['f\ng', '', 'h']]
    expect(lireCsv(versCsv(lignes))).toEqual(lignes)
  })
})
