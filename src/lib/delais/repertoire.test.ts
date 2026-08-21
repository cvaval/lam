/**
 * Bloc 15 du § 9 — LA GRAINE, rejouée sans écrire.
 *
 * « Un écart signale une transcription fautive — mais un écart signale aussi que ce tableau a
 * vieilli : dans ce cas, ARRÊTE-TOI et remonte-le, ne recale pas les chiffres en silence. »
 */
import { describe, expect, it } from 'vitest'
import { calculer, kindCalcule } from './calcul'
import { CALENDRIER_V1 } from './feries'
import { citationDeFranc } from './regimes'
import {
  DESAMBIGUISATION_TRAVAIL,
  KINDS_ATTENDUS_APRES,
  KINDS_ATTENDUS_AVANT,
  REPERTOIRE,
  SLUG_VALIDE,
  SURCHARGES_ART_74,
  TRAVAIL_REGIME_DOUTEUX,
  VENTILATION_ATTENDUE,
  construireEntrees,
  construireSlugs,
  controler,
  deriverKind,
  suffixeObjet,
} from './repertoire'
import { CITATIONS_CIVIL_FRANC, CITATIONS_DISTANCE_LIEUES } from './textes'

const ENTREES = construireEntrees(REPERTOIRE)

function compter<T>(xs: readonly T[], cle: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const x of xs) out[cle(x)] = (out[cle(x)] ?? 0) + 1
  return out
}

describe('Le catalogue', () => {
  it('porte 393 lignes, 232 + 114 + 47', () => {
    expect(REPERTOIRE).toHaveLength(393)
    expect(compter(REPERTOIRE, (l) => l.code)).toEqual({ CPC: 232, CIVIL: 114, TRAVAIL: 47 })
  })

  it('porte les trois valeurs de régime, dont 4 « À VÉRIFIER »', () => {
    expect(compter(REPERTOIRE, (l) => l.regime)).toEqual({
      FRANC: 281,
      ORDINAIRE: 108,
      'À VÉRIFIER': 4,
    })
  })
})

describe('§ 4.4 — la dérivation mécanique du genre', () => {
  it('rend les sept nombres AVANT surcharges', () => {
    expect(compter(REPERTOIRE, (l) => deriverKind(l))).toEqual(KINDS_ATTENDUS_AVANT)
  })

  it('rend les sept nombres APRÈS les six surcharges', () => {
    expect(compter(ENTREES, (e) => e.kind)).toEqual(KINDS_ATTENDUS_APRES)
  })

  it('donne 123 lignes calculables et 270 refus', () => {
    const calculables = ENTREES.filter((e) => kindCalcule(e.kind))
    expect(calculables).toHaveLength(123)
    expect(ENTREES.length - calculables.length).toBe(270)
  })

  it('JETTE plutôt que de deviner un genre non couvert', () => {
    const inedit = { ...REPERTOIRE[0], determine: true, unite: 'jour', distance: true, code: 'TRAVAIL' }
    expect(() => deriverKind(inedit)).toThrow(/décision humaine/)
    expect(() => deriverKind({ ...REPERTOIRE[0], determine: true, unite: 'semaine' })).toThrow(
      /Unité inconnue/,
    )
  })

  it('ventile les genres par code comme le § 4.4 l’annonce', () => {
    const parCodeEtGenre = compter(REPERTOIRE, (l) => `${deriverKind(l)}/${l.code}`)
    expect(parCodeEtGenre['JOURS/CPC']).toBe(78)
    expect(parCodeEtGenre['JOURS/TRAVAIL']).toBe(12)
    expect(parCodeEtGenre['JOURS/CIVIL']).toBe(10)
    expect(parCodeEtGenre['HEURES/CPC']).toBe(9)
    expect(parCodeEtGenre['HEURES/TRAVAIL']).toBe(7)
    expect(parCodeEtGenre['HEURES/CIVIL']).toBe(3)
    expect(parCodeEtGenre['INDETERMINE/CPC']).toBe(117)
    expect(parCodeEtGenre['INDETERMINE/CIVIL']).toBe(65)
    expect(parCodeEtGenre['INDETERMINE/TRAVAIL']).toBe(24)
  })
})

