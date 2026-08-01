import { describe, expect, it } from 'vitest'
import { segmentCodeRefs, isCpcArticle, isCpArticle, CPC_LAST_ARTICLE, CP_LAST_ARTICLE, CP_MISSING_ARTICLES } from './coderefs'

/** Rend les segments sous une forme lisible : les liens d'article entre crochets. */
function rendu(value: string): string {
  const segs = segmentCodeRefs(value, ['cpc'])
  if (!segs) return value
  return segs.map((s) => (s.kind === 'article' ? `[${s.text}]` : s.kind === 'abbrev' ? `{${s.text}}` : s.text)).join('')
}

/** Le texte rendu doit être RIGOUREUSEMENT identique à l'entrée, hors marqueurs. */
function texteIntact(value: string): boolean {
  const segs = segmentCodeRefs(value, ['cpc'])
  return (segs ? segs.map((s) => s.text).join('') : value) === value
}

describe('renvois au Code de procédure civile', () => {
  describe('construction 1 — abréviation puis numéros', () => {
    const cas: Array<[string, string]> = [
      ['- C. p. c. 956.', '- {C. p. c.} [956].'],
      ['C. p. c., 70, 470.', '{C. p. c.}, [70], [470].'],
      ['C. p. c. 464, et s ;', '{C. p. c.} [464], et s ;'],
      ['C. civ., 88 et s; C. p. c. 124 et s.', 'C. civ., 88 et s; {C. p. c.} [124] et s.'],
      ['C.p. c. 809.', '{C.p. c.} [809].'],
      ['C.p. c. 215 et s;', '{C.p. c.} [215] et s;'],
      // la virgule reste hors de l'abréviation : elle appartient à la ponctuation du renvoi
      ['C. p. c, 258 et s, 989.', '{C. p. c}, [258] et s, [989].'],
      ['C. p. c. 535, 536, 546, 956.', '{C. p. c.} [535], [536], [546], [956].'],
      ['Cp. c. 12', '{Cp. c.} [12]'],
      ['cp. c. 44', '{cp. c.} [44]'],
      ['C.p.c. 7', '{C.p.c.} [7]'],
      // Double virgule de l'OCR (le point de l'abréviation lu en virgule) : 50 renvois
      // du Code civil s'écrivent ainsi.
      ['C. p. c,, 814', '{C. p. c},, [814]'],
      ['C.p. c,, 121, 123', '{C.p. c},, [121], [123]'],
      ['C. p. c,, 475 et s, 945-947', '{C. p. c},, [475] et s, [945]-[947]'],
    ]
    for (const [entree, attendu] of cas) {
      it(`« ${entree} »`, () => {
        expect(rendu(entree)).toBe(attendu)
        expect(texteIntact(entree)).toBe(true)
      })
    }
  })

  describe('construction 2 — numéro puis abréviation', () => {
    const cas: Array<[string, string]> = [
      ["l'art. 921 C. p. c. de la part", "l'art. [921] {C. p. c.} de la part"],
      ["l'art. 930 du C. p. c., n'est pas", "l'art. [930] du {C. p. c.}, n'est pas"],
      ["les arts. 1109 du C. p. c. et 164 du C. p. c. combinés", "les arts. 1109 du {C. p. c.} et [164] du {C. p. c.} combinés"],
      ["l'art. 470 du C.p. civile", "l'art. [470] du {C.p. civile}"],
      ["l'article 148 du C. p. c. et", "l'article [148] du {C. p. c.} et"],
    ]
    for (const [entree, attendu] of cas) {
      it(`« ${entree} »`, () => {
        expect(rendu(entree)).toBe(attendu)
        expect(texteIntact(entree)).toBe(true)
      })
    }
  })

  describe('faux amis — jamais transformés', () => {
    const intacts = [
      'C. pén. 95.',                                   // Code pénal
      'C.pén, 107 et s, 192 et s.',                    // Code pénal, graphie serrée
      'Ci. c. 350 et s;',                              // Code d'instruction criminelle
      'C. civ., 16, 17, 155, 398.',                    // Code civil : renvoi INTERNE, traité ailleurs
      'C. proc. pén. 12',                              // procédure PÉNALE
      'Cpt. 45',                                       // rien à voir
    ]
    for (const s of intacts) {
      it(`« ${s} » reste du texte`, () => {
        expect(segmentCodeRefs(s, ['cpc'])).toBeNull()
      })
    }

    it('« C.P. Cass., 21 décembre 1914 » : Cass. n\'est pas le c de l\'abréviation', () => {
      // Le piège : « C.P. C » ressemble à l'abréviation si l'on ne vérifie pas ce qui suit.
      expect(segmentCodeRefs('de l\'art. 713, C.P. Cass., 21 décembre 1914', ['cpc'])).toBeNull()
    })
  })

  describe('anti-lien-mort', () => {
    it('un numéro au-delà du dernier article reste du texte', () => {
      expect(rendu('C. p. c. 4745.')).toBe('{C. p. c.} 4745.')
      expect(rendu("l'art. 1109 du C. p. c.")).toBe("l'art. 1109 du {C. p. c.}")
    })
    it('la borne correspond au Code réel', () => {
      expect(isCpcArticle(CPC_LAST_ARTICLE)).toBe(true)
      expect(isCpcArticle(CPC_LAST_ARTICLE + 1)).toBe(false)
      expect(isCpcArticle(0)).toBe(false)
      expect(isCpcArticle(1.5)).toBe(false)
    })
    it("l'abréviation seule reste cliquable même sans numéro exploitable", () => {
      const segs = segmentCodeRefs('voir le C. p. c. sur ce point', ['cpc'])
      expect(segs?.some((s) => s.kind === 'abbrev')).toBe(true)
      expect(segs?.some((s) => s.kind === 'article')).toBe(false)
    })
  })

  describe('intégrité du texte', () => {
    it('aucun caractère perdu ni ajouté sur un extrait réel du recueil', () => {
      const extrait =
        "Art. 7 (…) capacité des personnes en Haïti.- C. civ., 16, 17, 155, 398.- C. p. c. 956. " +
        "Art. 8 (…) sur les causes qui leur sont soumises.- C. p. c. 268.- C. pén. 95. " +
        "Art. 10 (…) déni de justice.- C. p. c. 464, et s ; C. pén. 146, 190-13."
      expect(texteIntact(extrait)).toBe(true)
      const segs = segmentCodeRefs(extrait, ['cpc'])!
      expect(segs.filter((s) => s.kind === 'article').map((s) => s.text)).toEqual(['956', '268', '464'])
    })

    it('deux renvois successifs ne se chevauchent pas', () => {
      expect(rendu('C. p. c. 12 ; C. p. c. 13')).toBe('{C. p. c.} [12] ; {C. p. c.} [13]')
    })

    it("un renvoi ne franchit pas la fin de ligne (cas réel du Code civil)", () => {
      // « C.p. c., 769; » puis, à la ligne, l'énumération « 3. Qu'il y ait eu… ».
      // Le 3 n'est PAS un article du Code de procédure civile.
      const extrait = "C. civ., 1043, 1675;- C.p. c., 769;\n3. Qu'il y ait eu procès-verbal dressé par l'huissier."
      expect(rendu(extrait)).toBe("C. civ., 1043, 1675;- {C.p. c.}, [769];\n3. Qu'il y ait eu procès-verbal dressé par l'huissier.")
      expect(texteIntact(extrait)).toBe(true)
    })

    it("une liste coupée par l'OCR se poursuit après la virgule, d'une ligne à l'autre", () => {
      // 46 renvois du Code civil sont dans ce cas : les interdire coûtait plus qu'il ne rapportait.
      expect(rendu('C. p. c. 535,\n536.')).toBe('{C. p. c.} [535],\n[536].')
    })

    it('le point-virgule clôt la liste, même sur une seule ligne', () => {
      // Il sépare deux codes : « C. civ., 51, 88;-C.p. c. 809 ».
      expect(rendu('C. p. c. 769; 3 autres pièces')).toBe('{C. p. c.} [769]; 3 autres pièces')
    })
  })
})

