/**
 * § 8.2 — **LE RAISONNEMENT SORT DANS LA LANGUE DEMANDÉE**, pas seulement les dates.
 *
 * Le défaut que ce fichier attrape est passé par un trou précis : **aucun des 1 219 tests ne
 * rendait le calculateur en `en` ni en `ht`.** Le moteur ne produisait qu'un champ français
 * (`texteFr`, `phraseSecuriteFr`, `TEXTE_A1`…), et `/en/delais` rendait des phrases hybrides —
 * « Agir au plus tard le Monday 6 July 2026 est sûr sous toutes les lectures du texte. »
 *
 * Le § 8.2 ferme la liste de ce qui n'est JAMAIS traduit : `dureeTexte`, les citations
 * d'articles, les extraits d'arrêts. Le raisonnement n'en fait pas partie — et l'exigence
 * d'avoir les noms de mois et de jours en trois langues n'a de sens que si la phrase qui les
 * entoure l'est aussi.
 */
import { describe, expect, it } from 'vitest'
import { CALENDRIER_V1 } from './feries'
import { REPERTOIRE, construireEntrees } from './repertoire'
import { calculer } from './calcul'
import { phrases } from './phrases'
import { CHOMAGE_PAR_ARRETE_PAR_CODE, FONDEMENT_REGIME_PAR_CODE } from './regimes'
import type { Locale } from './format'

const ENTREES = construireEntrees(REPERTOIRE)
const ART_354 = ENTREES.find((e) => e.slug === 'cpc-354-appel-parties-demeurant-haiti')!

/** Le gabarit vérifié du § 6.3 : 4 juin 2026, art. 354, 30 jours francs. */
function gabarit(locale: Locale) {
  const r = calculer({
    depart: { y: 2026, m: 6, d: 4 },
    entree: ART_354,
    km: [],
    versionCalendrier: 1,
    entreesCalendrier: CALENDRIER_V1,
    locale,
  })
  if (r.statut !== 'CALCUL') throw new Error('calcul attendu')
  return r
}

/** Les mots français que le raisonnement ne doit PLUS contenir hors citation. */
const MOTS_FRANCAIS = [
  'Agir au plus tard',
  'Point de départ',
  'Le jour du départ ne se compte pas',
  'Dernier jour compté',
  'aucune autre prorogation',
  'La plateforme ne connaît pas ces arrêtés',
]

