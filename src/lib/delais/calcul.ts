/**
 * § 4.4 à § 4.13 — LE MOTEUR. Fonctions PURES : aucune E/S, aucune dépendance à la base,
 * **AUCUN `Date`**, aucune bibliothèque de dates.
 *
 * Les quatre règles du § 0, dont tout le reste découle :
 *  1. un moteur qui ne sait pas REFUSE — jamais d'approximation ;
 *  2. aucune date sans son raisonnement ;
 *  3. la tête d'affiche est la lecture la plus PRÉCOCE, les autres sont nommées ;
 *  4. la règle 3 vaut dans les DEUX SENS — une lecture qui retarde la date est écartée de la
 *     tête d'affiche, quelle que soit l'autorité qui la porte.
 *
 * Ne jamais réintroduire : `addBusinessDays`, un saut de week-end, `Math.round`/`Math.ceil`
 * sur la distance, une prorogation par un jour `A_SURVEILLER`, une réserve « R7 » — ni les
 * réserves « R6 » (retirée le 20 août 2026 au matin), « R1 », « R1-T » et « R3 » (retirées le
 * même jour au soir, Me Vaval ayant répondu OUI aux deux questions qu'elles portaient). Les
 * motifs sont en tête de `lectures.ts` et de `regles-lecture.ts`.
 */
import type { CivilDate } from './civil'
import { addDays, apres, comparer, egales, estDimanche, estSamedi, isValidCivil } from './civil'
import type { EntreeCalendrier, Locale } from './feries'
import {
  BORNE_HISTORIQUE,
  VERSION_CALENDRIER_COURANTE,
  calendrier,
  entreesDuJour,
  libelle,
  noteJournee,
  observationsBorne,
  observationsTexte,
} from './feries'
import { dateEnToutesLettres } from './format'
import type { CleLecture, Configuration, GenreMotif } from './lectures'
import { CASCADE_MAX, entreeProroge, genreEntree } from './lectures'
import { phrases } from './phrases'
import type { CodeDelai, Prorogation991, Regime } from './regimes'
import { ARTICLE_PROROGATION_PAR_CODE, francEnTeteDaffiche } from './regimes'
import { REGLES_LECTURE, VERSION_REGLES_COURANTE, reglesLecture } from './regles-lecture'
import { TEXTES } from './textes'

/**
 * ⚠️ **IL N'Y A PLUS DE REPLI SUR LES RÈGLES DU JOUR** (20 août 2026, soir, défaut 12 de la
 * troisième recette). `calculer` faisait `reglesLecture(versionR) ?? REGLES_COURANTES` — un
 * repli SILENCIEUX que `regles-lecture.ts` interdit noir sur blanc : « un permalien qui en
 * nomme une est un 404 franc, JAMAIS un calcul rendu sous les règles du jour : ce serait rendre
 * une date sous une adresse qui en promet une autre. » Le chemin servi est bien 404é en amont
 * par `calculPublic`, mais `calculer()` est aussi appelé sans garde par les DEUX écrans
 * d'administration (`DelaiEntryForm`, `DelaiCalendarAdmin`) et par une centaine de tests :
 * l'invariant ne vivait que dans un commentaire. Il vit maintenant dans un REFUS typé.
 */
const REGLES_COURANTES = REGLES_LECTURE[VERSION_REGLES_COURANTE]

// ---------------------------------------------------------------------------
// Les entrées du répertoire
// ---------------------------------------------------------------------------

export type KindDelai =
  | 'JOURS'
  | 'JOURS_PLUS_DISTANCE_KM'
  | 'JOURS_DISTANCE_NON_CHIFFREE'
  | 'HEURES'
  | 'MOIS'
  | 'ANNEES'
  | 'INDETERMINE'

/** Trois genres calculent ; quatre refusent. 123 lignes sur 393 (§ 4.4). */
export const KINDS_CALCULABLES: readonly KindDelai[] = [
  'JOURS',
  'JOURS_PLUS_DISTANCE_KM',
  'JOURS_DISTANCE_NON_CHIFFREE',
]

export function kindCalcule(kind: KindDelai): boolean {
  return KINDS_CALCULABLES.includes(kind)
}

/** § 4.5 — la question de suite de l'article 74. Trois réponses, pas une. */
export type OptionSupplement = {
  cle: string
  jours: number
  libelleFr: string
  noteFr?: string
  fondement?: string
}

export type Supplement = {
  type: 'ART_74'
  questionFr: string
  obligatoire: boolean
  options: readonly OptionSupplement[]
}

export type EntreeDelai = {
  slug: string
  code: CodeDelai
  codeLibelle: string
  article: string
  /** § 4.5 bis — en-tête de section porteur. OBLIGATOIRE si le numéro a un homonyme. */
  articleContexte?: string | null
  objetFr: string
  /** MOT À MOT du répertoire. Jamais traduit, jamais réécrit. */
  dureeTexte: string
  /**
   * § 4.5 — RENSEIGNÉ SEULEMENT quand l'article ne chiffre PAS lui-même sa durée : il dit
   * alors quel article l'énonce, et le cite. L'art. 356 ne fixe que le point de départ de
   * l'appel ; ses trente jours sont ceux de l'art. 354 (défaut 3 du cahier de recette).
   */
  dureeFondementFr?: string | null
  kind: KindDelai
  jours: number | null
  /** 2 pour les art. 517 et 586, qui mesurent DEUX distances (§ 2.12). */
  nbDistances?: 0 | 1 | 2
  supplement?: Supplement | null
  regime: Regime
  regimeIncertain: boolean
  regimeFondement: string
  prorogation991: Prorogation991
  prorogationFondement: string
  /**
   * § 4.6 — **LES QUATRE JOURS SANS TEXTE DU CALENDRIER DE LA VERSION 1 PROROGENT-ILS LA TÊTE
   * D'AFFICHE ?** — et **rien d'autre**, depuis le 20 août 2026 (soir).
   *
   * ⚠️ **CE CHAMP A PERDU DEUX DE SES TROIS EFFETS LE JOUR MÊME OÙ IL LES AVAIT PRIS.** Il
   * portait `feteNationale`, `redaction` et `cascade` : les deux premiers et le dernier
   * faisaient de la surface publique la seule à proroger largement, pendant que le portail
   * gardait la tête étroite — deux écrans de la même maison, deux dates. Me Vaval ayant
   * tranché « oui » sur les fêtes NATIONALES et sur la CASCADE, ces deux-là sont passés dans
   * la VERSION DE RÈGLES (`regles-lecture.ts`) et valent maintenant pour LES DEUX SURFACES.
   * Ne reste ici que `redaction`.
   *
   * Par défaut `false` : les quatre lignes `autorite: 'REDACTION'` du calendrier de la
   * version 1 (Lundi Gras, 14 août, 20 septembre, 1er novembre) ne prorogent PAS la tête
   * d'affiche — aucun texte du corpus ne les instituait, et accorder un jour sur un fondement
   * non textuel fabriquerait la forclusion que le calculateur existe pour empêcher (§ 0,
   * règle 4). C'est le régime des 393 entrées du répertoire : aucune ligne de base ne porte
   * ce champ.
   *
   * `true` **uniquement** sur l'entrée synthétique du genre « Autre » servie à la surface
   * PUBLIQUE : Me Vaval a validé, le 20 août 2026, que le 1er octobre 2025 + 30 jours francs
   * rend « lundi 3 novembre », ce qui suppose que la Toussaint déplace la date — vrai des DEUX
   * côtés sous le calendrier de la version 2, où le Décret du 11 décembre 2024 l'institue, et
   * vrai de la seule surface publique sous la version 1, que rejouent les permaliens `c=1`.
   *
   * ⚠️ **Il est SANS EFFET sous le calendrier courant** (version 2), qui ne porte plus aucune
   * entrée `autorite: 'REDACTION'`. Il ne subsiste que pour les permaliens `c=1`.
   *
   * ⚠️ **Les jours À SURVEILLER ne prorogent toujours PAS** : `entreeProroge` les refuse en
   * tête de fonction, quelle que soit la lecture (§ 4.13, interdit n° 17). Ce champ ne les
   * atteint pas.
   *
   * ⚠️ **Il ne CRÉE pas de prorogation** : `derouler` ne proroge que si `cfg.prorogation`,
   * c'est-à-dire si `prorogation991 === 'OUI'`. Sur une entrée qui ne proroge pas, ce champ
   * est inerte.
   */
  prorogationTeteLarge?: boolean
  pointDepartFr: string
  motifRefusFr?: string | null
  /**
   * § 8.2 — les traductions que le back-office collecte déjà (`DelaiEntryForm`) et que la
   * base transporte. Elles ne servent qu'à travers `traductionRelue` : une traduction que
   * personne n'a relue ne passe pas pour relue sur un écran de délai de recours.
   */
  motifRefusEn?: string | null
  motifRefusHt?: string | null
  traductionRelue?: boolean
  /** A5 (« un jour par cinq lieues ») ou A5-bis (renvoi non chiffré) — § 4.9. */
  avisDistance?: 'A5' | 'A5_BIS' | null
  /** Texte de l'article, cité — sert l'avis A5 / A5-bis. */
  citationArticle?: string | null
  revision?: number
}

// ---------------------------------------------------------------------------
// Paramètres et résultat
// ---------------------------------------------------------------------------

