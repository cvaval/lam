/**
 * § 9 — blocs 1, 2, 3, 8, 9, 10, 11 et 16.
 *
 * Le bloc 1 est le cœur du produit : si les six arrêts cassent, rien ne se livre.
 * Toutes les dates de ce fichier ont été recalculées au jour de la semaine.
 */
import { describe, expect, it } from 'vitest'
import type { CivilDate } from './civil'
import { addDays, dayOfWeek, estDimanche, formatIso, fromJdn, parseIso, toJdn } from './civil'
import type { EntreeDelai, ResultatCalcul } from './calcul'
import { articleAffiche, calculer, joursDeDistance, kindCalcule } from './calcul'
import type { EntreeCalendrier } from './feries'
import { CALENDRIER_COURANT, CALENDRIER_V1, entreesDuJour } from './feries'
import { REPERTOIRE, construireEntrees } from './repertoire'
import { CITATIONS_DUREE_AILLEURS } from './textes'
import { VERSION_REGLES_COURANTE } from './regles-lecture'
import {
  CIV_1827,
  CIV_229,
  CIV_28,
  CIV_LOI_10,
  CPC_354,
  CPC_417_ETRANGER,
  CPC_424,
  CPC_425,
  CPC_517,
  CPC_GERMEIL,
  REFUS_ANNEES,
  REFUS_FOURCHETTE,
  REFUS_HEURES,
  REFUS_MOIS,
  REFUS_REBOURS,
  REGIME_A_VERIFIER_CALCULABLE,
  TRAV_172_DOUTEUX,
  TRAV_507,
  autre,
} from './fixtures'

/** Toutes les entrées de référence — l'aperçu obligatoire du back-office les montre (§ 7.1). */
const TOUTES_FIXTURES: readonly EntreeDelai[] = [
  CPC_354,
  CPC_424,
  CPC_417_ETRANGER,
  CPC_425,
  CPC_GERMEIL,
  CPC_517,
  TRAV_507,
  TRAV_172_DOUTEUX,
  CIV_28,
  CIV_LOI_10,
  CIV_229,
  CIV_1827,
  REFUS_HEURES,
  REFUS_MOIS,
  REFUS_ANNEES,
  REFUS_FOURCHETTE,
  REFUS_REBOURS,
  REGIME_A_VERIFIER_CALCULABLE,
]

const d = (iso: string): CivilDate => {
  const v = parseIso(iso)
  if (!v) throw new Error(`date de test impossible : ${iso}`)
  return v
}

/** Les six arrêts contournent la borne historique par DEUX paramètres. Les deux sont requis. */
const HISTORIQUE = { ignorerBorneHistorique: true, calendrierVide: true } as const

function calcul(params: Parameters<typeof calculer>[0]): ResultatCalcul {
  const r = calculer(params)
  if (r.statut !== 'CALCUL') {
    throw new Error(`calcul attendu, obtenu ${r.statut} : ${JSON.stringify(r)}`)
  }
  return r
}

// ===========================================================================
// BLOC 1 — LES SIX ARRÊTS DE LA COUR DE CASSATION
// ===========================================================================

describe('Bloc 1 — les six arrêts', () => {
  it('Cass. 1re Sect. n° 45, 7 juil. 1965 — Germeil c. Aubourg', () => {
    // 30 jours francs + 6 jours de distance (267 km), chiffres DONNÉS par l'arrêt.
    const r = calcul({ depart: d('1962-05-17'), entree: CPC_GERMEIL, km: [267], ...HISTORIQUE })
    expect(r.joursDistance).toBe(6)
    expect(formatIso(r.teteAffiche)).toBe('1962-06-23')
    expect(dayOfWeek(r.teteAffiche)).toBe(6) // samedi, sans aucun report
  })

  it('Cass. 2e Sect. n° 45, 29 juil. 1965 — art. 424, « justement les huit jours francs »', () => {
    const r = calcul({ depart: d('1962-06-25'), entree: CPC_424, ...HISTORIQUE })
    expect(formatIso(r.teteAffiche)).toBe('1962-07-04')
    expect(dayOfWeek(r.teteAffiche)).toBe(3) // mercredi
  })

  it('Cass. 2e Sect. n° 3, 9 déc. 1965 — Prophète, distance renoncée', () => {
    // « le délai légal de trente jours échu le 11 Juin 1962 ». Le dernier jour COMPTÉ était le
    // dimanche 10 juin : la Cour n'a pas prorogé à ce titre (§ 2.7 b).
    const r = calcul({ depart: d('1962-05-11'), entree: CPC_354, ...HISTORIQUE })
    expect(formatIso(r.dernierJourCompte)).toBe('1962-06-10')
    expect(dayOfWeek(r.dernierJourCompte)).toBe(0)
    expect(formatIso(r.teteAffiche)).toBe('1962-06-11')
    expect(dayOfWeek(r.teteAffiche)).toBe(1) // lundi
  })

  it('Cass. 1re Sect. n° 13, 28 mars 1966 — Brown and Root : 30 + 30 font UNE période franche', () => {
    // ARTICLES RECONSTITUÉS — l'arrêt nomme l'art. 922 (ancienne numérotation) et la formule
    // « continent américain » ; il ne nomme NI l'art. 417 NI l'art. 74. Ce qui est probant,
    // c'est l'arithmétique et la règle : 2 sept. + 30 + 30 + UN jour = 2 nov., pas + 2.
    const r = calcul({
      depart: d('1963-09-02'),
      entree: CPC_417_ETRANGER,
      supplementCle: 'antilles',
      ...HISTORIQUE,
    })
    expect(r.joursBase + r.joursSupplement).toBe(60)
    expect(formatIso(r.dernierJourCompte)).toBe('1963-11-01')
    expect(formatIso(r.teteAffiche)).toBe('1963-11-02')
    expect(dayOfWeek(r.teteAffiche)).toBe(6) // samedi : aucun report
    // + 2 donnerait le 3 novembre. Le test le dit explicitement.
    expect(formatIso(r.teteAffiche)).not.toBe('1963-11-03')
  })

  it('Cass. 1re Sect. n° 16, 16 mai 1966 — Compère (distance reconstituée)', () => {
    // L'arrêt dit « compte tenu du délai de distance », SANS donner un seul kilomètre. Deux
    // reconstitutions tombent sur la même date : 20 j + 7 j + 1 = lundi 1er juin 1964 ; ou
    // 20 j + 6 j + 1 = dimanche 31 mai, prorogé au lundi 1er juin. On écrit la seconde, qui
    // exerce la prorogation du dimanche. Ce cas contrôle LA DATE FINALE, pas la formule de
    // distance — celle-ci est contrôlée par Germeil et par le bloc 2.
    const r = calcul({
      depart: d('1964-05-04'),
      entree: CPC_425,
      distanceJours: 6,
      ...HISTORIQUE,
    })
    expect(formatIso(r.echeance)).toBe('1964-05-31')
    expect(dayOfWeek(r.echeance)).toBe(0)
    expect(formatIso(r.teteAffiche)).toBe('1964-06-01')
    expect(dayOfWeek(r.teteAffiche)).toBe(1) // lundi
  })

  it('Cass. 1re Sect. n° 37, 10 mai 1965 — Jean-Baptiste c. Kébreau (distance reconstituée)', () => {
    // Même remarque : 20 j + 2 j + 1 = lundi 16 juillet 1962 ; ou 20 j + 1 j + 1 = dimanche
    // 15 juillet, prorogé au lundi 16. On écrit la seconde.
    const r = calcul({
      depart: d('1962-06-23'),
      entree: CPC_425,
      distanceJours: 1,
      ...HISTORIQUE,
    })
    expect(formatIso(r.echeance)).toBe('1962-07-15')
    expect(formatIso(r.teteAffiche)).toBe('1962-07-16')
    expect(dayOfWeek(r.teteAffiche)).toBe(1) // lundi
  })

  it('les deux paramètres de contournement, et le SECOND garde-fou du calendrier', () => {
    // Le § 4.3 prévoyait que `ignorerBorneHistorique` seul prorogerait Brown and Root au
    // dimanche 3 novembre 1963, le 2 novembre étant fête légale au calendrier v1. Ce n'est
    // pas le cas ici, et c'est VOULU : chaque entrée du calendrier porte `appliqueDepuis:
    // '1989-06-22'` et `entreesDuJour` l'applique. Le calendrier est horodaté (§ 4.3) — « un
    // calculateur qui applique la liste de 2026 à un délai de 1987 se trompe ». Il y a donc
    // DEUX garde-fous, et le test le constate au lieu de le supposer.
    const sansCalendrierVide = calcul({
      depart: d('1963-09-02'),
      entree: CPC_417_ETRANGER,
      supplementCle: 'antilles',
      ignorerBorneHistorique: true,
    })
    expect(formatIso(sansCalendrierVide.teteAffiche)).toBe('1963-11-02')
    expect(entreesDuJour(d('1963-11-02'), CALENDRIER_V1)).toHaveLength(0)

    // `calendrierVide` seul ne suffit pas non plus : la borne historique refuse.
    const sansIgnorer = calculer({
      depart: d('1963-09-02'),
      entree: CPC_417_ETRANGER,
      supplementCle: 'antilles',
      calendrierVide: true,
    })
    expect(sansIgnorer.statut).toBe('REFUS')

    // Et `calendrierVide` ne neutralise PAS le dimanche, qui est dans l'article lui-même :
    // c'est ce qui fait passer les arrêts n° 5 et n° 6.
    const jeanBaptiste = calcul({
      depart: d('1962-06-23'),
      entree: CPC_425,
      distanceJours: 1,
      ...HISTORIQUE,
    })
    expect(jeanBaptiste.joursEcartes).toHaveLength(1)
    expect(jeanBaptiste.joursEcartes[0].motifs[0].cle).toBe('DIMANCHE')
  })
})

// ===========================================================================
// BLOC 2 — LA DISTANCE
// ===========================================================================

describe('Bloc 2 — le délai de distance (art. 987)', () => {
  const TABLE: [number, number][] = [
    [0, 0],
    [29, 0],
    [30, 1],
    [39, 1],
    [40, 1],
    [69, 1],
    [70, 2],
    [267, 6],
    [269, 6],
    [270, 7],
    [309, 7],
    [310, 8],
  ]

  it('rend la table de vérité figée', () => {
    for (const [km, jours] of TABLE) expect(joursDeDistance(km)).toBe(jours)
  })

  it('documente le piège : Math.round et Math.ceil donnent 7 pour 267 km, notre fonction donne 6', () => {
    expect(Math.round(267 / 40)).toBe(7)
    expect(Math.ceil(267 / 40)).toBe(7)
    expect(joursDeDistance(267)).toBe(6)
    expect(joursDeDistance(267)).not.toBe(7)
  })

  it('convertit SÉPARÉMENT les deux distances des art. 517 et 586', () => {
    // 35 km → 1 jour ; 45 km → 1 jour ; total 2. Un champ unique (80 km) donnerait 2 aussi,
    // mais 29 + 29 le démontre : deux fois 0 d'un côté, 58 km → 1 jour de l'autre.
    const r = calcul({ depart: d('2026-06-04'), entree: CPC_517, km: [29, 29] })
    expect(r.detailDistance).toEqual([
      { km: 29, jours: 0 },
      { km: 29, jours: 0 },
    ])
    expect(r.joursDistance).toBe(0)
    expect(joursDeDistance(58)).toBe(1)

    const r2 = calcul({ depart: d('2026-06-04'), entree: CPC_517, km: [35, 45] })
    expect(r2.detailDistance).toEqual([
      { km: 35, jours: 1 },
      { km: 45, jours: 1 },
    ])
    expect(r2.joursDistance).toBe(2)
  })

  it('refuse de calculer tant que le ou les kilométrages ne sont pas saisis', () => {
    const r = calculer({ depart: d('2026-06-04'), entree: CPC_517, km: [35] })
    expect(r.statut).toBe('INCOMPLET')
    if (r.statut === 'INCOMPLET') expect(r.manque[0]).toContain('DEUX kilométrages')
  })
})

// ===========================================================================
// BLOC 3 — LE SAMEDI
// ===========================================================================

