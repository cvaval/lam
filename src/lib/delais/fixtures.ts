/**
 * Entrées de référence du calculateur de délais.
 *
 * Elles servent (a) aux tests du § 9, (b) à l'« aperçu obligatoire » du back-office (§ 7.1),
 * qui exige de VOIR ce qu'une règle rend avant de la publier. Chacune reproduit une ligne
 * réelle du répertoire, avec sa durée écrite mot à mot et son fondement.
 *
 * ⚠️ Ce fichier n'est PAS le répertoire : les 393 lignes vivent en base, versées par
 * `scripts/seed-delais.ts` depuis `data/delais-catalogue.json`.
 */
import type { EntreeDelai, Supplement } from './calcul'
import { CITATIONS_CIVIL_FRANC } from './textes'
import { FONDEMENT_PROROGATION_PAR_CODE, FONDEMENT_REGIME_PAR_CODE } from './regimes'

/** § 4.5 — la question de suite de l'article 74, telle qu'elle se pose à l'écran. */
export const SUPPLEMENT_ART_74: Supplement = {
  type: 'ART_74',
  questionFr: 'Où demeure la partie ?',
  obligatoire: true,
  options: [
    {
      cle: 'haiti',
      jours: 0,
      libelleFr: 'En Haïti',
      noteFr: 'L’article 74 ne s’applique pas.',
    },
    {
      cle: 'antilles',
      jours: 30,
      libelleFr: 'Antilles ou continent américain',
      fondement: 'C. pr. civ., art. 74 — « trente jours francs »',
    },
    {
      cle: 'outre-ocean',
      jours: 45,
      libelleFr: 'Au-delà de l’un ou l’autre océan',
      fondement: 'C. pr. civ., art. 74 — « quarante-cinq jours francs »',
    },
  ],
}

/** C. pr. civ., art. 354 — appel, parties demeurant en Haïti. Le gabarit vérifié du § 6.3. */
export const CPC_354: EntreeDelai = {
  slug: 'cpc-354-appel-parties-demeurant-haiti',
  code: 'CPC',
  codeLibelle: 'Code de procédure civile',
  article: '354',
  objetFr: 'Appel — parties demeurant en Haïti',
  dureeTexte: '30 jours francs',
  kind: 'JOURS',
  jours: 30,
  regime: 'FRANC',
  regimeIncertain: false,
  regimeFondement: FONDEMENT_REGIME_PAR_CODE.CPC,
  prorogation991: 'OUI',
  prorogationFondement: FONDEMENT_PROROGATION_PAR_CODE.CPC,
  pointDepartFr: 'signification du jugement à personne ou domicile',
  revision: 1,
}

/** C. pr. civ., art. 424 — l'arrêt n° 45 du 29 juillet 1965 : « justement les huit jours francs ». */
export const CPC_424: EntreeDelai = {
  ...CPC_354,
  slug: 'cpc-424-opposition-arret-defaut',
  article: '424',
  objetFr: 'Opposition — arrêt par défaut',
  dureeTexte: '8 jours francs',
  jours: 8,
}

/** C. pr. civ., art. 417 — pourvoi, personnes habitant l'étranger : art. 74 en supplément. */
export const CPC_417_ETRANGER: EntreeDelai = {
  ...CPC_354,
  slug: 'cpc-417-pourvoi-personnes-habitant-etranger',
  article: '417',
  objetFr: 'Pourvoi en cassation — personnes habitant l’étranger',
  dureeTexte: '30 jours francs + délais de l’art. 74',
  jours: 30,
  supplement: SUPPLEMENT_ART_74,
  pointDepartFr: 'signification au Parquet du Ministère Public',
}

/** C. pr. civ., art. 425 — pourvoi, avec délai de distance jusqu'au siège de la Cour. */
export const CPC_425: EntreeDelai = {
  ...CPC_354,
  slug: 'cpc-425-pourvoi-delai-distance',
  article: '425',
  objetFr: 'Pourvoi en cassation — délai de distance',
  dureeTexte: '20 jours + délai de distance',
  kind: 'JOURS_PLUS_DISTANCE_KM',
  jours: 20,
  nbDistances: 1,
}

/** L'entrée de l'arrêt Germeil : 30 jours francs et un kilométrage saisi. */
export const CPC_GERMEIL: EntreeDelai = {
  ...CPC_354,
  slug: 'cpc-354-appel-avec-distance',
  article: '354',
  objetFr: 'Appel — avec délai de distance',
  dureeTexte: '30 jours francs + délai de distance',
  kind: 'JOURS_PLUS_DISTANCE_KM',
  jours: 30,
  nbDistances: 1,
}