export type ParamsCalcul = {
  depart: CivilDate
  entree: EntreeDelai
  /** Un kilométrage par distance à mesurer. L'utilisatrice le saisit ; jamais la plateforme. */
  km?: readonly number[]
  /** Réponse à la question de suite (art. 74) : « haiti » | « antilles » | « outre-ocean ». */
  supplementCle?: string | null
  /**
   * ⚠️ USAGE DE TEST — arrêts n° 5 (Compère) et n° 6 (Jean-Baptiste) du § 2.6 : les deux
   * disent « compte tenu du délai de distance » **sans donner un seul kilomètre**. On passe
   * donc la distance EN JOURS, sans inventer de kilométrage. Hors test, ne l'emploie pas.
   */
  distanceJours?: number
  versionCalendrier?: number
  /**
   * Calendrier explicite, qui prend le pas sur `versionCalendrier`. Deux usages légitimes :
   * l'« aperçu obligatoire » du back-office (§ 7.1 et § 7.4), qui doit montrer ce qu'une
   * version PAS ENCORE enregistrée rendrait, et le test 4 du bloc 16, qui rejoue le calcul
   * en retirant les cinq entrées `A_SURVEILLER`. **Un permalien porte une VERSION, jamais
   * une liste** : sinon un calcul cité ne serait plus reproductible.
   */
  entreesCalendrier?: readonly EntreeCalendrier[]
  /**
   * § 4.6 — **LA VERSION DES RÈGLES DE LECTURE** (`regles-lecture.ts`). Par défaut la courante.
   *
   * Elle dit DEUX choses, et deux seulement : les fêtes nationales prorogent-elles, et la
   * prorogation joue-t-elle en cascade. Un permalien la porte (`rl`), au même titre que la
   * version du calendrier (`c`) : sans elle, la même adresse rendrait une autre date le jour
   * où une question de droit est tranchée. Une version inconnue est refusée en amont, par
   * `calculPublic` ; ici, elle retombe sur la courante — le moteur ne devine pas, il n'est
   * simplement jamais appelé avec une version qui n'existe pas.
   */
  versionRegles?: number
  /** § 4.3 — les six tests de 1962-1966 contournent la borne. Les DEUX drapeaux sont requis. */
  ignorerBorneHistorique?: boolean
  /** Neutralise le calendrier des fêtes. **Ne neutralise PAS le dimanche**, qui est dans l'art. 991. */
  calendrierVide?: boolean
  locale?: Locale
}

export type MotifProrogation = {
  cle: string
  /**
   * CE QUE CE JOUR EST — et **ce n'est pas déductible du libellé**.
   *
   * ⚠️ Ajouté le 20 août 2026 (soir), contre une régression introduite le jour même par
   * `prorogationTeteLarge: true`. Sous l'ancienne tête étroite, seuls le dimanche et les
   * 7 fêtes légales du décret du 23 mai 1989 entraient dans `sauts` : le gabarit unique « un
   * jour de fête légale (…) » était donc toujours vrai. Depuis la lecture large, une fête
   * NATIONALE et un jour de la RÉDACTION y entrent aussi — et le raisonnement sérialisé
   * écrivait « Le lundi 18 mai 2026 est un jour de fête légale (La Fête du Drapeau et de
   * l'Université) », ou « Le samedi 1er novembre 2025 est un jour de fête légale (La
   * Toussaint) » pendant que la ligne fine du MÊME calcul disait « aucun texte du corpus ne
   * l'institue ». Le genre est donc porté par le motif, et la phrase composée entrée par
   * entrée (§ 4.9, boucle des sauts).
   *
   * ⚠️ `GenreMotif`, plus étroit que `GenreJour` : un motif est ce qui a DÉPLACÉ la date, et une
   * demi-journée dont la matinée reste ouvrable ne déplace rien (§ 4.10, `lectures.ts`). Le
   * `switch` de `construireEtapes` est exhaustif sur ce type-là.
   */
  genre: GenreMotif
  /** § 8.2 — déjà LOCALISÉ (repli sur le français tant que `traductionRelue` est faux). */
  libelle: string
  source: string
  /** Note de demi-journée (§ 4.10), quand l'entrée en porte une. Localisée elle aussi. */
  noteJournee?: string | null
  /** `REDACTION` déclenche l'avertissement A4 : « sans source textuelle ». */
  autorite?: EntreeCalendrier['autorite']
  /**
   * § 8.1 — la pastille « Source vérifiée » atteste la SOURCE D'UNE FÊTE, jamais la date.
   * Le dimanche est dans l'article lui-même : il n'a aucune source à attester, et le badger
   * ferait de l'accent l'ordinaire de l'écran. Le motif le DIT, l'écran ne le devine pas.
   */
  sourceAttestee: boolean
}

export type JourEcarte = {
  date: CivilDate
  jourSemaine: string
  motifs: MotifProrogation[]
}

export type Certitude = 'CERTAINE' | 'CONDITIONNELLE'

export type Empechement = {
  cle: string
  /** Localisé (§ 8.2). */
  libelle: string
  source: string
  certitude: Certitude
}

export type JourEmpeche = { date: CivilDate; empechements: Empechement[] }

/**
 * § 4.8 — le jour praticable, CORRIGÉ (défaut 2 du cahier de recette).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚠️ **CE BLOC NE S'ADRESSE PLUS QU'AUX DÉLAIS QUI NE PROROGENT PAS — 114 ENTRÉES SUR 393.**
 * (Constat du 20 août 2026, soir — défauts 4 et 13 de la troisième recette.)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Depuis que la prorogation joue en CASCADE (règles de la version 2), la tête d'affiche d'une
 * entrée `prorogation991: 'OUI'` est un POINT FIXE : `derouler` ne s'arrête que sur un jour qui
 * ne proroge pas, donc jamais sur un dimanche ni sur une fête que le calendrier porte. `reculer`
 * ne recule alors jamais, et `necessaire` est toujours faux. **Mesuré** par `calcul.test.ts`,
 * « ATTEIGNABILITÉ », sur les 1 460 calculs de l'année 2027 (366 départs × 8/15/30/31 jours) :
 *
 *   |                       | règles v1 | règles v2 (courantes) |
 *   | CPC   (art. 354)      |     44    |           0           |
 *   | TRAVAIL (art. 507)    |     44    |           0           |
 *   | CIVIL (art. 28)       |    262    |          258          |
 *
 * ⚠️ **CE TABLEAU DISAIT 212 / 212 / 1 332 / 1 312 JUSQU'AU 20 AOÛT 2026 AU SOIR.** Ces
 * nombres-là ne sont pas faux : ce sont les mêmes proportions relevées sur la fenêtre 2025-2029
 * (7 304 calculs). Mais le test qu'ils citaient en preuve balaie l'année 2027, et n'en fixait
 * AUCUN — il se contentait d'un `> 200`. Un tableau qui nomme un capteur que le capteur ne porte
 * pas est une affirmation sans témoin : les nombres sont donc ramenés à la fenêtre réellement
 * mesurée, et le test les fixe maintenant un par un.
 *
 * Les 232 entrées CPC et les 47 entrées TRAVAIL portent toutes `prorogation991: 'OUI'` : le bloc
 * y est INATTEIGNABLE, et c'est LOGIQUE — une tête d'affiche qui est toujours un jour praticable
 * n'a rien à faire reculer. Les 114 entrées du Code civil (`prorogation991: 'INCERTAIN'`, l'art.
 * 991 étant dans le Code de procédure civile) gardent une tête qui peut tomber un dimanche ou une
 * fête : c'est là, et là seulement, que le bloc a encore quelque chose à dire.
 *
 * ⚠️ **CE N'EST PAS UNE FONCTIONNALITÉ MORTE, C'EST UNE FONCTIONNALITÉ DÉPLACÉE** — mais elle
 * l'a été en silence, et trois tests la couvraient encore sur des matières où elle ne se
 * déclenche plus. Un test MESURE désormais l'atteignabilité au lieu de la supposer, et les
 * tests de contenu (art. 991 al. 2, art. 512, nullité) s'exécutent là où le bloc vit : sur le
 * Code civil pour la phrase du CPC, et sous les règles de la version 1 — que rejouent les
 * permaliens `rl=1` — pour la phrase du Code du travail.
 *
 * ⚠️ **CE QUI N'A PAS ÉTÉ FAIT, ET POURQUOI.** La recette proposait de réorienter le bloc vers
 * le SAMEDI, seul jour ouvrable ambigu que la cascade laisse passer. On s'y refuse : le § 2.9 et
 * deux arrêts de la Cour de cassation (samedi 23 juin 1962, Germeil ; samedi 2 novembre 1963,
 * Brown and Root) tiennent qu'un délai expirant un samedi ordinaire expire ce samedi-là. Faire
 * reculer la plateforme au vendredi contredirait la jurisprudence qu'elle cite ailleurs.
 *
 * La rédaction d'origine ne déclenchait le bloc que si la tête d'affiche tombait « une fête
 * légale **de la lecture retenue** ». Conséquence : un 1er novembre ne le déclenchait pas,
 * alors que le calendrier de la plateforme le porte comme fête légale et que l'art. 991 al. 2
 * y ferme toute signification — l'écart du CALCUL, justifié sous la version 1, le
 * rendait invisible dans un bloc qui ne parle pas de calcul mais de ce qu'un huissier peut
 * matériellement faire.
 *
 * Le bloc se déclenche donc dès que la tête d'affiche tombe un dimanche **ou une entrée
 * PERMANENTE du calendrier**, quelle que soit son autorité. Chaque jour empêché porte sa
 * `certitude` : CERTAINE pour le dimanche et les sept fêtes légales du décret de 1989 (ce que
 * l'art. 991 al. 2 interdit vraiment), CONDITIONNELLE pour tout le reste. Deux dates sont
 * rendues, et l'écran doit montrer les deux.
 *
 * ⚠️ CORRECTIF (défauts 6 et 11 de la seconde recette) : les cinq entrées `A_SURVEILLER`
 * sont EXCLUES du recul. Elles ne produisent qu'une phrase — l'avertissement A6 (§ 4.13).
 */
export type BlocPraticable = {
  necessaire: boolean
  /** Prudent : ni dimanche, ni aucune entrée PERMANENTE du calendrier. Toujours ≤ tête. */
  dernierJourPraticable: CivilDate
  /** Strict art. 991 al. 2 : ni dimanche, ni fête légale du décret de 1989. */
  dernierJourPraticableCertain: CivilDate
  joursEmpeches: JourEmpeche[]
  texte: string
  /**
   * § 4.10 — ⚠️ **LE JOUR PRATICABLE DONT LA FENÊTRE SE FERME À MIDI**, ou `''`.
   *
   * Ajouté le 20 août 2026 (au vu du décret). Depuis que la demi-journée ne proroge plus, le
   * bloc DÉSIGNE des Lundis Gras : mesuré sur les 7 304 calculs du balayage 2025-2029, il
   * renvoyait « au plus tard le lundi 16 février 2026 » — un jour dont la plateforme venait
   * précisément d'affirmer, pour ne PAS y reporter la date, que seule la matinée est ouvrable.
   * Le bloc promettait donc une journée entière sur le seul jour du calendrier qui n'en est pas
   * une : il rendait une date plus tardive praticable qu'elle ne l'est, du côté du risque.
   *
   * La phrase dit la fenêtre RÉELLE de ce jour-là — six heures du matin à midi en procédure
   * civile (art. 991 al. 2), huit heures à midi en matière de travail (art. 512, à peine de
   * nullité) — et elle est INDÉPENDANTE de `necessaire` : quand la tête d'affiche EST le Lundi
   * Gras, il n'y a aucun jour à reculer, et c'est pourtant là que la mention compte le plus.
   * L'écran rend donc le bloc dès que `necessaire || texteMidi`.
   *
   * ⚠️ **ELLE NE DÉPLACE AUCUNE DATE.** `dernierJourPraticable` reste ce jour-là : la matinée
   * est ouvrable, l'acte peut y être fait. Reculer d'un jour de plus retirerait à l'avocate une
   * demi-journée que le texte lui donne.
   */
  texteMidi: string
}

