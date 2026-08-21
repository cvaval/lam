/**
 * § 4.5 bis — LE TEST DU CONTRÔLE LUI-MÊME (défaut 4 du cahier de recette).
 *
 * Le test qu'il remplace était tautologique : il vérifiait que `construireEntrees` recopie
 * `DESAMBIGUISATION_TRAVAIL`, ce qui ne peut pas échouer. Celui-ci vérifie que le CONTRÔLE
 * attrape ce qu'il est censé attraper — sur un corps FABRIQUÉ, donc sans réseau : la phrase
 * de contrôle placée à la mauvaise occurrence, le chapitre discordant, l'occurrence absente.
 *
 * Le recoupement contre le vrai Code du travail est `scripts/verify-delais-travail.ts`, qui
 * lit la base : 8/8 au 19 août 2026.
 */
import { describe, expect, it } from 'vitest'
import {
  ancreDeLaDesignation,
  controlerHomonymes,
  decouperParArticle,
} from './homonymes'
import type { Desambiguisation } from './repertoire'
import { DESAMBIGUISATION_TRAVAIL, REPERTOIRE, construireEntrees } from './repertoire'

const ENTREES = construireEntrees(REPERTOIRE)

const CH_A = 'Chapitre III — Des conflits collectifs de travail Règlements amiables Conciliation'
const CH_B = 'CHAPITRE XXVII — DES DÉCLARATIONS D’ACCIDENTS ET DE MALADIES PROFESSIONNELLES'

/** Deux chapitres, deux articles 172 : le doublon du § 4.5 bis, en miniature. */
function corpsFabrique(opts: { phraseOcc1: string; phraseOcc3: string }): string {
  return [
    CH_A,
    `Article 172. Première occurrence. ${opts.phraseOcc1} pour répondre aux revendications.`,
    'Article 173. Première occurrence, trois jours.',
    'Chapitre V — De l’hygiène et de la sécurité dans le travail',
    'Article 172. Deuxième occurrence, sans aucun délai.',
    CH_B,
    `Article 172. Troisième occurrence. ${opts.phraseOcc3} pour transmettre le formulaire.`,
  ].join('\n')
}

const DD_OCC1: Desambiguisation = {
  article: 'Art. 172',
  objetDebut: 'Réponse concrète aux revendications',
  articleOccurrence: 1,
  articleContexte: CH_A,
  phraseDeControle: 'dix jours',
}
const DD_OCC3: Desambiguisation = {
  article: 'Art. 172',
  objetDebut: 'Transmission par l’employeur du formulaire',
  articleOccurrence: 3,
  articleContexte: CH_B,
  phraseDeControle: 'cinq jours',
}

describe('§ 4.5 bis — le découpage par en-tête, et le chapitre porteur', () => {
  it('compte les occurrences et rattache chacune à SON chapitre', () => {
    const blocs = decouperParArticle(corpsFabrique({ phraseOcc1: 'dix jours', phraseOcc3: 'cinq jours' }))
    expect(blocs.get('art-172')).toHaveLength(3)
    expect(blocs.get('art-172')![0].chapitre).toBe(CH_A)
    expect(blocs.get('art-172')![2].chapitre).toBe(CH_B)
    expect(blocs.get('art-173')).toHaveLength(1)
  })

  it('déduit l’ancre du DERNIER numéro : « Loi assurance, art. 168 » → art-168', () => {
    expect(ancreDeLaDesignation('Loi assurance, art. 168')).toBe('art-168')
    expect(ancreDeLaDesignation('Art. 172')).toBe('art-172')
    expect(ancreDeLaDesignation('Assurance maternité')).toBeNull()
  })
})

describe('§ 4.5 bis — le contrôle attrape ce que le test tautologique laissait passer', () => {
  it('passe quand chaque phrase est sous SON article', () => {
    const r = controlerHomonymes(
      corpsFabrique({ phraseOcc1: 'dix jours', phraseOcc3: 'cinq jours' }),
      ENTREES,
      [DD_OCC1, DD_OCC3],
    )
    expect(r.anomalies.filter((a) => !a.includes('surcharges déclarées'))).toEqual([])
    expect(r.constats.every((c) => c.phraseDansLeBloc && c.chapitreConcorde)).toBe(true)
  })

  it('ROUGIT quand la phrase est à la MAUVAISE occurrence — le défaut même du § 4.5 bis', () => {
    // Les « dix jours » ont glissé sous le troisième article 172. L'ancienne rédaction du
    // test ne pouvait pas s'en apercevoir : elle n'ouvrait jamais le Code.
    const r = controlerHomonymes(
      corpsFabrique({ phraseOcc1: 'sans délai', phraseOcc3: 'dix jours' }),
      ENTREES,
      [DD_OCC1],
    )
    const faute = r.anomalies.find((a) => a.includes('ABSENTE du bloc de l’occurrence 1'))
    expect(faute).toBeDefined()
    expect(faute).toContain('elle est à l’occurrence 3')
    expect(faute).toContain('sous le texte d’un AUTRE article')
    expect(r.constats[0].phraseDansLeBloc).toBe(false)
    expect(r.constats[0].occurrencesQuiPortentLaPhrase).toEqual([3])
  })

  it('ROUGIT quand le chapitre lu n’est pas celui d’`articleContexte`', () => {
    const r = controlerHomonymes(
      corpsFabrique({ phraseOcc1: 'dix jours', phraseOcc3: 'cinq jours' }),
      ENTREES,
      [{ ...DD_OCC1, articleContexte: 'Chapitre XL — Un chapitre qui n’est pas le sien' }],
    )
    expect(r.anomalies.some((a) => a.includes('chapitre lu'))).toBe(true)
    expect(r.constats[0].chapitreConcorde).toBe(false)
  })

  it('ROUGIT quand l’occurrence désignée n’existe pas', () => {
    const r = controlerHomonymes(
      corpsFabrique({ phraseOcc1: 'dix jours', phraseOcc3: 'cinq jours' }),
      ENTREES,
      [{ ...DD_OCC1, articleOccurrence: 9 }],
    )
    expect(r.anomalies.some((a) => a.includes('n’existe pas') && a.includes('en porte 3'))).toBe(true)
  })

  it('les 8 surcharges réelles couvrent exactement les 8 entrées à `articleContexte`', () => {
    // Le seul volet que le contrôle peut tenir SANS la base : les effectifs concordent.
    const r = controlerHomonymes('', ENTREES, DESAMBIGUISATION_TRAVAIL)
    expect(r.anomalies.some((a) => a.includes('surcharges déclarées'))).toBe(false)
    expect(r.constats).toHaveLength(8)
    // … et sur un corps VIDE, les huit remontent en anomalie : le contrôle ne se tait jamais
    // faute de matière. C'est exactement ce que faisait l'ancien test.
    expect(r.anomalies).toHaveLength(8)
  })
})
