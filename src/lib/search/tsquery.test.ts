/**
 * Construction de la requête plein-texte — le découpage des mots.
 *
 * Ce fichier naît d'un défaut mesuré le 16 août 2026 : le découpage se faisait aux seuls
 * ESPACES, puis `lexeme()` retirait les caractères non alphanumériques À L'INTÉRIEUR du
 * mot. « Port-au-Prince » devenait donc le lexème unique « portauprince », qui n'existe
 * nulle part : la recherche rendait **4 documents pour 2 445**.
 *
 * Le défaut a vécu longtemps parce que rien ne l'éprouvait : la suite comptait 311 tests,
 * dont aucun n'exécutait `buildTsQuery`. Un moteur de recherche juridique haïtien qui ne
 * sait pas chercher « Port-au-Prince » est un moteur qui ne sert à rien — et cela ne se
 * voyait ni au typecheck, ni au build, ni à l'écran, puisqu'une réponse à quatre résultats
 * ressemble à une réponse.
 */
import { describe, it, expect } from 'vitest'
import { buildTsQuery, toOrQuery } from './tsquery'

/** Les mots de contenu retenus, dans l'ordre — c'est là que se joue le découpage. */
const mots = (q: string) => buildTsQuery(q)?.words ?? []

describe('découpage des mots', () => {
  it('le trait d’union sépare, il ne soude pas', () => {
    // « au » est un mot vide : il tombe, comme dans « Port au Prince » écrit avec des espaces.
    expect(mots('Port-au-Prince')).toEqual(['port', 'prince'])
    expect(mots('Croix-des-Bouquets')).toEqual(['croix', 'bouquets'])
    expect(mots('procès-verbal')).toEqual(['proces', 'verbal'])
    expect(mots('sous-traitance')).toEqual(['sous', 'traitance'])
  })

  it('un composé donne le MÊME résultat écrit avec un tiret ou avec des espaces', () => {
    // C'est l'invariant qui manquait. Il ne dépend d'aucune liste de mots à maintenir.
    for (const t of ['Port-au-Prince', 'Petit-Goâve', 'chef-lieu', 'ayant-droit', 'non-lieu']) {
      expect(mots(t)).toEqual(mots(t.replace(/-/g, ' ')))
    }
  })

  it('l’apostrophe, la barre oblique et le point séparent aussi', () => {
    expect(mots("l'article")).toEqual(['article']) // « l » fait une lettre : écarté
    expect(mots('BRH/CIR/95')).toEqual(['brh', 'cir', '95'])
    expect(mots('art. 1er')).toEqual(['art', '1er'])
  })

  it('les accents tombent, la casse aussi', () => {
    expect(mots('Petit-Goâve')).toEqual(['petit', 'goave'])
  })
})

describe('formes cherchées', () => {
  it('un mot d’au moins quatre lettres est cherché par préfixe, les plus courts exactement', () => {
    // « loi:* » ramènerait loisir, loin… : en deçà de quatre lettres, correspondance exacte.
    expect(buildTsQuery('societe')?.query).toContain('societe:*')
    expect(buildTsQuery('loi')?.query).toBe('(loi)')
  })

  it('le pluriel est rattrapé, car le préfixe ne va que dans un sens', () => {
    // « loyers:* » ne trouverait pas « loyer » — on ajoute donc le singulier.
    expect(buildTsQuery('loyers')?.query).toContain('loyer')
  })

  it('tous les mots sont exigés (ET), leurs formes sont alternatives (OU)', () => {
    const q = buildTsQuery('Port-au-Prince')!.query
    expect(q).toBe('(port:*) & (prince:*)')
  })
})

describe('garde-fous', () => {
  it('aucune syntaxe tsquery ne peut venir de la saisie', () => {
    // Le découpage sur [^a-z0-9]+ est aussi le garde-fou d'injection : tout ce qui n'est
    // ni lettre ni chiffre devient un séparateur. Les seuls caractères de syntaxe présents
    // dans l'expression sont ceux que nous ajoutons nous-mêmes : « :* », « | », « & », « ) ».
    const q = buildTsQuery("bank' | 1=1 -- <script>")!.query
    expect(q).not.toContain("'")
    expect(q).not.toContain('=')
    expect(q).not.toContain('<')
    expect(q).not.toContain('!')
    // Ce qui subsiste n'est fait que de lexèmes et de la syntaxe que nous produisons.
    expect(q).toMatch(/^[a-z0-9:*|& ()]+$/)
  })

  it('une saisie sans mot exploitable ne produit pas de requête', () => {
    expect(buildTsQuery('')).toBeNull()
    expect(buildTsQuery('   ')).toBeNull()
    expect(buildTsQuery('- , ; !')).toBeNull()
  })

  it('les jokers LIKE d’une expression entre guillemets sont neutralisés', () => {
    expect(buildTsQuery('"100 % des parts"')?.phrases[0]).toContain('\\%')
  })

  it('le repli permissif n’existe qu’à partir de deux mots', () => {
    expect(toOrQuery(buildTsQuery('societe')!)).toBeNull()
    expect(toOrQuery(buildTsQuery('Port-au-Prince')!)).toContain('|')
  })
})