export type LectureNommee = {
  cle: CleLecture
  /** Localisés (§ 8.2) — voir `phrases.ts`. */
  libelle: string
  fondement: string
  date: CivilDate
}

export type CleAvertissement = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A5_BIS' | 'A6'

export type Avertissement = {
  cle: CleAvertissement
  texte: string
  /** A6 seulement : la date que l'avertissement nomme, SANS jamais être la tête d'affiche. */
  dateConditionnelle?: CivilDate
  /**
   * § 4.13, exigence 4 — A6 renvoie au corpus. La REQUÊTE est portée ici, en DONNÉE, et
   * l'écran en fait un vrai lien : concaténée dans la phrase, elle ne rendait que des
   * crochets typographiques inertes (« [Rechercher « carnaval » dans le corpus] »).
   */
  rechercheQ?: string | null
  /** Le libellé du lien, déjà traduit ; l'URL, elle, se construit à l'écran. */
  rechercheLibelle?: string | null
}

export type Etape = { cle: string; texte: string; date?: CivilDate }

export type ResultatRefus = {
  statut: 'REFUS'
  cle:
    | 'DATE_INVALIDE'
    | 'BORNE_HISTORIQUE'
    | 'GENRE_NON_CALCULABLE'
    | 'REGIME_A_VERIFIER'
    | 'DUREE_ABSENTE'
    /** § 0, règle 1 — une durée qui n'est pas un entier de jours ≥ 0 ne produit AUCUNE date. */
    | 'DUREE_INVALIDE'
    | 'OPTION_INCONNUE'
    /** § 4.6 — version de règles de lecture absente du registre (défaut 12). */
    | 'REGLES_INCONNUES'
    /** § 0, règle 1 — la borne anti-boucle de la cascade a joué (défaut 5). */
    | 'CASCADE_BORNE'
  motif: string
  regimeAffiche: string
  entree: EntreeDelai
}

export type ResultatIncomplet = {
  statut: 'INCOMPLET'
  /** Ce qui manque, en toutes lettres — jamais un bouton grisé muet (§ 6.2). */
  manque: string[]
  regimeAffiche: string
  entree: EntreeDelai
}

export type ResultatCalcul = {
  statut: 'CALCUL'
  entree: EntreeDelai
  depart: CivilDate
  joursBase: number
  joursSupplement: number
  joursDistance: number
  detailDistance: { km: number; jours: number }[]
  franc: boolean
  regimeAffiche: string
  dernierJourCompte: CivilDate
  /** Le jour d'échéance, avant toute prorogation. */
  echeance: CivilDate
  /** LA date. La plus précoce des lectures concurrentes. */
  teteAffiche: CivilDate
  phraseSecurite: string
  etapes: Etape[]
  joursEcartes: JourEcarte[]
  praticable: BlocPraticable
  lectures: LectureNommee[]
  /** Bornée par la lecture la plus large ; égale à la tête d'affiche s'il n'y a pas de réserve. */
  lectureLaPlusLarge: CivilDate
  avertissements: Avertissement[]
  versionCalendrier: number
  /**
   * § 4.6 — la version des RÈGLES DE LECTURE sous laquelle cette date a été rendue. Elle
   * voyage avec le résultat pour la même raison que `versionCalendrier` : le pied de page la
   * nomme, le permalien la porte, et un calcul cité doit pouvoir dire sous quelle règle il
   * a été fait.
   */
  versionRegles: number
}

export type Resultat = ResultatRefus | ResultatIncomplet | ResultatCalcul

// ---------------------------------------------------------------------------
// La distance — § 2.12
// ---------------------------------------------------------------------------

/**
 * Art. 987 : « un jour par quarante kilomètres. Les fractions de moins de trente kilomètres
 * ne sont pas comptées, les fractions de trente kilomètres et au-dessus augmentent les délais
 * d'un jour. »
 *
 * ⚠️ `Math.round(267/40)` et `Math.ceil(267/40)` donnent **7** : un jour de trop, confirmé
 * faux par l'arrêt Germeil, qui retient **6**. N'emploie jamais l'un ni l'autre ici.
 */
export function joursDeDistance(km: number): number {
  if (!Number.isFinite(km) || km <= 0) return 0
  const k = Math.trunc(km)
  return Math.floor(k / 40) + (k % 40 >= 30 ? 1 : 0)
}

// ---------------------------------------------------------------------------
// Le déroulé d'une lecture
// ---------------------------------------------------------------------------

type Deroule = {
  dernierJourCompte: CivilDate
  echeance: CivilDate
  date: CivilDate
  sauts: { jour: CivilDate; motifs: MotifProrogation[] }[]
  /**
   * § 0, règle 1 — **la boucle s'est épuisée sans atteindre un jour qui ne proroge pas.**
   * `date` porte alors le `CASCADE_MAX + 1`-ième jour, QUE LE MOTEUR N'A PAS VÉRIFIÉ : il ne
   * doit jamais s'afficher. L'appelant refuse (tête d'affiche) ou renonce à nommer la lecture.
   */
  borneAtteinte: boolean
}

/** La clause de prorogation à citer, selon la matière. */
function sourceProrogation(code: CodeDelai): string {
  // ⚠️ La citation est déclarée UNE fois, dans `regimes.ts` : la ligne du report public la lit
  // au même endroit. Deux exemplaires de la même référence, c'est le défaut 16 c.
  return ARTICLE_PROROGATION_PAR_CODE[code]
}

function motifsDuJour(
  date: CivilDate,
  cfg: Configuration,
  entrees: readonly EntreeCalendrier[],
  code: CodeDelai,
  locale: Locale,
): MotifProrogation[] {
  const motifs: MotifProrogation[] = []
  /**
   * ⚠️ **CE JOUR PROROGE-T-IL ?** — le dimanche compte dans la réponse, et il ne vient pas du
   * calendrier : il est dans l'article lui-même (art. 991 al. 3). Un dimanche 2 novembre
   * proroge PAR LE DIMANCHE, même si la Fête des Morts, chômée « à partir de midi », ne le
   * ferait pas à elle seule — et il faut alors NOMMER les deux (voir plus bas).
   */
  const decident = entreesDuJour(date, entrees).filter((e) => entreeProroge(e, cfg))
  if (!estDimanche(date) && decident.length === 0) return motifs
  // Le dimanche est dans l'article lui-même : `calendrierVide` ne le neutralise pas.
  if (estDimanche(date)) {
    motifs.push({
      cle: 'DIMANCHE',
      genre: 'DIMANCHE',
      libelle: phrases(locale).dimanche,
      source: sourceProrogation(code),
      // Le dimanche n'a AUCUNE source à attester : il est dans l'article (§ 8.1).
      sourceAttestee: false,
    })
  }
  /**
   * ⚠️ **LA DEMI-JOURNÉE NE PROROGE PAS À ELLE SEULE — MAIS ELLE EST NOMMÉE QUAND LE JOUR
   * PROROGE POUR AUTRE CHOSE** (20 août 2026, soir — défaut 2 de la troisième recette).
   *
   * Deux questions distinctes, et les confondre coûtait une information à chaque fois :
   *
   *  - **décider** : un jour chômé seulement « à partir de midi » laisse la matinée ouvrable,
   *    l'acte peut y être fait, et lui accorder un jour entier RETARDE la date limite (§ 0,
   *    règle 4). `entreeProroge` le refuse donc sous les règles de la version 2 ;
   *  - **nommer** : le dimanche 2 novembre 2025 est un dimanche ET la Fête des Morts. Le
   *    dimanche proroge seul ; taire la Fête des Morts parce qu'elle ne proroge plus ferait
   *    dire à l'écran moins que ce que le calendrier sait.
   *
   * On décide donc sur la configuration STRICTE, et l'on nomme sur la configuration RELÂCHÉE.
   * Quand la demi-journée est le SEUL motif du jour, la liste est vide et le jour ne proroge
   * pas : l'étape finale le nomme alors par `finaleCalendrier` (« le calendrier de la
   * plateforme le porte néanmoins »), et la lecture `DEMI_JOURNEE` porte la date tardive.
   */
  const nommables = entreesDuJour(date, entrees).filter((e) =>
    entreeProroge(e, { ...cfg, demiJournee: true }),
  )
  for (const e of nommables) {
    // § 8.2 — le libellé et la note passent par le repli de `texteLocalise` : la table des
    // jours écartés recopiait jusqu'ici le français brut, quelle que soit la langue.
    const note = noteJournee(e, locale)
    motifs.push({
      cle: e.cle,
      // Le classement vient de `lectures.ts`, au même endroit qu'`entreeProroge` : la phrase
      // qui NOMME le jour et la règle qui décide s'il proroge lisent la même ligne.
      genre: genreEntree(e),
      libelle: libelle(e, locale),
      source: e.source,
      noteJournee: note || null,
      autorite: e.autorite,
      // Une entrée du calendrier PORTE une source ; seule celle de la rédaction n'en a pas de
      // textuelle, et elle le dit alors en toutes lettres (A4).
      sourceAttestee: e.autorite !== 'REDACTION',
    })
  }
  return motifs
}

