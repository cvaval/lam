/**
 * § 7.1 et § 7.4 — LES INVARIANTS D'ADMINISTRATION.
 *
 * Chacun de ces tests correspond à une phrase fausse qui, sans lui, pourrait être publiée : une
 * date sans durée, un régime sans fondement, un refus sans motif, un jour du calendrier sans
 * source. Ce ne sont pas des contrôles de formulaire — ce sont les garde-fous qui empêchent la
 * plateforme d'affirmer ce qu'aucun texte ne porte.
 */
import { describe, expect, it } from 'vitest'
import {
  confirmationTypeeValide,
  validerEntree,
  validerFerie,
  validerMotif,
} from './validation-admin'
import type { SaisieEntree, SaisieFerie } from './validation-admin'

const cles = (v: { anomalies: { cle: string }[] }) => v.anomalies.map((a) => a.cle)

/** Une entrée VALIDE de référence : chaque test n'en dérange qu'un champ à la fois. */
const ENTREE_OK: SaisieEntree = {
  code: 'CPC',
  article: '354',
  objetFr: 'Appel — parties demeurant en Haïti',
  dureeTexte: '30 jours francs',
  kind: 'JOURS',
  jours: 30,
  nbDistances: 0,
  regime: 'FRANC',
  regimeIncertain: false,
  regimeFondement:
    'C. pr. civ., art. 987 — « Tous les délais prévus au Code de procédure civile sont francs. »',
  prorogation991: 'OUI',
  prorogationFondement: 'C. pr. civ., art. 991 al. 3',
  pointDepartFr: 'Signification du jugement à personne ou domicile',
}

describe('§ 7.1 — une entrée du répertoire', () => {
  it('l’entrée de référence passe sans anomalie', () => {
    expect(cles(validerEntree(ENTREE_OK))).toEqual([])
  })

  it('un genre qui CALCULE sans nombre de jours est refusé', () => {
    expect(cles(validerEntree({ ...ENTREE_OK, jours: null }))).toContain(
      'jours_absent_sur_kind_calculable',
    )
  })

  it('un nombre de jours sur un genre qui NE calcule PAS est refusé', () => {
    const v = validerEntree({
      ...ENTREE_OK,
      kind: 'MOIS',
      jours: 3,
      motifRefusFr: 'Ce délai se compte en mois.',
    })
    expect(cles(v)).toContain('jours_sur_kind_non_calculable')
  })

  it('`jours: 0` est refusé SANS question de suite obligatoire, et admis AVEC', () => {
    expect(cles(validerEntree({ ...ENTREE_OK, jours: 0 }))).toContain('jours_zero_sans_supplement')

    const supplement = JSON.stringify({
      type: 'ART_74',
      questionFr: 'Où demeure la partie ?',
      obligatoire: true,
      options: [
        { cle: 'antilles', jours: 30, libelleFr: 'Antilles', fondement: 'C. pr. civ., art. 74' },
      ],
    })
    expect(cles(validerEntree({ ...ENTREE_OK, jours: 0, supplementJson: supplement }))).toEqual([])
  })

  it('une durée fractionnaire ou négative est refusée — un délai ne se compte pas en demi-jours', () => {
    expect(cles(validerEntree({ ...ENTREE_OK, jours: 2.5 }))).toContain('jours_non_entier')
    expect(cles(validerEntree({ ...ENTREE_OK, jours: -5 }))).toContain('jours_non_entier')
  })

  it('un fondement de régime vide est refusé, sans exception', () => {
    expect(cles(validerEntree({ ...ENTREE_OK, regimeFondement: '   ' }))).toContain(
      'regime_fondement_vide',
    )
  })

  it('CIVIL + FRANC sans CITATION de l’article est refusé (§ 4.7, garde-fou 1)', () => {
    const v = validerEntree({
      ...ENTREE_OK,
      code: 'CIVIL',
      regime: 'FRANC',
      // Une formule SUR l'article, pas une phrase DE l'article.
      regimeFondement: 'L’article lui-même qualifie le délai de franc.',
    })
    expect(cles(v)).toContain('civil_franc_sans_citation')
  })

  it('… et il est admis dès que l’entrée est marquée `regimeIncertain`', () => {
    const v = validerEntree({
      ...ENTREE_OK,
      code: 'CIVIL',
      regime: 'FRANC',
      regimeIncertain: true,
      regimeFondement: 'L’article lui-même qualifie le délai de franc.',
    })
    expect(cles(v)).not.toContain('civil_franc_sans_citation')
  })

  it('un genre qui ne calcule pas SANS motif de refus est refusé — un refus muet n’informe pas', () => {
    expect(cles(validerEntree({ ...ENTREE_OK, kind: 'INDETERMINE', jours: null }))).toContain(
      'motif_refus_vide',
    )
  })

  it('un `supplementJson` mal formé, ou une option sans fondement, est refusé', () => {
    expect(cles(validerEntree({ ...ENTREE_OK, supplementJson: '{oups' }))).toContain(
      'supplement_malforme',
    )
    const sansFondement = JSON.stringify({
      type: 'ART_74',
      questionFr: 'Où demeure la partie ?',
      obligatoire: true,
      options: [{ cle: 'antilles', jours: 30, libelleFr: 'Antilles' }],
    })
    expect(cles(validerEntree({ ...ENTREE_OK, supplementJson: sansFondement }))).toContain(
      'supplement_malforme',
    )
  })

  it('un article vide est refusé', () => {
    expect(cles(validerEntree({ ...ENTREE_OK, article: '  ' }))).toContain('article_vide')
  })

  it('l’avis A5 sans citation portant le mot « lieue » est refusé (§ 4.9)', () => {
    const v = validerEntree({ ...ENTREE_OK, avisDistance: 'A5', citationArticle: 'un jour de plus' })
    expect(cles(v)).toContain('a5_sans_citation_lieue')
  })

  it('`A_VERIFIER` sur un genre qui calcule AVERTIT sans bloquer — la rédaction a le droit de ne pas trancher', () => {
    const v = validerEntree({ ...ENTREE_OK, regime: 'A_VERIFIER' })
    expect(cles(v)).toEqual([])
    expect(v.avertissements.map((a) => a.cle)).toContain('a_verifier_sur_kind_calculable')
  })

  it('trois fautes rendent TROIS anomalies — on ne corrige pas trois fois de suite', () => {
    const v = validerEntree({ ...ENTREE_OK, article: '', regimeFondement: '', jours: null })
    expect(v.anomalies.length).toBeGreaterThanOrEqual(3)
  })
})

