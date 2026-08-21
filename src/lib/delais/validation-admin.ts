/**
 * § 7.1 et § 7.4 — LES VALIDATIONS BLOQUANTES DU BACK-OFFICE, en fonctions PURES.
 *
 * Pourquoi ici et non dans la route : une validation écrite dans un `if` de route ne se teste
 * qu'en montant un serveur, et ne se réemploie pas dans l'APERÇU OBLIGATOIRE (§ 7.1) — or
 * l'écran doit refuser AVANT d'enregistrer, avec le même verdict que la route. Une seule
 * copie de la règle, appelée des deux côtés.
 *
 * Le vocabulaire : une **anomalie** BLOQUE l'enregistrement ; un **avertissement** ne le
 * bloque pas mais doit être lu. Les deux portent leur libellé en clair — jamais un code seul,
 * jamais une couleur seule (charte Klinik, règle 5).
 *
 * ⚠️ Ce fichier ne réécrit pas le droit : `controleCivilFranc` et `citationDeFranc` viennent
 * de `regimes.ts`, déjà écrit et testé. On les CONSOMME.
 */
import { isValidCivil, parseIso } from './civil'
import { kindCalcule } from './calcul'
import type { KindDelai } from './calcul'
import {
  AUTORITES,
  CATEGORIES,
  CODES,
  JOURNEES,
  KINDS,
  OFFSETS_PAQUES_ADMIS,
  PROROGATIONS,
  REGIMES,
  TYPES_ENTREE,
  lireSupplement,
} from './depuis-base'
import type { LigneDelaiEntry, LigneDelaiFerie } from './depuis-base'
import { controleCivilFranc, normaliserRegime } from './regimes'
import type { CodeDelai, Regime } from './regimes'

export type Anomalie = {
  /** Le champ fautif — l'écran y porte le focus et y accroche `aria-describedby` (§ 6.2). */
  champ: string
  /** Identifiant stable, pour les tests et le journal d'audit. */
  cle: string
  messageFr: string
}

export type Verdict = { anomalies: Anomalie[]; avertissements: Anomalie[] }

const vide = (s: string | null | undefined) => !s || s.trim() === ''

function ano(champ: string, cle: string, messageFr: string): Anomalie {
  return { champ, cle, messageFr }
}

// ---------------------------------------------------------------------------
// § 7.1 — une entrée du répertoire
// ---------------------------------------------------------------------------

/** La saisie du formulaire, avant conversion. Tout est optionnel : c'est ce qu'on valide. */
export type SaisieEntree = Partial<LigneDelaiEntry>

/**
 * Les validations du § 7.1, dans l'ordre où l'écran les présente. Elles ne s'arrêtent pas à la
 * première : une saisie qui porte trois fautes doit les montrer toutes les trois, sinon
 * l'éditeur corrige et se fait refuser trois fois de suite.
 */