describe('§ 8.2 — les trois langues du raisonnement', () => {
  it('la phrase de sécurité change de langue', () => {
    expect(gabarit('fr').phraseSecurite).toContain('est sûr sous toutes les lectures')
    expect(gabarit('en').phraseSecurite).toContain('is safe under every reading')
    expect(gabarit('ht').phraseSecurite).toContain('anba tout lekti tèks la')
  })

  it('les huit étapes changent de langue', () => {
    const en = gabarit('en').etapes
    expect(en[0].texte).toContain('Starting point')
    expect(en[1].texte).toContain('The starting day is not counted')
    expect(en.at(-1)!.texte).toContain('no further extension')

    const ht = gabarit('ht').etapes
    expect(ht[0].texte).toContain('Pwen depa')
    expect(ht[1].texte).toContain('Jou depa a pa konte')
  })

  it('A1 et A3 changent de langue', () => {
    const en = gabarit('en').avertissements
    expect(en.find((a) => a.cle === 'A1')!.texte).toContain('An order of the President')
    expect(en.find((a) => a.cle === 'A3')!.texte).toContain('guarantees no appeal period')

    const ht = gabarit('ht').avertissements
    expect(ht.find((a) => a.cle === 'A1')!.texte).toContain('arete Prezidan Repiblik la')
    expect(ht.find((a) => a.cle === 'A3')!.texte).toContain('pa garanti okenn delè rekou')
  })

  it('le motif d’un jour écarté change de langue — « Dimanche », pas seulement la date', () => {
    expect(gabarit('fr').joursEcartes[0].motifs[0].libelle).toBe('Dimanche')
    expect(gabarit('en').joursEcartes[0].motifs[0].libelle).toBe('Sunday')
    expect(gabarit('ht').joursEcartes[0].motifs[0].libelle).toBe('Dimanch')
  })

  it('AUCUN mot français ne subsiste dans le raisonnement anglais', () => {
    const r = gabarit('en')
    const corps = [
      r.phraseSecurite,
      ...r.etapes.map((e) => e.texte),
      ...r.avertissements.map((a) => a.texte),
    ].join('\n')
    for (const mot of MOTS_FRANCAIS) expect(corps, mot).not.toContain(mot)
  })

  it('… mais les CITATIONS d’articles restent en français, mot pour mot (§ 8.2)', () => {
    const r = gabarit('en')
    const duree = r.etapes.find((e) => e.cle === 'duree')!
    // `dureeTexte` et le fondement du régime sont des citations : jamais traduits.
    expect(duree.texte).toContain('30 jours francs')
    expect(duree.texte).toContain('Tous les délais prévus au Code de procédure civile sont francs')
    // Les références aussi : c'est sous cette forme qu'un juge haïtien les lit.
    expect(r.etapes[1].texte).toContain('C. pr. civ., art. 987')
  })

  it('un refus se motive dans la langue demandée', () => {
    const nonCalculable = { ...ART_354, kind: 'MOIS' as const, motifRefusFr: null }
    const r = calculer({
      depart: { y: 2026, m: 6, d: 4 },
      entree: nonCalculable,
      versionCalendrier: 1,
      entreesCalendrier: CALENDRIER_V1,
      locale: 'en',
    })
    expect(r.statut).toBe('REFUS')
    if (r.statut !== 'REFUS') return
    expect(r.motif).toContain('cannot be computed in days')
    expect(r.regimeAffiche).not.toContain('Délai')
  })

  /**
   * ⚠️ **CE TEST PORTAIT SUR « R3 · Prorogation en cascade », RETIRÉE LE 20 AOÛT 2026 (SOIR).**
   * Me Vaval a répondu OUI à la cascade : ce n'est plus une lecture concurrente, c'est la règle,
   * et la table n'en garde que TROIS clés. On éprouve donc la traduction sur celles qui restent
   * — dont `PROROGATION_991`, qui ne partira pas : le Code civil n'a pas de clause de
   * prorogation, et cette question-là n'a pas été tranchée.
   */
  it('les lectures nommées portent leur libellé et leur fondement traduits', () => {
    const p = phrases('en')
    // ⚠️ `REGIME_FRANC` a QUITTÉ cette table le 20 août 2026 : son fondement dépend du code de
    // la fiche, et une table fixe ne peut pas le porter. Voir `lectureRegimeFranc` ci-dessous.
    expect(Object.keys(p.lectures).sort()).toEqual(['CUMUL', 'DEMI_JOURNEE', 'PROROGATION_991'])
    expect(p.lectures.PROROGATION_991.libelle).toBe('If article 991 C. pr. civ. applies to this period')
    expect(phrases('ht').lectures.PROROGATION_991.libelle).toBe(
      'Si atik 991 C. pr. civ. aplike pou delè sa a',
    )
  })

  /**
   * § 4.6 — la BORNE de cascade N'EST PLUS UNE CONSÉQUENCE, C'EST UN REFUS (défaut 5 de la
   * troisième recette). `consequenceCascadeBornee` écrivait « la plateforme s'arrête là et ne
   * calcule pas au-delà » **sous une date que la plateforme affichait quand même** en gros
   * caractères. La phrase de refus, elle, ne s'accompagne d'aucune date.
   */
  it('la borne de la cascade est un REFUS, phrasé dans les trois langues, sans réserve R3', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      const texte = phrases(l).refusCascadeBornee(10)
      expect(texte, l).toContain('10')
      expect(texte, l).not.toContain('R3')
    }
    expect(phrases('fr').refusCascadeBornee(10)).toContain('répété')
    expect(phrases('en').refusCascadeBornee(10)).toContain('repeated')
    expect(phrases('ht').refusCascadeBornee(10)).toContain('repete')
  })

  /** § 4.6 — le refus d'une version de règles absente du registre (défaut 12). */
  it('une version de règles inconnue a sa phrase de refus dans les trois langues', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      expect(phrases(l).refusReglesInconnues('7'), l).toContain('7')
    }
  })

  /** § 4.6 — la lecture `DEMI_JOURNEE`, ouverte le 20 août 2026 au soir (défaut 2). */
  it('la lecture DEMI_JOURNEE est libellée et fondée dans les trois langues', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      const dj = phrases(l).lectures.DEMI_JOURNEE
      expect(dj.libelle.length, l).toBeGreaterThan(20)
      expect(dj.fondement, l).toContain('2, 1°')
      expect(dj.fondement.length, l).toBeGreaterThan(80)
    }
  })
})

/**
 * § 4.13 — L'ÉTAPE FINALE NE RENVOIE PAS À UN BLOC VIDE. Un jour À SURVEILLER ne produit,
 * par construction, AUCUNE lecture nommée : l'étape invitait pourtant à « voir les lectures
 * nommées », et le bloc suivant affichait « Aucune lecture concurrente ne donne une date
 * différente ». L'avocate cherchait un bloc que l'écran lui disait vide.
 */