function derouler(
  cfg: Configuration,
  depart: CivilDate,
  joursTotal: number,
  entrees: readonly EntreeCalendrier[],
  code: CodeDelai,
  locale: Locale,
): Deroule {
  const dernierJourCompte = addDays(depart, joursTotal)
  // § 2.7 a) — l'addition de deux délais francs ne fait qu'UNE seule période franche :
  // on additionne les composantes, PUIS on ajoute un jour. Jamais deux.
  const echeance = cfg.franc ? addDays(dernierJourCompte, 1) : dernierJourCompte
  let date = echeance
  const sauts: Deroule['sauts'] = []
  let borneAtteinte = false
  if (cfg.prorogation) {
    for (let i = 0; i < CASCADE_MAX; i++) {
      const motifs = motifsDuJour(date, cfg, entrees, code, locale)
      if (motifs.length === 0) break
      sauts.push({ jour: date, motifs })
      date = addDays(date, 1)
      // § 4.6 : sous les règles de la version 1, la lettre proroge « d'un jour », et un seul.
      // Sous celles de la version 2 (Me Vaval, 20 août 2026), le report se répète jusqu'au point
      // fixe — « au prochain jour ouvrable » — dans la limite de `CASCADE_MAX`.
      if (!cfg.cascade) break
      // ⚠️ CORRECTIF (défaut 5). La boucle sortait après `CASCADE_MAX` sauts et rendait le
      // onzième jour SANS l'avoir vérifié : l'étape finale avouait que la borne avait joué,
      // mais `teteAffiche` portait quand même cette date — celle qui s'affiche en gros
      // caractères, part au presse-papiers et se signe dans le permalien. « Un moteur qui ne
      // sait pas REFUSE » (§ 0, règle 1) : le garde-fou refusait de boucler, il refuse
      // désormais aussi d'affirmer.
      if (i === CASCADE_MAX - 1 && motifsDuJour(date, cfg, entrees, code, locale).length > 0) {
        borneAtteinte = true
      }
    }
  }
  return { dernierJourCompte, echeance, date, sauts, borneAtteinte }
}

// ---------------------------------------------------------------------------
// Le jour praticable — § 4.8, corrigé
// ---------------------------------------------------------------------------

/**
 * Les jours que le corpus ferme par un TEXTE — 7 fêtes légales sous la version 1 du calendrier
 * (décret du 23 mai 1989), 11 sous la version 2 (décret du 11 décembre 2024), **et les 5 fêtes
 * NATIONALES de l'article 275.1 de la Constitution, dans les deux versions**. Le critère est
 * l'autorité de la ligne, jamais un décompte figé.
 *
 * ⚠️ **LES FÊTES NATIONALES SONT ENTRÉES ICI LE 20 AOÛT 2026 (SOIR), défaut 3 de la troisième
 * recette.** La fonction exigeait `categorie === 'FETE_LEGALE'` et rangeait donc les cinq fêtes
 * nationales dans la certitude CONDITIONNELLE — celle dont la phrase dit « porté au calendrier
 * de la plateforme SANS TEXTE PERMANENT QUI L'INSTITUE ». Rendu à l'écran sur les 14 entrées
 * CIVIL calculables, cela donnait, pour le 1er janvier 2030 : « La Fête de l'Indépendance
 * Nationale […] sans texte permanent qui l'institue […] au plus tard le MARDI 1ER JANVIER
 * 2030 » — c'est-à-dire une invitation à signifier le jour de l'Indépendance, sous une entrée
 * qui porte `autorite: 'TEXTE'` et cite la Constitution deux blocs plus haut. Reproduit à
 * l'identique le 1er mai 2026 (Fête de l'Agriculture et du Travail) et le 18 mai 2026 (Fête du
 * Drapeau).
 *
 * **Le fondement du chômage n'est pas la lettre de l'art. 991 al. 2**, qui n'énumère que « les
 * dimanches et les jours de fêtes légales » : c'est l'art. 3 du décret du 11 décembre 2024 —
 * « L'Administration Publique, le Commerce, l'Industrie et les Écoles chômeront à l'occasion
 * des Fêtes Nationales ET Légales » — et l'art. 275 de la Constitution de 1987. Un jour
 * légalement chômé est un jour où l'huissier n'instrumente pas ; c'est tout ce que le § 4.8
 * demande.
 */
function estFermeParTexte(e: EntreeCalendrier): boolean {
  if (e.typeEntree !== 'PERMANENT' || e.autorite !== 'TEXTE') return false
  return e.categorie === 'FETE_LEGALE' || e.categorie === 'FETE_NATIONALE'
}

/**
 * Ce qui, ce jour-là, empêche matériellement d'instrumenter.
 *
 * ⚠️ `demiJourneeFerme` vient de la VERSION DE RÈGLES (`cfg.demiJournee`). Sous la version 2,
 * une entrée chômée « à partir de midi » ne ferme PAS la journée : la matinée reste ouvrable,
 * l'huissier peut instrumenter, et c'est précisément pourquoi la tête d'affiche ne proroge plus
 * sur elle (`entreeProroge`). Faire dire ici « Aucune signification ni exécution ne peut être
 * faite le lundi X » d'un jour dont on vient d'affirmer que la matinée est ouverte serait la
 * contradiction que le § 0, règle 2, interdit. Sous la version 1, la demi-journée était comptée
 * pour un jour plein des deux côtés : le paramètre garde ce comportement aux permaliens `rl=1`.
 */
function empechementsDuJour(
  date: CivilDate,
  entrees: readonly EntreeCalendrier[],
  code: CodeDelai,
  locale: Locale,
  demiJourneeFerme: boolean,
): Empechement[] {
  const out: Empechement[] = []
  if (estDimanche(date)) {
    out.push({
      cle: 'DIMANCHE',
      libelle: phrases(locale).dimanche,
      source: code === 'TRAVAIL' ? 'C. trav., art. 512' : 'C. pr. civ., art. 991 al. 2',
      certitude: 'CERTAINE',
    })
  }
  for (const e of entreesDuJour(date, entrees)) {
    // ⚠️ CORRECTIF (défauts 6 et 11 de la seconde recette). Le correctif du défaut 2 versait
    // ici TOUTE entrée du calendrier, `A_SURVEILLER` comprise, et `reculer` reculait devant
    // chacune : une tête d'affiche au mercredi 10 février 2027 (Mercredi des Cendres)
    // rendait un « dernier jour praticable » au samedi 6 février — quatre jours plus tôt,
    // sur un délai qui expire le 10, et sans qu'aucun texte ne ferme ces jours-là. Le
    // § 4.13 est net : un jour À SURVEILLER produit une PHRASE (A6), jamais une date. La
    // plateforme ne sait pas si un arrêté a été pris ; c'est tout l'objet de A6.
    // L'élargissement aux quatre entrées `REDACTION`, lui, est conservé : c'est l'apport
    // juste du correctif (le cas du 1er novembre), et il porte sa `certitude`.
    if (e.typeEntree !== 'PERMANENT') continue
    if (e.journee === 'DEMI_JOURNEE_APRES_MIDI' && !demiJourneeFerme) continue
    out.push({
      cle: e.cle,
      libelle: libelle(e, locale),
      source: e.source,
      certitude: estFermeParTexte(e) ? 'CERTAINE' : 'CONDITIONNELLE',
    })
  }
  return out
}

const RECUL_MAX = 40

function reculer(
  depuis: CivilDate,
  entrees: readonly EntreeCalendrier[],
  code: CodeDelai,
  seulementCertaines: boolean,
  locale: Locale,
  demiJourneeFerme: boolean,
): { date: CivilDate; joursEmpeches: JourEmpeche[] } {
  let d = depuis
  const joursEmpeches: JourEmpeche[] = []
  for (let i = 0; i <= RECUL_MAX; i++) {
    const emp = empechementsDuJour(d, entrees, code, locale, demiJourneeFerme).filter(
      (e) => !seulementCertaines || e.certitude === 'CERTAINE',
    )
    if (emp.length === 0) return { date: d, joursEmpeches }
    joursEmpeches.push({ date: d, empechements: emp })
    d = addDays(d, -1)
  }
  // Garde-fou : inatteignable avec 21 entrées de calendrier. On ne rend jamais une date
  // POSTÉRIEURE à la tête d'affiche.
  return { date: depuis, joursEmpeches }
}

/**
 * § 4.10 — **LA FENÊTRE D'UN JOUR CHÔMÉ « À PARTIR DE MIDI », SUR LES JOURS QUE LE BLOC
 * DÉSIGNE** (20 août 2026, au vu du décret).
 *
 * Le bloc praticable renvoie l'avocate à un jour où l'acte peut « matériellement » être fait.
 * Depuis que la demi-journée ne proroge plus, ce jour PEUT être un Lundi Gras — soit parce que
 * la tête d'affiche s'y arrête, soit parce que le recul s'y arrête (`empechementsDuJour` ne le
 * compte pas parmi les empêchements, et c'est juste : la matinée est ouvrable). Le taire
 * promettait une journée entière sur le seul jour du calendrier qui n'en est pas une.
 *
 * ⚠️ **ON REGARDE LES DEUX DATES QUE LE BLOC NOMME**, la prudente et la certaine : elles
 * diffèrent dès qu'un jour sans texte permanent s'intercale, et l'avocate peut retenir l'une ou
 * l'autre. Une seule phrase par date, dans l'ordre où le bloc les écrit.
 *
 * ⚠️ Sous les règles de la version 1 (`demiJourneeFerme`), la demi-journée ferme la journée
 * entière : elle est alors un EMPÊCHEMENT ordinaire, le recul passe devant, et il n'y a rien à
 * dire de particulier. La fonction rend `''`.
 */
function texteMidiPraticable(
  dates: readonly CivilDate[],
  entrees: readonly EntreeCalendrier[],
  code: CodeDelai,
  locale: Locale,
  demiJourneeFerme: boolean,
): string {
  if (demiJourneeFerme) return ''
  const p = phrases(locale)
  const vues = new Set<string>()
  const lignes: string[] = []
  for (const d of dates) {
    const iso = `${d.y}-${d.m}-${d.d}`
    if (vues.has(iso)) continue
    vues.add(iso)
    const demies = entreesDuJour(d, entrees).filter(
      (e) => e.typeEntree === 'PERMANENT' && e.journee === 'DEMI_JOURNEE_APRES_MIDI',
    )
    if (demies.length === 0) continue
    const noms = demies.map((e) => libelle(e, locale)).join(p.jointureMotifs)
    const jour = dateEnToutesLettres(d, locale)
    lignes.push(code === 'TRAVAIL' ? p.praticableMidiTravail(jour, noms) : p.praticableMidi(jour, noms))
  }
  return lignes.join(' ')
}

function construirePraticable(
  tete: CivilDate,
  entrees: readonly EntreeCalendrier[],
  code: CodeDelai,
  locale: Locale,
  demiJourneeFerme: boolean,
): BlocPraticable {
  const prudent = reculer(tete, entrees, code, false, locale, demiJourneeFerme)
  const certain = reculer(tete, entrees, code, true, locale, demiJourneeFerme)
  const necessaire = !egales(prudent.date, tete)
  const texte = necessaire ? texteBlocPraticable(tete, prudent, certain, code, locale) : ''
  return {
    necessaire,
    dernierJourPraticable: prudent.date,
    dernierJourPraticableCertain: certain.date,
    joursEmpeches: prudent.joursEmpeches,
    texte,
    // ⚠️ L'ordre suit celui du texte du bloc : la date CERTAINE d'abord (« au plus tard le … en
    // ne retenant que ce que le texte interdit »), la prudente ensuite. Quand le bloc n'est pas
    // nécessaire, les deux valent la tête d'affiche et `vues` n'en garde qu'une.
    texteMidi: texteMidiPraticable([certain.date, prudent.date], entrees, code, locale, demiJourneeFerme),
  }
}