export function validerEntree(d: SaisieEntree): Verdict {
  const anomalies: Anomalie[] = []
  const avertissements: Anomalie[] = []

  // -- Les énumérations. Une valeur hors liste n'est pas « à corriger plus tard » : elle
  //    rendrait la ligne illisible par le moteur (cf. `versEntreeDelai`).
  if (!d.code || !CODES.includes(d.code as CodeDelai)) {
    anomalies.push(ano('code', 'code_invalide', `Le code doit être l’un de : ${CODES.join(', ')}.`))
  }
  if (!d.kind || !KINDS.includes(d.kind as KindDelai)) {
    anomalies.push(ano('kind', 'kind_invalide', `Le genre doit être l’un de : ${KINDS.join(', ')}.`))
  }
  if (!d.regime || !REGIMES.includes(d.regime as Regime)) {
    anomalies.push(
      ano('regime', 'regime_invalide', `Le régime doit être l’un de : ${REGIMES.join(', ')}.`),
    )
  }
  if (!d.prorogation991 || !PROROGATIONS.includes(d.prorogation991 as 'OUI')) {
    anomalies.push(
      ano(
        'prorogation991',
        'prorogation_invalide',
        `La prorogation doit être l’une de : ${PROROGATIONS.join(', ')}.`,
      ),
    )
  }

  // -- L'article. Sans lui, l'entrée ne désigne rien et son slug ne peut pas être formé.
  if (vide(d.article)) {
    anomalies.push(
      ano('article', 'article_vide', 'L’article est obligatoire : une entrée sans article ne désigne aucun texte.'),
    )
  }
  if (vide(d.objetFr)) {
    anomalies.push(ano('objetFr', 'objet_vide', 'L’objet en français est obligatoire — c’est le libellé du menu.'))
  }
  if (vide(d.dureeTexte)) {
    anomalies.push(
      ano(
        'dureeTexte',
        'duree_texte_vide',
        'La durée MOT À MOT du répertoire est obligatoire : c’est elle que le résultat cite, jamais une reformulation.',
      ),
    )
  }
  if (vide(d.pointDepartFr)) {
    anomalies.push(
      ano('pointDepartFr', 'point_depart_vide', 'Le point de départ en français est obligatoire — il devient le libellé du champ date.'),
    )
  }

  // -- Le supplément (art. 74). Il commande la règle des `jours: 0` ci-dessous : on le lit d'abord.
  const sup = lireSupplement(d.supplementJson)
  if (!sup.ok) {
    anomalies.push(ano('supplementJson', 'supplement_malforme', sup.motif))
  }
  const supplementObligatoire = sup.ok && sup.valeur != null && sup.valeur.obligatoire

  // -- Le couple genre / durée. C'est ici que se joue la règle 1 du § 0.
  const calculable = d.kind ? kindCalcule(d.kind as KindDelai) : false
  const joursRenseigne = d.jours != null
  if (calculable) {
    if (!joursRenseigne) {
      anomalies.push(
        ano(
          'jours',
          'jours_absent_sur_kind_calculable',
          'Ce genre calcule une date : le nombre de jours est obligatoire. Un genre qui calcule sans durée rendrait une date sans fondement.',
        ),
      )
    } else if (!Number.isInteger(d.jours) || (d.jours as number) < 0) {
      anomalies.push(
        ano(
          'jours',
          'jours_non_entier',
          'La durée doit être un entier de jours, positif ou nul : un délai ne se compte pas en fractions de jour, et un nombre négatif ferait expirer le délai avant son point de départ.',
        ),
      )
    } else if (d.jours === 0 && !supplementObligatoire) {
      anomalies.push(
        ano(
          'jours',
          'jours_zero_sans_supplement',
          '`jours: 0` n’est admis que si une question de suite OBLIGATOIRE apporte la durée (art. 74). Sinon, l’entrée rendrait la date de départ elle-même.',
        ),
      )
    }
  } else if (joursRenseigne) {
    anomalies.push(
      ano(
        'jours',
        'jours_sur_kind_non_calculable',
        'Ce genre ne calcule pas de date : il ne doit pas porter de nombre de jours. Un nombre porté par une entrée qui refuse laisse croire à un calcul possible.',
      ),
    )
  }

  // -- Le motif de refus. C'est le seul contenu qu'une entrée non calculable rend à l'écran :
  //    vide, l'utilisatrice reçoit un refus muet.
  if (!calculable && d.kind && vide(d.motifRefusFr)) {
    anomalies.push(
      ano(
        'motifRefusFr',
        'motif_refus_vide',
        'Ce genre ne calcule pas : le motif de refus en français est obligatoire. C’est le refus MOTIVÉ qui informe, pas l’absence de date.',
      ),
    )
  }
  // Les deux autres langues retombent sur le français tant qu'elles ne sont pas relues
  // (§ 5.2, règle des ~780 libellés) : on le SIGNALE, on ne bloque pas.
  if (!calculable && d.kind && !vide(d.motifRefusFr) && (vide(d.motifRefusEn) || vide(d.motifRefusHt))) {
    avertissements.push(
      ano('motifRefusEn', 'motif_refus_non_traduit', 'Le motif de refus n’existe qu’en français : l’anglais et le créole y retomberont.'),
    )
  }

  // -- Le fondement du régime. JAMAIS VIDE (§ 4.7).
  if (vide(d.regimeFondement)) {
    anomalies.push(
      ano(
        'regimeFondement',
        'regime_fondement_vide',
        'Le fondement du régime est obligatoire, sans exception : un régime affirmé sans son fondement est une opinion.',
      ),
    )
  } else if (d.code && d.regime && CODES.includes(d.code as CodeDelai) && REGIMES.includes(d.regime as Regime)) {
    // `controleCivilFranc` porte la règle CIVIL + FRANC : citation réelle de l'article, ou
    // `regimeIncertain`. Elle est écrite et testée dans `regimes.ts` — on l'appelle.
    const controle = controleCivilFranc({
      code: d.code as CodeDelai,
      regime: normaliserRegime(d.regime),
      regimeIncertain: d.regimeIncertain ?? false,
      regimeFondement: d.regimeFondement ?? '',
    })
    if (!controle.ok) {
      anomalies.push(ano('regimeFondement', 'civil_franc_sans_citation', controle.motif))
    }
  }
  if (vide(d.prorogationFondement)) {
    anomalies.push(
      ano('prorogationFondement', 'prorogation_fondement_vide', 'Le fondement de la prorogation est obligatoire.'),
    )
  }

  // -- `A_VERIFIER` sur un genre qui calcule : le moteur REFUSERA (§ 4.7, garde-fou 3). Ce
  //    n'est pas une faute de saisie — la rédaction a le droit de verser une ligne qu'elle n'a
  //    pas qualifiée —, mais l'éditeur doit savoir que cette entrée ne rendra aucune date.
  if (d.regime === 'A_VERIFIER' && calculable) {
    avertissements.push(
      ano(
        'regime',
        'a_verifier_sur_kind_calculable',
        'Régime « à vérifier » sur un genre qui calcule : le calculateur REFUSERA toute date pour cette entrée tant que la rédaction ne l’aura pas qualifiée (franc ou ordinaire).',
      ),
    )
  }

  // -- Les distances. `nbDistances` ne vaut 2 que pour les art. 517 et 586 (§ 2.12).
  const nb = d.nbDistances ?? 0
  if (![0, 1, 2].includes(nb)) {
    anomalies.push(ano('nbDistances', 'nb_distances_invalide', 'Le nombre de kilométrages ne peut être que 0, 1 ou 2.'))
  }
  if (d.kind === 'JOURS_PLUS_DISTANCE_KM' && nb === 0) {
    anomalies.push(
      ano(
        'nbDistances',
        'distance_sans_kilometrage',
        'Ce genre ajoute un délai de distance : il faut déclarer 1 ou 2 kilométrages à saisir.',
      ),
    )
  }
  if (d.kind !== 'JOURS_PLUS_DISTANCE_KM' && nb > 0) {
    anomalies.push(
      ano('nbDistances', 'kilometrage_sans_distance', 'Seul le genre « jours + distance » fait saisir un kilométrage.'),
    )
  }

  // -- L'avis A5 (« un jour par cinq lieues ») exige la phrase de l'article (§ 4.9).
  if (d.avisDistance === 'A5' && !/lieue/i.test(d.citationArticle ?? '')) {
    anomalies.push(
      ano(
        'citationArticle',
        'a5_sans_citation_lieue',
        'L’avis A5 annonce une augmentation « d’un jour par cinq lieues » : la citation de l’article qui le dit est obligatoire, et elle doit contenir le mot « lieue ».',
      ),
    )
  }

  return { anomalies, avertissements }
}