/** C. pr. civ., art. 517 — DEUX distances (§ 2.12). Un champ unique donnerait la moitié des jours dus. */
export const CPC_517: EntreeDelai = {
  ...CPC_354,
  slug: 'cpc-517-saisie-arret-deux-distances',
  article: '517',
  objetFr: 'Saisie-arrêt — dénonciation au débiteur saisi',
  dureeTexte: '8 jours + un jour par 40 km (deux distances)',
  kind: 'JOURS_PLUS_DISTANCE_KM',
  jours: 8,
  nbDistances: 2,
}

/** C. trav., art. 507 — déclaration de pourvoi et dépôt au greffe. Délai de procédure : franc. */
export const TRAV_507: EntreeDelai = {
  slug: 'trav-507-declaration-pourvoi-depot-greffe',
  code: 'TRAVAIL',
  codeLibelle: 'Code du travail',
  article: '507',
  objetFr: 'Déclaration de pourvoi et dépôt au greffe',
  dureeTexte: '8 jours',
  kind: 'JOURS',
  jours: 8,
  regime: 'FRANC',
  regimeIncertain: false,
  regimeFondement: FONDEMENT_REGIME_PAR_CODE.TRAVAIL,
  prorogation991: 'OUI',
  prorogationFondement: FONDEMENT_PROROGATION_PAR_CODE.TRAVAIL,
  pointDepartFr: 'prononcé de la décision',
  revision: 1,
}

/**
 * C. trav., art. 172 (Chapitre III) — réponse concrète aux revendications, 10 jours.
 * « Délai de procédure » n'est PAS acquis : `regimeIncertain: true`. Tête d'affiche en
 * ORDINAIRE, régime franc en lecture nommée (§ 4.7, garde-fou 2).
 */
export const TRAV_172_DOUTEUX: EntreeDelai = {
  ...TRAV_507,
  slug: 'trav-172-reponse-concrete-revendications',
  article: '172',
  articleContexte:
    'Chapitre III — Des conflits collectifs de travail Règlements amiables Conciliation',
  objetFr: 'Réponse concrète aux revendications (règlement direct)',
  dureeTexte: '10 jours',
  jours: 10,
  regimeIncertain: true,
  pointDepartFr: 'présentation des revendications',
}

/** C. civ. — décret du 4 avril 1974 (adoption), art. 28 : citation vérifiée en base. */
export const CIV_28: EntreeDelai = {
  slug: 'civ-28-recours-cour-appel-refus-homologation',
  code: 'CIVIL',
  codeLibelle: 'Code civil',
  article: 'Art. 28',
  objetFr: 'Recours devant la Cour d’appel contre le refus d’homologation',
  dureeTexte: '30 jours francs',
  kind: 'JOURS',
  jours: 30,
  regime: 'FRANC',
  regimeIncertain: false,
  regimeFondement: `${CITATIONS_CIVIL_FRANC['Art. 28'].reference} — « ${CITATIONS_CIVIL_FRANC['Art. 28'].citation} »`,
  prorogation991: 'INCERTAIN',
  prorogationFondement: FONDEMENT_PROROGATION_PAR_CODE.CIVIL,
  pointDepartFr: 'prononcé du jugement',
  revision: 1,
}

/**
 * C. civ. — « Loi, art. 10 », transcription du dispositif du jugement de divorce, donnée pour
 * « 3 jours francs ». **AUCUNE citation dans le corpus** (vérifié en base le 19 août 2026) :
 * l'entrée est marquée `regimeIncertain: true` et le moteur n'affirme pas qu'elle est franche.
 * C'est le correctif du défaut 1.
 */
export const CIV_LOI_10: EntreeDelai = {
  ...CIV_28,
  slug: 'civ-loi-art-10-transcription-dispositif-jugement-arret',
  article: 'Loi, art. 10',
  objetFr:
    'Transcription du dispositif du jugement ou arrêt de divorce par l’officier de l’état civil',
  dureeTexte: '3 jours francs',
  jours: 3,
  regimeIncertain: true,
  regimeFondement: CITATIONS_CIVIL_FRANC['Loi, art. 10'].constat,
  pointDepartFr: 'signification-sommation par huissier, récépissé fiscal joint',
}