/** Une ligne de calendrier PERMANENTE valide : le 1er janvier. */
const FERIE_OK: SaisieFerie = {
  cle: '1er-janvier',
  typeEntree: 'PERMANENT',
  libelleFr: 'Jour de l’An — Indépendance nationale',
  categorie: 'FETE_LEGALE',
  autorite: 'TEXTE',
  journee: 'JOURNEE_ENTIERE',
  mobile: false,
  mois: 1,
  jour: 1,
  source: 'Décret du 23 mai 1989 déterminant les Fêtes Légales — Le Moniteur n° 47-A.',
  appliqueDepuis: '1989-06-22',
}

/** Une ligne À SURVEILLER valide : le mercredi des Cendres (§ 4.13). */
const A_SURVEILLER_OK: SaisieFerie = {
  cle: 'mercredi-des-cendres',
  typeEntree: 'A_SURVEILLER',
  libelleFr: 'Mercredi des Cendres',
  categorie: 'CHOMAGE_PAR_ARRETE',
  autorite: 'OBSERVATION',
  journee: 'JOURNEE_ENTIERE',
  mobile: true,
  offsetPaques: -46,
  source: 'Observation du corpus : arrêtés de chômage relevés au Moniteur.',
  appliqueDepuis: '1989-06-22',
  observationsN: 14,
  observationsTexteFr:
    '14 arrêtés de chômage du Moniteur portent une date qui est exactement le mercredi des Cendres de leur année, de 1969 à 2020.',
  observationsBorneFr: 'L’Index du Moniteur de Lam s’arrête au 20 juin 2023.',
  rechercheCorpusQ: 'carnaval',
}