describe('Bloc 3 — le samedi n’est pas prorogé', () => {
  it('samedi 23 juin 1962 et samedi 2 novembre 1963 restent tels quels', () => {
    const germeil = calcul({ depart: d('1962-05-17'), entree: CPC_GERMEIL, km: [267], ...HISTORIQUE })
    expect(formatIso(germeil.teteAffiche)).toBe('1962-06-23')
    const brown = calcul({
      depart: d('1963-09-02'),
      entree: CPC_417_ETRANGER,
      supplementCle: 'antilles',
      ...HISTORIQUE,
    })
    expect(formatIso(brown.teteAffiche)).toBe('1963-11-02')
    expect(brown.joursEcartes).toHaveLength(0)
    expect(brown.etapes.some((e) => e.cle === 'finale-samedi')).toBe(true)
  })

  it('sur 1 000 dates tirées : un dernier jour utile samedi et non férié EST la date retenue', () => {
    const debut = toJdn({ y: 1990, m: 1, d: 1 })
    let vus = 0
    for (let i = 0; i < 1000; i++) {
      const depart = fromJdn(debut + (i * 37) % 18_000)
      const r = calcul({ depart, entree: CPC_354 })
      const echeance = r.echeance
      if (dayOfWeek(echeance) !== 6) continue
      // « samedi ET NON FÉRIÉ » : le 15 août 1992 est un samedi ET l'Assomption.
      if (entreesDuJour(echeance, CALENDRIER_V1).length > 0) continue
      vus++
      expect(formatIso(r.teteAffiche)).toBe(formatIso(echeance))
    }
    expect(vus).toBeGreaterThan(50) // le test doit réellement exercer des samedis
  })
})

// ===========================================================================
// BLOC 8 — LES REFUS
// ===========================================================================

describe('Bloc 8 — les refus : aucune date en sortie, pas même deux', () => {
  for (const entree of [REFUS_HEURES, REFUS_MOIS, REFUS_ANNEES, REFUS_FOURCHETTE, REFUS_REBOURS]) {
    it(`refuse ${entree.kind} — ${entree.article}`, () => {
      const r = calculer({ depart: d('2026-06-04'), entree })
      expect(r.statut).toBe('REFUS')
      if (r.statut !== 'REFUS') return
      expect(r.cle).toBe('GENRE_NON_CALCULABLE')
      expect(r.motif.length).toBeGreaterThan(30)
      expect(r.regimeAffiche.length).toBeGreaterThan(0)
      // Aucune date, nulle part, dans aucun champ.
      expect(JSON.stringify(r)).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    })
  }

  it('la fourchette est un refus SEC : pas deux dates', () => {
    const r = calculer({ depart: d('2026-06-04'), entree: REFUS_FOURCHETTE })
    if (r.statut !== 'REFUS') throw new Error('refus attendu')
    expect(r.motif).toContain('Deux bornes ne font pas une date')
  })

  it('le délai à rebours porte son motif propre', () => {
    const r = calculer({ depart: d('2026-06-04'), entree: REFUS_REBOURS })
    if (r.statut !== 'REFUS') throw new Error('refus attendu')
    expect(r.motif).toContain('à rebours')
    expect(r.motif).toContain('jamais l’anticipation')
  })

  it('refuse une entrée `A_VERIFIER` dont le genre calcule, et affiche le régime', () => {
    const r = calculer({ depart: d('2026-06-04'), entree: REGIME_A_VERIFIER_CALCULABLE })
    if (r.statut !== 'REFUS') throw new Error('refus attendu')
    expect(r.cle).toBe('REGIME_A_VERIFIER')
    expect(r.regimeAffiche).toContain('à vérifier')
    expect(r.regimeAffiche).not.toContain('Délai franc')
  })

  it('refuse une date impossible', () => {
    const r = calculer({ depart: { y: 2026, m: 2, d: 31 }, entree: CPC_354 })
    expect(r.statut).toBe('REFUS')
  })
})

// ===========================================================================
// BLOC 9 — LES RÉSERVES
// ===========================================================================

describe('Bloc 9 — les réserves', () => {
  /**
   * ⚠️ **CE TEST S'APPELAIT « R1 ». LA RÉSERVE N'EXISTE PLUS** (20 août 2026, soir). Elle
   * nommait la date qu'on obtiendrait si les cinq fêtes NATIONALES de l'article 275.1 de la
   * Constitution prorogeaient, et la tenait hors de la tête d'affiche parce que l'art. 991 al. 3
   * ne vise, à la lettre, que « un dimanche ou un jour de fête légale ». **Me Vaval a répondu
   * OUI** : elles prorogent en tête, sur les deux surfaces (`regles-lecture.ts`, version 2).
   *
   * ⚠️ N'écris jamais ce test sans millésime : le 18 novembre est un dimanche en 2029 et 2035,
   * un samedi en 2028 et 2034.
   */
  it('Vertières (18 nov. 2027, fête NATIONALE) PROROGE la tête d’affiche', () => {
    // Départ lundi 18 octobre 2027 → dernier jour compté mercredi 17 novembre 2027 →
    // dernier jour utile jeudi 18 novembre 2027, fête NATIONALE → vendredi 19.
    const r = calcul({ depart: d('2027-10-18'), entree: CPC_354 })
    expect(formatIso(r.dernierJourCompte)).toBe('2027-11-17')
    expect(formatIso(r.echeance)).toBe('2027-11-18')
    expect(formatIso(r.teteAffiche)).toBe('2027-11-19')
    expect(dayOfWeek(r.teteAffiche)).toBe(5) // vendredi
    // Plus AUCUNE lecture « R1 » : la clé n'existe plus dans le moteur, et la date qu'elle
    // nommait EST la tête d'affiche.
    expect(r.lectures.map((l) => l.cle)).not.toContain('R1')
    expect(r.lectures).toHaveLength(0)
    // Le jour écarté est NOMMÉ pour ce qu'il est — une fête nationale, jamais « fête légale ».
    expect(r.joursEcartes).toHaveLength(1)
    expect(r.joursEcartes[0].motifs[0].genre).toBe('FETE_NATIONALE')
  })

  /**
   * ⚠️ **ET « R1-T », SA JUMELLE EN MATIÈRE DE TRAVAIL.** L'art. 511 al. 2 C. trav. dit « un
   * dimanche ou un jour férié légal » — une rédaction PLUS LARGE que celle du C. pr. civ., ce
   * qui rendait la lecture large plus défendable encore ici. La réponse est la même des deux
   * côtés, et les deux codes rendent maintenant la même date sur le même jour.
   */
  it('… et la même question en matière de travail rend la même date (art. 511)', () => {
    // 8 jours francs : départ mardi 9 novembre 2027 → compté 17 nov. → utile 18 nov. → 19.
    const r = calcul({ depart: d('2027-11-09'), entree: TRAV_507 })
    expect(formatIso(r.teteAffiche)).toBe('2027-11-19')
    expect(r.lectures.map((l) => l.cle)).not.toContain('R1_T')
    expect(r.lectures).toHaveLength(0)
    // ⚠️ Le motif porte le texte qui INSTITUE la fête (la Constitution) ; c'est l'ÉTAPE qui cite
    // l'article qui PROROGE, et il suit la matière : art. 511 al. 2 C. trav., jamais l'art. 991.
    expect(r.joursEcartes[0].motifs[0].source).toContain('Constitution')
    const prorogation = r.etapes.find((e) => e.cle.startsWith('prorogation-'))!
    expect(prorogation.texte).toContain('C. trav., art. 511 al. 2')
    expect(prorogation.texte).not.toContain('991')
  })

  /**
   * ⚠️ **LA VERSION 1 DES RÈGLES REJOUE LA LECTURE D'AVANT, ET C'EST TOUT SON OBJET.** Un
   * permalien `rl=1` doit rendre la date qu'il rendait : jeudi 18 novembre, la fête nationale
   * ne prorogeant pas. La réserve, elle, ne reparaît PAS — elle a été retirée du produit, pas
   * mise en sommeil (voir `regles-lecture.ts`).
   */
  it('sous les règles de la VERSION 1, Vertières ne proroge pas — et rien ne le nomme', () => {
    const r = calcul({ depart: d('2027-10-18'), entree: CPC_354, versionRegles: 1 })
    expect(formatIso(r.teteAffiche)).toBe('2027-11-18')
    expect(r.versionRegles).toBe(1)
    expect(r.lectures.map((l) => l.cle)).not.toContain('R1')
    expect(r.lectures).toHaveLength(0)
  })

  /**
   * ⚠️ **CE TEST S'APPELAIT « R6 ». LA RÉSERVE N'EXISTE PLUS** (20 août 2026). Elle tenait la
   * Toussaint hors de la tête d'affiche parce qu'aucun texte du corpus ne l'instituait ; le
   * *Décret du 11 décembre 2024 déterminant les Fêtes Légales* (Moniteur, Spécial n° 66-A)
   * l'énumère à son article 2, 9°. Elle proroge donc en TÊTE D'AFFICHE, sur un texte.
   *
   * La règle 4 du § 0 n'a pas changé de sens pour autant : ce qui est écarté de la tête, ce
   * n'est plus un jour de la rédaction — il n'y en a plus —, c'est la CASCADE (R3), qui reste
   * une lecture nommée.
   */
  it('LE CAS DE LA CLIENTE — 1er oct. 2025 + 30 j : le PORTAIL rend lui aussi lundi 3 novembre', () => {
    const r = calcul({ depart: d('2025-10-01'), entree: CPC_354 })
    expect(formatIso(r.dernierJourCompte)).toBe('2025-10-31')
    // Samedi 1er novembre = la Toussaint, fête légale du décret de 2024 → dimanche 2 novembre,
    // qui est un dimanche ET la Fête des Morts → lundi 3 novembre. C'EST LA CASCADE, et elle
    // est dans la tête d'affiche depuis le 20 août 2026 (soir).
    expect(formatIso(r.teteAffiche)).toBe('2025-11-03')
    expect(dayOfWeek(r.teteAffiche)).toBe(1) // lundi
    expect(r.joursEcartes.map((j) => formatIso(j.date))).toEqual(['2025-11-01', '2025-11-02'])
    // Ni « R6 », ni « R3 » : les deux clés ont quitté le moteur, et la date qu'elles nommaient
    // est celle de la tête d'affiche.
    expect(r.lectures).toHaveLength(0)
    expect(formatIso(r.lectureLaPlusLarge)).toBe('2025-11-03')
    // A4 disparaît avec son objet : aucune entrée du calendrier n'est plus sans texte.
    expect(r.avertissements.some((a) => a.cle === 'A4')).toBe(false)
    // ⚠️ **LA MÊME DATE QUE LA SURFACE PUBLIQUE**, à durée et régime identiques : c'est la fin
    // du désaccord des deux écrans (§ 0). La page publique rendait déjà lundi 3 novembre.
    const publique = calcul({ depart: d('2025-10-01'), entree: { ...CPC_354, prorogationTeteLarge: true } })
    expect(formatIso(publique.teteAffiche)).toBe(formatIso(r.teteAffiche))
  })

  /**
   * ⚠️ **LE MÊME CAS SOUS LES RÈGLES DE LA VERSION 1** — ce que rejoue un permalien `rl=1` :
   * la prorogation ne joue qu'UNE fois, et la date s'arrête au dimanche 2 novembre.
   */
  it('… et sous les règles de la VERSION 1, la prorogation ne joue qu’une fois', () => {
    const r = calcul({ depart: d('2025-10-01'), entree: CPC_354, versionRegles: 1 })
    expect(formatIso(r.teteAffiche)).toBe('2025-11-02')
    expect(dayOfWeek(r.teteAffiche)).toBe(0) // dimanche
    expect(r.versionRegles).toBe(1)
  })

  /**
   * ⚠️ **L'IMMUTABILITÉ DES VERSIONS, MESURÉE SUR LE MÊME CAS.** Un permalien émis avant le
   * 20 août 2026 porte `c=1` : rejoué, il doit rendre la date qu'il rendait — samedi
   * 1er novembre 2025 —, et non celle du calendrier d'aujourd'hui.
   */
  it('… mais sous le CALENDRIER DE LA VERSION 1, la même date rend le samedi 1er novembre', () => {
    const r = calcul({
      depart: d('2025-10-01'),
      entree: CPC_354,
      versionCalendrier: 1,
      entreesCalendrier: CALENDRIER_V1,
    })
    expect(formatIso(r.teteAffiche)).toBe('2025-11-01')
    expect(dayOfWeek(r.teteAffiche)).toBe(6) // samedi
    expect(r.versionCalendrier).toBe(1)
    // La lecture cumulée porte toujours les jours sans texte de la version 1 : lundi 3.
    expect(formatIso(r.lectures.find((l) => l.cle === 'CUMUL')!.date)).toBe('2025-11-03')
    // … et A4 les nomme, sans plus employer la formule « sur instruction de la rédaction ».
    const a4 = r.avertissements.find((a) => a.cle === 'A4')
    expect(a4).toBeDefined()
    expect(a4!.texte).toContain('La Toussaint')
    expect(a4!.texte).toContain('VERSION 1')
    expect(a4!.texte).not.toContain('sur instruction de la rédaction')
  })

  /**
   * ⚠️ **CE TEST S'APPELAIT « R3 ».** Noël 2027 tombe un samedi : l'échéance est reportée au
   * dimanche 26, qui est un dimanche — « proroge-t-on de nouveau ? La lettre ne le dit pas. »
   * **Me Vaval a répondu OUI le 20 août 2026 (soir)** : la tête d'affiche est le LUNDI 27, la
   * réserve a été retirée, et le raisonnement ne renvoie plus à rien.
   */
  it('Noël un samedi (2027) : la cascade porte la tête d’affiche au lundi 27', () => {
    const r = calcul({ depart: d('2027-11-24'), entree: CPC_354 })
    expect(formatIso(r.dernierJourCompte)).toBe('2027-12-24')
    expect(formatIso(r.echeance)).toBe('2027-12-25')
    expect(formatIso(r.teteAffiche)).toBe('2027-12-27')
    expect(dayOfWeek(r.teteAffiche)).toBe(1) // lundi
    expect(r.lectures).toHaveLength(0)
    // Les DEUX jours franchis sont nommés, chacun pour ce qu'il est.
    expect(r.joursEcartes.map((j) => formatIso(j.date))).toEqual(['2027-12-25', '2027-12-26'])
    expect(r.joursEcartes[0].motifs[0].genre).toBe('FETE_LEGALE')
    expect(r.joursEcartes[1].motifs[0].genre).toBe('DIMANCHE')

    // CORRECTIF défauts 1, 5 et 7 — le RAISONNEMENT aussi. C'est par ce trou que le défaut
    // est passé : le test contrôlait les deux dates et ne regardait jamais `etapes`, si bien
    // que l'écran pouvait imprimer « Le dimanche 26 décembre 2027 n’est ni un dimanche ni une
    // fête légale » sous une date pourtant juste. La date finale étant désormais un jour
    // ouvrable, c'est l'affirmation INVERSE qu'il faut contrôler.
    const derniere = r.etapes.at(-1)!
    expect(derniere.texte).toContain('lundi 27 décembre 2027')
    expect(derniere.texte).not.toContain('ne proroge que d’UN jour')
    expect(derniere.texte).not.toContain('R3')
  })

  it('… et sous les règles de la VERSION 1, elle s’arrête au dimanche 26 et le DIT', () => {
    const r = calcul({ depart: d('2027-11-24'), entree: CPC_354, versionRegles: 1 })
    expect(formatIso(r.teteAffiche)).toBe('2027-12-26')
    expect(dayOfWeek(r.teteAffiche)).toBe(0) // dimanche
    const derniere = r.etapes.at(-1)!
    expect(derniere.texte).not.toContain('n’est ni un dimanche')
    expect(derniere.texte).toContain('dimanche 26 décembre 2027')
    expect(derniere.texte).toContain('ne proroge que d’UN jour')
    // ⚠️ Le renvoi à la réserve R3 est parti AVEC elle : la phrase ne nomme plus un bloc qui
    // n'existe pas.
    expect(derniere.texte).not.toContain('R3')
  })

  it('régime incertain (C. trav.) — tête en ORDINAIRE, régime franc en lecture nommée', () => {
    // Départ lundi 1er juin 2026, 10 jours : ordinaire → jeudi 11 juin ; franc → vendredi 12.
    const r = calcul({ depart: d('2026-06-01'), entree: TRAV_172_DOUTEUX })
    expect(r.franc).toBe(false)
    expect(formatIso(r.dernierJourCompte)).toBe('2026-06-11')
    expect(formatIso(r.teteAffiche)).toBe('2026-06-11')
    const franc = r.lectures.find((l) => l.cle === 'REGIME_FRANC')
    expect(franc).toBeDefined()
    expect(formatIso(franc!.date)).toBe('2026-06-12')
    expect(r.regimeAffiche).toContain('incertain')
  })

  it('prorogation991 INCERTAIN (C. civ.) — tête sans prorogation, prorogation en lecture nommée', () => {
    // 30 jours francs depuis le 5 juin 2026 → compté 5 juillet, utile dimanche 5 juillet ?
    // On prend un cas où l'échéance tombe un dimanche : départ jeudi 4 juin 2026.
    const r = calcul({ depart: d('2026-06-04'), entree: CIV_28 })
    expect(formatIso(r.echeance)).toBe('2026-07-05')
    expect(dayOfWeek(r.echeance)).toBe(0)
    expect(formatIso(r.teteAffiche)).toBe('2026-07-05') // aucune prorogation en tête
    const p = r.lectures.find((l) => l.cle === 'PROROGATION_991')
    expect(formatIso(p!.date)).toBe('2026-07-06')
  })

  it('CIVIL déclaré FRANC sans citation : le moteur n’affirme PAS qu’il est franc (défaut 1)', () => {
    const r = calcul({ depart: d('2026-06-04'), entree: CIV_LOI_10 })
    expect(r.franc).toBe(false)
    expect(r.regimeAffiche).toContain('incertain')
    expect(formatIso(r.teteAffiche)).toBe('2026-06-07') // 4 + 3 jours, régime ordinaire
    const franc = r.lectures.find((l) => l.cle === 'REGIME_FRANC')
    expect(franc).toBeDefined()
    expect(formatIso(franc!.date)).toBe('2026-06-08')
  })

  it('« Autre » / « je ne sais pas » — deux dates, la plus précoce en tête', () => {
    const r = calcul({ depart: d('2026-06-04'), entree: autre(15, 'Délai lu dans un avis douanier', 'inconnu') })
    expect(formatIso(r.teteAffiche)).toBe('2026-06-19')
    const franc = r.lectures.find((l) => l.cle === 'REGIME_FRANC')
    expect(formatIso(franc!.date)).toBe('2026-06-20')
    expect(r.entree.regimeFondement).toContain('les deux lectures diffèrent d’un jour')
  })

  it('« Autre » / oui et non diffèrent d’exactement un jour', () => {
    const oui = calcul({ depart: d('2026-06-04'), entree: autre(15, 'x', 'oui') })
    const non = calcul({ depart: d('2026-06-04'), entree: autre(15, 'x', 'non') })
    expect(toJdn(oui.teteAffiche) - toJdn(non.teteAffiche)).toBe(1)
  })

  it('l’écran le dit quand aucune lecture concurrente ne donne une date différente', () => {
    const r = calcul({ depart: d('2026-06-08'), entree: CPC_354 })
    expect(r.lectures).toHaveLength(0)
    expect(formatIso(r.lectureLaPlusLarge)).toBe(formatIso(r.teteAffiche))
  })
})