function texteBlocPraticable(
  tete: CivilDate,
  prudent: { date: CivilDate; joursEmpeches: JourEmpeche[] },
  certain: { date: CivilDate },
  code: CodeDelai,
  locale: Locale,
): string {
  const p = phrases(locale)
  const jourTete = dateEnToutesLettres(tete, locale)
  const surLaTete = prudent.joursEmpeches[0]?.empechements ?? []
  const interditParLeTexte = surLaTete.some((e) => e.certitude === 'CERTAINE')
  const noms = surLaTete.map((e) => e.libelle).join(', ')
  // Le texte n'interdit que le dimanche et les fêtes LÉGALES. Quand la tête d'affiche ne
  // tombe que sur une entrée sans texte permanent (rédaction, jour à surveiller), on ne lui
  // fait pas dire ce qu'il ne dit pas : la phrase devient conditionnelle.
  const debut = interditParLeTexte
    ? code === 'TRAVAIL'
      ? p.praticableInterditTravail(jourTete)
      : p.praticableInterditCpc(jourTete)
    : p.praticableConditionnel(
        jourTete,
        noms,
        code === 'TRAVAIL' ? p.articleCtrav512 : p.articleCpc991al2,
      )
  const lignes = [debut]
  lignes.push(
    egales(certain.date, prudent.date)
      ? p.praticableUneDate(dateEnToutesLettres(prudent.date, locale))
      : p.praticableDeuxDates(
          dateEnToutesLettres(certain.date, locale),
          dateEnToutesLettres(prudent.date, locale),
        ),
  )
  lignes.push(p.praticableGreffe)
  return lignes.join(' ')
}

// ---------------------------------------------------------------------------
// Le calcul
// ---------------------------------------------------------------------------

function regimeAffiche(entree: EntreeDelai, locale: Locale): string {
  const p = phrases(locale)
  if (entree.regime === 'A_VERIFIER') return p.regimeAVerifierLibelle
  if (entree.regimeIncertain) return p.regimeIncertainLibelle
  const libelleRegime = entree.regime === 'FRANC' ? p.regimeFranc : p.regimeOrdinaire
  // ⚠️ `regimeFondement` est une CITATION du répertoire : jamais traduite (§ 8.2).
  return `${libelleRegime} — ${entree.regimeFondement}`
}

function refus(
  entree: EntreeDelai,
  cle: ResultatRefus['cle'],
  motif: string,
  locale: Locale,
): ResultatRefus {
  return { statut: 'REFUS', cle, motif, regimeAffiche: regimeAffiche(entree, locale), entree }
}