describe('§ 5.2 bis — les 393 slugs', () => {
  const slugs = construireSlugs(REPERTOIRE)

  it('sont 393, tous distincts, tous conformes, 54 caractères au plus', () => {
    expect(slugs).toHaveLength(393)
    expect(new Set(slugs).size).toBe(393)
    for (const s of slugs) expect(s, s).toMatch(SLUG_VALIDE)
    expect(Math.max(...slugs.map((s) => s.length))).toBe(54)
  })

  it('désambiguïsent 26 groupes couvrant 56 lignes', () => {
    const bases = compter(REPERTOIRE, (l) => `${l.code}|${l.article}`)
    const groupes = Object.values(bases).filter((n) => n > 1)
    expect(groupes).toHaveLength(26)
    expect(groupes.reduce((s, n) => s + n, 0)).toBe(56)
  })

  it('produisent AU CARACTÈRE PRÈS les slugs nommés au § 5.2 bis', () => {
    const attendus = [
      'cpc-354-appel-parties-demeurant-haiti',
      'cpc-354-appel-parties-demeurant-hors-haiti',
      'cpc-417-pourvoi-cassation-demeurant-haiti',
      'cpc-417-pourvoi-personnes-habitant-etranger',
      'cpc-417-pourvoi-affaires-urgentes-referes',
      'cpc-10-citation-comparaitre-defendeur-siege',
      'cpc-10-citation-section-rurale-quartier-commune',
      'cpc-10-citation-autre-commune-meme-departement',
      'cpc-10-citation-commune-autre-departement',
      'cpc-622-denonciation-saisie-immobiliere-saisi',
      'cpc-622-visa-original-denonciation-juge-paix',
      'cpc-622-transcription-saisie-denonciation-bureau',
      'trav-172-reponse-concrete-revendications',
      'trav-172-transmission-employeur-formulaire',
      'trav-173-transmission-proces-verbal-accord',
      'trav-173-avis-maladie-professionnelle-travailleur',
      'cpc-296-opposition-partie-sans-defenseur',
      'cpc-296-opposition-lorsque-signification-n-pu',
      'civ-loi-art-10-transcription-dispositif-jugement-arret',
      'civ-loi-art-10-contentieux-non-paiement-loyers-devant',
    ]
    for (const a of attendus) expect(slugs, a).toContain(a)
  })

  it('tronquent sur une frontière de mot, sans jamais dépasser 40 caractères de suffixe', () => {
    expect(suffixeObjet('Citation à comparaître (défendeur au siège du tribunal de paix)')).toBe(
      'citation-comparaitre-defendeur-siege',
    )
    // deux mots qui tiennent dans 40 caractères sont tous deux gardés
    expect(suffixeObjet('Contradictoirement établissement')).toBe('contradictoirement-etablissement')
    // le premier mot est TOUJOURS gardé, même s'il dépasse à lui seul les 40 caractères
    const tresLong = 'a'.repeat(46)
    expect(suffixeObjet(`${tresLong} suite`)).toBe(tresLong)
    // ... et le mot suivant n'est jamais ajouté s'il fait dépasser
    expect(suffixeObjet('opposition lorsque signification pu comparution ultérieure')).toBe(
      'opposition-lorsque-signification-pu',
    )
    expect(suffixeObjet('de la du des')).toBe('')
  })
})