describe('§ 7.4 — le calendrier des fêtes', () => {
  it('les deux lignes de référence passent', () => {
    expect(cles(validerFerie(FERIE_OK))).toEqual([])
    expect(cles(validerFerie(A_SURVEILLER_OK))).toEqual([])
  })

  it('une SOURCE vide est refusée — sans exception, sur les deux tableaux', () => {
    expect(cles(validerFerie({ ...FERIE_OK, source: '' }))).toContain('source_vide')
    expect(cles(validerFerie({ ...A_SURVEILLER_OK, source: '   ' }))).toContain('source_vide')
  })

  it('A_SURVEILLER sans texte d’observations est refusé', () => {
    expect(cles(validerFerie({ ...A_SURVEILLER_OK, observationsTexteFr: '' }))).toContain(
      'observations_texte_vide',
    )
  })

  it('A_SURVEILLER sans borne de l’Index est refusé — un écran qui ne trouve rien laisserait croire qu’il n’y a rien', () => {
    expect(cles(validerFerie({ ...A_SURVEILLER_OK, observationsBorneFr: null }))).toContain(
      'observations_borne_vide',
    )
  })

  it('A_SURVEILLER sans nombre entier d’arrêtés est refusé', () => {
    expect(cles(validerFerie({ ...A_SURVEILLER_OK, observationsN: null }))).toContain(
      'observations_n_invalide',
    )
    expect(cles(validerFerie({ ...A_SURVEILLER_OK, observationsN: 12.5 }))).toContain(
      'observations_n_invalide',
    )
  })

  it('A_SURVEILLER en demi-journée est refusé (§ 5.4 bis)', () => {
    expect(
      cles(validerFerie({ ...A_SURVEILLER_OK, journee: 'DEMI_JOURNEE_APRES_MIDI' })),
    ).toContain('a_surveiller_demi_journee')
  })

  it('les colonnes d’observation sont INTERDITES sur une entrée permanente', () => {
    expect(cles(validerFerie({ ...FERIE_OK, observationsN: 3 }))).toContain(
      'observations_sur_permanent',
    )
  })

  it('LA BASCULE A_SURVEILLER → PERMANENT exige un document du corpus ET une autorité autre qu’OBSERVATION', () => {
    const bascule = validerFerie(
      {
        ...A_SURVEILLER_OK,
        typeEntree: 'PERMANENT',
        observationsN: null,
        observationsTexteFr: null,
        observationsBorneFr: null,
        rechercheCorpusQ: null,
      },
      A_SURVEILLER_OK,
    )
    expect(cles(bascule)).toContain('bascule_sans_document')
    expect(cles(bascule)).toContain('permanent_sur_observation')
  })

  /**
   * ⚠️ Les deux règles sont des INVARIANTS de toute ligne PERMANENT, pas des contrôles de la
   * seule bascule : sans cela, elles se contournaient en masquant la ligne puis en la
   * recréant (le précédent disparaissait de la version courante).
   */
  it('une ligne PERMANENT ne peut PAS avoir l’autorité OBSERVATION, même sans précédent', () => {
    const neuve = validerFerie({
      ...A_SURVEILLER_OK,
      cle: 'jour-tout-neuf',
      typeEntree: 'PERMANENT',
      observationsN: null,
      observationsTexteFr: null,
      observationsBorneFr: null,
      rechercheCorpusQ: null,
    })
    expect(cles(neuve)).toContain('permanent_sur_observation')
  })

  it('… et elle passe dès qu’un texte du corpus la fonde', () => {
    const bascule = validerFerie(
      {
        ...A_SURVEILLER_OK,
        typeEntree: 'PERMANENT',
        autorite: 'TEXTE',
        sourceDocId: 'cmsw5mxng000ag85y3o2ey2rr',
        source: 'Décret du 23 mai 1989 — Le Moniteur n° 47-A.',
        observationsN: null,
        observationsTexteFr: null,
        observationsBorneFr: null,
        rechercheCorpusQ: null,
      },
      A_SURVEILLER_OK,
    )
    expect(cles(bascule)).toEqual([])
  })

  it('une entrée mobile hors des sept décalages pascals est refusée', () => {
    expect(cles(validerFerie({ ...A_SURVEILLER_OK, offsetPaques: -45 }))).toContain(
      'offset_paques_invalide',
    )
  })

  it('une entrée fixe sans date, ou mobile avec une date fixe, est refusée', () => {
    expect(cles(validerFerie({ ...FERIE_OK, mois: null, jour: null }))).toContain(
      'date_fixe_invalide',
    )
    expect(cles(validerFerie({ ...A_SURVEILLER_OK, mois: 2, jour: 10 }))).toContain(
      'mobile_avec_date_fixe',
    )
  })

  /**
   * ⚠️ **L'AVERTISSEMENT NE NOMME PLUS LA RÉSERVE R6**, retirée le 20 août 2026 (le décret du
   * 11 décembre 2024 institue les onze fêtes légales, et la version 2 du calendrier ne porte
   * plus aucune entrée sans texte). Il subsiste : un éditeur peut encore créer une telle
   * entrée depuis le back-office, et l'écran doit lui dire ce qu'elle fera — rien, en tête
   * d'affiche.
   */
  it('l’autorité REDACTION dit que l’entrée reste hors de la tête d’affiche', () => {
    const v = validerFerie({ ...FERIE_OK, autorite: 'REDACTION' })
    expect(v.avertissements.map((a) => a.cle)).toContain('redaction_hors_tete')
    expect(v.avertissements.map((a) => a.cle)).not.toContain('redaction_reserve_r6')
  })
})

describe('§ 7.2 / § 7.3 — motif et confirmation typée', () => {
  it('un motif vide ou trop court est refusé : il est affiché AUX UTILISATEURS', () => {
    expect(validerMotif('')?.cle).toBe('motif_vide')
    expect(validerMotif('n/a')?.cle).toBe('motif_trop_court')
    expect(validerMotif('Doublon de l’article 354.')).toBeNull()
  })

  it('la confirmation typée compare sans casse ni accent, et refuse le vide', () => {
    expect(confirmationTypeeValide('354', '354')).toBe(true)
    expect(confirmationTypeeValide('Art. 229 (L. 5 mai 1949)', 'art. 229 (l. 5 mai 1949)')).toBe(true)
    expect(confirmationTypeeValide('354', '355')).toBe(false)
    expect(confirmationTypeeValide('354', '')).toBe(false)
    expect(confirmationTypeeValide('', '')).toBe(false)
  })
})
