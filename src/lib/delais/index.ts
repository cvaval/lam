/**
 * Calculateur de délais — point d'entrée unique du noyau.
 *
 * Tout ce qui est exporté ici est **pur** : aucune E/S, aucune dépendance à la base, aucun
 * `Date`, aucune bibliothèque de dates. Le moteur est employé tel quel par le composant
 * serveur (le résultat existe donc sans JavaScript, imprimable et partageable) et par le
 * client pour le retour immédiat.
 *
 * Ce que le calculateur n'écrit JAMAIS : rien. Ni journal, ni statistique, ni historique.
 * C'est un outil, pas une recherche — il ne consomme pas le quota et n'appelle pas
 * `runSearch()`.
 */
export type { CivilDate } from './civil'
export {
  addDays,
  apres,
  avant,
  comparer,
  dayOfWeek,
  diffDays,
  egales,
  estBissextile,
  estDimanche,
  estSamedi,
  formatIso,
  fromJdn,
  isValidCivil,
  joursDansLeMois,
  laPlusPrecoce,
  laPlusTardive,
  parseFrSaisie,
  parseIso,
  toJdn,
} from './civil'

export type { CleMobile } from './paques'
export { DECALAGES_PAQUES, decalageConnu, jourMobile, paques } from './paques'

export type {
  AutoriteFerie,
  CategorieFerie,
  EntreeCalendrier,
  Journee,
  Locale,
  TypeEntree,
} from './feries'
export {
  BORNE_HISTORIQUE,
  CALENDRIER_V1,
  CALENDRIERS,
  MESSAGE_BORNE_HISTORIQUE,
  OBSERVATIONS_BORNE_FR,
  VERSION_CALENDRIER_COURANTE,
  calendrier,
  dateEntree,
  entreesDuJour,
  libelle,
  noteJournee,
  observationsBorne,
  observationsTexte,
  texteLocalise,
} from './feries'

export type { GenreMentionJour, JourFranchi, MentionJour, ReportPublic } from './mention-jour'
export { genreEntree, mentionsJour, reportPublic } from './mention-jour'

export type { CleLecture, Configuration } from './lectures'
export { CASCADE_MAX, entreeProroge } from './lectures'

export type { CodeDelai, Prorogation991, Regime } from './regimes'
export {
  // L'abréviation (« C. pr. civ. ») est DÉRIVÉE du code, jamais stockée : deux vérités pour
  // une seule donnée, c'est le défaut 16 c. Les écrans la prennent ici.
  ABREGE_CODE,
  ARTICLE_PROROGATION_PAR_CODE,
  LIBELLE_CODE,
  FONDEMENT_PROROGATION_PAR_CODE,
  FONDEMENT_REGIME_PAR_CODE,
  LIBELLE_REGIME,
  citationDeFranc,
  controleCivilFranc,
  francEnTeteDaffiche,
  normaliserRegime,
} from './regimes'

export type {
  Avertissement,
  BlocPraticable,
  Certitude,
  CleAvertissement,
  Empechement,
  EntreeDelai,
  Etape,
  JourEcarte,
  JourEmpeche,
  KindDelai,
  LectureNommee,
  MotifProrogation,
  OptionSupplement,
  ParamsCalcul,
  Resultat,
  ResultatCalcul,
  ResultatIncomplet,
  ResultatRefus,
  Supplement,
} from './calcul'
export { KINDS_CALCULABLES, calculer, joursDeDistance, kindCalcule } from './calcul'

export {
  dateComplete,
  dateEnChiffres,
  dateEnToutesLettres,
  nomJour,
  nomMois,
} from './format'

export type { CitationRegime, ExtraitArret, FenetreSignification, TexteGele } from './textes'
export {
  ARRETS,
  CITATIONS_CIVIL_FRANC,
  FENETRES_V1,
  TEXTES,
  VERSION_FENETRES_COURANTE,
} from './textes'