// ---------------------------------------------------------------------------
// § 7.4 — une entrée du calendrier
// ---------------------------------------------------------------------------

export type SaisieFerie = Partial<LigneDelaiFerie>

/**
 * Les validations du § 7.4. `precedent` est la ligne telle qu'elle existe dans la version
 * courante, quand il s'agit d'une modification : elle sert à détecter LA BASCULE
 * `A_SURVEILLER → PERMANENT`, seul chemin par lequel un jour à surveiller se met à proroger —
 * et il passe par un texte versé au corpus, pas par une case à cocher.
 */
export function validerFerie(d: SaisieFerie, precedent?: SaisieFerie | null): Verdict {
  const anomalies: Anomalie[] = []
  const avertissements: Anomalie[] = []

  if (vide(d.cle) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.cle ?? '')) {
    anomalies.push(
      ano('cle', 'cle_invalide', 'La clé est obligatoire, en minuscules sans accent, mots séparés par des tirets simples (ex. « mercredi-des-cendres »).'),
    )
  }
  if (vide(d.libelleFr)) {
    anomalies.push(ano('libelleFr', 'libelle_vide', 'Le libellé en français est obligatoire.'))
  }
  const typeEntree = d.typeEntree ?? 'PERMANENT'
  if (!TYPES_ENTREE.includes(typeEntree as 'PERMANENT')) {
    anomalies.push(ano('typeEntree', 'type_entree_invalide', `Le type doit être ${TYPES_ENTREE.join(' ou ')}.`))
  }
  if (!d.categorie || !CATEGORIES.includes(d.categorie as 'FETE_LEGALE')) {
    anomalies.push(ano('categorie', 'categorie_invalide', `La catégorie doit être l’une de : ${CATEGORIES.join(', ')}.`))
  }
  if (!d.autorite || !AUTORITES.includes(d.autorite as 'TEXTE')) {
    anomalies.push(ano('autorite', 'autorite_invalide', `L’autorité doit être l’une de : ${AUTORITES.join(', ')}.`))
  }
  const journee = d.journee ?? 'JOURNEE_ENTIERE'
  if (!JOURNEES.includes(journee as 'JOURNEE_ENTIERE')) {
    anomalies.push(ano('journee', 'journee_invalide', `La journée doit être ${JOURNEES.join(' ou ')}.`))
  }

  // -- LA RÈGLE QUI EMPÊCHE QUE LA LISTE REDEVIENNE UNE OPINION. Sans exception.
  if (vide(d.source)) {
    anomalies.push(
      ano('source', 'source_vide', 'La source est obligatoire, sans exception : c’est la règle qui empêche que la liste redevienne une opinion.'),
    )
  }

  // -- La datation. Une entrée qu'on ne sait pas dater n'entre dans aucun calcul.
  if (d.mobile) {
    if (d.offsetPaques == null || !OFFSETS_PAQUES_ADMIS.includes(d.offsetPaques)) {
      anomalies.push(
        ano(
          'offsetPaques',
          'offset_paques_invalide',
          `Une entrée mobile porte l’un des sept décalages pascals admis : ${OFFSETS_PAQUES_ADMIS.join(', ')}.`,
        ),
      )
    }
    if (d.mois != null || d.jour != null) {
      anomalies.push(ano('mois', 'mobile_avec_date_fixe', 'Une entrée mobile ne porte ni mois ni jour fixes.'))
    }
  } else {
    if (d.mois == null || d.jour == null || !isValidCivil({ y: 2024, m: d.mois, d: d.jour })) {
      anomalies.push(ano('mois', 'date_fixe_invalide', 'Une entrée fixe porte un mois et un jour qui forment une date.'))
    }
    if (d.offsetPaques != null) {
      anomalies.push(ano('offsetPaques', 'fixe_avec_offset', 'Une entrée fixe ne porte pas de décalage pascal.'))
    }
  }
  if (!parseIso(d.appliqueDepuis ?? '')) {
    anomalies.push(
      ano('appliqueDepuis', 'applique_depuis_invalide', 'La date d’application s’écrit AAAA-MM-JJ (ex. « 1989-06-22 »).'),
    )
  }

  // -- Le tableau 2 : les jours À SURVEILLER. Chaque règle empêche une phrase fausse à l'écran.
  if (typeEntree === 'A_SURVEILLER') {
    if (vide(d.observationsTexteFr)) {
      anomalies.push(
        ano(
          'observationsTexteFr',
          'observations_texte_vide',
          'Un jour à surveiller doit dire ce que le corpus montre : le texte des observations est obligatoire (il est repris mot pour mot dans l’avertissement A6).',
        ),
      )
    }
    if (vide(d.observationsBorneFr)) {
      anomalies.push(
        ano(
          'observationsBorneFr',
          'observations_borne_vide',
          'La borne de l’Index est obligatoire : sans cette phrase, un écran qui ne trouve rien laisse croire qu’il n’y a rien.',
        ),
      )
    }
    if (d.observationsN == null || !Number.isInteger(d.observationsN) || d.observationsN < 0) {
      anomalies.push(
        ano(
          'observationsN',
          'observations_n_invalide',
          'Le nombre d’arrêtés relevés est obligatoire et entier. Ce nombre doit être recompté sur le corpus, pas estimé.',
        ),
      )
    }
    if (journee === 'DEMI_JOURNEE_APRES_MIDI') {
      anomalies.push(
        ano(
          'journee',
          'a_surveiller_demi_journee',
          'Un jour à surveiller ne se déclare pas en demi-journée : il ne proroge rien, il avertit (§ 5.4 bis).',
        ),
      )
    }
  } else {
    // Les colonnes d'observation sont RÉSERVÉES au tableau 2 : les renseigner sur une entrée
    // permanente ferait afficher un avertissement A6 sur un jour qui, lui, proroge déjà.
    const intruses = (
      [
        ['observationsN', d.observationsN],
        ['observationsTexteFr', d.observationsTexteFr],
        ['observationsBorneFr', d.observationsBorneFr],
        ['rechercheCorpusQ', d.rechercheCorpusQ],
      ] as const
    ).filter(([, v]) => v != null && v !== '')
    for (const [champ] of intruses) {
      anomalies.push(
        ano(champ, 'observations_sur_permanent', `« ${champ} » est réservé aux jours à surveiller : une entrée permanente proroge, elle n’avertit pas.`),
      )
    }
  }

  /**
   * -- LES DEUX RÈGLES DE CE QUI PROROGE. **Ce sont des INVARIANTS de toute ligne PERMANENT,
   * pas des contrôles de la seule bascule.**
   *
   * ⚠️ CORRECTIF (défaut majeur du 20 août 2026). Elles ne s'appliquaient qu'à la « bascule »
   * `A_SURVEILLER → PERMANENT` détectée sur la version COURANTE du calendrier. Le verrou se
   * contournait donc en deux appels `corpus.manage` : `masquer` publie une version d'où la
   * ligne est absente, puis `ajouter` avec la même clé ne trouve plus de précédent, et la
   * ligne repart en PERMANENT / OBSERVATION / sans `sourceDocId`. Un jour qui ne prorogeait
   * pas se mettait à proroger sans aucun texte versé au corpus — et il RETARDE toutes les
   * dates limites, c'est-à-dire qu'il fabrique la forclusion (§ 0, règle 4).
   *
   * Le second garde-fou du même trou est dans la route : le `precedent` se cherche sur TOUTE
   * l'histoire du calendrier, jamais sur la seule version courante.
   */
  if (typeEntree === 'PERMANENT') {
    // Le message d'erreur d'origine l'affirmait déjà : « une entrée qui proroge ne peut pas
    // avoir pour autorité OBSERVATION ». Rien ne l'interdisait pourtant à la création.
    if (d.autorite === 'OBSERVATION') {
      anomalies.push(
        ano(
          'autorite',
          'permanent_sur_observation',
          'Une entrée qui proroge ne peut pas avoir pour autorité « OBSERVATION » : l’observation constate des arrêtés ponctuels, elle n’institue pas une fête.',
        ),
      )
    }
    // La bascule reste ce qu'elle était — le SEUL chemin par lequel un jour à surveiller se
    // met à proroger — mais elle se lit désormais sur l'histoire entière de la clé.
    if (precedent?.typeEntree === 'A_SURVEILLER' && vide(d.sourceDocId)) {
      anomalies.push(
        ano(
          'sourceDocId',
          'bascule_sans_document',
          'Faire proroger un jour jusque-là seulement surveillé exige un texte VERSÉ AU CORPUS : renseignez l’identifiant du document source.',
        ),
      )
    }
  }

  // -- L'autorité REDACTION tient l'entrée HORS de la tête d'affiche : l'écran doit le dire
  //    (§ 7.4). ⚠️ Depuis le décret du 11 décembre 2024, les onze fêtes légales ont un texte :
  //    créer une entrée sans texte est devenu l'exception, et elle ne nomme plus aucune
  //    lecture concurrente (la réserve R6 a été retirée le 20 août 2026, voir `lectures.ts`).
  if (d.autorite === 'REDACTION' && typeEntree === 'PERMANENT') {
    avertissements.push(
      ano(
        'autorite',
        'redaction_hors_tete',
        'Cette entrée ne proroge pas la date en tête d’affiche : aucun texte du corpus ne l’institue. Elle n’apparaîtra que dans la lecture la plus large.',
      ),
    )
  }

  return { anomalies, avertissements }
}

