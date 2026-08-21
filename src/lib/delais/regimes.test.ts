/**
 * § 4.7 — le régime, ses trois valeurs, et le garde-fou de la citation.
 *
 * CORRECTIF défaut 1 : le garde-fou d'origine cherchait « le mot franc » dans le
 * `regimeFondement`. Les six entrées CIVIL/FRANC du catalogue portent toutes le fondement
 * « l'article lui-même qualifie le délai de franc » — qui contient le mot. Le garde-fou
 * était donc franchi d'avance par la donnée qu'il devait contrôler. Ces tests le prouvent,
 * puis vérifient qu'il ne l'est plus.
 */
import { describe, expect, it } from 'vitest'
import { citationDeFranc, controleCivilFranc, francEnTeteDaffiche, normaliserRegime } from './regimes'
import { CITATIONS_CIVIL_FRANC } from './textes'

/** Le fondement TEL QU'IL EST dans `delais-catalogue.json`, pour les six entrées. */
const FONDEMENT_DU_CATALOGUE = 'l’article lui-même qualifie le délai de franc'

describe('normaliserRegime — la troisième valeur existe et ne se convertit pas', () => {
  it('lit les trois valeurs du catalogue', () => {
    expect(normaliserRegime('FRANC')).toBe('FRANC')
    expect(normaliserRegime('ORDINAIRE')).toBe('ORDINAIRE')
    expect(normaliserRegime('À VÉRIFIER')).toBe('A_VERIFIER')
    expect(normaliserRegime('A VERIFIER')).toBe('A_VERIFIER')
  })

  it('jette sur une valeur inconnue plutôt que de deviner', () => {
    expect(() => normaliserRegime('')).toThrow()
    expect(() => normaliserRegime('PEUT-ÊTRE')).toThrow()
  })
})

describe('citationDeFranc — le garde-fou qui ne gardait rien', () => {
  it('REFUSE le fondement du catalogue, qui contient pourtant le mot « franc »', () => {
    expect(FONDEMENT_DU_CATALOGUE).toMatch(/franc/)
    expect(citationDeFranc(FONDEMENT_DU_CATALOGUE).citation).toBeNull()
  })

  it('refuse une formule méta même mise entre guillemets', () => {
    const r = citationDeFranc('C. civ., art. 30 — « l’article lui-même qualifie le délai de franc »')
    expect(r.citation).toBeNull()
    expect(r.motif).toContain('une formule sur l’article n’est pas une phrase de l’article')
  })

  it('refuse un fondement vide, et un fondement sans guillemets', () => {
    expect(citationDeFranc('').citation).toBeNull()
    expect(citationDeFranc('Le délai est franc.').citation).toBeNull()
  })

  it('refuse une citation trop courte pour être une phrase', () => {
    expect(citationDeFranc('art. 30 — « francs »').citation).toBeNull()
  })

  it('ACCEPTE la phrase de l’article, lue en base', () => {
    const art28 = CITATIONS_CIVIL_FRANC['Art. 28']
    const fondement = `${art28.reference} — « ${art28.citation} »`
    const r = citationDeFranc(fondement)
    expect(r.citation).toContain('trente jours francs')
  })

  it('accepte les guillemets droits et courbes', () => {
    expect(
      citationDeFranc('art. 6 — "dans le délai de un jour franc à compter de la saisie-arrêt"')
        .citation,
    ).toContain('un jour franc')
    expect(
      citationDeFranc('art. 6 — “dans le délai de un jour franc à compter de la saisie-arrêt”')
        .citation,
    ).toContain('un jour franc')
  })
})