export function calculer(p: ParamsCalcul): Resultat {
  const entree = p.entree
  const locale: Locale = p.locale ?? 'fr'
  const version = p.versionCalendrier ?? VERSION_CALENDRIER_COURANTE
  const versionR = p.versionRegles ?? VERSION_REGLES_COURANTE

  const ph = phrases(locale)

  // 0. Les règles de lecture demandées existent-elles ? § 4.6 — le registre est la seule
  //    autorité : une version absente ne retombe PAS sur les règles du jour (défaut 12).
  const regles = reglesLecture(versionR)
  if (!regles) {
    return refus(entree, 'REGLES_INCONNUES', ph.refusReglesInconnues(String(versionR)), locale)
  }

  // 1. La date de départ existe-t-elle ?
  if (!isValidCivil(p.depart)) {
    return refus(entree, 'DATE_INVALIDE', ph.dateInvalide, locale)
  }

  // 2. Le genre refuse-t-il ? Un refus n'affiche AUCUNE date, pas même deux.
  if (!kindCalcule(entree.kind)) {
    // § 8.2 — le motif de refus est une donnée de l'entrée : il suit le repli de traduction
    // du répertoire, jamais le français brut.
    return refus(
      entree,
      'GENRE_NON_CALCULABLE',
      motifRefusLocalise(entree, locale) ?? ph.genreNonCalculable,
      locale,
    )
  }

  // 3. § 4.7, garde-fou 3 — `A_VERIFIER` sur un genre qui calcule : ARRÊT. Le jour où le
  //    back-office en crée une, il faut que ce soit une décision humaine.
  if (entree.regime === 'A_VERIFIER') {
    return refus(entree, 'REGIME_A_VERIFIER', ph.regimeAVerifier, locale)
  }

  if (entree.jours == null) {
    return refus(entree, 'DUREE_ABSENTE', ph.dureeAbsente, locale)
  }

  // 3 bis. § 0, règle 1 — la durée doit être un ENTIER de jours, positif ou nul. Le chemin
  // est atteignable : le genre « Autre » (§ 4.12) prend le nombre de la main de
  // l'utilisatrice, puis du permalien (`n=`). Sans ce refus, `jours: -5` rend une tête
  // d'affiche ANTÉRIEURE au départ, `2.5` rend « 2026-06-07.5 » et `NaN` rend
  // « 0NaN-NaN-NaN » — trois dates qu'aucun texte ne fonde.
  if (!Number.isInteger(entree.jours) || entree.jours < 0) {
    return refus(entree, 'DUREE_INVALIDE', ph.dureeInvalide(String(entree.jours)), locale)
  }

  // 4. Ce qui manque, en toutes lettres.
  const manque: string[] = []
  const nbDistances = entree.nbDistances ?? (entree.kind === 'JOURS_PLUS_DISTANCE_KM' ? 1 : 0)
  const km = p.km ?? []
  if (entree.kind === 'JOURS_PLUS_DISTANCE_KM' && p.distanceJours == null) {
    if (km.length < nbDistances) {
      manque.push(nbDistances === 2 ? ph.manqueKmDeux : ph.manqueKmUn)
    }
    for (const k of km.slice(0, nbDistances)) {
      if (!Number.isFinite(k) || k < 0 || !Number.isInteger(k)) {
        manque.push(ph.manqueKmEntier)
        break
      }
    }
  }
  let joursSupplement = 0
  const sup = entree.supplement
  if (sup) {
    const choisie = sup.options.find((o) => o.cle === p.supplementCle)
    if (!choisie) {
      if (p.supplementCle) {
        return refus(entree, 'OPTION_INCONNUE', ph.optionInconnue(p.supplementCle), locale)
      }
      if (sup.obligatoire) manque.push(ph.manqueReponse(sup.questionFr))
    } else {
      joursSupplement = choisie.jours
    }
  }
  if (manque.length > 0) {
    return { statut: 'INCOMPLET', manque, regimeAffiche: regimeAffiche(entree, locale), entree }
  }

  // 5. § 4.3 — la borne historique. Ne devine pas.
  if (!p.ignorerBorneHistorique && comparer(p.depart, BORNE_HISTORIQUE) < 0) {
    return refus(entree, 'BORNE_HISTORIQUE', ph.borneHistorique, locale)
  }

  // 6. Les composantes.
  const joursBase = entree.jours
  const detailDistance: { km: number; jours: number }[] = []
  let joursDistance = 0
  if (p.distanceJours != null) {
    // Usage de test (arrêts n° 5 et n° 6) : la distance en jours, sans kilométrage inventé.
    joursDistance = Math.max(0, Math.trunc(p.distanceJours))
  } else if (entree.kind === 'JOURS_PLUS_DISTANCE_KM') {
    for (const k of km.slice(0, nbDistances)) {
      const j = joursDeDistance(k)
      detailDistance.push({ km: Math.trunc(k), jours: j })
      joursDistance += j
    }
  }
  // `JOURS_DISTANCE_NON_CHIFFREE` : la base se calcule, l'augmentation NON (A5 / A5-bis).

  const entrees = p.calendrierVide ? [] : (p.entreesCalendrier ?? calendrier(version))
  const joursTotal = joursBase + joursSupplement + joursDistance

  // 7. La tête d'affiche.
  //
  // ⚠️ **ELLE PROROGE SUR LES FÊTES NATIONALES ET EN CASCADE DEPUIS LE 20 AOÛT 2026 (SOIR)** :
  // Me Vaval a répondu OUI aux deux questions que R1 / R1-T et R3 tenaient en réserve. Les deux
  // drapeaux ne viennent donc plus de l'entrée mais de la VERSION DE RÈGLES, la même pour les
  // deux surfaces — c'est ce qui met fin au désaccord des deux écrans (voir `regles-lecture.ts`
  // et l'en-tête de `lectures.ts`).
  //
  // Ne reste attaché à l'entrée que `redaction` : les quatre lignes sans texte instituant du
  // calendrier de la VERSION 1, que seule la surface publique proroge, et que la version 2 du
  // calendrier ne porte plus du tout.
  const cfgTete: Configuration = {
    franc: francEnTeteDaffiche(entree),
    prorogation: entree.prorogation991 === 'OUI',
    feteNationale: regles.feteNationale,
    redaction: entree.prorogationTeteLarge === true,
    cascade: regles.cascade,
    demiJournee: regles.demiJournee,
  }
  const tete = derouler(cfgTete, p.depart, joursTotal, entrees, entree.code, locale)

  // 7 bis. § 0, règle 1 — la borne anti-boucle a joué : le moteur REFUSE (défaut 5). Rendre
  // le onzième jour sans l'avoir vérifié, c'était afficher en gros caractères, copier au
  // presse-papiers et SIGNER dans le permalien une date que le moteur sait fausse.
  if (tete.borneAtteinte) {
    return refus(entree, 'CASCADE_BORNE', ph.refusCascadeBornee(CASCADE_MAX), locale)
  }

  // 8. La borne historique vaut aussi pour le dernier jour CALCULÉ.
  if (!p.ignorerBorneHistorique && comparer(tete.date, BORNE_HISTORIQUE) < 0) {
    return refus(entree, 'BORNE_HISTORIQUE', ph.borneHistorique, locale)
  }

  // 9. Les lectures concurrentes. Chacune ne peut qu'AJOUTER des jours.
  const lectures: LectureNommee[] = []
  /**
   * § 4.9, A4 — le DÉROULÉ complet de chaque lecture retenue, et pas seulement sa date.
   * Sans lui, A4 se déclenchait sur la seule PRÉSENCE d'une ligne CUMUL, sans jamais
   * vérifier qu'une des quatre entrées `autorite: 'REDACTION'` avait réellement joué.
   */
  const deroules = new Map<CleLecture, Deroule>()
  const ajouter = (cle: Exclude<CleLecture, 'TETE'>, cfg: Configuration) => {
    const deroule = derouler(cfg, p.depart, joursTotal, entrees, entree.code, locale)
    // § 0, règle 1 — une lecture dont la cascade s'est épuisée ne porte pas de date vérifiée :
    // on ne la nomme pas. La tête d'affiche, elle, a déjà refusé plus haut (défaut 5).
    if (deroule.borneAtteinte) return
    const d = deroule.date
    if (comparer(d, tete.date) < 0) {
      // Invariant du bloc 10 : une lecture nommée ne peut jamais être ANTÉRIEURE à la tête
      // d'affiche. Si cela arrive, c'est un défaut du moteur, pas une date à afficher.
      throw new Error(
        `Invariant rompu : la lecture ${cle} rend une date antérieure à la tête d’affiche.`,
      )
    }
    if (comparer(d, tete.date) === 0) return
    deroules.set(cle, deroule)
    lectures.push({ cle, ...ph.lectures[cle], date: d })
  }

  // ⚠️ **PLUS DE `ajouter('R1' | 'R1_T', …)` NI DE `ajouter('R3', …)` DEPUIS LE 20 AOÛT 2026
  // (SOIR).** R1 / R1-T nommaient la date qu'auraient donnée les cinq fêtes NATIONALES de
  // l'article 275.1 de la Constitution ; R3 celle qu'aurait donnée la répétition du report.
  // Me Vaval a répondu OUI aux deux : la tête d'affiche les applique désormais (voir `cfgTete`
  // ci-dessus), et une réserve qui rend la date de la tête n'a plus rien à nommer. Le motif
  // complet, et ce qui subsiste des deux, sont en tête de `lectures.ts` et de
  // `regles-lecture.ts`. **Sous les règles de la version 1**, que rejoue un permalien `rl=1`,
  // la tête redevient étroite — mais les deux réserves ne reparaissent pas pour autant : elles
  // ont été retirées du produit, pas mises en sommeil.
  //
  // ⚠️ **PLUS DE `ajouter('R6', …)` DEPUIS LE 20 AOÛT 2026 (MATIN).** La réserve R6 nommait la date
  // qu'auraient donnée les quatre jours sans texte du calendrier de la version 1 (Lundi Gras,
  // 14 août, 20 septembre, 1er novembre). Le décret du 11 décembre 2024 les institue : la
  // version 2 ne porte plus aucune entrée `autorite: 'REDACTION'`, et sous la version 1 la
  // lecture cumulée les porte toujours. Le motif complet est en tête de `lectures.ts`.
  if (entree.regimeIncertain) ajouter('REGIME_FRANC', { ...cfgTete, franc: true })
  if (entree.prorogation991 === 'INCERTAIN') {
    ajouter('PROROGATION_991', { ...cfgTete, prorogation: true })
  }
  // § 4.6 — **LA LECTURE `DEMI_JOURNEE`, OUVERTE LE 20 AOÛT 2026 (SOIR), défaut 2 de la
  // troisième recette.** Le décret du 11 décembre 2024 ne chôme le Lundi Gras qu'« à partir de
  // midi » : la tête d'affiche ne proroge donc plus sur lui (§ 0, règle 4 — une lecture qui
  // RETARDE la date est écartée de la tête). Ce qui était perdu ne l'est pas : cette lecture
  // nomme la date tardive, et l'écran la montre à côté de la date sûre. Sous les règles de la
  // version 1, `cfgTete.demiJournee` vaut déjà `true` : la configuration est alors identique à
  // celle de la tête, la date aussi, et `ajouter` l'écarte de lui-même.
  ajouter('DEMI_JOURNEE', { ...cfgTete, demiJournee: true })

  // La ligne « lecture la plus large » borne l'exposition. On ne l'affiche que si elle
  // DÉPASSE toutes les lectures déjà nommées : sinon elle répéterait l'une d'elles. Le cas
  // du 1er novembre, sous le calendrier de la VERSION 1, le montrait : les jours sans texte
  // seuls donnaient le 2, cumulés à la cascade le 3, alors que la cascade seule ne donnait rien.
  //
  // ⚠️ **ELLE PART DE LA TÊTE, ELLE NE REPART PLUS DE ZÉRO** (20 août 2026, soir). Elle posait
  // `feteNationale: true` et `cascade: true` en dur, du temps où R1 et R3 les NOMMAIENT. Ces
  // deux drapeaux viennent maintenant de la version de règles : les forcer ici ferait dire à la
  // ligne « toutes les réserves cumulées » une date qu'AUCUNE réserve nommée ne produit, sous
  // un permalien `rl=1`. Le cumul n'ajoute donc plus que ce qui reste en réserve — le régime
  // franc, la prorogation de l'art. 991 — et les quatre jours sans texte de la version 1 du
  // calendrier, dont A4 tire son objet.
  const cfgCumul: Configuration = {
    ...cfgTete,
    franc: cfgTete.franc || entree.regimeIncertain,
    prorogation: cfgTete.prorogation || entree.prorogation991 === 'INCERTAIN',
    redaction: true,
    // La demi-journée entre au cumul comme elle entre dans sa propre lecture : la ligne « la
    // plus large » ne serait plus la plus large si elle l'oubliait.
    demiJournee: true,
  }
  const cumul = derouler(cfgCumul, p.depart, joursTotal, entrees, entree.code, locale)
  const dateCumul = cumul.date
  const maxNommees = lectures.reduce(
    (max, l) => (apres(l.date, max) ? l.date : max),
    tete.date,
  )
  if (!cumul.borneAtteinte && apres(dateCumul, maxNommees)) ajouter('CUMUL', cfgCumul)

  let lectureLaPlusLarge = tete.date
  for (const l of lectures) if (apres(l.date, lectureLaPlusLarge)) lectureLaPlusLarge = l.date

  // 10. Ce qui se montre.
  const joursEcartes: JourEcarte[] = tete.sauts.map((s) => ({
    date: s.jour,
    jourSemaine: dateEnToutesLettres(s.jour, locale).split(' ')[0],
    motifs: s.motifs,
  }))

  const praticable = construirePraticable(
    tete.date,
    entrees,
    entree.code,
    locale,
    cfgTete.demiJournee,
  )

  const etapes = construireEtapes({
    entree,
    depart: p.depart,
    joursBase,
    joursSupplement,
    joursDistance,
    detailDistance,
    franc: cfgTete.franc,
    deroule: tete,
    entrees,
    cfgTete,
    lectures,
    locale,
  })

  const avertissements = construireAvertissements({
    entree,
    tete: tete.date,
    lectures,
    joursRedaction: joursDeLaRedaction(deroules, locale),
    entrees,
    detailDistance,
    joursTotal,
    depart: p.depart,
    cfgTete,
    code: entree.code,
    locale,
  })

  return {
    statut: 'CALCUL',
    entree,
    depart: p.depart,
    joursBase,
    joursSupplement,
    joursDistance,
    detailDistance,
    franc: cfgTete.franc,
    regimeAffiche: regimeAffiche(entree, locale),
    dernierJourCompte: tete.dernierJourCompte,
    echeance: tete.echeance,
    teteAffiche: tete.date,
    phraseSecurite: ph.phraseSecurite(dateEnToutesLettres(tete.date, locale)),
    etapes,
    joursEcartes,
    praticable,
    lectures,
    lectureLaPlusLarge,
    avertissements,
    versionCalendrier: version,
    versionRegles: versionR,
  }
}

/**
 * § 4.9, A4 — les jours qui ont RÉELLEMENT joué sur l'autorité de la rédaction, dans la
 * lecture cumulée. Rendus dans l'ordre chronologique, sans doublon.
 *
 * ⚠️ **CE CHEMIN N'EST PLUS ATTEIGNABLE QUE SOUS LE CALENDRIER DE LA VERSION 1** (20 août
 * 2026) : la version 2 ne porte aucune entrée `autorite: 'REDACTION'`. Il reste parce que les
 * permaliens `c=1` se rejouent, et qu'un calcul qui écarte un jour doit dire lequel.
 *
 * ⚠️ CORRECTIF (défaut 8). A4 se déclenchait sur la seule PRÉSENCE d'une ligne CUMUL. Sur
 * un départ au 1er décembre 2029 (art. 354), la ligne CUMUL vient du 1er et du 2 janvier
 * 2030 — deux fêtes NATIONALES, instituées par l'article 275.1 de la Constitution : l'écran
 * imprimait « aucun texte du corpus ne l’institue » sous une entrée que le corpus institue.
 */
function joursDeLaRedaction(
  deroules: ReadonlyMap<CleLecture, Deroule>,
  locale: Locale,
): JourEcarte[] {
  const parDate = new Map<string, JourEcarte>()
  for (const cle of ['CUMUL'] as const) {
    const deroule = deroules.get(cle)
    if (!deroule) continue
    for (const saut of deroule.sauts) {
      const motifs = saut.motifs.filter((m) => m.autorite === 'REDACTION')
      if (motifs.length === 0) continue
      const k = `${saut.jour.y}-${saut.jour.m}-${saut.jour.d}`
      if (parDate.has(k)) continue
      parDate.set(k, {
        date: saut.jour,
        jourSemaine: dateEnToutesLettres(saut.jour, locale).split(' ')[0],
        motifs,
      })
    }
  }
  return [...parDate.values()].sort((x, y) => comparer(x.date, y.date))
}

// ---------------------------------------------------------------------------
// Le raisonnement, pas à pas — § 6.3 c)
// ---------------------------------------------------------------------------

/**
 * § 6.3 — « Art. 28 » ne se compose pas en « art. Art. 28 », et « 354 » se compose en
 * « art. 354 ». Même règle de préfixe que `slugifierArticle` (§ 5.2 bis) ; une désignation
 * qui porte déjà « art. » ailleurs qu'en tête — « Loi, art. 10 », « Jur. (art. 488) » — est
 * rendue TELLE QUELLE, parce que le préfixe y appartient à la désignation.
 */
/**
 * « Réf — « la phrase de l'article » » → « Réf ». La citation est déjà donnée en toutes
 * lettres à l'étape 3 ; l'étape de l'échéance n'en répète que la RÉFÉRENCE.
 */
