import { describe, it, expect } from 'vitest'
import { analyserTextesIntegraux } from './full-text'

const recueil = [
  'RÉPUBLIQUE D’HAÏTI',
  'COUR DE CASSATION — PREMIÈRE SECTION',
  'EXERCICE 1964---1965',
  'PREMIÈRE SECTION',
  '[Date manuscrite : 28 octobre 1964]',
  'No. 2).-',
  'AU NOM DE LA RÉPUBLIQUE',
  'Sur le pourvoi du sieur Jules CESAR, identifié au No. 6006-AA, propriétaire…',
  'PAR CES MOTIFS, la Cour déclare le sieur Jules CESAR déchu du pourvoi.',
  'En foi de quoi, etc... ;',
  'EX : 64-65 — Première Section',
  '[Date manuscrite : 21 décembre 1964]',
  'No. 13',
  'AU NOM DE LA RÉPUBLIQUE',
  'Attendu que la mort de Joseph Comeau est datée du 1er mars 1959 ;',
  'IL EST ORDONNÉ, etc...',
  'NOTES DE TRANSCRIPTION',
  'La présente transcription reproduit fidèlement le texte dactylographié.',
  '1. Arrêt No. 2 — Le dispositif porte « les décisions... rendus » (accord au masculin).',
  '2. Général — Les sommes des dépens sont laissées en pointillés dans tous les originaux.',
]

describe('analyserTextesIntegraux', () => {
  it('découpe les arrêts et lit les deux graphies d’en-tête', () => {
    // Le recueil de référence écrit « No. 2).- » quatorze fois et « No. 13 » une fois.
    const r = analyserTextesIntegraux(recueil)
    expect(r.textes.map((t) => t.numero)).toEqual(['2', '13'])
    expect(r.avertissements).toEqual([])
  })

  it('ne prend PAS pour un en-tête un numéro cité dans une phrase', () => {
    // « identifié au No. 6006-AA » vit à l'intérieur du texte de l'arrêt n° 2.
    const r = analyserTextesIntegraux(recueil)
    expect(r.textes).toHaveLength(2)
    expect(r.textes[0].texte).toContain('No. 6006-AA')
  })

  it('rend l’en-tête d’archive à l’arrêt SUIVANT, pas au précédent', () => {
    // Sans cela, « EX : 64-65 » et la date du 21 décembre finiraient dans l'arrêt n° 2.
    const r = analyserTextesIntegraux(recueil)
    expect(r.textes[0].texte).not.toContain('EX : 64-65')
    expect(r.textes[0].texte).not.toContain('21 décembre')
    expect(r.textes[0].texte.endsWith('En foi de quoi, etc... ;')).toBe(true)
    expect(r.textes[1].dateISO).toBe('1964-12-21')
  })

  it('lit la date d’archive de chaque arrêt pour la RECOUPER', () => {
    const r = analyserTextesIntegraux(recueil)
    expect(r.textes[0].dateISO).toBe('1964-10-28')
    expect(r.textes[0].dateTexte).toBe('28 octobre 1964')
  })

  it('sort les notes de transcription du corps et les rattache par numéro', () => {
    const r = analyserTextesIntegraux(recueil)
    expect(r.textes[1].texte).not.toContain('NOTES DE TRANSCRIPTION')
    expect(r.notesParArret['2']).toContain('accord au masculin')
    expect(r.notesGenerales[0]).toContain('pointillés')
  })

  it('signale un document au format inattendu au lieu de rendre un résultat vide', () => {
    const r = analyserTextesIntegraux(['Un texte quelconque', 'sans en-tête'])
    expect(r.textes).toHaveLength(0)
    expect(r.avertissements[0]).toMatch(/format attendu/)
  })

  it('signale les numéros en double au lieu de les écraser en silence', () => {
    const r = analyserTextesIntegraux(['No. 4', 'Texte A.', 'No. 4', 'Texte B.'])
    expect(r.textes).toHaveLength(2)
    expect(r.avertissements.join(' ')).toMatch(/double/)
  })

  it('signale un en-tête sans texte', () => {
    const r = analyserTextesIntegraux(['No. 9', 'No. 10', 'Texte.'])
    expect(r.avertissements.join(' ')).toMatch(/Arrêt 9 : aucun texte/)
  })
})