describe('renvois au Code pénal', () => {
  const rp = (v: string) => {
    const segs = segmentCodeRefs(v, ['cp'])
    if (!segs) return v
    return segs.map((s) => (s.kind === 'article' ? `[${s.text}]` : s.kind === 'abbrev' ? `{${s.text}}` : s.text)).join('')
  }

  const cas: Array<[string, string]> = [
    ['- C. pén. 95.', '- {C. pén.} [95].'],
    ['C. pén., 300.', '{C. pén.}, [300].'],
    ['C. pén. 146, 190-13.', '{C. pén.} [146], [190]-13.'],
    ['C.pén, 107 et s, 192 et s.', '{C.pén}, [107] et s, [192] et s.'],
    ['C. pén., 287', '{C. pén.}, [287]'],
    ["l'art. 300 du C. pén.", "l'art. [300] du {C. pén.}"],
  ]
  for (const [entree, attendu] of cas) {
    it(`« ${entree} »`, () => {
      expect(rp(entree)).toBe(attendu)
      const segs = segmentCodeRefs(entree, ['cp'])
      expect((segs ?? []).map((s) => s.text).join('')).toBe(entree)
    })
  }

  it('« C. p. c. » n’est pas confondu avec le Code pénal', () => {
    expect(segmentCodeRefs('C. p. c. 956.', ['cp'])).toBeNull()
  })

  it('les deux codes cohabitent dans une même phrase', () => {
    const segs = segmentCodeRefs('- C. p. c. 464, et s ; C. pén. 146.', ['cpc', 'cp'])!
    const liens = segs.filter((s) => s.kind === 'article').map((s) => `${s.kind === 'article' ? s.code : ''}:${s.text}`)
    expect(liens).toEqual(['cpc:464', 'cp:146'])
    expect(segs.map((s) => s.text).join('')).toBe('- C. p. c. 464, et s ; C. pén. 146.')
  })

  describe('anti-lien-mort : le Code pénal a des trous', () => {
    it('les sept numéros sans article ne deviennent pas des liens', () => {
      for (const n of CP_MISSING_ARTICLES) {
        expect(isCpArticle(n)).toBe(false)
        expect(rp(`C. pén. ${n}.`)).toBe(`{C. pén.} ${n}.`)
      }
    })
    it('les bornes sont celles du Code réel', () => {
      expect(isCpArticle(1)).toBe(true)
      expect(isCpArticle(CP_LAST_ARTICLE)).toBe(true)
      expect(isCpArticle(CP_LAST_ARTICLE + 1)).toBe(false)
      expect(isCpArticle(11)).toBe(true)
      expect(isCpArticle(15)).toBe(true)
    })
  })
})