// ===========================================================================
// BLOC 10 — LES INVARIANTS
// ===========================================================================

describe('Bloc 10 — les invariants, sur 5 000 tirages', () => {
  it('tient sur toutes les entrées et toutes les dates tirées', () => {
    const entrees = [CPC_354, CPC_424, TRAV_507, TRAV_172_DOUTEUX, CIV_28, CIV_LOI_10, CIV_1827]
    const debut = toJdn({ y: 1990, m: 1, d: 1 })
    for (let i = 0; i < 5000; i++) {
      const depart = fromJdn(debut + (i * 7919) % 20_000)
      const entree = entrees[i % entrees.length]
      const r = calcul({ depart, entree })

      // le dernier jour utile est toujours ≥ la date de départ, strictement en régime franc
      expect(toJdn(r.teteAffiche)).toBeGreaterThanOrEqual(toJdn(depart))
      if (r.franc) expect(toJdn(r.teteAffiche)).toBeGreaterThan(toJdn(depart))

      // une prorogation ne rapproche jamais la date
      expect(toJdn(r.teteAffiche)).toBeGreaterThanOrEqual(toJdn(r.echeance))

      // la tête d'affiche est ≤ à toutes les dates des lectures nommées
      for (const l of r.lectures) expect(toJdn(l.date)).toBeGreaterThanOrEqual(toJdn(r.teteAffiche))
      expect(toJdn(r.lectureLaPlusLarge)).toBeGreaterThanOrEqual(toJdn(r.teteAffiche))

      // le jour praticable ne dépasse jamais la tête d'affiche, et le « certain » est ≥ au prudent
      expect(toJdn(r.praticable.dernierJourPraticable)).toBeLessThanOrEqual(toJdn(r.teteAffiche))
      expect(toJdn(r.praticable.dernierJourPraticableCertain)).toBeLessThanOrEqual(
        toJdn(r.teteAffiche),
      )
      expect(toJdn(r.praticable.dernierJourPraticableCertain)).toBeGreaterThanOrEqual(
        toJdn(r.praticable.dernierJourPraticable),
      )
    }
  })

  it('ajouter de la distance ne rapproche jamais la date', () => {
    const debut = toJdn({ y: 2000, m: 1, d: 1 })
    for (let i = 0; i < 500; i++) {
      const depart = fromJdn(debut + i * 13)
      const sans = calcul({ depart, entree: CPC_GERMEIL, km: [0] })
      const avec = calcul({ depart, entree: CPC_GERMEIL, km: [i * 3] })
      expect(toJdn(avec.teteAffiche)).toBeGreaterThanOrEqual(toJdn(sans.teteAffiche))
    }
  })
})

// ===========================================================================
// BLOC 11 — LA BORNE HISTORIQUE
// ===========================================================================

describe('Bloc 11 — la borne historique du 22 juin 1989', () => {
  it('refuse un départ au 21 juin 1989 et accepte le 22', () => {
    const refus = calculer({ depart: d('1989-06-21'), entree: CPC_354 })
    expect(refus.statut).toBe('REFUS')
    if (refus.statut === 'REFUS') {
      expect(refus.cle).toBe('BORNE_HISTORIQUE')
      expect(refus.motif).toContain('22 juin 1989')
      expect(refus.motif).toContain('1982')
    }
    const ok = calculer({ depart: d('1989-06-22'), entree: CPC_354 })
    expect(ok.statut).toBe('CALCUL')
  })

  it('refuse aussi quand seul le DERNIER JOUR calculé serait antérieur à la borne', () => {
    // Le cas ne peut se produire qu'avec un départ lui-même antérieur : les deux contrôles
    // sont donc redondants par construction, et c'est voulu — le second est le filet.
    const r = calculer({ depart: d('1989-06-01'), entree: CPC_354 })
    expect(r.statut).toBe('REFUS')
  })
})

// ===========================================================================
// BLOC 16 — LES JOURS À SURVEILLER (§ 4.13)
// ===========================================================================

const SANS_A_SURVEILLER = CALENDRIER_COURANT.filter((e) => e.typeEntree !== 'A_SURVEILLER')