describe('§ 5.2 ter — tableau, ordre et titres', () => {
  it('ventile les 393 lignes exactement comme les trois sources', () => {
    for (const [code, attendus] of Object.entries(VENTILATION_ATTENDUE)) {
      const obtenus = compter(
        ENTREES.filter((e) => e.code === code),
        (e) => String(e.tableau),
      )
      for (const [t, n] of Object.entries(attendus)) expect(obtenus[t], `${code} T${t}`).toBe(n)
      expect(Object.keys(obtenus)).toHaveLength(Object.keys(attendus).length)
    }
  })

  it('numérote `ordre` de 1 à k dans chaque tableau, sans trou', () => {
    for (const code of ['CPC', 'CIVIL', 'TRAVAIL']) {
      const parTableau = new Map<number, number[]>()
      for (const e of ENTREES.filter((x) => x.code === code)) {
        parTableau.set(e.tableau, [...(parTableau.get(e.tableau) ?? []), e.ordre])
      }
      for (const [t, ordres] of parTableau) {
        expect(ordres.slice().sort((a, b) => a - b), `${code} T${t}`).toEqual(
          ordres.map((_, i) => i + 1),
        )
      }
    }
  })

  it('donne un titre aux tableaux du Code civil et du Code du travail, et AUCUN au C. pr. civ.', () => {
    // Les 10 tableaux du C. pr. civ. ne sont que numérotés : n'en invente pas.
    expect(ENTREES.filter((e) => e.code === 'CPC' && e.tableauTitreFr)).toHaveLength(0)
    expect(ENTREES.filter((e) => e.code !== 'CPC' && !e.tableauTitreFr)).toHaveLength(0)
    const premierCivil = ENTREES.find((e) => e.code === 'CIVIL')!
    expect(premierCivil.tableauTitreFr).toBe('I. Promulgation et application des lois')
  })
})

describe('§ 4.5 — les six surcharges de l’article 74', () => {
  it('en compte six, dont cinq qui déplacent une ligne d’INDETERMINE vers JOURS', () => {
    expect(SURCHARGES_ART_74).toHaveLength(6)
    const surchargees = ENTREES.filter((e) => e.surchargeAppliquee)
    expect(surchargees).toHaveLength(6)
    const deplacees = surchargees.filter(
      (e) => deriverKind(REPERTOIRE.find((l) => l.objet === e.objetFr && l.article === e.article)!) === 'INDETERMINE',
    )
    expect(deplacees).toHaveLength(5)
  })

  it('pose la question de suite, obligatoire, avec le bon nombre d’options', () => {
    for (const s of SURCHARGES_ART_74) {
      const e = ENTREES.find((x) => x.article === s.article && x.objetFr.startsWith(s.objetDebut))!
      expect(e.supplement?.obligatoire).toBe(true)
      expect(e.supplement?.questionFr).toBe('Où demeure la partie ?')
      // 10-4° et 584 ne visent QUE des personnes hors d'Haïti : l'option « haiti » est retirée
      expect(e.supplement?.options).toHaveLength(s.avecHaiti ? 3 : 2)
      for (const o of e.supplement!.options) {
        if (o.jours > 0) expect(o.fondement).toContain('art. 74')
      }
    }
  })

  it('accepte `jours: 0` UNIQUEMENT quand un supplément obligatoire l’accompagne', () => {
    for (const e of ENTREES) {
      if (kindCalcule(e.kind) && e.jours === 0) expect(e.supplement?.obligatoire, e.slug).toBe(true)
    }
  })
})