/** C. civ., art. 229 (L. 5 mai 1949) — « outre le délai de distance », non chiffré : A5-BIS. */
export const CIV_229: EntreeDelai = {
  ...CIV_28,
  slug: 'civ-229-l-5-mai-1949',
  article: 'Art. 229 (L. 5 mai 1949)',
  objetFr: 'Citation du défendeur à comparaître',
  dureeTexte: 'Huitaine franche + délai de distance',
  kind: 'JOURS_DISTANCE_NON_CHIFFREE',
  jours: 8,
  regimeFondement: `${CITATIONS_CIVIL_FRANC['Art. 229 (L. 5 mai 1949)'].reference} — « ${CITATIONS_CIVIL_FRANC['Art. 229 (L. 5 mai 1949)'].citation} »`,
  avisDistance: 'A5_BIS',
  citationArticle: CITATIONS_CIVIL_FRANC['Art. 229 (L. 5 mai 1949)'].citation,
  pointDepartFr: 'permission du tribunal',
}

/** C. civ., art. 1827 — « un jour par cinq lieues » : A5. */
export const CIV_1827: EntreeDelai = {
  ...CIV_28,
  slug: 'civ-1827-quinzaine-un-jour-cinq-lieues',
  article: '1827',
  objetFr: 'Surenchère',
  dureeTexte: 'Quinzaine + 1 jour / 5 lieues',
  kind: 'JOURS_DISTANCE_NON_CHIFFREE',
  jours: 15,
  regime: 'ORDINAIRE',
  regimeIncertain: false,
  regimeFondement: FONDEMENT_REGIME_PAR_CODE.CIVIL,
  avisDistance: 'A5',
  citationArticle: 'il sera ajouté au délai de quinzaine, un jour par cinq lieues',
  pointDepartFr: 'adjudication',
}

/** Les genres qui REFUSENT — un par genre (bloc 8). */
export const REFUS_HEURES: EntreeDelai = {
  ...CPC_354,
  slug: 'cpc-516-declaration-affirmative',
  article: '516',
  objetFr: 'Déclaration affirmative du tiers saisi',
  dureeTexte: '24 heures',
  kind: 'HEURES',
  jours: null,
  motifRefusFr:
    'Ce délai est exprimé en heures. Un délai franc se compte en jours entiers ; « 24 heures ' +
    'franches » n’a pas de sens établi, et l’article 991 interdit toute signification avant 6 h ' +
    'et après 18 h. Ce calculateur de jours ne le traite pas.',
}

export const REFUS_MOIS: EntreeDelai = {
  ...CPC_354,
  slug: 'cpc-397-requete-civile-mois',
  article: '397',
  objetFr: 'Requête civile',
  dureeTexte: '3 mois',
  kind: 'MOIS',
  jours: null,
  motifRefusFr:
    '« Ne pas compter le jour de l’échéance » n’a pas de sens établi pour un mois ou une année, ' +
    'et aucun texte du corpus ne dit de quel jour part un délai d’un mois commencé le 31 janvier.',
}

/**
 * C. civ., art. 385 — prescription de 5 ans.
 *
 * ⚠️ CORRECTIF (défaut 12). L'entrée s'écrivait `{ ...REFUS_MOIS }`, donc `{ ...CPC_354 }` :
 * elle héritait de `code: 'CPC'` et affichait « Délai franc — C. pr. civ., art. 987 » sur un
 * article du **Code civil**. Le § 4.7 impose l'affichage du régime « y compris sur un écran
 * de refus », et ce fichier sert l'aperçu obligatoire du back-office (§ 7.1) : le faux se
 * serait donc montré.
 */
export const REFUS_ANNEES: EntreeDelai = {
  ...REFUS_MOIS,
  slug: 'civ-385-action-mineur-tuteur',
  code: 'CIVIL',
  codeLibelle: 'Code civil',
  article: '385',
  objetFr: 'Action du mineur contre son tuteur',
  dureeTexte: 'Prescription de 5 ans',
  kind: 'ANNEES',
  regime: 'ORDINAIRE',
  regimeIncertain: false,
  regimeFondement: FONDEMENT_REGIME_PAR_CODE.CIVIL,
  prorogation991: 'INCERTAIN',
  prorogationFondement: FONDEMENT_PROROGATION_PAR_CODE.CIVIL,
}