describe('Bloc 16 — les jours à surveiller ne prorogent pas', () => {
  it('1. il ne proroge pas : tête d’affiche au 10 février 2027, PAS au 11', () => {
    // Départ samedi 9 janvier 2027 → dernier jour compté lundi 8 février (Lundi Gras, qui
    // n'est PAS testé : § 2.7 b) → échéance mardi 9 février = Mardi Gras, fête légale du
    // décret de 1989 → prorogation d'un jour → mercredi 10 février, Mercredi des Cendres.
    const r = calcul({ depart: d('2027-01-09'), entree: CPC_354 })
    expect(formatIso(r.dernierJourCompte)).toBe('2027-02-08')
    expect(formatIso(r.echeance)).toBe('2027-02-09')
    expect(formatIso(r.teteAffiche)).toBe('2027-02-10')
    expect(formatIso(r.teteAffiche)).not.toBe('2027-02-11')
    // le Mardi Gras a bien joué, le Lundi Gras n'a pas été testé
    expect(r.joursEcartes).toHaveLength(1)
    expect(r.joursEcartes[0].motifs.map((m) => m.cle)).toContain('mardi-gras')
  })

  it('2. il avertit, et il nomme la date conditionnelle sans jamais la mettre en tête', () => {
    const r = calcul({ depart: d('2027-01-09'), entree: CPC_354 })
    const a6 = r.avertissements.find((a) => a.cle === 'A6')
    expect(a6).toBeDefined()
    expect(formatIso(a6!.dateConditionnelle!)).toBe('2027-02-11')
    expect(a6!.texte).toContain('Mercredi des Cendres')
    expect(a6!.texte).toContain('11 février 2027')
    // et cette date n'est NI la tête d'affiche, NI dans la phrase de sécurité, NI dans la
    // ligne « lecture la plus large »
    expect(formatIso(r.teteAffiche)).not.toBe('2027-02-11')
    expect(r.phraseSecurite).not.toContain('11 février 2027')
    expect(formatIso(r.lectureLaPlusLarge)).not.toBe('2027-02-11')
    // A6 est en TÊTE du bloc d'avertissements
    expect(r.avertissements[0].cle).toBe('A6')
    // et il ne figure PAS dans le tableau des jours écartés
    expect(r.joursEcartes.some((j) => j.motifs.some((m) => m.cle === 'mercredi-des-cendres'))).toBe(
      false,
    )
  })

  it('3. au milieu du délai : rien du tout', () => {
    // Départ lundi 1er février 2027 → compté mercredi 3 mars → tête jeudi 4 mars 2027. Le
    // délai traverse le Lundi Gras, le Mardi Gras ET le Mercredi des Cendres.
    const r = calcul({ depart: d('2027-02-01'), entree: CPC_354 })
    expect(formatIso(r.dernierJourCompte)).toBe('2027-03-03')
    expect(formatIso(r.teteAffiche)).toBe('2027-03-04')
    expect(r.avertissements.some((a) => a.cle === 'A6')).toBe(false)
    expect(r.joursEcartes).toHaveLength(0)
  })

  it('4. invariant : retirer les 5 entrées A_SURVEILLER ne change AUCUNE date', () => {
    // C'est la preuve mécanique que la catégorie n'entre pas dans le calcul. Si ce test
    // rougit, quelqu'un a rebranché la prorogation.
    const entrees = [CPC_354, TRAV_507, CIV_28]
    const debut = toJdn({ y: 2000, m: 1, d: 1 })
    for (let i = 0; i < 5000; i++) {
      const depart = fromJdn(debut + (i * 3571) % 15_000)
      const entree = entrees[i % entrees.length]
      const complet = calcul({ depart, entree })
      const sansSurveiller = calcul({ depart, entree, entreesCalendrier: SANS_A_SURVEILLER })
      expect(formatIso(sansSurveiller.teteAffiche)).toBe(formatIso(complet.teteAffiche))
      expect(formatIso(sansSurveiller.lectureLaPlusLarge)).toBe(
        formatIso(complet.lectureLaPlusLarge),
      )
      expect(sansSurveiller.lectures.map((l) => `${l.cle}:${formatIso(l.date)}`)).toEqual(
        complet.lectures.map((l) => `${l.cle}:${formatIso(l.date)}`),
      )
      // CORRECTIF défaut 11 — le bloc « jour praticable » AUSSI. Le correctif du défaut 2
      // avait versé les cinq entrées A_SURVEILLER dans le recul : sur 5 000 tirages, 69
      // `dernierJourPraticable` changeaient selon qu'on les retirait ou non, et une tête
      // d'affiche au mercredi 10 février 2027 rendait « au plus tard le samedi 6 février ».
      // Le § 4.13 est net : un jour à surveiller produit une PHRASE (A6), jamais une date.
      expect(formatIso(sansSurveiller.praticable.dernierJourPraticable)).toBe(
        formatIso(complet.praticable.dernierJourPraticable),
      )
      expect(formatIso(sansSurveiller.praticable.dernierJourPraticableCertain)).toBe(
        formatIso(complet.praticable.dernierJourPraticableCertain),
      )
      expect(sansSurveiller.praticable.necessaire).toBe(complet.praticable.necessaire)
    }
  })

  it('4 bis. un Mercredi des Cendres en tête d’affiche n’ouvre PAS le bloc « jour praticable »', () => {
    // Le cas mesuré du défaut 11 : tête d'affiche mercredi 10 février 2027, et le moteur
    // reculait jusqu'au samedi 6 février (Cendres → Mardi Gras → Lundi Gras → dimanche 7 +
    // « 7 février »). Aucun texte ne ferme le 10 février : le bloc ne s'ouvre pas, et A6 dit
    // tout ce qu'il y a à dire.
    const r = calcul({ depart: d('2027-01-09'), entree: CPC_354 })
    expect(formatIso(r.teteAffiche)).toBe('2027-02-10')
    expect(r.praticable.necessaire).toBe(false)
    expect(formatIso(r.praticable.dernierJourPraticable)).toBe('2027-02-10')
    expect(formatIso(r.praticable.dernierJourPraticableCertain)).toBe('2027-02-10')
    expect(formatIso(r.praticable.dernierJourPraticable)).not.toBe('2027-02-06')
    expect(r.praticable.texte).toBe('')
    // … et l'avertissement A6, lui, est bien là.
    expect(r.avertissements.some((a) => a.cle === 'A6')).toBe(true)
  })

  it('5. la borne de l’Index est dans la phrase de A6, dans les trois langues', () => {
    // Repli sur le français tant que la traduction n'a pas été relue (défaut 3) : la phrase
    // reste lisible et la borne reste là, quelle que soit la langue demandée.
    for (const locale of ['fr', 'en', 'ht'] as const) {
      const r = calcul({ depart: d('2027-01-09'), entree: CPC_354, locale })
      const a6 = r.avertissements.find((a) => a.cle === 'A6')
      expect(a6!.texte).toContain('20 juin 2023')
      expect(a6!.texte).toContain('2024, 2025 et 2026')
    }
  })

  it('5 bis. les CINQ jours à surveiller déclenchent tous A6 avec la borne', () => {
    // ⚠️ CORRECTIF (défaut 15). La rédaction d'origine bouclait sur cinq cibles de 2027 et
    // faisait `if (formatIso(r.teteAffiche) !== cible) continue` : le 24 octobre 2027 et le
    // 7 février 2027 sont des DIMANCHES, la prorogation déplaçait la tête d'affiche, et les
    // deux itérations sortaient EN SILENCE sans jamais assert. Trois entrées sur cinq
    // étaient réellement testées. Chaque cible porte désormais un millésime où elle n'est ni
    // un dimanche ni une fête, écrit en dur avec son jour de la semaine, et le `continue`
    // est devenu un `expect` : si la tête d'affiche se déplace, le test ROUGIT.
    const cibles: [string, string, number][] = [
      ['2027-02-10', 'mercredi-des-cendres', 3], // mercredi
      ['2027-05-06', 'ascension', 4], // jeudi
      ['2027-03-25', 'jeudi-saint', 4], // jeudi
      ['2028-10-24', '24-octobre', 2], // mardi (le 24 oct. 2027 est un DIMANCHE)
      ['2028-02-07', '7-fevrier', 1], // lundi (le 7 févr. 2027 est un DIMANCHE)
    ]
    for (const [cible, cle, jourSemaine] of cibles) {
      const echeance = d(cible)
      expect(dayOfWeek(echeance), `${cible} : jour de la semaine`).toBe(jourSemaine)
      // 30 jours francs : tête = départ + 31 si aucune prorogation ne joue.
      const r = calcul({ depart: addDays(echeance, -31), entree: CPC_354 })
      expect(formatIso(r.teteAffiche), `tête d’affiche attendue le ${cible}`).toBe(cible)
      const a6 = r.avertissements.find((a) => a.cle === 'A6')
      expect(a6, `A6 attendu pour ${cible} (${cle})`).toBeDefined()
      expect(a6!.texte).toContain('20 juin 2023')
      expect(formatIso(a6!.dateConditionnelle!)).toBe(formatIso(addDays(echeance, 1)))
    }
  })
})

// ===========================================================================
// § 0, RÈGLE 1 — CE QUE LE MOTEUR REFUSE PLUTÔT QUE D'AFFIRMER
// ===========================================================================