describe('Les SIX entrées CIVIL/FRANC, vérifiées une par une en base le 19 août 2026', () => {
  it('en compte bien six', () => {
    expect(Object.keys(CITATIONS_CIVIL_FRANC)).toHaveLength(6)
  })

  it('CINQ portent la phrase de l’article', () => {
    const avec = Object.values(CITATIONS_CIVIL_FRANC).filter((c) => c.citation !== null)
    expect(avec).toHaveLength(5)
    for (const c of avec) {
      expect(c.citation).toMatch(/\bfranc(?:s|he|hes)?\b/i)
      expect(c.docId).toBeTruthy()
      expect(c.luLe).toBe('2026-08-19')
      // et la citation passe le garde-fou
      expect(citationDeFranc(`${c.reference} — « ${c.citation} »`).citation).toBeTruthy()
    }
  })

  /**
   * ⚠️ **CE CONSTAT EST AFFICHÉ SOUS LA DATE, SUR LA FICHE PUBLIÉE** (correctif du 20 août
   * 2026). Il finissait par « L'entrée est donc marquée `regimeIncertain: true` … À faire
   * trancher par la rédaction (§ 13, point 5). » : un nom de champ et un renvoi à une
   * spécification interne, donnés à lire à une avocate. Le fond n'a pas bougé — c'est sa
   * qualité —, la forme si.
   */
  it('UNE n’en a AUCUNE : « Loi, art. 10 », transcription du divorce', () => {
    const sans = CITATIONS_CIVIL_FRANC['Loi, art. 10']
    expect(sans.citation).toBeNull()
    // Ce que la plateforme SAIT — le texte lu, mot pour mot, et ce qu'il ne dit pas.
    expect(sans.constat).toContain('dans les délais prévus par la loi')
    expect(sans.constat).toContain('aucun texte du corpus ne le dit')
    // Ce qu'elle NE TRANCHE PAS, et la date qu'elle retient en attendant.
    expect(sans.constat).toContain('ne tranche donc pas')
    expect(sans.constat).toContain('la date la plus précoce')
    // Ce qui revient à l'avocate.
    expect(sans.constat).toContain('Vérifiez le texte dont vous tenez ces trois jours')
    // Et rien du brouillon.
    expect(sans.constat).not.toContain('regimeIncertain')
    expect(sans.constat).not.toContain('§ 13')
    expect(sans.constat).not.toContain('`')
    expect(sans.constat).not.toMatch(/à faire trancher par la rédaction/i)
  })
})

describe('controleCivilFranc — le garde-fou de graine, bloquant', () => {
  const base = { code: 'CIVIL' as const, regime: 'FRANC' as const, regimeIncertain: false }

  it('BLOQUE une entrée CIVIL/FRANC dont le fondement est celui du catalogue', () => {
    const r = controleCivilFranc({ ...base, regimeFondement: FONDEMENT_DU_CATALOGUE })
    expect(r.ok).toBe(false)
    expect(r.motif).toContain('Produis la phrase de l’article')
  })

  it('LAISSE PASSER une entrée qui porte la phrase', () => {
    const c = CITATIONS_CIVIL_FRANC['Art. 229 (L. 5 mai 1949)']
    const r = controleCivilFranc({ ...base, regimeFondement: `${c.reference} — « ${c.citation} »` })
    expect(r.ok).toBe(true)
    expect(r.motif).toContain('huitaine franche')
  })

  it('LAISSE PASSER une entrée sans citation SI elle est marquée `regimeIncertain`', () => {
    const r = controleCivilFranc({
      ...base,
      regimeIncertain: true,
      regimeFondement: CITATIONS_CIVIL_FRANC['Loi, art. 10'].constat,
    })
    expect(r.ok).toBe(true)
    expect(r.motif).toContain('la tête d’affiche est calculée en ORDINAIRE')
  })

  it('ne s’applique ni au C. pr. civ. ni au C. trav.', () => {
    expect(controleCivilFranc({ code: 'CPC', regime: 'FRANC', regimeIncertain: false, regimeFondement: 'x' }).ok).toBe(true)
    expect(controleCivilFranc({ code: 'TRAVAIL', regime: 'FRANC', regimeIncertain: false, regimeFondement: 'x' }).ok).toBe(true)
  })
})

describe('francEnTeteDaffiche — la tête d’affiche est la plus précoce', () => {
  it('traite un régime douteux comme ORDINAIRE', () => {
    expect(francEnTeteDaffiche({ regime: 'FRANC', regimeIncertain: false })).toBe(true)
    expect(francEnTeteDaffiche({ regime: 'FRANC', regimeIncertain: true })).toBe(false)
    expect(francEnTeteDaffiche({ regime: 'ORDINAIRE', regimeIncertain: false })).toBe(false)
    expect(francEnTeteDaffiche({ regime: 'A_VERIFIER', regimeIncertain: false })).toBe(false)
  })
})