describe('§ 4.7 — les régimes', () => {
  it('marque les 4 lignes A_VERIFIER, et AUCUNE ne calcule', () => {
    const av = ENTREES.filter((e) => e.regime === 'A_VERIFIER')
    expect(av).toHaveLength(4)
    for (const e of av) expect(kindCalcule(e.kind), e.slug).toBe(false)
    expect(av.map((e) => e.article).sort()).toEqual(
      ['Art. 160', 'Art. 164', 'C. civ., art. 2036 (renvoi)', 'Jur. (art. 488)'].sort(),
    )
  })

  it('CORRECTIF défaut 1 — les 6 entrées CIVIL/FRANC : 5 citations, 1 regimeIncertain', () => {
    const cf = ENTREES.filter((e) => e.code === 'CIVIL' && e.regime === 'FRANC')
    expect(cf).toHaveLength(6)
    const avecCitation = cf.filter((e) => citationDeFranc(e.regimeFondement).citation !== null)
    expect(avecCitation).toHaveLength(5)
    const sans = cf.filter((e) => citationDeFranc(e.regimeFondement).citation === null)
    expect(sans).toHaveLength(1)
    expect(sans[0].article).toBe('Loi, art. 10')
    expect(sans[0].regimeIncertain).toBe(true)
    // aucune entrée n'affirme « franc » sans citation
    for (const e of cf) {
      const aUneCitation = citationDeFranc(e.regimeFondement).citation !== null
      expect(aUneCitation || e.regimeIncertain, e.slug).toBe(true)
    }
  })

  it('la citation vient bien du texte lu en base, pas du fondement du catalogue', () => {
    const art28 = ENTREES.find((e) => e.article === 'Art. 28' && e.code === 'CIVIL')!
    expect(art28.regimeFondement).toContain(CITATIONS_CIVIL_FRANC['Art. 28'].citation!)
    expect(art28.regimeFondement).not.toContain('l’article lui-même qualifie')
  })

  it('marque les 6 délais douteux du Code du travail', () => {
    const douteux = ENTREES.filter((e) => e.code === 'TRAVAIL' && e.regimeIncertain)
    expect(douteux).toHaveLength(TRAVAIL_REGIME_DOUTEUX.length)
    expect(douteux).toHaveLength(6)
    for (const e of douteux) expect(e.regimeFondement).toContain('DE PROCÉDURE')
  })

  it('donne INCERTAIN au Code civil et OUI aux deux autres', () => {
    for (const e of ENTREES) {
      expect(e.prorogation991, e.slug).toBe(e.code === 'CIVIL' ? 'INCERTAIN' : 'OUI')
      expect(e.prorogationFondement.length).toBeGreaterThan(30)
    }
  })
})

describe('§ 4.5 bis — les 8 entrées du Code du travail à numéro homonyme', () => {
  /**
   * ⚠️ RENOMMÉ pour ce qu'il vérifie RÉELLEMENT (défaut 4). Ce test s'intitulait « … portent
   * toutes leur occurrence et leur section, VERBATIM » et se contentait de constater que
   * `construireEntrees` recopie la constante `DESAMBIGUISATION_TRAVAIL` dans les entrées :
   * il n'ouvrait JAMAIS le Code du travail, et la `phraseDeControle` — le seul verrou contre
   * « afficher une durée sous le texte d'un autre article », sur 207 numéros en double —
   * n'était comparée à rien. Le vrai contrôle, qui lit la base, est
   * `scripts/verify-delais-travail.ts` ; celui-ci ne garde que la recopie.
   */
  it('la surcharge de désambiguïsation est bien recopiée sur les 8 entrées', () => {
    const homonymes = ENTREES.filter((e) => e.code === 'TRAVAIL' && e.articleContexte)
    expect(homonymes).toHaveLength(8)
    for (const d of DESAMBIGUISATION_TRAVAIL) {
      const e = homonymes.find((x) => x.article === d.article && x.objetFr.startsWith(d.objetDebut))
      expect(e, `${d.article} ${d.objetDebut}`).toBeDefined()
      expect(e!.articleOccurrence).toBe(d.articleOccurrence)
      expect(e!.articleContexte).toBe(d.articleContexte)
    }
  })

  it('distinguent les deux art. 172 et les deux art. 173, jusque dans le slug', () => {
    const a172 = ENTREES.filter((e) => e.code === 'TRAVAIL' && e.article === 'Art. 172')
    expect(a172).toHaveLength(2)
    expect(a172.map((e) => e.jours).sort((x, y) => (x ?? 0) - (y ?? 0))).toEqual([5, 10])
    expect(a172.map((e) => e.articleOccurrence).sort((x, y) => x - y)).toEqual([1, 3])
    expect(new Set(a172.map((e) => e.slug)).size).toBe(2)
  })
})