describe('§ 0, règle 1 — le moteur REFUSE au lieu d’approximer', () => {
  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ⚠️ **DÉFAUT 5 — LA BORNE ANTI-BOUCLE RENDAIT UNE DATE QUE LE MOTEUR SAVAIT FAUSSE.**
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * `derouler` sortait de la boucle après `CASCADE_MAX` sauts et rendait le onzième jour SANS
   * l'avoir vérifié. L'étape finale l'avouait — « le report a été répété 10 fois sans atteindre
   * un jour qui ne proroge pas : la plateforme s'arrête là » — mais `teteAffiche` portait quand
   * même cette date, et c'est elle qui s'affiche en gros caractères, part au presse-papiers et
   * **se signe dans le permalien**. Le garde-fou refusait de boucler ; il refuse maintenant
   * aussi d'affirmer.
   *
   * ⚠️ **INATTEIGNABLE SUR LE CALENDRIER HAÏTIEN** — deux jours prorogeants consécutifs au
   * maximum (1er/2 janvier, 1er/2 novembre). Mais `entreesCalendrier` accepte un jeu quelconque
   * (l'aperçu obligatoire du back-office, § 7.1) et l'écran d'administration ÉCRIT EN BASE : le
   * chemin existe, et il ne doit pas rendre de date.
   */
  it('DÉFAUT 5 — douze jours prorogeants consécutifs : REFUS, pas une date de plus', () => {
    // Un calendrier fabriqué : douze fêtes légales à la file, du 1er au 12 juin.
    const douze: EntreeCalendrier[] = []
    for (let jour = 1; jour <= 12; jour++) {
      douze.push({
        cle: `essai-juin-${jour}`,
        typeEntree: 'PERMANENT',
        libelleFr: `Jour d’essai ${jour}`,
        libelleEn: `Test day ${jour}`,
        libelleHt: `Jou tès ${jour}`,
        categorie: 'FETE_LEGALE',
        autorite: 'TEXTE',
        journee: 'JOURNEE_ENTIERE',
        traductionRelue: true,
        mobile: false,
        mois: 6,
        jour,
        source: 'Calendrier fabriqué pour ce test — il n’existe dans aucune version.',
        appliqueDepuis: '1989-06-22',
      })
    }
    // 1er mai 2026 + 30 jours francs → échéance le 1er juin 2026, premier des douze.
    const r = calculer({
      depart: d('2026-05-01'),
      entree: CPC_354,
      entreesCalendrier: douze,
      locale: 'fr',
    })
    expect(r.statut).toBe('REFUS')
    if (r.statut !== 'REFUS') throw new Error('attendu REFUS')
    expect(r.cle).toBe('CASCADE_BORNE')
    expect(r.motif).toContain('10')
    // ⚠️ **AUCUNE DATE**, sous aucun nom : c'est tout l'objet du refus.
    expect(r).not.toHaveProperty('teteAffiche')
    expect(r.motif).not.toContain('2026-06')

    // Et le contrôle : ONZE jours prorogeants passent — la borne n'a pas joué, la date sort.
    const onze = douze.slice(0, 10)
    const ok = calculer({
      depart: d('2026-05-01'),
      entree: CPC_354,
      entreesCalendrier: onze,
      locale: 'fr',
    })
    expect(ok.statut).toBe('CALCUL')
    if (ok.statut !== 'CALCUL') throw new Error('attendu CALCUL')
    expect(formatIso(ok.teteAffiche)).toBe('2026-06-11')
    // La date rendue ne proroge pas : c'est un POINT FIXE, vérifié et non supposé.
    expect(entreesDuJour(ok.teteAffiche, onze)).toHaveLength(0)
  })

  /**
   * ⚠️ **DÉFAUT 12 — LE REPLI SILENCIEUX SUR LES RÈGLES DU JOUR.** `calculer` faisait
   * `reglesLecture(versionR) ?? REGLES_COURANTES`, que `regles-lecture.ts` interdit en toutes
   * lettres. Le chemin SERVI est protégé en amont par `calculPublic` (404), mais `calculer()`
   * est appelé sans garde par les deux écrans d'administration (`DelaiEntryForm.tsx:155`,
   * `DelaiCalendarAdmin.tsx:180`) et par une centaine de tests : l'invariant ne vivait que dans
   * un commentaire. Il vit maintenant dans un refus typé, et c'est ce test qui le garde.
   */
  it('DÉFAUT 12 — une version de règles inconnue REFUSE, elle ne retombe pas sur celles du jour', () => {
    for (const versionRegles of [3, 0, 99, -1]) {
      const r = calculer({ depart: d('2029-12-01'), entree: CPC_354, versionRegles, locale: 'fr' })
      expect(r.statut, String(versionRegles)).toBe('REFUS')
      if (r.statut !== 'REFUS') throw new Error('attendu REFUS')
      expect(r.cle, String(versionRegles)).toBe('REGLES_INCONNUES')
      expect(r.motif, String(versionRegles)).toContain(String(versionRegles))
    }
    // ⚠️ Le contrôle qui donne son sens au refus : sous la version 2, la MÊME saisie rend une
    // date. Le refus n'est donc pas une panne, c'est un choix — et il porte sur `rl` seul.
    const ok = calculer({ depart: d('2029-12-01'), entree: CPC_354, versionRegles: 2, locale: 'fr' })
    expect(ok.statut).toBe('CALCUL')
    if (ok.statut !== 'CALCUL') throw new Error('attendu CALCUL')
    expect(formatIso(ok.teteAffiche)).toBe('2030-01-03')
    // ... et le refus arrive AVANT tout autre : même une date invalide ne le devance pas, car
    // rendre « date invalide » sous une règle inexistante répondrait à côté de la question.
    const priorite = calculer({
      depart: { y: 2029, m: 13, d: 40 },
      entree: CPC_354,
      versionRegles: 3,
      locale: 'fr',
    })
    expect(priorite.statut).toBe('REFUS')
    if (priorite.statut !== 'REFUS') throw new Error('attendu REFUS')
    expect(priorite.cle).toBe('REGLES_INCONNUES')
  })
})

// ===========================================================================
// § 4.8 — LE JOUR PRATICABLE, corrigé (défaut 2)
// ===========================================================================

describe('§ 4.8 — le jour praticable', () => {
  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * § 4.10 — ⚠️ **LA FENÊTRE QUI SE FERME À MIDI, ET LE JOUR QUE LE BLOC DÉSIGNAIT SANS LE
   * DIRE** (Me Vaval, 20 août 2026, au vu du décret : « le bloc dernier jour praticable doit en
   * tenir compte »).
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * Le défaut, mesuré : sur un délai dont la tête d'affiche tombe le MARDI Gras, `reculer`
   * s'arrête sur le LUNDI Gras — et il a raison de s'y arrêter, la matinée y est ouvrable —,
   * puis le bloc écrivait « au plus tard le lundi 16 février 2026 » sans un mot sur l'heure.
   * Il promettait une journée entière sur le seul jour du calendrier qui n'en est pas une,
   * c'est-à-dire du côté du risque. Balayage 2025-2029 × 8/15/30/31 jours : le bloc désignait
   * une demi-journée sur 40 calculs, et n'en disait rien sur 40.
   *
   * ⚠️ **AUCUNE DATE N'EST DÉPLACÉE.** `dernierJourPraticable` reste le Lundi Gras : reculer
   * d'un jour de plus retirerait à l'avocate une demi-journée que le texte lui donne.
   */
  it('§ 4.10 — le bloc DIT que la fenêtre se ferme à midi, et ne recule aucune date', () => {
    // ⚠️ La MATIÈRE choisit l'article, et le bloc n'est atteignable que sur une entrée qui ne
    // proroge pas : `TRAV_507` est `prorogation991: 'OUI'`, sa tête est un point fixe. On pose
    // donc la matière sur une entrée `INCERTAIN` — c'est le seul chemin par lequel un délai de
    // travail atteint le § 4.8, et il vaut aussi pour le genre « Autre » du portail.
    const TRAVAIL_INCERTAIN: EntreeDelai = { ...CIV_28, code: 'TRAVAIL', codeLibelle: 'Code du travail' }
    for (const [entree, article, heure] of [
      [CIV_28, 'art. 991 al. 2', 'six heures du matin'],
      [TRAVAIL_INCERTAIN, 'art. 512', 'huit heures du matin'],
    ] as const) {
      const r = calcul({ depart: d('2026-01-17'), entree })
      expect(formatIso(r.teteAffiche), entree.slug).toBe('2026-02-17')
      // Le dernier jour praticable est le Lundi Gras — la matinée y est ouvrable.
      expect(formatIso(r.praticable.dernierJourPraticable), entree.slug).toBe('2026-02-16')
      expect(r.praticable.texteMidi, entree.slug).toContain('est chômé à partir de midi')
      expect(r.praticable.texteMidi, entree.slug).toContain('Lundi Gras')
      expect(r.praticable.texteMidi, entree.slug).toContain(article)
      expect(r.praticable.texteMidi, entree.slug).toContain(heure)
    }
    // La nullité de l'art. 512 voyage avec la phrase du Code du travail, et avec elle seule.
    const trav = calcul({
      depart: d('2026-01-17'),
      entree: { ...CIV_28, code: 'TRAVAIL', codeLibelle: 'Code du travail' },
    })
    expect(trav.praticable.texteMidi).toContain('est nulle')
    expect(calcul({ depart: d('2026-01-17'), entree: CIV_28 }).praticable.texteMidi) //
      .not.toContain('est nulle')
  })

  /**
   * ⚠️ **SOUS LES RÈGLES DE LA VERSION 1, LA PHRASE N'A PAS D'OBJET** : la demi-journée y ferme
   * la journée entière, elle est un empêchement ordinaire, le recul passe devant, et dire
   * « la matinée reste ouvrable » contredirait le calcul du même écran.
   */
  it('§ 4.10 — sous les règles `rl=1`, la fenêtre de midi ne se dit pas', () => {
    const r = calcul({ depart: d('2026-01-17'), entree: CIV_28, versionRegles: 1 })
    expect(r.praticable.texteMidi).toBe('')
  })

  /**
   * ⚠️ **QUAND LA TÊTE D'AFFICHE EST ELLE-MÊME LE LUNDI GRAS**, il n'y a aucun jour à reculer :
   * `necessaire` vaut `false`, et c'est là que la mention compte le plus. Elle est donc
   * INDÉPENDANTE de `necessaire` — l'écran rend le bloc dès que l'un des deux est vrai.
   */
  it('§ 4.10 — la tête d’affiche sur le Lundi Gras : `necessaire` faux, la phrase reste', () => {
    const r = calcul({ depart: d('2026-01-16'), entree: CPC_354 })
    expect(formatIso(r.teteAffiche)).toBe('2026-02-16')
    expect(r.praticable.necessaire).toBe(false)
    expect(r.praticable.texte).toBe('')
    expect(r.praticable.texteMidi).toContain('avant midi')
  })

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ⚠️ **CE BLOC A CHANGÉ D'ADRESSE LE 20 AOÛT 2026 (SOIR) — défauts 4 et 13.**
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * Les trois tests qui suivent portaient sur `CPC_354` et `TRAV_507`, deux entrées
   * `prorogation991: 'OUI'`. Depuis que la prorogation joue en CASCADE, leur tête d'affiche est
   * un POINT FIXE : elle ne peut plus tomber un jour fermé, `reculer` ne recule jamais, et le
   * bloc ne se déclenche plus. Les tests n'échouaient pas parce que leur oracle avait bougé :
   * ils échouaient parce que la fonctionnalité était morte sous eux, en silence.
   *
   * Ils sont donc REPOSÉS là où le bloc vit — sur le Code civil pour la phrase de l'art. 991
   * al. 2, sous les règles de la version 1 (permaliens `rl=1`) pour celle de l'art. 512 — et le
   * test d'ATTEIGNABILITÉ, plus bas, mesure ce qui était jusqu'ici supposé.
   */
  it('se déclenche quand la tête d’affiche est un dimanche (Noël 2027) — Code civil', () => {
    // ⚠️ `CIV_28` et non `CPC_354` : le Code civil ne proroge pas (art. 991 dans le CPC), donc
    // sa tête d'affiche TOMBE le dimanche 26 décembre 2027 et le bloc a quelque chose à dire.
    const r = calcul({ depart: d('2027-11-25'), entree: CIV_28 })
    expect(formatIso(r.teteAffiche)).toBe('2027-12-26')
    expect(r.praticable.necessaire).toBe(true)
    expect(formatIso(r.praticable.dernierJourPraticable)).toBe('2027-12-24')
    expect(formatIso(r.praticable.dernierJourPraticableCertain)).toBe('2027-12-24')
    expect(r.praticable.texte).toContain('Aucune signification ni exécution')
    expect(r.praticable.texte).toContain('art. 991 al. 2')

    // La même entrée en CPC : la cascade porte la tête au lundi 27, et le bloc se tait.
    const cpc = calcul({ depart: d('2027-11-24'), entree: CPC_354 })
    expect(formatIso(cpc.teteAffiche)).toBe('2027-12-27')
    expect(cpc.praticable.necessaire).toBe(false)
    expect(cpc.praticable.texte).toBe('')
  })

  /**
   * ⚠️ **LE DÉFAUT 3 DE LA TROISIÈME RECETTE : LA PLATEFORME INVITAIT À SIGNIFIER LE JOUR DE
   * L'INDÉPENDANCE.** `estFeteLegaleDeTexte` exigeait `categorie === 'FETE_LEGALE'` et rangeait
   * donc les cinq fêtes NATIONALES dans la certitude CONDITIONNELLE, dont la phrase dit « porté
   * au calendrier de la plateforme SANS TEXTE PERMANENT QUI L'INSTITUE » — sous une entrée qui
   * porte `autorite: 'TEXTE'` et cite la Constitution. Trois cas, rendus à l'écran.
   */
  it('DÉFAUT 3 — les fêtes NATIONALES ferment CERTAINEMENT : le décret de 2024 et la Constitution', () => {
    const cas: readonly [string, string, string][] = [
      // départ ── tête d'affiche ── le jour fermé qui est nommé
      ['2029-12-02', '2030-01-02', 'Le Jour des Aïeux'],
      ['2026-03-31', '2026-05-01', 'La Fête de l’Agriculture et du Travail'],
      ['2026-04-17', '2026-05-18', 'La Fête du Drapeau et de l’Université'],
    ]
    for (const [depart, tete, nom] of cas) {
      const r = calcul({ depart: d(depart), entree: CIV_28 })
      expect(formatIso(r.teteAffiche), depart).toBe(tete)
      expect(r.praticable.necessaire, depart).toBe(true)
      const surLaTete = r.praticable.joursEmpeches[0]
      expect(formatIso(surLaTete.date), depart).toBe(tete)
      expect(surLaTete.empechements[0].certitude, depart).toBe('CERTAINE')
      expect(surLaTete.empechements[0].libelle, depart).toBe(nom)
      // ⚠️ La phrase ne dit plus « sans texte permanent qui l'institue » : le corpus en nomme
      // un — art. 3 du décret du 11 décembre 2024, art. 275 de la Constitution de 1987.
      expect(r.praticable.texte, depart).toContain('Aucune signification ni exécution')
      expect(r.praticable.texte, depart).not.toContain('sans texte permanent qui l’institue')
      // ... et les deux dates rendues sont la MÊME : plus rien n'est conditionnel ici.
      expect(
        formatIso(r.praticable.dernierJourPraticableCertain),
        depart,
      ).toBe(formatIso(r.praticable.dernierJourPraticable))
    }
  })

  /**
   * ⚠️ **L'ATTEIGNABILITÉ DU § 4.8, MESURÉE ET NON SUPPOSÉE** (défauts 4 et 13). Le bloc est un
   * THÉORÈME, pas un accident : sous la cascade, une entrée qui proroge a une tête d'affiche qui
   * est un point fixe, donc toujours praticable. Ce test le prouve sur 4 × 365 départs par
   * matière, et il ROUGIT si l'une des deux colonnes cesse d'être ce qu'elle est.
   *
   * ⚠️ **CE TEST NE FIXAIT AUCUN DE SES PROPRES NOMBRES** (20 août 2026, soir) : son intitulé
   * annonçait « 1 312 », le tableau du § 4.8 de `calcul.ts` le citait en preuve de six valeurs,
   * et les seules assertions écrites étaient `> 30` et `> 200`. Trois défauts en découlaient :
   * le nombre de l'intitulé (1 312) appartenait à la fenêtre 2025-2029 alors que le balayage
   * couvre l'année 2027 ; une dérive de 258 à 205 serait passée ; et le commentaire du moteur
   * nommait un capteur qui ne portait pas ses chiffres. Les six valeurs sont donc fixées une
   * par une, et l'intitulé dit celle que le balayage rend vraiment.
   */
  it('ATTEIGNABILITÉ — zéro bloc praticable là où le délai proroge, et 258 là où il ne proroge pas', () => {
    const balayer = (entree: typeof CPC_354, versionRegles: number) => {
      let n = 0
      let total = 0
      for (const jours of [8, 15, 30, 31]) {
        let depart = d('2027-01-01')
        while (formatIso(depart) <= '2027-12-31') {
          const r = calcul({ depart, entree: { ...entree, jours }, versionRegles })
          total += 1
          if (r.praticable.necessaire) n += 1
          depart = addDays(depart, 1)
        }
      }
      return { n, total }
    }
    // Les 279 entrées CPC et TRAVAIL prorogent toutes : le bloc y est INATTEIGNABLE.
    expect(CPC_354.prorogation991).toBe('OUI')
    expect(TRAV_507.prorogation991).toBe('OUI')
    expect(balayer(CPC_354, VERSION_REGLES_COURANTE)).toEqual({ n: 0, total: 1460 })
    expect(balayer(TRAV_507, VERSION_REGLES_COURANTE)).toEqual({ n: 0, total: 1460 })
    /**
     * ⚠️ **LE ZÉRO N'EST UNE PREUVE QUE SI LA SONDE MORD AILLEURS.** Sous les règles de la
     * VERSION 1 — un jour de report, et un seul —, le bloc se déclenche : c'est ce qui établit
     * que le zéro ci-dessus vient de la cascade et non d'un balayage qui ne mesurerait rien.
     * La valeur est FIXÉE, et non minorée : `> 30` laissait passer une dérive de 44 à 31.
     */
    expect(balayer(CPC_354, 1)).toEqual({ n: 44, total: 1460 })
    expect(balayer(TRAV_507, 1)).toEqual({ n: 44, total: 1460 })
    // Les 114 entrées du Code civil ne prorogent pas : c'est là que le bloc vit. Les deux
    // versions de règles y comptent, et elles ne rendent PAS la même chose — l'écart de 4 est
    // celui des têtes que la cascade déplace jusqu'à un jour, lui, praticable.
    expect(CIV_28.prorogation991).toBe('INCERTAIN')
    expect(balayer(CIV_28, VERSION_REGLES_COURANTE)).toEqual({ n: 258, total: 1460 })
    expect(balayer(CIV_28, 1)).toEqual({ n: 262, total: 1460 })
  })

  /**
   * ⚠️ **LE MÊME CAS, VERSION 1 : l'empêchement était CONDITIONNEL.** Le 1er novembre était au
   * calendrier sans texte permanent, l'art. 991 al. 2 ne le fermait donc pas expressément, et
   * la phrase était au conditionnel. Le test est conservé sous la version 1 — c'est ce qu'un
   * permalien `c=1` rend encore — et doublé, plus bas, de ce que rend la version 2.
   */
  it('CORRECTIF défaut 2 — v1 : un 1er novembre déclenche le bloc, en empêchement CONDITIONNEL', () => {
    // Ancienne rédaction : le bloc ne se déclenchait que sur « une fête légale de la lecture
    // retenue » ; le 1er novembre, écarté du calcul, ne le déclenchait donc pas — alors
    // que le calendrier de la plateforme le porte et que l'art. 991 al. 2 y ferme toute
    // signification. Il se déclenche désormais sur TOUTE entrée du calendrier.
    const v1 = { versionCalendrier: 1, entreesCalendrier: CALENDRIER_V1 } as const
    const r = calcul({ depart: d('2025-10-01'), entree: CPC_354, ...v1 })
    expect(formatIso(r.teteAffiche)).toBe('2025-11-01') // samedi : les jours sans texte n'y jouent pas
    expect(r.praticable.necessaire).toBe(true)
    expect(formatIso(r.praticable.dernierJourPraticable)).toBe('2025-10-31')
    // mais la certitude est nommée : l'empêchement du 1er novembre est CONDITIONNEL
    const empeche = r.praticable.joursEmpeches[0]
    expect(formatIso(empeche.date)).toBe('2025-11-01')
    expect(empeche.empechements[0].certitude).toBe('CONDITIONNELLE')
    // ... et la phrase ne fait pas dire au texte ce qu'il ne dit pas :
    expect(r.praticable.texte).toContain('sans texte permanent qui l’institue')
    expect(r.praticable.texte).not.toContain('Aucune signification ni exécution ne peut être faite')
    expect(formatIso(r.praticable.dernierJourPraticableCertain)).toBe('2025-11-01')
    // le calcul, lui, n'a pas bougé : la tête d'affiche reste le samedi 1er novembre
    expect(formatIso(r.teteAffiche)).toBe('2025-11-01')
  })

  /**
   * ⚠️ **VERSION 2 : le même jour ferme désormais CERTAINEMENT.** La Toussaint est une fête
   * légale du décret du 11 décembre 2024 : l'art. 991 al. 2 y interdit expressément toute
   * signification, et la phrase cesse d'être au conditionnel. C'est le gain concret du texte
   * retrouvé — l'écran n'a plus à dire « un huissier peut ne pas instrumenter ».
   */
  it('… et en v2 l’empêchement du 1er novembre devient CERTAIN : le texte le ferme', () => {
    // ⚠️ `CIV_28` : sur `CPC_354`, la cascade porte désormais la tête au lundi 3 novembre et le
    // bloc ne s'ouvre plus (voir l'ATTEIGNABILITÉ ci-dessus). Le Code civil, lui, ne proroge
    // pas : sa tête reste le samedi 1er novembre, et c'est bien de ce jour-là qu'il s'agit.
    const r = calcul({ depart: d('2025-10-01'), entree: CIV_28 })
    expect(formatIso(r.teteAffiche)).toBe('2025-11-01') // samedi 1er : la Toussaint
    expect(r.praticable.necessaire).toBe(true)
    // On recule du samedi 1er (la Toussaint, fermée par le texte) jusqu'au vendredi 31 octobre.
    expect(formatIso(r.praticable.dernierJourPraticable)).toBe('2025-10-31')
    expect(formatIso(r.praticable.dernierJourPraticableCertain)).toBe('2025-10-31')
    const surLeSamedi = r.praticable.joursEmpeches.find((j) => formatIso(j.date) === '2025-11-01')!
    expect(surLeSamedi.empechements[0].certitude).toBe('CERTAINE')
    expect(r.praticable.texte).toContain('Aucune signification ni exécution ne peut être faite')
    expect(r.praticable.texte).not.toContain('sans texte permanent qui l’institue')
    // Et sous la version 1 du calendrier, la MÊME entrée rendait la phrase conditionnelle :
    // la Toussaint y est portée sans texte instituant.
    const v1 = calcul({
      depart: d('2025-10-01'),
      entree: CIV_28,
      versionCalendrier: 1,
      entreesCalendrier: CALENDRIER_V1,
    })
    expect(v1.praticable.joursEmpeches[0].empechements[0].certitude).toBe('CONDITIONNELLE')
  })

  it('ne s’affiche pas quand la tête d’affiche est déjà praticable', () => {
    const r = calcul({ depart: d('2026-06-08'), entree: CPC_354 })
    expect(r.praticable.necessaire).toBe(false)
    expect(formatIso(r.praticable.dernierJourPraticable)).toBe(formatIso(r.teteAffiche))
    expect(r.praticable.texte).toBe('')
  })

  /**
   * ⚠️ La matière TRAVAIL proroge (art. 511 al. 2) : sous les règles COURANTES, sa tête est un
   * point fixe et le bloc ne s'ouvre plus (0 sur 1 460, ci-dessus). La phrase de l'art. 512 et
   * son avertissement de nullité ne sont donc plus atteignables qu'en rejouant un permalien
   * `rl=1`. Le test le DIT au lieu de faire croire que le portail les rend encore.
   */
  it('cite l’art. 512 ET la nullité en matière de travail — sous les règles de la version 1', () => {
    const r = calcul({ depart: d('2027-12-16'), entree: TRAV_507, versionRegles: 1 })
    expect(formatIso(r.teteAffiche)).toBe('2027-12-26')
    expect(r.praticable.texte).toContain('C. trav., art. 512')
    expect(r.praticable.texte).toContain('est nulle')

    // Sous les règles courantes, la cascade porte la tête au lundi 27 et le bloc se tait.
    const courant = calcul({ depart: d('2027-12-16'), entree: TRAV_507 })
    expect(formatIso(courant.teteAffiche)).toBe('2027-12-27')
    expect(courant.praticable.necessaire).toBe(false)
  })
})

// ===========================================================================
// LE GABARIT VÉRIFIÉ DU § 6.3 — les huit étapes
// ===========================================================================

describe('§ 6.3 — le gabarit vérifié : 4 juin 2026, art. 354, 30 jours francs', () => {
  const r = calcul({ depart: d('2026-06-04'), entree: CPC_354 })

  it('rend lundi 6 juillet 2026', () => {
    expect(formatIso(r.teteAffiche)).toBe('2026-07-06')
    expect(dayOfWeek(r.teteAffiche)).toBe(1)
  })

  it('rend la phrase de sécurité, invariable', () => {
    expect(r.phraseSecurite).toBe(
      'Agir au plus tard le lundi 6 juillet 2026 est sûr sous toutes les lectures du texte. ' +
        'Agir plus tard suppose que le juge retienne l’une des lectures ci-dessous.',
    )
  })

  it('rend le raisonnement pas à pas, huit étapes, chacune une phrase complète', () => {
    expect(r.etapes).toHaveLength(8)
    expect(r.etapes[0].texte).toContain('jeudi 4 juin 2026')
    expect(r.etapes[1].texte).toContain('art. 987')
    expect(r.etapes[2].texte).toContain('30 jours francs')
    expect(r.etapes[3].texte).toContain('aucun')
    expect(r.etapes[4].texte).toContain('samedi 4 juillet 2026')
    expect(r.etapes[5].texte).toContain('dimanche 5 juillet 2026')
    expect(r.etapes[6].texte).toContain('prorogé d’un jour')
    expect(r.etapes[7].texte).toContain('aucune autre prorogation')
    for (const e of r.etapes) expect(e.texte.trim().length).toBeGreaterThan(20)
  })

  it('porte A1 et A3 en permanence', () => {
    const cles = r.avertissements.map((a) => a.cle)
    expect(cles).toContain('A1')
    expect(cles).toContain('A3')
    expect(cles[cles.length - 2]).toBe('A1')
    expect(cles[cles.length - 1]).toBe('A3')
  })

  it('montre le jour écarté avec sa source', () => {
    expect(r.joursEcartes).toHaveLength(1)
    expect(formatIso(r.joursEcartes[0].date)).toBe('2026-07-05')
    expect(r.joursEcartes[0].motifs[0].source).toContain('art. 991')
  })
})

describe('§ 6.3 — le gabarit historique de Germeil', () => {
  it('267 km ÷ 40 = 6 jours ; samedi 23 juin 1962, aucune prorogation', () => {
    const r = calcul({ depart: d('1962-05-17'), entree: CPC_GERMEIL, km: [267], ...HISTORIQUE })
    expect(r.detailDistance).toEqual([{ km: 267, jours: 6 }])
    const distance = r.etapes.find((e) => e.cle === 'distance')
    expect(distance!.texte).toContain('reste 27 km, inférieur à 30, non compté')
    expect(r.joursEcartes).toHaveLength(0)
    // A2 : la ligne calculée « sans augmentation de distance »
    const a2 = r.avertissements.find((a) => a.cle === 'A2')
    // Sans les 6 jours de distance : compté samedi 16 juin, échéance dimanche 17 juin,
    // prorogée au lundi 18 juin 1962. Le dimanche proroge même sous `calendrierVide`.
    expect(a2!.texte).toContain('lundi 18 juin 1962')
  })
})

describe('A5 et A5-bis — l’augmentation que la plateforme ne calcule pas', () => {
  /**
   * ⚠️ CORRECTIF (défaut 9). Ces tests partaient des FIXTURES `CIV_229` / `CIV_1827`, dont
   * le `citationArticle` est écrit à la main : ils passaient au vert sur le mauvais objet,
   * pendant que `construireEntrees` écrivait `citationArticle: null` en dur pour les 393
   * lignes et que les trois entrées A5 rendaient « un jour par cinq lieues. Aucun texte… »
   * SANS la citation que le gabarit du § 4.9 rend obligatoire. Ils partent désormais des
   * entrées RÉELLES du répertoire.
   */
  const DU_REPERTOIRE = construireEntrees(REPERTOIRE)
  const entreeDe = (article: string) =>
    DU_REPERTOIRE.find((e) => e.code === 'CIVIL' && e.article === article)! as EntreeDelai

  it('A5-bis, et JAMAIS A5, sur l’art. 229 : il ne dit pas « cinq lieues »', () => {
    const r = calcul({ depart: d('2026-06-04'), entree: entreeDe('Art. 229 (L. 5 mai 1949)') })
    const cles = r.avertissements.map((a) => a.cle)
    expect(cles).toContain('A5_BIS')
    expect(cles).not.toContain('A5')
    const a5b = r.avertissements.find((a) => a.cle === 'A5_BIS')
    expect(a5b!.texte).toContain('outre le délai de distance')
    expect(a5b!.texte).not.toContain('cinq lieues.')
    // la base se calcule, l'augmentation non
    expect(r.joursDistance).toBe(0)
    expect(formatIso(r.dernierJourCompte)).toBe('2026-06-12')
  })

  it('les TROIS entrées A5 du répertoire portent leur citation, et l’écran la produit', () => {
    // Le gabarit du § 4.9 : « un jour par cinq lieues ([citation de l'article]) ». Sans la
    // citation, la plateforme affirme une règle en lieues sans produire la phrase qui la
    // fonde — le reproche même que le § 4.4 fait à l'idée d'appliquer A5 à l'art. 229.
    const a5 = DU_REPERTOIRE.filter((e) => e.avisDistance === 'A5')
    expect(a5.map((e) => e.article).sort()).toEqual(['Art. 1827', 'Art. 1952', 'Art. 353'])
    for (const e of a5) {
      expect(e.citationArticle, e.slug).toBeTruthy()
      expect(e.citationArticle, e.slug).toMatch(/lieue/i)
      const r = calcul({ depart: d('2026-06-04'), entree: e as EntreeDelai })
      const avis = r.avertissements.find((a) => a.cle === 'A5')
      expect(avis, e.slug).toBeDefined()
      expect(avis!.texte).toContain('cinq lieues')
      expect(avis!.texte).toContain(`« ${e.citationArticle} »`)
      expect(avis!.texte).toContain('ne calcule pas cette augmentation')
    }
  })

  it('A5 sur l’art. 1827, qui dit « un jour par cinq lieues »', () => {
    const r = calcul({ depart: d('2026-06-04'), entree: entreeDe('Art. 1827') })
    const a5 = r.avertissements.find((a) => a.cle === 'A5')
    expect(a5).toBeDefined()
    expect(a5!.texte).toContain('cinq lieues')
    expect(a5!.texte).toContain('ne calcule pas cette augmentation')
  })
})

describe('§ 4.5 — une durée que l’article n’énonce pas est NOMMÉE (défaut 3)', () => {
  const ART_356 = construireEntrees(REPERTOIRE).find(
    (e) => e.code === 'CPC' && e.article === '356',
  )! as EntreeDelai

  it('l’art. 356 dit d’où viennent ses trente jours — l’art. 354', () => {
    // Le texte de l'art. 356 en base ne porte AUCUNE durée : « Le délai de l'appel courra à
    // l'encontre de celui qui aura signifié le jugement, du jour de cette signification. »
    // La durée est juste au fond, mais le catalogue l'attribuait à un article qui ne
    // l'énonce pas, et rien ne le signalait à l'écran.
    const r = calcul({ depart: d('2026-06-04'), entree: ART_356 })
    const duree = r.etapes.find((e) => e.cle === 'duree')!
    expect(duree.texte).toContain('Délai : 30 jours francs')
    expect(duree.texte).toContain('L’article 356 ne chiffre pas ce délai')
    // La citation N'EST PAS recopiée à la main dans la phrase : elle vient de la constante
    // relue en base, que `verify-delais-sources.ts` recoupe mot pour mot (§ 5.5).
    const c = CITATIONS_DUREE_AILLEURS['356']
    expect(c.reference).toBe('C. pr. civ., art. 354')
    expect(duree.texte).toContain(`${c.reference} : « ${c.citation} »`)
    expect(c.citation).toContain('trente jours francs')
  })

  it('l’art. 354, lui, ne porte aucun renvoi : la phrase ne se met pas partout', () => {
    const r = calcul({ depart: d('2026-06-04'), entree: CPC_354 })
    const duree = r.etapes.find((e) => e.cle === 'duree')!
    expect(duree.texte).not.toContain('ne chiffre pas ce délai')
    expect(CPC_354.dureeFondementFr ?? null).toBeNull()
  })

  it('une seule entrée du répertoire porte ce renvoi, et c’est une décision nommée', () => {
    // La liste n'est pas un tiroir où ranger ce qui ne concorde pas : une durée introuvable
    // dans son article reste une divergence tant que la rédaction n'a pas nommé l'article
    // qui la porte (`verify-delais-durees.ts`).
    const avecRenvoi = construireEntrees(REPERTOIRE).filter((e) => e.dureeFondementFr)
    expect(avecRenvoi.map((e) => `${e.code} ${e.article}`)).toEqual(['CPC 356'])
  })
})

// ===========================================================================
// § 6.3 c) — L'ÉTAPE FINALE INTERROGE LA DATE (défauts 1, 5 et 7 — le bloquant)
// ===========================================================================

/** Les 123 entrées calculables du répertoire, la question de suite déjà répondue. */
const CALCULABLES = construireEntrees(REPERTOIRE)
  .filter((e) => kindCalcule(e.kind))
  .map((e) => ({ entree: e as EntreeDelai, supplementCle: e.supplement?.options[0]?.cle ?? null }))

/**
 * La date est-elle un dimanche, ou portée au calendrier ? Alors la phrase « ni… ni » ment.
 *
 * ⚠️ **LA SONDE LIT LE CALENDRIER COURANT, PAS LA VERSION 1** (20 août 2026). Elle lisait
 * `CALENDRIER_V1` pendant que `calcul()` appliquait la version courante : le jour où celle-ci
 * est passée à 2, le balayage a réclamé une mention de fête légale sur le Lundi Gras 2020 et
 * 2021 — que le décret du 11 décembre 2024 n'institue qu'à compter du 11 décembre 2024. La
 * phrase du moteur était JUSTE, c'est la sonde qui datait.
 */
function suspecte(date: CivilDate): boolean {
  return estDimanche(date) || entreesDuJour(date, CALENDRIER_COURANT).length > 0
}

describe('§ 6.3 c) — l’étape finale interroge la date, elle ne la suppose pas', () => {
  /**
   * ⚠️ **LE CAS D'ORIGINE A CHANGÉ DE BRANCHE LE 20 AOÛT 2026 (SOIR).** La tête d'affiche
   * tombait le dimanche 26 décembre 2027 (prorogation d'UN jour depuis le samedi de Noël), et
   * l'étape finale devait dire que ce jour-là était un dimanche. Depuis que la cascade est la
   * règle, la tête est le LUNDI 27 : la branche est `finale`, et l'exigence devient l'inverse —
   * la phrase ne doit rien affirmer d'empêché sur un jour qui ne l'est pas.
   *
   * Les deux versions de règles sont éprouvées : `rl=1` rejoue exactement l'ancienne.
   */
  it('le gabarit du § 6.3 : le 27 décembre 2027 est un lundi, et l’étape ne dément rien', () => {
    const r = calcul({ depart: d('2027-11-24'), entree: CPC_354 })
    const derniere = r.etapes.at(-1)!
    expect(derniere.cle).toBe('finale')
    expect(formatIso(derniere.date!)).toBe('2027-12-27')
    expect(derniere.texte).toContain('lundi 27 décembre 2027')
  })

  it('… et sous les règles de la version 1, le 26 décembre est nommé dimanche, pas le contraire', () => {
    const r = calcul({ depart: d('2027-11-24'), entree: CPC_354, versionRegles: 1 })
    const derniere = r.etapes.at(-1)!
    expect(derniere.cle).toBe('finale-empechee')
    expect(derniere.texte).not.toContain('n’est ni un dimanche ni une fête légale')
  })

  it('CIVIL, prorogation INCERTAIN : la page ne dément plus la lecture nommée', () => {
    // Le cas exact du défaut 7 : CIV_28, départ 4 juin 2026, tête = dimanche 5 juillet 2026.
    const r = calcul({ depart: d('2026-06-04'), entree: CIV_28 })
    expect(formatIso(r.teteAffiche)).toBe('2026-07-05')
    const derniere = r.etapes.at(-1)!
    expect(derniere.texte).not.toContain('n’est ni un dimanche')
    expect(derniere.texte).toContain('dimanche 5 juillet 2026')
    expect(derniere.texte).toContain('la prorogation n’est pas acquise')
    // … et il renvoie à la lecture nommée qui dit le contraire deux blocs plus bas.
    expect(derniere.texte).toContain('Si l’article 991 C. pr. civ. s’applique à ce délai')
    expect(derniere.texte).toContain('lundi 6 juillet 2026')
  })

  it('un 25 décembre en tête d’affiche n’est jamais dit « ni une fête légale »', () => {
    // Le second cas mesuré du défaut 7 : « Le vendredi 25 décembre 2026 n’est ni un dimanche
    // ni une fête légale » — le 25 décembre EST fête légale au décret du 23 mai 1989.
    const r = calcul({ depart: addDays(d('2026-12-25'), -31), entree: CIV_28 })
    expect(formatIso(r.teteAffiche)).toBe('2026-12-25')
    expect(dayOfWeek(r.teteAffiche)).toBe(5) // vendredi
    const derniere = r.etapes.at(-1)!
    expect(derniere.texte).not.toContain('n’est ni un dimanche')
    expect(derniere.texte).toContain('Jour de Noël')
  })

  it('un samedi qui est aussi l’Assomption : la branche samedi le dit (défaut 1)', () => {
    // 15 août 2026 est un SAMEDI et l'Assomption. La branche samedi d'origine écrivait
    // « l’article 991 ne vise que le dimanche, la fête légale… La date reste le samedi
    // 15 août 2026 » — en laissant croire que ce samedi n'était rien de tout cela.
    const r = calcul({ depart: addDays(d('2026-08-15'), -31), entree: CIV_28 })
    expect(formatIso(r.teteAffiche)).toBe('2026-08-15')
    expect(dayOfWeek(r.teteAffiche)).toBe(6)
    const derniere = r.etapes.at(-1)!
    expect(derniere.cle).toBe('finale-samedi')
    expect(derniere.texte).toContain('Le samedi n’est pas un jour de prorogation')
    expect(derniere.texte).toContain('Ce samedi est en outre')
    expect(derniere.texte).toContain('Assomption')
  })

  it('un samedi ordinaire garde sa phrase, sans rien y ajouter', () => {
    const r = calcul({ depart: d('1963-09-02'), entree: CPC_417_ETRANGER, supplementCle: 'antilles', ...HISTORIQUE })
    const derniere = r.etapes.at(-1)!
    expect(derniere.cle).toBe('finale-samedi')
    expect(derniere.texte).not.toContain('en outre')
  })

  it('BALAYAGE — 3 650 départs consécutifs, art. 354 : aucune étape finale ne se contredit', () => {
    // 13 cas rougissaient avant le correctif, dont le gabarit du § 6.3 lui-même.
    const debut = toJdn({ y: 2020, m: 1, d: 1 })
    let vus = 0
    for (let i = 0; i < 3650; i++) {
      const r = calcul({ depart: fromJdn(debut + i), entree: CPC_354 })
      if (!suspecte(r.teteAffiche)) continue
      vus++
      expect(r.etapes.at(-1)!.texte, formatIso(r.teteAffiche)).not.toContain('n’est ni un dimanche')
    }
    expect(vus).toBeGreaterThan(10) // le balayage doit réellement rencontrer le cas
  })

  it('BALAYAGE — les 123 entrées calculables sur 2 000 dates : jamais de contradiction', () => {
    // 81 raisonnements faux sur 4 000 calculs avant le correctif (2,0 %), concentrés sur les
    // entrées CIVIL et sur les `regimeIncertain` : environ un calcul sur six.
    expect(CALCULABLES).toHaveLength(123)
    const debut = toJdn({ y: 2020, m: 1, d: 1 })
    let vus = 0
    for (let i = 0; i < 2000; i++) {
      const { entree, supplementCle } = CALCULABLES[i % CALCULABLES.length]
      const params: Parameters<typeof calculer>[0] = {
        depart: fromJdn(debut + ((i * 7919) % 4000)),
        entree,
        supplementCle,
      }
      if (entree.kind === 'JOURS_PLUS_DISTANCE_KM') params.km = [0, 0]
      const r = calculer(params)
      if (r.statut !== 'CALCUL') continue
      if (!suspecte(r.teteAffiche)) continue
      vus++
      expect(r.etapes.at(-1)!.texte, `${entree.slug} ${formatIso(r.teteAffiche)}`).not.toContain(
        'n’est ni un dimanche',
      )
    }
    expect(vus).toBeGreaterThan(50)
  })
})

// ===========================================================================
// § 0, règle 1 — UNE DURÉE QUI N'EST PAS UN ENTIER ≥ 0 NE PRODUIT AUCUNE DATE (défaut 2)
// ===========================================================================

describe('§ 0 règle 1 — les durées impossibles sont REFUSÉES, pas approximées', () => {
  for (const n of [-1, -5, 0.5, 2.5, NaN, Infinity, -Infinity]) {
    it(`refuse une entrée dont la durée vaut ${n}`, () => {
      const r = calculer({ depart: d('2026-06-04'), entree: { ...CPC_354, jours: n } })
      expect(r.statut).toBe('REFUS')
      if (r.statut !== 'REFUS') return
      expect(r.cle).toBe('DUREE_INVALIDE')
      expect(r.motif).toContain('entier de jours')
      // Aucune date, nulle part, dans aucun champ — pas même « 0NaN-NaN-NaN » ni
      // « 2026-06-07.5 ». La valeur fautive n'est CITÉE que dans le motif, entre guillemets.
      expect(JSON.stringify(r)).not.toMatch(/\d{4}-\d{2}-\d{2}/)
      expect(JSON.stringify(r)).not.toMatch(/NaN-|0NaN|-NaN/)
      expect(r.motif).toContain(`« ${String(n)} »`)
    })

    it(`refuse la même durée saisie par le genre « Autre » (${n})`, () => {
      // Le chemin ATTEIGNABLE du § 4.12 : le nombre vient de la main de l'utilisatrice, puis
      // du permalien (`n=`). `autre()` ne filtrait rien.
      const r = calculer({ depart: d('2026-06-04'), entree: autre(n, 'Délai libre', 'inconnu') })
      expect(r.statut).toBe('REFUS')
      expect(JSON.stringify(r)).not.toMatch(/\d{4}-\d{2}-\d{2}/)
      expect(JSON.stringify(r)).not.toContain('undefined')
    })
  }

  it('accepte 0 et 1, qui sont des durées légitimes', () => {
    for (const n of [0, 1, 30]) {
      const r = calculer({ depart: d('2026-06-04'), entree: autre(n, 'x', 'non') })
      expect(r.statut, `jours=${n}`).toBe('CALCUL')
    }
  })

  it('INVARIANT — le dernier jour utile n’est JAMAIS antérieur au départ, même hors fixtures', () => {
    // L'invariant du bloc 10 n'attrapait rien : il ne tirait que des fixtures à durée
    // positive. Ici on tire aussi des durées hostiles.
    for (const n of [-30, -1, 0, 0.5, 1, NaN]) {
      const r = calculer({ depart: d('2026-06-04'), entree: { ...CPC_354, jours: n } })
      if (r.statut !== 'CALCUL') continue
      expect(toJdn(r.teteAffiche), `jours=${n}`).toBeGreaterThanOrEqual(toJdn(d('2026-06-04')))
    }
  })
})

// ===========================================================================
// § 4.9 — A4 NE S'ÉMET QUE SI LA RÉDACTION A RÉELLEMENT JOUÉ (défaut 8)
// ===========================================================================

describe('§ 4.9 — A4 et son fondement réel', () => {
  /**
   * ⚠️ **CE TEST PORTAIT LA DERNIÈRE OCCURRENCE VIVANTE DE LA RÉSERVE « R1 » DU DÉPÔT** —
   * `expect(r.lectures.map((l) => l.cle)).toEqual(['R1', 'CUMUL'])`, défaut 8 de la troisième
   * recette. R1 a été retirée du moteur le 20 août 2026 au soir (Me Vaval : les fêtes
   * nationales prorogent), et `CleLecture` ne la porte plus ; mais la comparaison se fait sur
   * des `string[]`, `tsc` ne la voyait donc pas, et la ligne précédente échouait AVANT de
   * l'atteindre : une clé morte, cachée derrière un échec. Elle est remplacée ici par la
   * mesure de ce que le moteur rend RÉELLEMENT.
   */
  it('N’ÉMET PAS A4 quand la ligne CUMUL ne vient que de fêtes CONSTITUTIONNELLES', () => {
    // Départ 1er décembre 2029, art. 354 → échéance mardi 1er janvier 2030 (Fête de
    // l'Indépendance), 2 janvier (Jour des Aïeux), et la cascade s'arrête au jeudi 3 janvier.
    // Aucune entrée « rédaction » n'est intervenue : les deux jours en cause sont institués par
    // l'article 275.1 de la Constitution. « Aucun texte du corpus ne l’institue » y était une
    // affirmation FAUSSE, et A4 ne doit pas sortir.
    const r = calcul({ depart: d('2029-12-01'), entree: CPC_354 })
    expect(formatIso(r.teteAffiche)).toBe('2030-01-03')
    // ⚠️ AUCUNE lecture nommée : les deux fêtes nationales sont appliquées en tête d'affiche,
    // et une réserve qui rendrait la date de la tête n'a plus rien à nommer.
    expect(r.lectures.map((l) => l.cle)).toEqual([])
    expect(r.avertissements.some((a) => a.cle === 'A4')).toBe(false)
    // Les deux jours écartés sont NOMMÉS pour ce qu'ils sont, et portent leur source.
    expect(r.joursEcartes.map((j) => formatIso(j.date))).toEqual(['2030-01-01', '2030-01-02'])
    for (const j of r.joursEcartes) expect(j.motifs[0].genre).toBe('FETE_NATIONALE')

    // Sous les règles de la version 1 — tête étroite, un seul jour —, la même entrée rendait le
    // mardi 1er janvier : DEUX jours plus tôt, et c'est ce que rejoue un permalien `rl=1`.
    const v1 = calcul({ depart: d('2029-12-01'), entree: CPC_354, versionRegles: 1 })
    expect(formatIso(v1.teteAffiche)).toBe('2030-01-01')
    expect(v1.lectures.map((l) => l.cle)).toEqual([])
  })

  /**
   * ⚠️ **A4 N'EST PLUS ATTEIGNABLE QUE SOUS LE CALENDRIER DE LA VERSION 1** (20 août 2026) :
   * il naît des seules entrées `autorite: 'REDACTION'`, et la version 2 n'en porte aucune. Le
   * test est donc explicitement versionné — c'est ce que rejoue un permalien `c=1`.
   */
  const V1 = { versionCalendrier: 1, entreesCalendrier: CALENDRIER_V1 } as const

  it('v1 — ÉMET A4 quand une entrée sans texte a joué, et NOMME le jour en cause', () => {
    const r = calcul({ depart: d('2025-10-01'), entree: CPC_354, ...V1 })
    const a4 = r.avertissements.find((a) => a.cle === 'A4')
    expect(a4).toBeDefined()
    // Le jour NOMMÉ est le 1er novembre — le jour porté sans texte —, pas la date d'arrivée
    // de la lecture cumulée.
    expect(a4!.texte).toContain('samedi 1er novembre 2025')
    expect(a4!.texte).toContain('La Toussaint')
    // ⚠️ La formule « sur instruction de la rédaction » a été retirée de toutes les surfaces
    // le 20 août 2026 : A4 nomme désormais la VERSION du calendrier et le décret qui l'a
    // périmée, ce qui est vrai et vérifiable.
    expect(a4!.texte).not.toContain('sur instruction de la rédaction')
    expect(a4!.texte).toContain('11 décembre 2024')
  })

  it('v2 — le même départ n’émet AUCUN A4 : plus aucune entrée sans texte', () => {
    const r = calcul({ depart: d('2025-10-01'), entree: CPC_354 })
    expect(r.avertissements.some((a) => a.cle === 'A4')).toBe(false)
  })

  it('BALAYAGE v1 — tout A4 émis nomme un jour dont l’autorité est bien la rédaction', () => {
    const debut = toJdn({ y: 2020, m: 1, d: 1 })
    let emis = 0
    for (let i = 0; i < 2000; i++) {
      const r = calcul({ depart: fromJdn(debut + ((i * 7919) % 4000)), entree: CPC_354, ...V1 })
      const a4 = r.avertissements.find((a) => a.cle === 'A4')
      if (!a4) continue
      emis++
      // les quatre entrées sans texte de la version 1, et elles seules
      const nomme = ['Lundi Gras', 'Bois-Caïman', '20 septembre', 'Toussaint'].some((n) =>
        a4.texte.includes(n),
      )
      expect(nomme, a4.texte.slice(0, 120)).toBe(true)
    }
    expect(emis).toBeGreaterThan(10)
  })

  it('BALAYAGE v2 — sur les mêmes 2 000 départs, A4 ne s’émet JAMAIS', () => {
    const debut = toJdn({ y: 2020, m: 1, d: 1 })
    for (let i = 0; i < 2000; i++) {
      const r = calcul({ depart: fromJdn(debut + ((i * 7919) % 4000)), entree: CPC_354 })
      expect(r.avertissements.some((a) => a.cle === 'A4'), formatIso(r.teteAffiche)).toBe(false)
    }
  })
})

// ===========================================================================
// § 4.7 et § 6.3 — LE FONDEMENT SE PORTE, L'ARTICLE S'ÉCRIT UNE FOIS (défauts 10, 12, 16)
// ===========================================================================

describe('§ 4.7 — chaque étape cite le fondement de SON code', () => {
  const civ = calcul({ depart: d('2026-06-04'), entree: CIV_28 })
  const etape = (cle: string) => civ.etapes.find((e) => e.cle === cle)!

  it('n’attribue pas au C. pr. civ. le caractère franc d’un délai du Code civil', () => {
    // L'étape 3 donnait le bon fondement (la phrase de l'art. 28 du décret de 1974) et
    // l'étape de l'échéance le démentait aussitôt : « un jour s’ajoute (C. pr. civ.,
    // art. 987) », sur un article du Code CIVIL.
    expect(etape('echeance').texte).not.toContain('C. pr. civ., art. 987')
    expect(etape('echeance').texte).toContain('Décret du 4 avril 1974')
  })

  it('ne rend plus la tautologie du jour de départ pour le Code civil', () => {
    expect(etape('jour-depart').texte).not.toContain(
      'droit commun : le jour du départ ne se compte pas',
    )
    expect(etape('jour-depart').texte).toContain('ne comporte pas de règle générale')
  })

  it('garde les fondements propres du C. pr. civ. et du C. trav.', () => {
    const cpc = calcul({ depart: d('2026-06-04'), entree: CPC_354 })
    expect(cpc.etapes.find((e) => e.cle === 'echeance')!.texte).toContain('C. pr. civ., art. 987')
    const trav = calcul({ depart: d('2026-06-04'), entree: TRAV_507 })
    expect(trav.etapes.find((e) => e.cle === 'echeance')!.texte).toContain('C. trav., art. 511')
  })

  it('dit que le régime franc n’est pas acquis quand il ne l’est pas', () => {
    const r = calcul({ depart: d('2026-06-01'), entree: TRAV_172_DOUTEUX })
    expect(r.etapes.find((e) => e.cle === 'echeance')!.texte).toContain('n’est pas acquis')
  })

  it('écrit « Délai : 30 jours francs », et jamais « art. Art. 28 » (défaut 16)', () => {
    const cpc = calcul({ depart: d('2026-06-04'), entree: CPC_354 })
    expect(cpc.etapes.find((e) => e.cle === 'duree')!.texte).toContain('Délai : 30 jours francs')
    const duree = etape('duree').texte
    expect(duree).toContain('art. 28')
    expect(duree).not.toContain('art. Art.')
    // « 1 jour franc », jamais « 1 jour francs »
    const unJour = calcul({ depart: d('2026-06-04'), entree: { ...CPC_354, jours: 1 } })
    expect(unJour.etapes.find((e) => e.cle === 'duree')!.texte).toContain('1 jour franc (')
  })

  it('compose l’article comme `slugifierArticle`, et laisse intactes les désignations', () => {
    expect(articleAffiche('354')).toBe('art. 354')
    expect(articleAffiche('Art. 28')).toBe('art. 28')
    expect(articleAffiche('Article 991')).toBe('art. 991')
    expect(articleAffiche('10-4°')).toBe('art. 10-4°')
    expect(articleAffiche('Loi, art. 10')).toBe('Loi, art. 10')
    expect(articleAffiche('Jur. (art. 488)')).toBe('Jur. (art. 488)')
    expect(articleAffiche('—')).toBe('')
  })

  it('AUCUNE fixture n’affiche le fondement d’un autre code que le sien (défaut 12)', () => {
    for (const entree of TOUTES_FIXTURES) {
      const r = calculer({ depart: d('2026-06-04'), entree })
      const regime = 'regimeAffiche' in r ? r.regimeAffiche : ''
      if (entree.code === 'CIVIL') {
        expect(regime, entree.slug).not.toContain('art. 987')
        expect(regime, entree.slug).not.toContain('Code de procédure civile sont francs')
      }
      if (entree.code === 'CPC') expect(regime, entree.slug).not.toContain('Code du Travail')
      if (entree.code === 'TRAVAIL') expect(regime, entree.slug).not.toContain('art. 987')
      expect(entree.codeLibelle, entree.slug).not.toBe(
        entree.code === 'CIVIL' ? 'Code de procédure civile' : '—',
      )
    }
  })

  it('REFUS_ANNEES est bien une entrée du Code CIVIL, y compris sur l’écran de refus', () => {
    const r = calculer({ depart: d('2026-06-04'), entree: REFUS_ANNEES })
    expect(REFUS_ANNEES.code).toBe('CIVIL')
    expect(REFUS_ANNEES.codeLibelle).toBe('Code civil')
    if (r.statut !== 'REFUS') throw new Error('refus attendu')
    expect(r.regimeAffiche).not.toContain('art. 987')
    expect(r.regimeAffiche).toContain('Aucune règle générale de computation au Code civil')
  })
})

describe('§ 4.5 — la question de suite de l’article 74', () => {
  it('n’affiche AUCUNE date tant que la question n’a pas de réponse', () => {
    const r = calculer({ depart: d('2026-06-04'), entree: CPC_417_ETRANGER })
    expect(r.statut).toBe('INCOMPLET')
    if (r.statut === 'INCOMPLET') {
      expect(r.manque[0]).toContain('Où demeure la partie ?')
      expect(JSON.stringify(r)).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    }
  })

  it('additionne les composantes, puis UN SEUL jour d’échéance', () => {
    const outreOcean = calcul({
      depart: d('2026-06-04'),
      entree: CPC_417_ETRANGER,
      supplementCle: 'outre-ocean',
    })
    expect(outreOcean.joursBase + outreOcean.joursSupplement).toBe(75)
    expect(formatIso(outreOcean.dernierJourCompte)).toBe('2026-08-18')
    expect(formatIso(outreOcean.teteAffiche)).toBe('2026-08-19')
  })

  it('refuse une option inconnue plutôt que de retomber sur un défaut', () => {
    const r = calculer({
      depart: d('2026-06-04'),
      entree: CPC_417_ETRANGER,
      supplementCle: 'lune',
    })
    expect(r.statut).toBe('REFUS')
  })
})