export const REFUS_FOURCHETTE: EntreeDelai = {
  ...CPC_354,
  slug: 'cpc-fourchette-15-jours-4-mois',
  article: '704',
  objetFr: 'Délai fixé entre deux bornes',
  dureeTexte: '15 jours à 4 mois',
  kind: 'INDETERMINE',
  jours: null,
  motifRefusFr:
    'Deux bornes ne font pas une date. Refus sec : aucune date n’est affichée, pas même deux. ' +
    'Saisissez vous-même le nombre de jours par l’option Autre.',
}

export const REFUS_REBOURS: EntreeDelai = {
  ...CPC_354,
  slug: 'cpc-rebours-8-jours-avant-adjudication',
  article: '635',
  objetFr: 'Publication 8 jours au moins AVANT l’adjudication',
  dureeTexte: '8 jours au moins avant',
  kind: 'INDETERMINE',
  jours: null,
  motifRefusFr:
    'Délai à rebours. Si le jour obtenu tombe un dimanche, proroger raccourcirait le préavis et ' +
    'annulerait l’acte ; le texte ne prévoit que la prorogation, jamais l’anticipation. La ' +
    'question n’est pas tranchée ; la plateforme ne la tranche pas seule.',
}

/** § 4.7, garde-fou 3 — une ligne `A_VERIFIER` sur un genre qui calcule : ARRÊT. */
export const REGIME_A_VERIFIER_CALCULABLE: EntreeDelai = {
  ...TRAV_507,
  slug: 'trav-jur-art-488-dommages-interets',
  article: 'Jur. (art. 488)',
  objetFr: 'Dommages-intérêts pour rupture illégale ou abusive',
  dureeTexte: '8 jours',
  regime: 'A_VERIFIER',
  regimeFondement: 'La rédaction n’a pas qualifié ce délai.',
}

/**
 * § 4.12 — le genre « Autre », réponse « je ne sais pas » : la plateforme n'a aucun fondement
 * pour traiter le délai comme franc. Tête d'affiche en ORDINAIRE, régime franc en lecture
 * nommée, prorogation en lecture nommée.
 *
 * ⚠️ CORRECTIF (défaut 2). Le nombre vient de la main de l'utilisatrice, puis du permalien
 * (`n=`) : `-5` rendait une tête d'affiche ANTÉRIEURE au départ, `2.5` rendait
 * « 2026-06-07.5 » et `NaN` rendait « 0NaN-NaN-NaN ». Une durée qui n'est pas un entier de
 * jours ≥ 0 fait maintenant de l'entrée un REFUS motivé, jamais une date.
 */
const MOTIF_DUREE_LIBRE_INVALIDE =
  'Le nombre de jours saisi n’est pas un entier positif ou nul. Un délai ne se compte pas en ' +
  'fractions de jour, et un nombre négatif ferait expirer le délai avant son point de départ. ' +
  'Saisissez un nombre entier de jours.'

export function autre(jours: number, nature: string, franc: 'oui' | 'non' | 'inconnu'): EntreeDelai {
  const dureeValide = Number.isInteger(jours) && jours >= 0
  return {
    slug: 'autre',
    code: 'CPC',
    codeLibelle: 'Saisie libre',
    article: '—',
    objetFr: nature,
    dureeTexte: dureeValide
      ? `${jours} jours (saisie libre)`
      : `Durée saisie non retenue : « ${String(jours)} »`,
    kind: dureeValide ? 'JOURS' : 'INDETERMINE',
    jours: dureeValide ? jours : null,
    motifRefusFr: dureeValide ? null : MOTIF_DUREE_LIBRE_INVALIDE,
    regime: franc === 'non' ? 'ORDINAIRE' : 'FRANC',
    regimeIncertain: franc === 'inconnu',
    regimeFondement:
      franc === 'oui'
        ? `Nature du délai indiquée par l’utilisatrice : ${nature}. Déclaré franc.`
        : franc === 'non'
          ? `Nature du délai indiquée par l’utilisatrice : ${nature}. Déclaré non franc.`
          : `Nature du délai indiquée par l’utilisatrice : ${nature}. Le caractère franc n’est pas ` +
            `établi : vérifiez dans votre texte, les deux lectures diffèrent d’un jour.`,
    prorogation991: 'INCERTAIN',
    prorogationFondement:
      'Le régime de prorogation d’un délai saisi librement est INCERTAIN : la tête d’affiche est ' +
      'calculée sans prorogation.',
    pointDepartFr: 'date de départ du délai',
    revision: 1,
  }
}