describe('§ 4.9 — A5 et A5-bis', () => {
  it('pose A5 sur 353, 1827 et 1952, et A5-bis sur le seul art. 229', () => {
    const a5 = ENTREES.filter((e) => e.avisDistance === 'A5')
    const a5bis = ENTREES.filter((e) => e.avisDistance === 'A5_BIS')
    expect(a5.map((e) => e.article).sort()).toEqual(['Art. 1827', 'Art. 1952', 'Art. 353'])
    expect(a5bis.map((e) => e.article)).toEqual(['Art. 229 (L. 5 mai 1949)'])
    // garde-fou : l'art. 229 ne dit pas « cinq lieues » — lui poser A5 lui ferait dire ce
    // qu'il ne dit pas, avec la citation qui le dément imprimée juste en dessous.
    expect(a5bis[0].dureeTexte).not.toMatch(/lieue/i)
    for (const e of a5) expect(e.dureeTexte).toMatch(/lieue/i)
  })

  it('CORRECTIF défaut 9 — les 3 entrées A5 portent la CITATION de leur article', () => {
    // Le gabarit du § 4.9 impose « un jour par cinq lieues ([citation de l'article]) », et
    // `construireEntrees` écrivait `citationArticle: null` en dur pour les 393 lignes : la
    // plateforme affirmait la règle en lieues sans produire la phrase qui la fonde.
    const a5 = ENTREES.filter((e) => e.avisDistance === 'A5')
    expect(a5).toHaveLength(3)
    for (const e of a5) {
      expect(e.citationArticle, e.slug).toBeTruthy()
      expect(e.citationArticle!, e.slug).toMatch(/lieue/i)
      // la citation vient du texte relu en BASE, pas du catalogue
      expect(e.citationArticle).toBe(CITATIONS_DISTANCE_LIEUES[e.article].citation)
      expect(e.citationArticle!.length).toBeGreaterThan(80)
    }
    // et A5-bis porte la sienne, qui ne dit PAS « lieues »
    const a5bis = ENTREES.find((e) => e.avisDistance === 'A5_BIS')!
    expect(a5bis.citationArticle).toBeTruthy()
    expect(a5bis.citationArticle!).not.toMatch(/lieue/i)
    expect(a5bis.citationArticle!).toContain('outre le délai de distance')
  })

  it('CORRECTIF défaut 9 — le calcul RÉEL, depuis le répertoire et non depuis une fixture', () => {
    // Le test A5 de `calcul.test.ts` employait la fixture `CIV_1827`, dont le
    // `citationArticle` est écrit à la main : il passait au vert sur le mauvais objet.
    for (const e of ENTREES.filter((x) => x.avisDistance === 'A5')) {
      const r = calculer({ depart: { y: 2026, m: 6, d: 4 }, entree: e })
      if (r.statut !== 'CALCUL') throw new Error(`calcul attendu pour ${e.slug}`)
      const a5 = r.avertissements.find((a) => a.cle === 'A5')
      expect(a5, e.slug).toBeDefined()
      expect(a5!.texte).toContain('un jour par cinq lieues')
      expect(a5!.texte).toContain(e.citationArticle!)
    }
  })

  it('le garde-fou est BLOQUANT : A5 sans citation en « lieue » arrête la graine', () => {
    const a5 = ENTREES.find((e) => e.avisDistance === 'A5')!
    const fautive = { ...a5, slug: 'civ-test-a5-sans-citation', citationArticle: null }
    expect(controler([...ENTREES, fautive]).some((x) => x.includes('civ-test-a5-sans-citation'))).toBe(
      true,
    )
    const vide = { ...a5, slug: 'civ-test-a5-citation-muette', citationArticle: 'Article sans le mot.' }
    expect(controler([...ENTREES, vide]).some((x) => x.includes('civ-test-a5-citation-muette'))).toBe(
      true,
    )
  })

  it('n’attribue A5 / A5-bis qu’aux entrées JOURS_DISTANCE_NON_CHIFFREE', () => {
    for (const e of ENTREES) {
      if (e.avisDistance) expect(e.kind).toBe('JOURS_DISTANCE_NON_CHIFFREE')
    }
  })

  it('donne DEUX kilométrages aux art. 517 et 586, un seul aux autres', () => {
    const deux = ENTREES.filter((e) => e.nbDistances === 2)
    expect(deux.map((e) => e.article).sort()).toEqual(['517', '517', '586'])
    const un = ENTREES.filter((e) => e.kind === 'JOURS_PLUS_DISTANCE_KM' && e.nbDistances === 1)
    expect(un).toHaveLength(11)
  })
})