function referenceDuFondement(fondement: string): string {
  const i = fondement.indexOf(' — «')
  return i > 0 ? fondement.slice(0, i) : fondement
}

const PREFIXE_INITIAL = /^\s*(?:arts?\.|articles?)\s+/i

/**
 * § 6.3 — LE NUMÉRO SEUL. **135 des 393 lignes portent déjà leur préfixe** dans `article` :
 * « Art. 164 », « Arts. 30–34 », « Art. 229 (L. 5 mai 1949) ». Tout gabarit qui recolle
 * « art. » devant produit « art. Art. 164 » — dans le menu, dans l'en-tête du résultat, dans
 * la ligne « Textes appliqués », dans le presse-papiers que l'avocate colle dans une écriture,
 * et jusque dans la requête de recherche du corpus.
 *
 * On retire donc le préfixe **INITIAL, et lui seul** : « Loi, art. 10 » et « Jur. (art. 488) »
 * le gardent, parce qu'il y appartient à la désignation et non à un gabarit d'affichage.
 */
export function numeroArticle(article: string): string {
  return (article ?? '').trim().replace(PREFIXE_INITIAL, '').trim()
}

export function articleAffiche(article: string): string {
  const a = (article ?? '').trim()
  if (!a || a === '—') return ''
  const numero = numeroArticle(a)
  // « Arts. 30–34 » reste au pluriel : le singulier ferait croire à un article unique.
  if (numero !== a) return `${/^\s*(?:arts\.|articles)\s/i.test(a) ? 'arts.' : 'art.'} ${numero}`
  if (/\barts?\.|\barticles?\b/i.test(a)) return a
  return `art. ${a}`
}

/** § 8.2 — le motif de refus d'une entrée, avec le repli de traduction du répertoire. */
function motifRefusLocalise(entree: EntreeDelai, locale: Locale): string | null {
  if (!entree.motifRefusFr) return null
  const relue = entree.traductionRelue ?? false
  if (!relue || locale === 'fr') return entree.motifRefusFr
  const candidate = locale === 'en' ? entree.motifRefusEn : entree.motifRefusHt
  return candidate && candidate.trim() ? candidate : entree.motifRefusFr
}

function construireEtapes(a: {
  entree: EntreeDelai
  depart: CivilDate
  joursBase: number
  joursSupplement: number
  joursDistance: number
  detailDistance: { km: number; jours: number }[]
  franc: boolean
  deroule: Deroule
  /** § 4.8 — le calendrier de la version retenue. L'étape finale l'INTERROGE (défauts 1 et 7). */
  entrees: readonly EntreeCalendrier[]
  /** La configuration de la tête d'affiche : elle dit ce qui proroge sous cette lecture. */
  cfgTete: Configuration
  /** Les lectures nommées, pour renvoyer à PROROGATION_991 avec sa date. */
  lectures: readonly LectureNommee[]
  locale: Locale
}): Etape[] {
  const { entree, locale } = a
  const p = phrases(locale)
  const j = (d: CivilDate) => dateEnToutesLettres(d, locale)
  const etapes: Etape[] = []

  etapes.push({
    cle: 'depart',
    texte: p.etapeDepart(entree.pointDepartFr, j(a.depart)),
    date: a.depart,
  })

  // § 4.7 — le fondement se PORTE. La parenthèse d'origine rendait pour le Code civil la
  // tautologie « (droit commun : le jour du départ ne se compte pas) » (défaut 10).
  const fondementDepart =
    entree.code === 'TRAVAIL'
      ? 'C. trav., art. 511'
      : entree.code === 'CPC'
        ? 'C. pr. civ., art. 987'
        : p.fondementDroitCommunCivil
  etapes.push({
    cle: 'jour-depart',
    texte: p.etapeJourDepart(fondementDepart),
  })

  // § 6.3 — « Délai : 30 jours francs », et jamais « art. Art. 28 » (défaut 16 a et b).
  etapes.push({
    cle: 'duree',
    texte: p.etapeDuree({
      jours: a.joursBase,
      franc: a.franc,
      dureeTexte: entree.dureeTexte,
      reference: articleAffiche(entree.article),
      // § 4.5 — quand l'article ne chiffre pas lui-même sa durée, l'écran le DIT et nomme
      // celui qui l'énonce. Sans cette phrase, la page attribuait trente jours à un article
      // qui n'en porte aucun (défaut 3, art. 356).
      dureeFondement: entree.dureeFondementFr ?? null,
      regimeFondement: entree.regimeFondement,
    }),
  })

  if (a.joursSupplement > 0) {
    etapes.push({ cle: 'supplement', texte: p.etapeSupplement(a.joursSupplement) })
  }

  if (a.detailDistance.length > 0) {
    const detail = a.detailDistance
      .map((d) =>
        p.detailDistance({
          km: d.km,
          quotient: Math.floor(d.km / 40),
          reste: d.km % 40,
          jours: d.jours,
        }),
      )
      .join(' ; ')
    etapes.push({
      cle: 'distance',
      texte: p.etapeDistanceDetaillee(a.joursDistance, detail),
    })
  } else if (a.joursDistance > 0) {
    etapes.push({ cle: 'distance', texte: p.etapeDistanceSimple(a.joursDistance) })
  } else {
    etapes.push({
      cle: 'distance',
      texte:
        entree.kind === 'JOURS_DISTANCE_NON_CHIFFREE'
          ? p.etapeDistanceNonChiffree
          : p.etapeDistanceAucune,
    })
  }

  etapes.push({
    cle: 'dernier-jour-compte',
    texte: p.etapeDernierJourCompte(j(a.deroule.dernierJourCompte)),
    date: a.deroule.dernierJourCompte,
  })

  // § 4.7 — « Aucune règle générale de computation au Code civil » : le caractère franc des
  // six entrées CIVIL vient de la PHRASE DE LEUR PROPRE ARTICLE, déjà portée par
  // `regimeFondement` et déjà affichée à l'étape 3. Fonder cette étape sur l'art. 987
  // attribuait au Code de procédure civile un délai du Code civil (défaut 10).
  const fondementEcheance =
    entree.code === 'TRAVAIL'
      ? 'C. trav., art. 511'
      : entree.code === 'CPC'
        ? 'C. pr. civ., art. 987'
        : referenceDuFondement(entree.regimeFondement)
  etapes.push({
    cle: 'echeance',
    texte: a.franc
      ? p.etapeEcheanceFranche(fondementEcheance, j(a.deroule.echeance))
      : entree.regimeIncertain
        ? p.etapeEcheanceIncertaine(j(a.deroule.echeance))
        : p.etapeEcheanceOrdinaire(j(a.deroule.echeance)),
    date: a.deroule.echeance,
  })

  /**
   * ⚠️ **UN MOTIF PAR ENTRÉE, ET LE GENRE DÉCIDE DU GABARIT** (correctif du 20 août 2026 au
   * soir). La rédaction précédente joignait les LIBELLÉS puis collait un gabarit unique — « un
   * jour de fête légale (X et Y) » — et le booléen `seulementDimanche` ne rattrapait que le cas
   * où il n'y avait QUE des dimanches. D'où deux phrases fausses, vérifiées à l'API :
   *
   *   - « Le lundi 18 mai 2026 est un jour de fête légale (La Fête du Drapeau et de
   *     l'Université) » — c'est une fête NATIONALE (Const. 1987, art. 275.1), et l'art. 991
   *     al. 3 ne vise que la fête légale ;
   *   - « Le dimanche 2 novembre 2025 est un jour de fête légale (Dimanche et Fête des
   *     Morts) » — le dimanche était NOMMÉ DANS la parenthèse des fêtes légales ;
   *   - « Le samedi 1er novembre 2025 est un jour de fête légale (La Toussaint) » — jour de la
   *     RÉDACTION, dont la ligne fine du même calcul dit « aucun texte du corpus ne l'institue ».
   *
   * Le dimanche se reconnaît à son GENRE, jamais à son libellé : comparer « dimanche » au texte
   * affiché échouait dès la première traduction.
   */
  const motifEnPhrase = (m: MotifProrogation): string => {
    switch (m.genre) {
      case 'DIMANCHE':
        return p.motifDimancheArticle
      case 'FETE_NATIONALE':
        return p.motifFeteNationale(m.libelle)
      case 'REDACTION':
        return p.motifJourRedaction(m.libelle)
      // `A_SURVEILLER` n'entre JAMAIS dans un saut (`entreeProroge` le refuse en tête de
      // fonction, § 4.13) : le cas est ici pour que le compilateur garde l'énumération close.
      case 'A_SURVEILLER':
      case 'FETE_LEGALE':
        return p.motifFeteLegale(m.libelle)
    }
  }
  for (const saut of a.deroule.sauts) {
    etapes.push({
      cle: `prorogation-${saut.motifs[0]?.cle ?? 'x'}`,
      texte: p.etapeProrogation({
        jour: j(saut.jour),
        motif: saut.motifs.map(motifEnPhrase).join(p.jointureMotifs),
        source: sourceProrogation(entree.code),
        suivant: j(addDays(saut.jour, 1)),
      }),
      date: addDays(saut.jour, 1),
    })
  }

  // -------------------------------------------------------------------------
  // L'ÉTAPE FINALE — elle INTERROGE la date, elle ne la suppose pas.
  //
  // ⚠️ CORRECTIF (défauts 1 et 7, le bloquant). La rédaction d'origine ne testait que
  // `estSamedi` et écrivait sinon, EN DUR, « n’est ni un dimanche ni une fête légale ». Or
  // la lecture étroite ne prorogeait que d'UN jour, et le Code civil ne proroge pas du
  // tout (`prorogation991: INCERTAIN`) : la tête d'affiche tombe régulièrement un dimanche
  // ou une fête légale. Mesuré : 81 raisonnements faux sur 4 000 calculs, dont le gabarit
  // du § 6.3 lui-même (« Le dimanche 26 décembre 2027 n’est ni un dimanche… ») — pendant
  // que le bloc « jour praticable », deux blocs plus bas, écrivait l'inverse sur le même
  // écran. C'est le § 0, règle 2 : aucune date sans son raisonnement, et jamais un
  // raisonnement que l'écran dément lui-même.
  // -------------------------------------------------------------------------
  const finale = a.deroule.date
  // Ce qui, sur ce jour, PROROGERAIT sous la lecture retenue…
  const motifsFinaux = motifsDuJour(finale, a.cfgTete, a.entrees, entree.code, locale)
  const clesMotifs = new Set(motifsFinaux.map((m) => m.cle))
  // … et ce que le calendrier porte sans proroger sous cette lecture-là (fête nationale →
  // sous les règles de la version 1, jour à surveiller → A6, et sous le calendrier de la
  // version 1 les jours sans texte instituant).
  const autresEntrees = entreesDuJour(finale, a.entrees).filter((e) => !clesMotifs.has(e.cle))
  const nommer = (xs: readonly { cle: string; libelle: string }[]) =>
    xs.map((x) => (x.cle === 'DIMANCHE' ? p.motifDimancheArticle : x.libelle)).join(p.jointureMotifs)
  const nommerEntrees = (xs: readonly EntreeCalendrier[]) =>
    nommer(xs.map((e) => ({ cle: e.cle, libelle: libelle(e, locale) })))
  const lecture991 = a.lectures.find((l) => l.cle === 'PROROGATION_991')

  /**
   * § 4.13 — « voir les lectures nommées » ne s'écrit QUE s'il y en a. Un jour À SURVEILLER
   * n'en produit aucune par construction : l'étape invitait à consulter un bloc que le bloc
   * suivant déclarait vide (« Aucune lecture concurrente ne donne une date différente. »).
   */
  const renvoi = (): string =>
    a.lectures.length > 0 ? p.voirLecturesEtAvertissements : p.voirAvertissements

  /**
   * Pourquoi la date ne bouge pas malgré le motif, et où la question est posée.
   *
   * ⚠️ **CE CHEMIN N'EST ATTEINT QUE SI LA TÊTE D'AFFICHE PORTE ENCORE UN MOTIF DE
   * PROROGATION** (`motifsFinaux.length > 0`) — c'est le cas ordinaire sous les règles de la
   * version 1, où l'article proroge « d'UN jour », et un seul. Sous celles de la version 2, la
   * cascade fait de la tête un POINT FIXE : `derouler` ne s'arrête que sur un jour sans motif,
   * et si la borne anti-boucle joue, `calculer` REFUSE avant d'arriver ici (défaut 5). La
   * branche `cascade` est donc INATTEIGNABLE par construction, et elle le dit — au lieu de
   * l'ancienne phrase `consequenceCascadeBornee`, qui affirmait « la plateforme s'arrête là »
   * sous une date que la plateforme venait pourtant d'afficher.
   */
  const consequence = (): string => {
    if (a.cfgTete.prorogation) {
      if (a.cfgTete.cascade) {
        throw new Error(
          'Invariant rompu : sous la cascade, la tête d’affiche porte encore un motif de ' +
            'prorogation. `derouler` ne peut s’arrêter que sur un point fixe, et la borne ' +
            'anti-boucle est refusée en amont (§ 0, règle 1).',
        )
      }
      return p.consequenceUnJour(sourceProrogation(entree.code), j(finale))
    }
    // La prorogation ne joue pas dans la lecture retenue (Code civil, saisie libre).
    return (
      p.consequencePasAcquise(entree.prorogationFondement) +
      (lecture991 ? p.consequenceLecture991(lecture991.libelle, j(lecture991.date)) : '')
    )
  }

  if (estSamedi(finale)) {
    // Le samedi n'est pas prorogé (§ 2.9) — mais il peut être l'Assomption.
    const surLeJour = [
      ...motifsFinaux.map((m) => ({ cle: m.cle, libelle: m.libelle })),
      ...autresEntrees.map((e) => ({ cle: e.cle, libelle: libelle(e, locale) })),
    ]
    let texte = p.finaleSamedi(j(finale))
    if (surLeJour.length > 0) {
      texte += p.finaleSamediEnOutre(nommer(surLeJour))
      texte +=
        motifsFinaux.length > 0
          ? consequence()
          : p.finaleSamediPorteSansProroger + renvoi()
    }
    etapes.push({ cle: 'finale-samedi', texte, date: finale })
  } else if (motifsFinaux.length === 0 && autresEntrees.length === 0) {
    etapes.push({ cle: 'finale', texte: p.finaleRas(j(finale)), date: finale })
  } else if (motifsFinaux.length > 0) {
    etapes.push({
      cle: 'finale-empechee',
      texte:
        p.finaleEmpechee({
          date: j(finale),
          luiMeme: a.cfgTete.prorogation,
          noms: nommer(motifsFinaux),
        }) + consequence(),
      date: finale,
    })
  } else {
    etapes.push({
      cle: 'finale-calendrier',
      texte:
        p.finaleCalendrier({
          date: j(finale),
          source: sourceProrogation(entree.code),
          noms: nommerEntrees(autresEntrees),
        }) + renvoi(),
      date: finale,
    })
  }

  return etapes
}

