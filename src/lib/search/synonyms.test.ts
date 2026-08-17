import { describe, it, expect } from 'vitest'
import { expandQuery, SYNONYMS } from './synonyms'
import { synonymLines } from './mappings'

/**
 * Le ministre s'appelait Secrétaire d'État.
 *
 * Avant 1984, le Moniteur n'emploie pas le mot « ministre » : 6 fascicules sur 81 en 1981,
 * 2 sur 88 en 1982. Sans synonymie, une recherche « ministre » ne rend presque rien sur les
 * 1 695 fascicules du fonds ancien — et rien ne le dit à qui cherche.
 */
describe('ministre ↔ secrétaire d’État', () => {
  it('« ministre » atteint les trois graphies du corpus', () => {
    const t = expandQuery('ministre')
    // Mesurées dans le corpus, pas supposées : 68/81 en 1981 pour la locution avec
    // apostrophe, 8 sans (l'OCR la perd), 53 pour le département lui-même.
    expect(t).toContain("secretaire d'etat")
    expect(t).toContain('secretaire d etat')
    expect(t).toContain('secretairerie')
  })

  it('la réciproque existe : qui cherche l’ancien terme trouve le récent', () => {
    expect(expandQuery("secrétaire d'État")).toContain('ministre')
    expect(expandQuery('secrétairerie')).toContain('ministre')
  })

  it('le pluriel déclenche autant que le singulier', () => {
    expect(expandQuery('ministres')).toContain("secretaire d'etat")
  })

  /**
   * ⚠️ LE GARDE-FOU DE CETTE ENTRÉE. « secrétaire » seul est partout — secrétaire de
   * séance, secrétaire général, secrétaire du tribunal. L'ajouter aux expansions noierait
   * la requête : c'est la LOCUTION qui désigne le membre du gouvernement, jamais le mot nu.
   */
  it('« secrétaire » seul n’ouvre sur rien', () => {
    expect(expandQuery('secrétaire')).toEqual(['secretaire'])
  })

  it('aucune expansion ne réduit « ministre » au mot nu « secrétaire »', () => {
    for (const [cle, exp] of Object.entries(SYNONYMS)) {
      if (!/ministre|ministère/.test(cle)) continue
      expect(exp, `clé « ${cle} »`).not.toContain('secrétaire')
      expect(exp.map((e) => e.toLowerCase()), `clé « ${cle} »`).not.toContain('secretaire')
    }
  })

  /**
   * Le miroir OpenSearch dérive ses lignes de la MÊME table (mappings.synonymLines).
   * ⚠️ Une virgule dans une expansion couperait la ligne Solr en deux synonymes : le
   * format est « clé => a, b, c », la virgule y est le séparateur.
   */
  it('les lignes Solr du miroir restent lisibles', () => {
    const l = synonymLines().find((x) => x.startsWith('ministre =>'))
    expect(l).toBeDefined()
    expect(l).toContain("secrétaire d'État")
    for (const [, exp] of Object.entries(SYNONYMS)) {
      for (const e of exp) expect(e, `expansion « ${e} »`).not.toContain(',')
    }
  })
})