describe('Le calendrier de la graine', () => {
  it('compte 16 + 5 = 21 lignes en version 1', () => {
    expect(CALENDRIER_V1.filter((e) => e.typeEntree === 'PERMANENT')).toHaveLength(16)
    expect(CALENDRIER_V1.filter((e) => e.typeEntree === 'A_SURVEILLER')).toHaveLength(5)
    expect(CALENDRIER_V1).toHaveLength(21)
  })
})

describe('Les douze contrôles bloquants du § 5.3', () => {
  it('passent tous, sans une anomalie', () => {
    expect(controler(ENTREES)).toEqual([])
  })

  it('attrapent une entrée CIVIL/FRANC qui affirme le régime sans le citer', () => {
    const fautive = {
      ...ENTREES.find((e) => e.code === 'CIVIL' && e.regime === 'FRANC')!,
      slug: 'civ-test-fautive',
      regimeIncertain: false,
      regimeFondement: 'l’article lui-même qualifie le délai de franc',
    }
    const anomalies = controler([...ENTREES, fautive])
    expect(anomalies.some((a) => a.includes('civ-test-fautive'))).toBe(true)
  })

  it('attrapent un slug en double', () => {
    const clone = { ...ENTREES[0] }
    const anomalies = controler([...ENTREES, clone])
    expect(anomalies.some((a) => a.startsWith('slug en double'))).toBe(true)
  })

  it('attrapent une ligne A_VERIFIER qui se mettrait à calculer', () => {
    const calculable = ENTREES.find((e) => kindCalcule(e.kind))!
    const fautive = { ...calculable, slug: 'cpc-test-averifier', regime: 'A_VERIFIER' as const }
    const anomalies = controler([...ENTREES, fautive])
    expect(anomalies.some((a) => a.includes('cpc-test-averifier'))).toBe(true)
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * **CE QUE L'AVOCATE LIT N'EST PAS UN BROUILLON.** (20 août 2026.)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Sept fiches — la transcription du jugement de divorce (Code civil) et les six délais du
 * Code du travail dont la qualification n'est pas acquise — portaient, DANS LE TEXTE AFFICHÉ
 * sous la date, une note de travail : « L'entrée est donc marquée `regimeIncertain: true` …
 * À faire trancher par la rédaction (§ 13, point 4/5). » Le fond était honnête, et c'est sa
 * qualité ; la forme donnait à lire un nom de champ technique et le renvoi à un paragraphe
 * d'une spécification interne.
 *
 * ⚠️ **CES SEPT LIGNES SONT AUSSI EN BASE DE PRODUCTION** (vérifié le 20 août 2026 :
 * `regimeIncertain: true`, 7 entrées, statut `visible`). Corriger la graine corrige la SOURCE ;
 * les sept lignes déjà versées demandent une mise à jour décidée par la rédaction — la graine
 * refuse d'écraser une table peuplée (§ 5.2).
 */
describe('les fondements affichés sont écrits pour une avocate, pas pour la rédaction', () => {
  /** Tout ce qu'une fiche publiée ne doit jamais montrer. */
  const JARGON: [string, RegExp][] = [
    ['un nom de champ du modèle', /regimeIncertain|prorogation991|teteAffiche|motifRefus/],
    ['un identifiant entre accents graves', /`/],
    ['un renvoi à la spécification', /§\s*\d/],
    ['une consigne interne', /à faire trancher par la rédaction/i],
  ]

  it('aucun des 393 fondements de régime ne porte de jargon de code', () => {
    for (const e of ENTREES) {
      for (const [quoi, motif] of JARGON) {
        expect(e.regimeFondement, `${e.slug} — ${quoi}`).not.toMatch(motif)
      }
    }
  })

  it('… ni aucun des 393 fondements de prorogation, ni aucun motif de refus', () => {
    for (const e of ENTREES) {
      for (const [quoi, motif] of JARGON) {
        expect(e.prorogationFondement, `${e.slug} — ${quoi}`).not.toMatch(motif)
        if (e.motifRefusFr) expect(e.motifRefusFr, `${e.slug} — ${quoi}`).not.toMatch(motif)
      }
    }
  })

  /** Les SEPT, nommément : elles disent ce qu'on sait, ce qu'on ignore, et ce qui reste à faire. */
  it('les sept fiches au régime douteux disent les trois choses, dans les mots du métier', () => {
    const douteuses = ENTREES.filter((e) => e.regimeIncertain)
    expect(douteuses).toHaveLength(7)
    expect(douteuses.filter((e) => e.code === 'TRAVAIL')).toHaveLength(6)
    expect(douteuses.filter((e) => e.code === 'CIVIL')).toHaveLength(1)
    for (const e of douteuses) {
      // 1. ce que la plateforme A FAIT : elle a retenu la date la plus précoce ;
      expect(e.regimeFondement, e.slug).toContain('la date la plus précoce')
      // 2. ce qu'elle NE TRANCHE PAS ;
      expect(e.regimeFondement, e.slug).toMatch(/ne tranche (pas|donc pas)/)
      // 3. ce qui revient à l'avocate — la seconde date, et à quelle condition.
      expect(e.regimeFondement, e.slug).toMatch(/vous engage/)
    }
  })

  /**
   * La citation de l'art. 511 était ALTÉRÉE (« Tous les délais DE PROCÉDURE… ») : l'article
   * écrit « de procédure » en bas de casse, relu en base. Une plateforme ne publie pas une
   * version d'un texte qui n'a jamais paru — l'insistance appartient à sa propre phrase.
   */
  it('la citation de l’art. 511 est rendue mot pour mot, l’insistance reste hors guillemets', () => {
    const travail = ENTREES.filter((e) => e.regimeIncertain && e.code === 'TRAVAIL')
    for (const e of travail) {
      expect(e.regimeFondement, e.slug).toContain(
        '« Tous les délais de procédure prévus au Code du Travail sont francs. »',
      )
      expect(e.regimeFondement, e.slug).not.toContain('« Tous les délais DE PROCÉDURE')
      expect(e.regimeFondement, e.slug).toContain('délais DE PROCÉDURE')
    }
  })

  /** ⚠️ Le garde-fou du § 4.7 doit tenir malgré la réécriture : pas de citation fabriquée. */
  it('la réécriture ne fait pas passer la fiche civile pour citée', () => {
    const divorce = ENTREES.find((e) => e.regimeIncertain && e.code === 'CIVIL')!
    expect(citationDeFranc(divorce.regimeFondement).citation).toBeNull()
    expect(controler(ENTREES).filter((a) => a.includes(divorce.slug))).toHaveLength(0)
  })
})