// ---------------------------------------------------------------------------
// Les motifs — masquer, supprimer
// ---------------------------------------------------------------------------

/**
 * § 7.2 / § 7.3 — le motif est affiché AUX UTILISATEURS sur les permaliens d'un calcul rendu
 * avec une entrée retirée. Un motif vide y afficherait « Motif : ». Longueur minimale : une
 * phrase, pas une lettre.
 */
export function validerMotif(motif: string | null | undefined): Anomalie | null {
  if (vide(motif)) {
    return ano('masqueMotif', 'motif_vide', 'Le motif est obligatoire : il est affiché aux utilisateurs sur les calculs déjà rendus.')
  }
  if ((motif ?? '').trim().length < 5) {
    return ano('masqueMotif', 'motif_trop_court', 'Le motif doit être une phrase lisible par un tiers, pas une abréviation.')
  }
  return null
}

/**
 * § 7.3 — la confirmation TYPÉE d'une suppression : l'éditeur recopie le numéro d'article
 * (répertoire) ou la clé (calendrier). Une case à cocher se coche sans lire.
 */
export function confirmationTypeeValide(attendu: string, saisi: string | null | undefined): boolean {
  const normaliser = (s: string) =>
    (s ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  return normaliser(attendu) !== '' && normaliser(attendu) === normaliser(saisi ?? '')
}
