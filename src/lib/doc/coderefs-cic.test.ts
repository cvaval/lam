import { describe, it, expect } from 'vitest'
import { segmentCodeRefs, isCicArticle, CIC_MISSING_ARTICLES } from './coderefs'

/**
 * Renvois vers le Code d'instruction criminelle.
 *
 * Le sigle n'a que DEUX graphies dans tout le corpus (mesuré sur 29 227 documents) :
 * « C. i. c. » — 26 renvois du Code civil — et « C.I.C. » — 3 du Code de procédure civile
 * et de son appendice. Chaque sentinelle de la grammaire a été payée par un faux positif
 * réel : ces témoins les gardent.
 */
const codes = ['cpc', 'cp', 'cic'] as const
const lire = (s: string) =>
  (segmentCodeRefs(s, codes) ?? []).filter((x) => x.kind !== 'text').map((x) =>
    x.kind === 'article' ? `${x.code}#${x.article}` : `${x.code}:${x.text.trim()}`,
  )

describe('Code d’instruction criminelle — renvois', () => {
  it('reconnaît les deux graphies du corpus', () => {
    expect(lire('qui habitent le territoire de la République.- C. i. c., 5, 7.')).toEqual([
      'cic:C. i. c.', 'cic#5', 'cic#7',
    ])
    // Deux des trois « C.I.C. » sont suivis d'un MOT : ne pas exiger l'absence de lettre.
    expect(lire('non une abrogation de l’art. 3 du C.I.C. auquel elle n’apporte rien.')).toContain('cic#3')
    expect(lire('du jury, en conformité de l’article 181 C.I.C. ;')).toContain('cic#181')
    // ⚠ LIMITE CONNUE de `segmentCodeRefs`, antérieure à cette clé et commune aux trois
    // codes : un numéro qui précède le sigle SANS le mot « article » n'est pas rattaché.
    // « …et 443 C.I.C. que… » ne donne donc que le lien vers le code, pas vers son
    // article 443 — alors que `CIC_BEFORE_RE` reconnaît bien la chaîne isolément.
    const mixte = lire('Il résulte des articles 448 C.P.C. et 443 C.I.C. que la communication…')
    expect(mixte).toContain('cpc#448')
    expect(mixte).toContain('cic:C.I.C.')
    expect(mixte).not.toContain('cic#443')
  })

  it('ne vole pas au Code civil son renvoi après un mot en « -ci »', () => {
    // Sans le lookbehind, « celui-ci. C. » est lu comme le sigle : 2 cas dans le Code civil.
    expect(lire('notifiée à celui-ci. C. civ., 1767, 1768, 1769.')).toEqual([])
  })

  it('exige le point final — sinon entrent sociétés, Cicéron et codes pays', () => {
    for (const faux of ['la société CIC a déposé', 'selon Cicéron', 'CI CÔTE D’IVOIRE', 'CL CHILI'])
      expect(lire(faux), faux).toEqual([])
  })

  it('les quatre grammaires se partagent une ligne sans se marcher dessus', () => {
    const l = 'C. civ., 1168.- C. p. c. 215 et s;- C. i. c. 350 et s; C. pén., 107 et s, 192 et s.'
    const r = lire(l)
    expect(r).toContain('cic#350')
    expect(r).toContain('cpc#215')
    expect(r).toContain('cp#107')
    expect(r.filter((x) => x.startsWith('cic'))).toEqual(['cic:C. i. c.', 'cic#350'])
  })

  it('n’émet aucun lien vers un article supprimé', () => {
    // Le Code civil cite « C. i. c., 108, 110 » : l'article 110 n'existe pas.
    expect(lire('C. civ., 1838 et s.- C. p. c., 442.- C. i. c., 108, 110.')).toContain('cic#108')
    expect(lire('C. civ., 1838 et s.- C. p. c., 442.- C. i. c., 108, 110.')).not.toContain('cic#110')
    expect(CIC_MISSING_ARTICLES).toEqual([109, 110, 111, 202, 203, 204, 205, 206, 207, 208])
    expect(isCicArticle(472)).toBe(true)
    expect(isCicArticle(473)).toBe(false)
    expect(isCicArticle(205)).toBe(false)
  })
})