describe('§ 4.13 — « voir les lectures nommées » ne s’écrit que s’il y en a', () => {
  function surLeMercrediDesCendres(locale: Locale = 'fr') {
    // Départ samedi 9 janvier 2027 → échéance mardi 9 février (Mardi Gras, fête légale du
    // décret de 1989) → prorogation d'un jour → mercredi 10 février, MERCREDI DES CENDRES,
    // qui est un jour À SURVEILLER : il avertit (A6) et ne produit aucune lecture nommée.
    const r = calculer({
      depart: { y: 2027, m: 1, d: 9 },
      entree: ART_354,
      versionCalendrier: 1,
      entreesCalendrier: CALENDRIER_V1,
      locale,
    })
    if (r.statut !== 'CALCUL') throw new Error('calcul attendu')
    return r
  }

  it('le jour à surveiller déclenche bien A6 et AUCUNE lecture', () => {
    const r = surLeMercrediDesCendres()
    expect(r.lectures).toHaveLength(0)
    expect(r.avertissements.some((a) => a.cle === 'A6')).toBe(true)
  })

  it('l’étape finale renvoie alors aux SEULS avertissements', () => {
    const derniere = surLeMercrediDesCendres().etapes.at(-1)!
    expect(derniere.cle).toBe('finale-calendrier')
    expect(derniere.texte).toContain('voir les avertissements ci-dessous')
    expect(derniere.texte).not.toContain('lectures nommées')
  })

  it('§ 4.13, exigence 4 — A6 porte sa recherche en DONNÉE, pas en crochets dans la phrase', () => {
    const a6 = surLeMercrediDesCendres().avertissements.find((a) => a.cle === 'A6')!
    expect(a6.rechercheQ).toBeTruthy()
    expect(a6.rechercheLibelle).toContain('Rechercher')
    // Les crochets typographiques inertes ont disparu du texte.
    expect(a6.texte).not.toContain('[Rechercher')
    expect(phrases('en').a6Recherche('carnaval')).toBe('Search “carnaval” in the corpus')
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * § 4.13 — **L'ARRÊTÉ DE CHÔMAGE EST À L'ALINÉA 4.** (20 août 2026.)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * L'art. 991 C. pr. civ., relu en base alinéa par alinéa, en a QUATRE : l'al. 3 proroge « si le
 * dernier est un dimanche ou un jour de fête légale », et c'est l'**al. 4**, et lui seul, qui
 * ajoute « Il en est de même lorsque, au dernier jour, le chômage est prescrit par arrêté du
 * Président de la République. » L'avertissement A6 servait la phrase de l'al. 4 sous la
 * référence de l'al. 3 — à chaque échéance tombant sur les Cendres, le Jeudi Saint,
 * l'Ascension, le 7 février ou le 24 octobre, sur l'écran d'où une avocate recopie une
 * référence dans une assignation.
 */
describe('§ 4.13 — A6 cite l’alinéa qui porte le chômage par arrêté, et pas un autre', () => {
  it('la table de régime nomme l’al. 4 pour le C. pr. civ., l’al. 2 pour le C. trav.', () => {
    expect(CHOMAGE_PAR_ARRETE_PAR_CODE.CPC.article).toBe('C. pr. civ., art. 991 al. 4')
    expect(CHOMAGE_PAR_ARRETE_PAR_CODE.CIVIL.article).toBe('C. pr. civ., art. 991 al. 4')
    // ⚠️ Le Code du travail ne coupe PAS : son al. 2 porte les trois cas d'un seul tenant.
    expect(CHOMAGE_PAR_ARRETE_PAR_CODE.TRAVAIL.article).toBe('C. trav., art. 511 al. 2')
  })

  it('chaque citation est celle de SON code, mot pour mot — jamais celle de l’autre', () => {
    expect(CHOMAGE_PAR_ARRETE_PAR_CODE.CPC.citation).toBe(
      '« Il en est de même lorsque, au dernier jour, le chômage est prescrit par arrêté du Président de la République. »',
    )
    expect(CHOMAGE_PAR_ARRETE_PAR_CODE.TRAVAIL.citation).toContain('ou prescrit par Arrêté Présidentiel')
    expect(CHOMAGE_PAR_ARRETE_PAR_CODE.TRAVAIL.citation).not.toContain('Il en est de même')
  })

  /** Le défaut, tel qu'il s'affichait : « art. 991 al. 3 … le chômage est prescrit par arrêté ». */
  it('AUCUNE des trois langues n’attache la phrase de l’arrêté à l’al. 3', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      const cpc = phrases(l).a6Phrase3({
        annee: 2027,
        date: 'X',
        source: CHOMAGE_PAR_ARRETE_PAR_CODE.CPC.article,
        citation: CHOMAGE_PAR_ARRETE_PAR_CODE.CPC.citation,
      })
      expect(cpc, l).toContain('art. 991 al. 4')
      expect(cpc, l).not.toContain('al. 3')
      expect(cpc, l).toContain('le chômage est prescrit par arrêté du Président de la République')
      // La numérotation inventée (« troisième cas ») ne revient pas non plus : aucun texte ne
      // numérote ce cas-là, et l'arrêt Brown and Root le compte pour le SECOND.
      expect(cpc.toLowerCase(), l).not.toContain('troisième cas')
      expect(cpc.toLowerCase(), l).not.toContain('third case')
      expect(cpc.toLowerCase(), l).not.toContain('twazyèm ka')
    }
  })

  /** Le chemin réel : le moteur, sur un jour à surveiller, en matière civile puis de travail. */
  it('le moteur écrit l’al. 4 dans A6 — et l’art. 511 al. 2 sur une fiche de travail', () => {
    const surveille = (entree: typeof ART_354) => {
      const r = calculer({
        depart: { y: 2027, m: 1, d: 9 },
        entree,
        versionCalendrier: 1,
        entreesCalendrier: CALENDRIER_V1,
        locale: 'fr',
      })
      if (r.statut !== 'CALCUL') throw new Error('calcul attendu')
      return r.avertissements.find((a) => a.cle === 'A6')!.texte
    }
    const cpc = surveille(ART_354)
    expect(cpc).toContain('C. pr. civ., art. 991 al. 4')
    expect(cpc).toContain('le chômage est prescrit par arrêté du Président de la République')

    const travail = surveille({ ...ART_354, code: 'TRAVAIL' as const })
    expect(travail).toContain('C. trav., art. 511 al. 2')
    expect(travail).toContain('ou prescrit par Arrêté Présidentiel')
    // Et surtout : les mots du Code de procédure civile ne partent pas sur une fiche de travail.
    expect(travail).not.toContain('Il en est de même')
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * § 4.6 — **UN DÉLAI DU CODE CIVIL NE SE FONDE PAS SUR LE CODE DU TRAVAIL.** (20 août 2026.)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * La lecture nommée `REGIME_FRANC` citait « C. trav., art. 511 » quel que soit le code de la
 * fiche. Elle s'ouvre pourtant sur la **transcription du jugement de divorce** — un délai du
 * CODE CIVIL, la seule des six entrées civiles déclarées franches dont le corpus ne porte
 * aucune phrase. La date restait juste ; le fondement affiché, non.
 */
describe('§ 4.6 — la lecture REGIME_FRANC se fonde sur le code de la fiche', () => {
  const lecture = (code: 'CPC' | 'TRAVAIL' | 'CIVIL', l: Locale = 'fr') =>
    phrases(l).lectureRegimeFranc({ code, fondementDuCode: FONDEMENT_REGIME_PAR_CODE[code] })

  it('le fondement vient de FONDEMENT_REGIME_PAR_CODE — pas d’une seconde copie', () => {
    for (const code of ['CPC', 'TRAVAIL', 'CIVIL'] as const) {
      for (const l of ['fr', 'en', 'ht'] as const) {
        expect(lecture(code, l).fondement, `${code}/${l}`).toContain(FONDEMENT_REGIME_PAR_CODE[code])
      }
    }
  })

  it('une fiche du CODE CIVIL n’invoque plus l’art. 511 du Code du travail', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      expect(lecture('CIVIL', l).fondement, l).not.toContain('511')
      expect(lecture('CIVIL', l).fondement, l).not.toContain('Code du Travail')
      expect(lecture('CIVIL', l).libelle, l).not.toMatch(/procédur|procedural|pwosedi/i)
    }
    // Et les fiches de travail, elles, le gardent : c'est bien leur article.
    expect(lecture('TRAVAIL').fondement).toContain('C. trav., art. 511')
    expect(lecture('CPC').fondement).toContain('C. pr. civ., art. 987')
  })

  /**
   * Le chemin réel : la transcription du divorce, seule entrée CIVIL du répertoire à ouvrir
   * cette lecture. ⚠️ La DATE ne doit pas bouger — c'est le fondement qui était faux.
   */
  it('sur la transcription du jugement de divorce, l’écran cite le Code civil', () => {
    const divorce = ENTREES.find((e) => e.code === 'CIVIL' && e.regimeIncertain)!
    const r = calculer({
      depart: { y: 2026, m: 6, d: 4 },
      entree: divorce,
      versionCalendrier: 1,
      entreesCalendrier: CALENDRIER_V1,
      locale: 'fr',
    })
    if (r.statut !== 'CALCUL') throw new Error('calcul attendu')
    const franc = r.lectures.find((x) => x.cle === 'REGIME_FRANC')!
    expect(franc.fondement).toContain('Code civil')
    expect(franc.fondement).not.toContain('Code du Travail')
    expect(franc.fondement).not.toContain('511')
  })

  /**
   * ⚠️ **LA MÊME FAUTE, D'UN CRAN PLUS BAS : LE FONDEMENT CIVIL EST DE LA PROSE, PAS UNE
   * CITATION.** (21 août 2026.) Le correctif ci-dessus a fait suivre au fondement le code de la
   * fiche — mais en injectant `FONDEMENT_REGIME_PAR_CODE[code]`, qui pour `CIVIL` n'est PAS la
   * lettre d'un article : c'est un constat de la rédaction, et il n'existait qu'en français. La
   * fiche du divorce ouvrait donc son raisonnement, sur `/en` et `/ht`, par « Aucune règle
   * générale de computation au Code civil… » suivi de la suite en anglais ou en créole.
   *
   * Les deux autres codes gardent leur français : c'est la LETTRE de l'art. 987 et de l'art.
   * 511, et une citation ne se traduit pas (§ 8.2, règle 1). Le partage est là, et ce test le
   * tient dans les deux sens — sans quoi « traduire » finirait par traduire les articles.
   */
  it('le constat civil est traduit, la lettre des articles ne l’est pas', () => {
    const divorce = ENTREES.find((e) => e.code === 'CIVIL' && e.regimeIncertain)!
    const fondementSurEcran = (locale: Locale) => {
      const r = calculer({
        depart: { y: 2026, m: 6, d: 4 },
        entree: divorce,
        versionCalendrier: 1,
        entreesCalendrier: CALENDRIER_V1,
        locale,
      })
      if (r.statut !== 'CALCUL') throw new Error('calcul attendu')
      return r.lectures.find((x) => x.cle === 'REGIME_FRANC')!.fondement
    }

    // 1 · La version française EST la table — importée, jamais recopiée.
    expect(phrases('fr').fondementRegimeCivil).toBe(FONDEMENT_REGIME_PAR_CODE.CIVIL)

    // 2 · Sur l'écran, chaque langue porte SA phrase, et pas celle des deux autres.
    for (const l of ['fr', 'en', 'ht'] as const) {
      expect(fondementSurEcran(l), l).toContain(phrases(l).fondementRegimeCivil)
    }
    for (const l of ['en', 'ht'] as const) {
      expect(fondementSurEcran(l), l).not.toContain(FONDEMENT_REGIME_PAR_CODE.CIVIL)
      expect(fondementSurEcran(l), l).not.toContain('Aucune règle générale')
      expect(fondementSurEcran(l), l).not.toContain('jour de l’échéance compte')
    }

    // 3 · Les trois disent la même chose : le jour de l'échéance compte.
    expect(phrases('en').fondementRegimeCivil).toMatch(/day of expiry counts/i)
    expect(phrases('ht').fondementRegimeCivil).toMatch(/jou echeyans la konte/i)

    // 4 · ET LE PARTAGE TIENT DANS L'AUTRE SENS : la lettre des articles reste en français.
    for (const l of ['en', 'ht'] as const) {
      const cpc = phrases(l).lectureRegimeFranc({
        code: 'CPC',
        fondementDuCode: FONDEMENT_REGIME_PAR_CODE.CPC,
      })
      expect(cpc.fondement, l).toContain('Tous les délais prévus au Code de procédure civile')
    }
  })

  /** § 4.12 — le genre « Autre » n'a pas de code : il ne cite AUCUN article, dans les 3 langues. */
  it('le nombre saisi à la main renvoie à VOTRE texte, et il est traduit', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      const a = phrases(l).lectureRegimeFrancAutre
      expect(a.fondement.length, l).toBeGreaterThan(80)
      expect(a.fondement, l).not.toContain('511')
      expect(a.fondement, l).not.toContain('987')
    }
    expect(phrases('fr').lectureRegimeFrancAutre.fondement).toContain('Vérifiez')
    expect(phrases('en').lectureRegimeFrancAutre.fondement).toContain('Check')
    expect(phrases('ht').lectureRegimeFrancAutre.fondement).toContain('Verifye')
  })
})
