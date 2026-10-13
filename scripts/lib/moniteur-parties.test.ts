import { describe, expect, it } from 'vitest'
import { debutDePlage, decouperEnEditions, jourDuNom } from './moniteur-parties'

describe('jourDuNom — le numéro n’est pas le jour', () => {
  it.each([
    // Noms sans jour : le numéro du fascicule ne doit JAMAIS devenir la date.
    ['Le Moniteur No. 4 Janvier 2022.pdf', null],
    ['Le Moniteur Spécial No. 12 Juillet 2020.pdf', null],
    ['Le Moniteur Extraordinaire No.3 Janvier 2013.pdf', null],
    ['Le Moniteur Special No. 11 Juin 2020 (12-30 pages).pdf', null],
    ['Le Moniteur Spécial No.12-A1 Février 2025.pdf', null],
    ['Le Moniteur Spécial No.12-E2 Février 2025.pdf', null],
    // Noms avec jour : lu, quelle que soit la forme.
    ['Le Moniteur No.44 2Avril 2026.pdf', 2],
    ['Le Moniteur No.24-B 11Février 2026.pdf', 11],
    ['Le Moniteur No. 74 Mardi 9 Mai 2023.pdf', 9],
    ['Le Moniteur No.126 Mardi 1er Août 2023.pdf', 1],
    ['Le Moniteur No.87-A Lundi  29 Juin 2026.pdf', 29],
    ['Le Moniteur No.152-G Vendredi 14 Novembre 2025.pdf', 14],
    ['Le Moniteur Spécial No.12 Jeudi 4 Mai 2023.pdf', 4],
  ])('%s → %s', (nom, attendu) => {
    expect(jourDuNom(nom)).toBe(attendu)
  })
})

describe('debutDePlage', () => {
  it.each([
    ['Le Moniteur Special No. 8 Juin 2020 (101 -130 pages).pdf', 101],
    ['Le Moniteur Spécial No. 30 Juin 2021 (1-30pages).pdf', 1],
    ['Le Moniteur Spécial No. 14 Juillet 2020 (81 - 100 pages).pdf', 81],
    ['Le Moniteur No. 50 Mars 2022.pdf', null],
  ])('%s → %s', (nom, attendu) => {
    expect(debutDePlage(nom)).toBe(attendu)
  })
})

describe('decouperEnEditions — ordre des pages et noms trompeurs', () => {
  it('trie les parties sur la première page, pas sur l’ordre alphabétique', () => {
    const noms = ['(1-24 pages)', '(101 -130 pages)', '(131-160 pages)', '(161-200 pages)', '(25-40 pages)', '(41-64 pages)', '(65-80 pages)', '(81-100 pages)']
      .map((p) => `Le Moniteur Special No. 8 Juin 2020 ${p}.pdf`)
    const [ed] = decouperEnEditions('SP-8-', noms.map((nom) => ({ nom, cle: 'SP-8-' })))
    expect(ed.parties.map((n) => n.match(/\((\d+)/)![1])).toEqual(['1', '25', '41', '65', '81', '101', '131', '161'])
  })

  it('2020, dossier « Spécial No. 13 » : les parties nommées 14 mais paginées à la suite sont du n° 13', () => {
    const eds = decouperEnEditions('SP-13-', [
      { nom: 'Le Moniteur Spécial No. 14 Juillet 2020 (41-72 pages).pdf', cle: 'SP-14-' },
      { nom: 'Le Moniteur Spécial No. 13 Juillet 2020 (1-20 pages).pdf', cle: 'SP-13-' },
      { nom: 'Le Moniteur Spécial No. 14 Juillet 2020 (21-40 pages).pdf', cle: 'SP-14-' },
    ])
    expect(eds).toHaveLength(1)
    expect(eds[0].cle).toBe('SP-13-')
    expect(eds[0].parties.map((n) => n.match(/\((\d+)/)![1])).toEqual(['1', '21', '41'])
    expect(eds[0].rectifications).toHaveLength(2)
  })

  it('2021, dossier « Spécial No. 30 » : trois éditions qui recommencent chacune à la page 1', () => {
    const p = (cle: string, num: string, plage: string) => ({ nom: `Le Moniteur Spécial No. ${num} Juin 2021 (${plage}pages).pdf`, cle })
    const eds = decouperEnEditions('SP-30-', [
      p('SP-30-B', '30-B', '31-60'), p('SP-30-', '30', '1-30'), p('SP-30-A', '30-A', '1-20'),
      p('SP-30-', '30', '31-61'), p('SP-30-B', '30-B', '1-30'), p('SP-30-A', '30-A', '21-41'),
    ])
    expect(eds.map((e) => [e.cle, e.parties.length])).toEqual([['SP-30-', 2], ['SP-30-A', 2], ['SP-30-B', 2]])
    expect(eds.every((e) => e.rectifications.length === 0)).toBe(true)
  })

  it('une partie mal nommée prolonge l’édition qu’elle pagine, pas la dernière ouverte', () => {
    const eds = decouperEnEditions('SP-13-', [
      { nom: 'Spécial No. 13 (1-20 pages).pdf', cle: 'SP-13-' },
      { nom: 'Spécial No. 13-A (1-10 pages).pdf', cle: 'SP-13-A' },
      { nom: 'Spécial No. 14 (21-40 pages).pdf', cle: 'SP-14-' },
    ])
    expect(eds.map((e) => [e.cle, e.parties.length])).toEqual([['SP-13-', 2], ['SP-13-A', 1]])
  })

  it('une première partie qui ne commence pas à la page 1 est une anomalie', () => {
    expect(() => decouperEnEditions('SP-9-', [{ nom: 'No. 9 (21-40 pages).pdf', cle: 'SP-9-' }])).toThrow(/page 21/)
  })
})