// ---------------------------------------------------------------------------
// Les avertissements — § 4.9. Ordre imposé : A6, A2, A4, A5 / A5-bis, A1, A3.
// ---------------------------------------------------------------------------

function construireAvertissements(a: {
  entree: EntreeDelai
  tete: CivilDate
  lectures: LectureNommee[]
  /** § 4.9 — les jours de la RÉDACTION qui ont réellement joué dans la lecture cumulée. */
  joursRedaction: JourEcarte[]
  entrees: readonly EntreeCalendrier[]
  detailDistance: { km: number; jours: number }[]
  joursTotal: number
  depart: CivilDate
  cfgTete: Configuration
  code: CodeDelai
  locale: Locale
}): Avertissement[] {
  const { entree, locale } = a
  const p = phrases(locale)
  const avant: Avertissement[] = []

  // --- A6 — jour à surveiller. EN TÊTE : c'est le seul qui porte sur la date affichée.
  const datesAControler: CivilDate[] = [a.tete, ...a.lectures.map((l) => l.date)]
  const vues = new Set<string>()
  for (const d of datesAControler) {
    const cle = `${d.y}-${d.m}-${d.d}`
    if (vues.has(cle)) continue
    vues.add(cle)
    for (const e of entreesDuJour(d, a.entrees)) {
      if (e.typeEntree !== 'A_SURVEILLER') continue
      avant.push(construireA6(d, e, a.entrees, a.cfgTete, a.code, locale))
    }
  }

  // --- A2 — la distance saisie.
  if (a.detailDistance.length > 0) {
    const sansDistance = derouler(
      a.cfgTete,
      a.depart,
      a.joursTotal - a.detailDistance.reduce((s, d) => s + d.jours, 0),
      a.entrees,
      a.code,
      locale,
    ).date
    avant.push({ cle: 'A2', texte: p.a2(dateEnToutesLettres(sansDistance, locale)) })
  }

  // --- A4 — une fête sans source textuelle est RÉELLEMENT intervenue dans une lecture nommée.
  //
  // ⚠️ CORRECTIF (défaut 8). Le déclencheur était la seule PRÉSENCE d'une ligne large, sans
  // jamais vérifier qu'une des entrées `autorite: 'REDACTION'` avait joué : 34 A4
  // sur 99 étaient dans ce cas. Départ 1er décembre 2029, art. 354 → CUMUL au 3 janvier 2030,
  // qui ne vient que du 1er et du 2 janvier — deux fêtes NATIONALES de l'article 275.1 de la
  // Constitution. « Aucun texte du corpus ne l’institue » était alors une affirmation FAUSSE
  // sous la signature de la rédaction (§ 5.4).
  if (a.joursRedaction.length > 0) {
    const noms = a.joursRedaction
      .map(
        (jr) =>
          `${locale === 'fr' ? 'le ' : ''}${dateEnToutesLettres(jr.date, locale)} ` +
          `(${jr.motifs.map((m) => m.libelle).join(', ')})`,
      )
      .join(locale === 'fr' ? ' et ' : locale === 'en' ? ' and ' : ' ak ')
    avant.push({ cle: 'A4', texte: p.a4(noms, a.joursRedaction.length > 1) })
  }

  // --- A5 / A5-bis — l'augmentation que la plateforme ne calcule pas.
  if (entree.kind === 'JOURS_DISTANCE_NON_CHIFFREE') {
    avant.push(
      entree.avisDistance === 'A5_BIS'
        ? { cle: 'A5_BIS', texte: p.a5bis }
        : { cle: 'A5', texte: p.a5(entree.citationArticle ?? null) },
    )
  }

  avant.push({ cle: 'A1', texte: p.a1 })
  avant.push({ cle: 'A3', texte: p.a3 })
  return avant
}

/**
 * § 4.13 — LE GABARIT DE A6 : quatre phrases, dans cet ordre, aucune facultative.
 * La date conditionnelle est CALCULÉE et AFFICHÉE — un avertissement qui dit « le délai
 * pourrait être prorogé » sans dire de combien oblige l'utilisatrice à refaire le calcul.
 * Elle n'est JAMAIS la tête d'affiche.
 */
function construireA6(
  date: CivilDate,
  e: EntreeCalendrier,
  entrees: readonly EntreeCalendrier[],
  cfg: Configuration,
  code: CodeDelai,
  locale: Locale,
): Avertissement {
  const p = phrases(locale)
  const conditionnelle = addDays(date, 1)
  const phrase1 = p.a6Phrase1(dateEnToutesLettres(date, locale), libelle(e, locale))
  const phrase2 = observationsTexte(e, locale)
  let phrase3 = p.a6Phrase3({
    annee: date.y,
    date: dateEnToutesLettres(conditionnelle, locale),
    source: sourceProrogation(code),
  })
  // Cascade — on l'ÉCRIT, on ne la calcule pas au deuxième niveau sur un fondement déjà
  // conditionnel (§ 4.13).
  const motifsSuivants = motifsDuJour(conditionnelle, cfg, entrees, code, locale)
  if (motifsSuivants.length > 0) {
    phrase3 += p.a6Cascade(motifsSuivants.map((m) => m.libelle.toLowerCase()).join(p.jointureMotifs))
  }
  // § 4.13, exigence 4 — la recherche au corpus est un LIEN, pas des crochets dans la phrase.
  // Elle sort donc du texte et voyage en donnée jusqu'à l'écran, qui sait seul arbitrer entre
  // un utilisateur connecté et un visiteur anonyme (« connexion requise »).
  const phrase4 = p.a6Phrase4(observationsBorne(e, locale))
  const note = noteJournee(e, locale)
  const texte = [phrase1, phrase2, phrase3, phrase4, note].filter(Boolean).join(' ')
  return {
    cle: 'A6',
    texte,
    dateConditionnelle: conditionnelle,
    rechercheQ: e.rechercheCorpusQ ?? null,
    rechercheLibelle: e.rechercheCorpusQ ? p.a6Recherche(e.rechercheCorpusQ) : null,
  }
}
