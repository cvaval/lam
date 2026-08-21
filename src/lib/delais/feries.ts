/**
 * § 4.3, § 4.13, § 5.4 et § 5.4 bis — LE CALENDRIER DE COMPUTATION.
 * **AUCUN `Date` DANS CE FICHIER.**
 *
 * Le calendrier n'est pas une constante : c'est une **suite de versions datées**. Un
 * permalien pointe une version, jamais « le calendrier courant » — sinon une édition
 * changerait rétroactivement un calcul déjà rendu et déjà cité.
 *
 * DEUX VERSIONS EN LIGNE :
 *  - **version 1** (19 août 2026) — 7 fêtes légales du décret du 23 mai 1989, 5 fêtes
 *    nationales, **4 entrées sans texte** portées `autorite: 'REDACTION'`, 5 jours à
 *    surveiller. Elle reste servie aux permaliens qui la nomment (`c=1`) ;
 *  - **version 2** (20 août 2026) — le *Décret du 11 décembre 2024 déterminant les Fêtes
 *    Légales* (Moniteur, Spécial n° 66-A) a été retrouvé : il énumère **onze** fêtes
 *    légales, dont les quatre que la version 1 portait sans texte. **Aucune entrée
 *    `autorite: 'REDACTION'` n'y subsiste.**
 *
 * Les catégories, et elles ne font pas la même chose :
 *  - `PERMANENT` + `autorite: 'TEXTE'` + `categorie: 'FETE_LEGALE'` → les fêtes légales du
 *    décret applicable (7 en v1, 11 en v2) : elles prorogent DANS LA TÊTE D'AFFICHE ;
 *  - `PERMANENT` + `categorie: 'FETE_NATIONALE'` → les 5 de la Constitution : elles prorogent
 *    en tête d'affiche depuis le 20 août 2026 (soir), sous les règles de lecture de la
 *    version 2 — Me Vaval a tranché la question que portait la réserve R1, retirée ;
 *  - `PERMANENT` + `autorite: 'REDACTION'` → **version 1 SEULEMENT** : les 4 sans texte.
 *    L'autorité survit au type et à la base parce que les lignes de la v1 la portent
 *    toujours ; aucune version postérieure n'en crée (voir `CALENDRIER_V2`) ;
 *  - `A_SURVEILLER` → les 5 jours récurrents chômés par arrêté : **ils ne prorogent JAMAIS**,
 *    ni en tête d'affiche, ni en lecture nommée, ni dans la « lecture la plus large ».
 *    Ils produisent une PHRASE (l'avertissement A6), pas une date (§ 4.13).
 *
 * Le champ `typeEntree` est le verrou de cette distinction : il n'y a pas d'autre façon de
 * savoir, en lisant une ligne, si elle proroge.
 */
import type { CivilDate } from './civil'
import { egales, parseIso } from './civil'
import type { CleMobile } from './paques'
import { jourMobile } from './paques'

export type TypeEntree = 'PERMANENT' | 'A_SURVEILLER'
export type CategorieFerie = 'FETE_LEGALE' | 'FETE_NATIONALE' | 'CHOMAGE_PAR_ARRETE'
export type AutoriteFerie = 'TEXTE' | 'REDACTION' | 'OBSERVATION'
export type Journee = 'JOURNEE_ENTIERE' | 'DEMI_JOURNEE_APRES_MIDI'
export type Locale = 'fr' | 'en' | 'ht'

/**
 * Une entrée du calendrier, avec SA SOURCE. `source` n'est jamais vide : c'est la règle qui
 * empêche que la liste redevienne une opinion.
 *
 * ⚠️ CORRECTIF (défaut 3 du cahier de recette) : les textes de l'avertissement A6
 * — `observationsTexte*` et `observationsBorne*` — n'existaient qu'en français. Ils portent
 * désormais leurs variantes En/Ht, comme `DelaiEntry`, avec `traductionRelue` et un repli
 * sur le français à l'affichage (`texteLocalise`). Tant que la relecture n'a pas eu lieu,
 * l'écran montre le français : mieux vaut une phrase juridique dans une langue que
 * l'utilisatrice lit qu'une traduction que personne n'a relue.
 */
export type EntreeCalendrier = {
  cle: string
  typeEntree: TypeEntree
  libelleFr: string
  libelleEn: string
  libelleHt: string
  categorie: CategorieFerie
  autorite: AutoriteFerie
  journee: Journee
  noteJourneeFr?: string | null
  noteJourneeEn?: string | null
  noteJourneeHt?: string | null
  /** false → l'interface retombe sur le français (§ 5.2, règle des ~780 libellés non relus). */
  traductionRelue: boolean
  mobile: boolean
  offsetPaques?: number | null
  mois?: number | null
  jour?: number | null
  source: string
  sourceDocId?: string | null
  /** CivilDate ISO, jamais un DateTime : « 1989-06-22 ». */
  appliqueDepuis: string
  // --- réservé aux entrées A_SURVEILLER (§ 4.13) ; NULL et interdits sur PERMANENT ---
  observationsN?: number | null
  observationsTexteFr?: string | null
  observationsTexteEn?: string | null
  observationsTexteHt?: string | null
  observationsBorneFr?: string | null
  observationsBorneEn?: string | null
  observationsBorneHt?: string | null
  rechercheCorpusQ?: string | null
}

/** § 4.3 — borne historique : la liste applicable avant cette date n'est pas établie. */
export const BORNE_HISTORIQUE: CivilDate = { y: 1989, m: 6, d: 22 }

export const MESSAGE_BORNE_HISTORIQUE =
  'La liste des fêtes légales applicable avant le 22 juin 1989 n’est pas établie dans ce ' +
  'corpus (les décrets de 1982 et 1985 donnent d’autres listes). Ce calculateur ne sert pas ' +
  'les dossiers antérieurs à cette date.'

/** Identifiants vérifiés en base de production le 19 août 2026 (§ 2). */
export const DOC_DECRET_1989 = 'cmsw5mxng000ag85y3o2ey2rr'
export const DOC_CONSTITUTION = 'cmr1it23a0000b4r0l6r1xp5l'

/**
 * Le fascicule du décret du 11 décembre 2024, **vérifié en base de production le 20 août
 * 2026** : « Le Moniteur — Édition spéciale n° 66-A — Décembre 2024 », type `LEGISLATION`,
 * source `MONITEUR_PDF_2024`, `number` « LM2024-SP66A », `publicationDate` 2024-12-11,
 * `sourcePdfUrl` renseigné (Blob), en base depuis le 13 juin 2026.
 *
 * ⚠️ **C'EST EXACTEMENT LA MÊME CONVENTION QUE `DOC_DECRET_1989`**, qui n'est pas autre chose
 * que le fascicule scanné « Le Moniteur n° 47-A — Juin 1989 » (source `MONITEUR_PDF_1989`).
 * Le document ANNOTÉ que produira `scripts/import-decret-fetes-2024.ts` est un autre
 * chantier ; il ne change rien ici — le lien profond doit exister dès maintenant, sans quoi
 * la version 2 serait la première du calendrier dont aucune fête légale ne renvoie à une
 * pièce du corpus.
 */
export const DOC_DECRET_2024 = 'cmqcb6mq5007fzywi4vem7v0g'

const SOURCE_DECRET_1989 =
  'Décret du 23 mai 1989 déterminant, en dehors des Fêtes Nationales, de façon plus précise ' +
  'les Fêtes Légales — Le Moniteur n° 47-A du jeudi 22 juin 1989 ; reproduit à l’article 110 ' +
  'du Code du travail.'

const SOURCE_CONSTITUTION =
  'Constitution du 29 mars 1987, art. 275.1 (fêtes nationales) ; art. 275 : le chômage est ' +
  'observé « à l’occasion des Fêtes Nationales et des Fêtes Légales ».'

/**
 * § 5.4 — tronc commun des quatre entrées sans texte. Il est OBLIGATOIRE et explicite :
 * un champ `source` vide ferait de la liste une opinion.
 *
 * ⚠️ **CE TEXTE N'EST PLUS QUE DE L'HISTOIRE, ET IL NE DOIT PAS ÊTRE RÉÉCRIT** (20 août
 * 2026). Le décret du 11 décembre 2024 institue les quatre jours ; la **version 2** du
 * calendrier les porte donc `autorite: 'TEXTE'`. La version 1 reste ce qu'elle était — les
 * permaliens `c=1` la rejouent, et la base garde ses 21 lignes. Le corriger ICI
 * réécrirait rétroactivement une version déjà citée : c'est exactement ce que le
 * versionnage du § 4.3 existe pour empêcher.
 */
const TRONC_REDACTION =
  'Retenu sur instruction de la rédaction (décision de Me Christelle Vaval, 19 août 2026). ' +
  'Aucun texte du corpus ne l’institue comme fête légale permanente ; le décret du 23 mai ' +
  '1989, qui abroge les dispositions contraires, ne le mentionne pas.'

/**
 * § 5.4 bis — la borne de l'Index, IDENTIQUE pour les cinq jours à surveiller. Sans cette
 * phrase, un écran qui ne trouve rien laisse croire qu'il n'y a rien.
 */
export const OBSERVATIONS_BORNE_FR =
  'L’Index du Moniteur de Lam s’arrête au 20 juin 2023 (27 234 entrées, de 1900 à 2023) : la ' +
  'plateforme n’a rien pour 2024, 2025 et 2026. Cette absence n’est pas une absence d’arrêté.'

/** Source d'une entrée A_SURVEILLER : une OBSERVATION de série, jamais un texte. */
function sourceObservation(observation: string): string {
  return (
    'Observation du corpus au 19 août 2026 : ' +
    observation +
    ' Aucun texte permanent n’institue ce jour ; il est chômé, ou non, par arrêté, année par année.'
  )
}

const OBS_CENDRES =
  '14 arrêtés de chômage du Moniteur portent une date qui est exactement le mercredi des ' +
  'Cendres de leur année : 1969, 1973, 1992, 1993, 2005, 2009, 2012, 2013, 2014, 2015, 2016, ' +
  '2017, 2018, 2020. Celui du 8 février 2013 (LM2013-22) le nomme expressément — « à ' +
  'l’occasion du mercredi des Cendres, la journée du mercredi 13 février 2013 » — et celui du ' +
  '10 février 2016 (LM2016-30) chôme la journée « dans son intégralité ».'

const OBS_ASCENSION =
  '5 arrêtés de chômage visent exactement le jour de l’Ascension : 1991, 1992, 1993, 1995, ' +
  '2011 (LM2011-70 : « Arrêté déclarant fériée et chômée la journée du jeudi 2 juin 2011, ' +
  'Fête de l’Ascension »).'

const OBS_JEUDI_SAINT =
  '5 arrêtés de chômage de Semaine Sainte visent exactement le Jeudi Saint : 1969, 1970, ' +
  '1971, 1973 et 1992. Un seul le chôme « à partir de midi » (LM1992-37, jeudi 16 avril ' +
  '1992) ; les quatre autres le chôment en journée entière.'

const OBS_24_OCTOBRE =
  '16 arrêtés de chômage visent le 24 octobre, Jour des Nations Unies, de 1969 à 1995 — aucun ' +
  'après 1995 dans l’Index.'

const OBS_7_FEVRIER =
  '5 arrêtés de chômage visent le 7 février comme tel : 1987, 1990, 1992, 2001 et 2017 (les ' +
  'deux derniers pour une prestation de serment présidentielle). Trois autres le chôment ' +
  'incidemment, l’année où il coïncide avec les Jours Gras (1978, 1989, 2005).'

/** Gabarit d'une entrée `A_SURVEILLER` — cinq champs obligatoires, aucun facultatif. */
function aSurveiller(
  base: Pick<EntreeCalendrier, 'cle' | 'libelleFr' | 'libelleEn' | 'libelleHt'> &
    Partial<Pick<EntreeCalendrier, 'mobile' | 'offsetPaques' | 'mois' | 'jour'>>,
  observationsN: number,
  observationsTexteFr: string,
  rechercheCorpusQ: string,
): EntreeCalendrier {
  return {
    ...base,
    typeEntree: 'A_SURVEILLER',
    categorie: 'CHOMAGE_PAR_ARRETE',
    autorite: 'OBSERVATION',
    // § 5.4 bis : sur une entrée qui ne proroge pas, une demi-journée n'a rien à qualifier.
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: base.mobile ?? false,
    offsetPaques: base.offsetPaques ?? null,
    mois: base.mois ?? null,
    jour: base.jour ?? null,
    source: sourceObservation(observationsTexteFr),
    // Aucune entrée A_SURVEILLER n'a de `sourceDocId` : leur source est une observation
    // de série, pas un texte (§ 5.4 bis).
    sourceDocId: null,
    appliqueDepuis: '1989-06-22',
    observationsN,
    observationsTexteFr,
    // ⚠️ Non traduits, non relus : `texteLocalise` replie sur le français (défaut 3).
    observationsTexteEn: null,
    observationsTexteHt: null,
    observationsBorneFr: OBSERVATIONS_BORNE_FR,
    observationsBorneEn: null,
    observationsBorneHt: null,
    rechercheCorpusQ,
  }
}

/**
 * § 5.4 — VERSION 1 : 16 entrées PERMANENTES + 5 à surveiller = **21 lignes**.
 * Contrôle de graine bloquant : ces trois nombres.
 *
 * ⚠️ **GELÉE DEPUIS LE 20 AOÛT 2026 — NE RIEN Y CHANGER.** La version 2 lui succède ; celle-ci
 * reste servie telle quelle aux permaliens qui la nomment (`c=1`), et ses 21 lignes sont en
 * base. Une correction apportée ici changerait la date d'un calcul déjà rendu et déjà cité.
 */
export const CALENDRIER_V1: readonly EntreeCalendrier[] = [
  // ---- 7 FETE_LEGALE / TEXTE — décret du 23 mai 1989 ----
  {
    cle: 'mardi-gras',
    typeEntree: 'PERMANENT',
    libelleFr: 'Mardi Gras',
    libelleEn: 'Shrove Tuesday',
    libelleHt: 'Madi Gra',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: true,
    offsetPaques: -47,
    source: SOURCE_DECRET_1989,
    sourceDocId: DOC_DECRET_1989,
    appliqueDepuis: '1989-06-22',
  },
  {
    cle: 'vendredi-saint',
    typeEntree: 'PERMANENT',
    libelleFr: 'Vendredi Saint',
    libelleEn: 'Good Friday',
    libelleHt: 'Vandredi Sen',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: true,
    offsetPaques: -2,
    source: SOURCE_DECRET_1989,
    sourceDocId: DOC_DECRET_1989,
    appliqueDepuis: '1989-06-22',
  },
  {
    cle: 'fete-dieu',
    typeEntree: 'PERMANENT',
    libelleFr: 'Fête Dieu',
    libelleEn: 'Corpus Christi',
    libelleHt: 'Fèt Dye',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: true,
    offsetPaques: 60,
    source: SOURCE_DECRET_1989,
    sourceDocId: DOC_DECRET_1989,
    appliqueDepuis: '1989-06-22',
  },
  {
    cle: 'assomption',
    typeEntree: 'PERMANENT',
    libelleFr: 'Fête de l’Assomption',
    libelleEn: 'Feast of the Assumption',
    libelleHt: 'Fèt Asonpsyon',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 8,
    jour: 15,
    source: SOURCE_DECRET_1989,
    sourceDocId: DOC_DECRET_1989,
    appliqueDepuis: '1989-06-22',
  },
  {
    cle: '17-octobre',
    typeEntree: 'PERMANENT',
    libelleFr: 'Commémoration de la Mort de Dessalines',
    libelleEn: 'Commemoration of the Death of Dessalines',
    libelleHt: 'Komemorasyon Lanmò Desalin',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 10,
    jour: 17,
    source: SOURCE_DECRET_1989,
    sourceDocId: DOC_DECRET_1989,
    appliqueDepuis: '1989-06-22',
  },
  {
    cle: '2-novembre',
    typeEntree: 'PERMANENT',
    libelleFr: 'Fête des Morts',
    libelleEn: 'All Souls’ Day',
    libelleHt: 'Fèt Mò',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    // § 4.10 — la demi-journée est traitée comme un JOUR PLEIN. Le champ ne change pas le
    // calcul en v1 ; il nourrit la phrase affichée.
    journee: 'DEMI_JOURNEE_APRES_MIDI',
    noteJourneeFr:
      '2 novembre — les décrets de 1982 et 1985 le chôment « à partir de midi » ; retenu ici ' +
      'comme jour entier.',
    traductionRelue: false,
    mobile: false,
    mois: 11,
    jour: 2,
    source: SOURCE_DECRET_1989,
    sourceDocId: DOC_DECRET_1989,
    appliqueDepuis: '1989-06-22',
  },
  {
    cle: '25-decembre',
    typeEntree: 'PERMANENT',
    libelleFr: 'Jour de Noël',
    libelleEn: 'Christmas Day',
    libelleHt: 'Jou Nwèl',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 12,
    jour: 25,
    source: SOURCE_DECRET_1989,
    sourceDocId: DOC_DECRET_1989,
    appliqueDepuis: '1989-06-22',
  },

  // ---- 5 FETE_NATIONALE / TEXTE — Constitution de 1987, art. 275.1 ----
  {
    cle: '1er-janvier',
    typeEntree: 'PERMANENT',
    libelleFr: 'La Fête de l’Indépendance Nationale',
    libelleEn: 'National Independence Day',
    libelleHt: 'Fèt Endepandans Nasyonal',
    categorie: 'FETE_NATIONALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 1,
    jour: 1,
    source: SOURCE_CONSTITUTION,
    sourceDocId: DOC_CONSTITUTION,
    appliqueDepuis: '1989-06-22',
  },
  {
    cle: '2-janvier',
    typeEntree: 'PERMANENT',
    libelleFr: 'Le Jour des Aïeux',
    libelleEn: 'Ancestors’ Day',
    libelleHt: 'Jou Zansèt yo',
    categorie: 'FETE_NATIONALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 1,
    jour: 2,
    source: SOURCE_CONSTITUTION,
    sourceDocId: DOC_CONSTITUTION,
    appliqueDepuis: '1989-06-22',
  },
  {
    cle: '1er-mai',
    typeEntree: 'PERMANENT',
    libelleFr: 'La Fête de l’Agriculture et du Travail',
    libelleEn: 'Agriculture and Labour Day',
    libelleHt: 'Fèt Agrikilti ak Travay',
    categorie: 'FETE_NATIONALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 5,
    jour: 1,
    source: SOURCE_CONSTITUTION,
    sourceDocId: DOC_CONSTITUTION,
    appliqueDepuis: '1989-06-22',
  },
  {
    cle: '18-mai',
    typeEntree: 'PERMANENT',
    libelleFr: 'La Fête du Drapeau et de l’Université',
    libelleEn: 'Flag and University Day',
    libelleHt: 'Fèt Drapo ak Inivèsite',
    categorie: 'FETE_NATIONALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 5,
    jour: 18,
    source: SOURCE_CONSTITUTION,
    sourceDocId: DOC_CONSTITUTION,
    appliqueDepuis: '1989-06-22',
  },
  {
    cle: '18-novembre',
    typeEntree: 'PERMANENT',
    libelleFr:
      'La Commémoration de la Bataille de Vertières, Jour des forces armées d’Haïti',
    libelleEn: 'Commemoration of the Battle of Vertières, Armed Forces Day',
    libelleHt: 'Komemorasyon Batay Vètyè, Jou Fòs Ame d’Ayiti',
    categorie: 'FETE_NATIONALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 11,
    jour: 18,
    source: SOURCE_CONSTITUTION,
    sourceDocId: DOC_CONSTITUTION,
    appliqueDepuis: '1989-06-22',
  },

  // ---- 4 FETE_LEGALE / REDACTION — sans texte instituant ----
  //
  // ⚠️ Ces quatre lignes NOMMAIENT la réserve R6, retirée le 20 août 2026 : le décret du
  // 11 décembre 2024 les institue, et la version 2 les porte `autorite: 'TEXTE'`. Elles
  // restent ici, inchangées, parce que la version 1 est servie telle quelle aux permaliens
  // qui la nomment. Le motif complet est en tête de `lectures.ts`.
  {
    cle: 'lundi-gras',
    typeEntree: 'PERMANENT',
    libelleFr: 'Lundi Gras',
    libelleEn: 'Shrove Monday',
    libelleHt: 'Lendi Gra',
    categorie: 'FETE_LEGALE',
    autorite: 'REDACTION',
    journee: 'DEMI_JOURNEE_APRES_MIDI',
    noteJourneeFr:
      'Lundi Gras — les arrêtés qui le chôment le font « à partir de midi » ; retenu ici ' +
      'comme jour entier.',
    traductionRelue: false,
    mobile: true,
    offsetPaques: -48,
    source:
      TRONC_REDACTION +
      ' Le corpus porte néanmoins 13 arrêtés de chômage « Jours Gras » (1969-2005), dont 9 ' +
      'chôment le lundi à partir de midi : chômage ponctuel par arrêté, non fête permanente.',
    sourceDocId: null,
    appliqueDepuis: '1989-06-22',
  },
  {
    cle: '14-aout',
    typeEntree: 'PERMANENT',
    libelleFr: 'Jour du Bois-Caïman et de l’Union pour la Liberté',
    libelleEn: 'Bois-Caïman Day and Union for Freedom',
    libelleHt: 'Jou Bwa Kayiman ak Inyon pou Libète',
    categorie: 'FETE_LEGALE',
    autorite: 'REDACTION',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 8,
    jour: 14,
    source: TRONC_REDACTION + ' Le corpus ne porte aucun arrêté de chômage pour cette date.',
    sourceDocId: null,
    appliqueDepuis: '1989-06-22',
  },
  {
    cle: '20-septembre',
    typeEntree: 'PERMANENT',
    libelleFr: 'Jour de Dessalines',
    libelleEn: 'Dessalines Day',
    libelleHt: 'Jou Desalin',
    categorie: 'FETE_LEGALE',
    autorite: 'REDACTION',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 9,
    jour: 20,
    source:
      TRONC_REDACTION +
      ' Le corpus porte néanmoins l’« Arrêté déclarant la journée du 20 septembre “Jour de ' +
      'Dessalines” » (Le Moniteur LM2020-151, 18 septembre 2020) : une dénomination, qui ne ' +
      'dit ni « fériée » ni « chômée » — et l’art. 275.2 de la Constitution réserve les fêtes ' +
      'légales à la loi.',
    sourceDocId: null,
    appliqueDepuis: '1989-06-22',
  },
  {
    cle: '1er-novembre',
    typeEntree: 'PERMANENT',
    libelleFr: 'La Toussaint',
    libelleEn: 'All Saints’ Day',
    libelleHt: 'Latousen',
    categorie: 'FETE_LEGALE',
    autorite: 'REDACTION',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 11,
    jour: 1,
    source:
      TRONC_REDACTION +
      ' Le corpus porte néanmoins 15 arrêtés de chômage visant le 1er novembre, de 1982 à ' +
      '2019 (LM1982-75 … LM2019-185) : chômage ponctuel par arrêté — le troisième déclencheur ' +
      'de l’art. 991 —, non fête permanente.',
    sourceDocId: null,
    appliqueDepuis: '1989-06-22',
  },

  // ---- 5 A_SURVEILLER — § 5.4 bis. Elles NE PROROGENT PAS. ----
  aSurveiller(
    {
      cle: 'mercredi-des-cendres',
      libelleFr: 'Mercredi des Cendres',
      libelleEn: 'Ash Wednesday',
      libelleHt: 'Mèkredi Sann',
      mobile: true,
      offsetPaques: -46,
    },
    14,
    OBS_CENDRES,
    'carnaval',
  ),
  aSurveiller(
    {
      cle: 'ascension',
      libelleFr: 'Ascension',
      libelleEn: 'Ascension Day',
      libelleHt: 'Asansyon',
      mobile: true,
      offsetPaques: 39,
    },
    5,
    OBS_ASCENSION,
    'ascension',
  ),
  aSurveiller(
    {
      cle: 'jeudi-saint',
      libelleFr: 'Jeudi Saint',
      libelleEn: 'Maundy Thursday',
      libelleHt: 'Jedi Sen',
      mobile: true,
      offsetPaques: -3,
    },
    5,
    OBS_JEUDI_SAINT,
    'semaine sainte',
  ),
  aSurveiller(
    {
      cle: '24-octobre',
      libelleFr: '24 octobre — Jour des Nations Unies',
      libelleEn: '24 October — United Nations Day',
      libelleHt: '24 oktòb — Jou Nasyonzini',
      mois: 10,
      jour: 24,
    },
    16,
    OBS_24_OCTOBRE,
    'nations unies',
  ),
  aSurveiller(
    {
      cle: '7-fevrier',
      libelleFr: '7 février',
      libelleEn: '7 February',
      libelleHt: '7 fevriye',
      mois: 2,
      jour: 7,
    },
    5,
    OBS_7_FEVRIER,
    '7 février',
  ),
]

// ═══════════════════════════════════════════════════════════════════════════════
// VERSION 2 — LE DÉCRET DU 11 DÉCEMBRE 2024
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * § 5.4 — **VERSION 2 : les onze fêtes légales ont enfin leur texte.**
 *
 * Le *Décret du 11 décembre 2024 déterminant les Fêtes Légales* (Le Moniteur, Spécial
 * n° 66-A, mercredi 11 décembre 2024) a été retrouvé par la rédaction le 20 août 2026. Il
 * énumère ONZE fêtes légales à son article 2 — les sept du décret du 23 mai 1989, plus
 * les quatre que la version 1 portait `autorite: 'REDACTION'`, sans texte instituant :
 * Lundi Gras, 14 août, 20 septembre, 1er novembre.
 *
 * **La version 1 n'est pas corrigée : elle est SUCCÉDÉE.** Les permaliens déjà émis
 * portent `c=1`, la base garde ses 21 lignes de version 1, et un calcul rejoué sous
 * `c=1` rend la date qu'il rendait. C'est la règle du § 4.3 : le calendrier est une suite
 * de versions datées, jamais une constante que l'on rectifie.
 *
 * ⚠️ **`appliqueDepuis` N'EST PAS UNIFORME, ET C'EST LE POINT DÉLICAT.** Les sept fêtes
 * reconduites de 1989 étaient déjà des fêtes légales AVANT 2024 : leur borne reste au
 * 22 juin 1989, sans quoi un délai de 2015 recalculé sous la version 2 perdrait le Mardi
 * Gras. Les quatre AJOUTS de 2024 ne portent que le 11 décembre 2024 : les inscrire
 * depuis 1989 ferait dire au décret ce qu'il ne dit pas, et fabriquerait rétroactivement
 * des prorogations que personne n'a jamais eues.
 *
 * ⚠️ **`sourceDocId: DOC_DECRET_2024` sur les onze — CORRECTIF DU 20 AOÛT 2026 (SOIR).** Ce
 * commentaire affirmait auparavant que « le fac-similé n'est pas versé au corpus » et que la
 * référence en toutes lettres était « la SEULE façon de retrouver le texte ». **C'était faux,
 * et la base le démentait** : le fascicule y est depuis le 13 juin 2026 sous
 * `cmqcb6mq5007fzywi4vem7v0g` (voir `DOC_DECRET_2024`). Deux conséquences se cumulaient :
 * le décret de 2024 n'était rattaché à aucun document alors que le sien existait, et les
 * SEPT fêtes reconduites PERDAIENT en v2 le `DOC_DECRET_1989` qu'elles portaient en v1. Le
 * champ est déclaré (l. 73) « `Document.id` en base de production, pour le lien profond et
 * pour la vérification » : la v2 aurait été la première version du calendrier dont aucune des
 * onze fêtes légales n'aurait été reliée à une pièce. Le script de bascule n'ayant pas été
 * appliqué, la correction était encore gratuite.
 *
 * ⚠️ Le tronc cite aussi le **dernier considérant** du décret, et pour une raison de droit :
 * l'art. 275.2 de la Constitution réserve les fêtes légales à la LOI (« Les Fêtes Légales
 * sont déterminées par la Loi », texte gelé sous `const-275-2` dans `textes.ts`) — la version
 * 1 opposait précisément cette réserve au 20 septembre. Le décret y répond, et sa réponse est
 * l'argument que la rédaction devra tenir si un confrère conteste la qualification.
 */
const SOURCE_DECRET_2024 =
  'Décret du 11 décembre 2024 déterminant les Fêtes Légales, art. 2 — Le Moniteur, Journal ' +
  'officiel de la République d’Haïti, 179ᵉ année, Spécial n° 66-A, mercredi 11 décembre 2024, ' +
  'pages 1 à 3. Pris par le Conseil Présidentiel de Transition, sur le rapport des Ministres ' +
  'de la Culture et de la Communication, de l’Éducation Nationale et de la Formation ' +
  'Professionnelle, des Affaires Sociales et du Travail, du Commerce et de l’Industrie, des ' +
  'Affaires Étrangères et des Cultes, et de l’Intérieur et des Collectivités Territoriales, ' +
  'et après délibération en Conseil des Ministres. Dernier considérant : « Considérant que le ' +
  'Pouvoir Législatif est, pour le moment, inopérant et qu’il y a alors lieu pour le Pouvoir ' +
  'Exécutif de légiférer par Décret sur les objets d’intérêt public ». C’est la réponse du ' +
  'décret à l’art. 275.2 de la Constitution de 1987 — « Les Fêtes Légales sont déterminées par ' +
  'la Loi » —, réserve que la version 1 du calendrier opposait aux quatre jours qu’elle ' +
  'portait sans texte : un DÉCRET détermine ici ce que la Constitution réserve à la LOI, et ' +
  'il le motive par l’inopérance du Pouvoir Législatif. Art. 3 : « L’Administration Publique, le ' +
  'Commerce, l’Industrie et les Écoles chômeront à l’occasion des Fêtes Nationales et ' +
  'Légales. » Art. 4 : le décret « abroge toutes Lois ou dispositions de Lois, tous ' +
  'Décrets-Lois ou dispositions de Décrets-Lois, tous Décrets ou dispositions de Décrets qui ' +
  'lui sont contraires ».'

/** Ce que le décret de 1989 apportait et que celui de 2024 RECONDUIT (7 entrées). */
const RECONDUIT_DE_1989 =
  'Le même jour figurait déjà à la liste du Décret du 23 mai 1989, art. 1er (Le Moniteur ' +
  'n° 47-A du jeudi 22 juin 1989), reproduit à l’article 110 du Code du travail : le décret ' +
  'de 2024 le reconduit sans interruption, et le calendrier le porte depuis le 22 juin 1989.'

/** Ce que 2024 AJOUTE, et que 1989 ne portait pas (4 entrées). */
const AJOUT_DE_2024 =
  'Le Décret du 23 mai 1989 ne le mentionnait pas : c’est le décret du 11 décembre 2024 qui ' +
  'l’institue en fête légale. Le calendrier ne le porte donc qu’à compter du 11 décembre ' +
  '2024, date du fascicule — l’inscrire plus tôt fabriquerait des prorogations qu’aucun texte ' +
  'n’a jamais accordées.'

/** La source d'une des onze fêtes légales : le tronc commun, puis son rang à l'article 2. */
function sourceDecret2024(rang: string, continuite: string, precision = ''): string {
  return `${SOURCE_DECRET_2024} Énuméré à l’art. 2, ${rang}. ${continuite}${precision ? ' ' + precision : ''}`
}

/** Les deux bornes en présence : la liste de 1989, et l'entrée en vigueur de celle de 2024. */
const DEPUIS_1989 = '1989-06-22'
/**
 * ⚠️ **EXPORTÉE DEPUIS LE 20 AOÛT 2026 (AU VU DU DÉCRET), ET C'EST LA SEULE MARQUE FIABLE DE
 * « CETTE LIGNE VIENT DU DÉCRET DE 2024 ».** `mention-jour.ts` en a besoin : la mention de la
 * demi-journée CITE ce décret, et il ne faut donc la poser que sur ce qu'il institue.
 *
 * Le premier essai clé la reconnaissance sur `sourceDocId === DOC_DECRET_2024` : **il ne marche
 * pas contre la base**. Vérifié en lecture sur la production le 20 août 2026 — la ligne
 * `lundi-gras` de la version 2 y porte `sourceDocId = cmt1x4eza0001m0c3gp6996w7`, quand la
 * constante de ce fichier vaut `cmqcb6mq5007fzywi4vem7v0g` : la graine porte un identifiant
 * qu'un script de liaison a remplacé. La mention ne se déclenchait donc JAMAIS en production,
 * et rien ne l'aurait signalé — les tests passent le calendrier du code, pas celui de la base.
 * `appliqueDepuis`, lui, est écrit par la graine ET par la base à la même valeur, et il DIT ce
 * que la citation affirme : la ligne est entrée au calendrier avec le décret du 11 décembre
 * 2024. C'est une date, pas un identifiant : rien ne la réécrit derrière le dos du code.
 */
export const DEPUIS_2024 = '2024-12-11'

/**
 * § 5.4 — **VERSION 2 : 16 entrées PERMANENTES + 5 à surveiller = 21 lignes**, comme la
 * version 1 — mais 11 fêtes légales au lieu de 7, et **plus aucune `autorite: 'REDACTION'`**.
 *
 * Les onze sont rangées dans l'ORDRE DU DÉCRET (art. 2, 1° à 11°), pas dans l'ordre du
 * calendrier : c'est la liste du texte, et elle se relit contre le fascicule ligne à ligne.
 */
export const CALENDRIER_V2: readonly EntreeCalendrier[] = [
  // ---- 11 FETE_LEGALE / TEXTE — décret du 11 décembre 2024, art. 2 ----
  {
    cle: 'lundi-gras',
    typeEntree: 'PERMANENT',
    libelleFr: 'Lundi Gras',
    libelleEn: 'Shrove Monday',
    libelleHt: 'Lendi Gra',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    // § 4.10 — LE TEXTE LE DIT : « 1°) le Lundi Gras, à partir de midi ». C'est la seule des
    // onze qui porte une restriction d'horaire. ⚠️ Une demi-journée compte pour un JOUR
    // PLEIN dans la prorogation (décision de Me Vaval) : le champ nourrit la phrase
    // affichée, jamais le calcul.
    //
    // ⚠️ **ET CETTE DÉCISION CHANGE DE PORTÉE EN V2 — LA SEULE DU LOT QUI DÉPLACE UNE DATE
    // VERS LE PLUS TARD.** Elle a été prise sous la version 1, où `lundi-gras` était
    // `autorite: 'REDACTION'` : `entreeProroge` l'écartait de la tête d'affiche du portail
    // (`lectures.ts`), et compter la matinée pour un jour plein ne déplaçait donc RIEN. En
    // version 2 la ligne devient `TEXTE`, elle proroge en tête, et un jour ENTIER est ajouté
    // à raison d'une matinée qui reste ouvrable.
    //
    // ⚠️ **TRANCHÉ LE 20 AOÛT 2026 (SOIR) — défaut 2 de la troisième recette. LA VARIANTE A
    // ÉTÉ RETENUE.** `entreeProroge` (`lectures.ts`) lit désormais `journee`, sous le drapeau
    // `demiJournee` de la VERSION DE RÈGLES (`regles-lecture.ts`) : version 1, la demi-journée
    // proroge — c'est ce que rejouent les permaliens `rl=1` ; version 2, elle ne proroge plus.
    // Mesuré avant le correctif, sur 7 304 calculs (1 826 départs 2025-2029 × 8/15/30/31
    // jours) : **40 dates limites retardées de DEUX jours** — deux, et non un, parce que le
    // Lundi Gras est TOUJOURS suivi du Mardi Gras, que le décret chôme en journée entière
    // (art. 2, 2°) : la cascade sautait les deux. Toujours dans le sens du REPORT, c'est-à-dire
    // du risque de forclusion — exactement ce que la règle 4 du § 0 interdit. La date tardive
    // n'est pas perdue : la lecture nommée `DEMI_JOURNEE` la porte, et l'écran la montre à côté
    // de la date sûre. `franc-pur.test.ts` (§ 0, « DÉFAUT 2 ») mesure les 40 au lieu de les
    // supposer. ⚠️ La question de FOND — compter ou non la matinée — reste à faire confirmer
    // par écrit à Me Vaval ; la voie retenue est celle qui ne peut pas forclore.
    journee: 'DEMI_JOURNEE_APRES_MIDI',
    // ⚠️ **LA NOTE AFFICHÉE PORTE SON ATTRIBUTION** (correctif du 20 août 2026, soir). La
    // première phrase CITE le décret ; la seconde est une DÉCISION de la rédaction, et le
    // décret ne dit rien du décompte de la demi-journée en matière de délais. Sans la
    // mention « Choix de la rédaction », les deux phrases se suivaient sous la même
    // référence « (art. 2, 1°) » et la plateforme faisait dire au texte, par juxtaposition,
    // ce qu'il ne dit pas. Toute note future qui prolonge une citation par une décision doit
    // marquer le passage de la même façon.
    //
    // ⚠️ **CETTE NOTE DISAIT L'INVERSE DE CE QUE LE MOTEUR FAIT, ET ELLE L'A DIT UNE DEMI-
    // JOURNÉE** (correctif du 20 août 2026, au vu du décret). Elle se terminait par « la
    // demi-journée est comptée comme un jour entier pour la prorogation » — la décision de la
    // rédaction, exacte tant que `entreeProroge` ignorait `journee`. Me Vaval a tranché
    // l'inverse le jour même, le drapeau `demiJournee` des règles de lecture porte la décision,
    // et la note continuait d'annoncer un report que la plateforme ne fait plus. Une note
    // affichée à côté d'une date est une affirmation : elle suit la règle ou elle ment.
    //
    // ⚠️ **LE TEXTE CI-DESSOUS EST LA GRAINE, PAS CE QUI EST SERVI.** Les entrées viennent de
    // la base (`service-base.ts` : « aucun repli sur le fichier de graine »), et la ligne
    // `lundi-gras` de la version 2 y porte encore l'ancienne rédaction. Une écriture est
    // nécessaire pour l'aligner — décision humaine, hors de ce correctif.
    noteJourneeFr:
      'Lundi Gras — le décret du 11 décembre 2024 le chôme « à partir de midi » (art. 2, 1°) : ' +
      'c’est la seule restriction d’horaire de la liste. La matinée reste ouvrable, et la date ' +
      'limite ne se reporte donc pas sur ce jour ; la lecture nommée « demi-journée » porte la ' +
      'date qu’on obtiendrait en le comptant pour un jour entier.',
    traductionRelue: false,
    mobile: true,
    offsetPaques: -48,
    source: sourceDecret2024(
      '1°) : « le Lundi Gras, à partir de midi »',
      AJOUT_DE_2024,
      'La version 1 le portait sur l’autorité de la rédaction, sans texte ; il en a un.',
    ),
    sourceDocId: DOC_DECRET_2024,
    appliqueDepuis: DEPUIS_2024,
  },
  {
    cle: 'mardi-gras',
    typeEntree: 'PERMANENT',
    libelleFr: 'Mardi Gras',
    libelleEn: 'Shrove Tuesday',
    libelleHt: 'Madi Gra',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: true,
    offsetPaques: -47,
    source: sourceDecret2024('2°) : « le Mardi Gras »', RECONDUIT_DE_1989),
    sourceDocId: DOC_DECRET_2024,
    appliqueDepuis: DEPUIS_1989,
  },
  {
    cle: 'vendredi-saint',
    typeEntree: 'PERMANENT',
    libelleFr: 'Vendredi Saint',
    libelleEn: 'Good Friday',
    libelleHt: 'Vandredi Sen',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: true,
    offsetPaques: -2,
    source: sourceDecret2024('3°) : « le Vendredi Saint »', RECONDUIT_DE_1989),
    sourceDocId: DOC_DECRET_2024,
    appliqueDepuis: DEPUIS_1989,
  },
  {
    cle: 'fete-dieu',
    typeEntree: 'PERMANENT',
    libelleFr: 'Fête Dieu',
    libelleEn: 'Corpus Christi',
    libelleHt: 'Fèt Dye',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: true,
    offsetPaques: 60,
    source: sourceDecret2024('4°) : « la Fête Dieu »', RECONDUIT_DE_1989),
    sourceDocId: DOC_DECRET_2024,
    appliqueDepuis: DEPUIS_1989,
  },
  {
    cle: '14-aout',
    typeEntree: 'PERMANENT',
    libelleFr: 'Jour du Bois-Caïman et de l’Union pour la Liberté',
    libelleEn: 'Bois-Caïman Day and Union for Freedom',
    libelleHt: 'Jou Bwa Kayiman ak Inyon pou Libète',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 8,
    jour: 14,
    source: sourceDecret2024(
      '5°) : « le 14 Août, Jour du Bois-Caïman et de l’Union pour la Liberté »',
      AJOUT_DE_2024,
      'La version 1 le portait sur l’autorité de la rédaction, sans texte ; il en a un.',
    ),
    sourceDocId: DOC_DECRET_2024,
    appliqueDepuis: DEPUIS_2024,
  },
  {
    cle: 'assomption',
    typeEntree: 'PERMANENT',
    libelleFr: 'Fête de l’Assomption',
    libelleEn: 'Feast of the Assumption',
    libelleHt: 'Fèt Asonpsyon',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 8,
    jour: 15,
    source: sourceDecret2024(
      '6°) : « le 15 Août, Fête de l’Assomption »',
      RECONDUIT_DE_1989,
      // ⚠️ « ne la DATAIT pas », et non « ne la nommait pas » : le décret de 1989 la NOMME.
      // `textes.ts` porte les deux preuves — `ctrav-110` (« L’Assomption », art. 110 du Code
      // du travail, que la plateforme sert) et `decret-1989-art-1` (« L' Assomption » au
      // fac-similé du Moniteur n° 47-A). Ce champ est AFFICHÉ (`DelaiResult.tsx`, `{m.source}`,
      // sous la pastille « Source vérifiée ») : une lectrice qui recoupe avec l'art. 110 y
      // trouverait l'Assomption et conclurait que le calculateur se trompe sur 1989.
      '⚠️ Le décret de 2024 DATE l’Assomption (« le 15 Août ») là où celui de 1989 ne la ' +
        'datait pas — il la nommait sans jour (« L’Assomption », art. 1er, reproduit à ' +
        'l’art. 110 du Code du travail) ; la date retenue est la même.',
    ),
    sourceDocId: DOC_DECRET_2024,
    appliqueDepuis: DEPUIS_1989,
  },
  {
    cle: '20-septembre',
    typeEntree: 'PERMANENT',
    libelleFr: 'Jour de Dessalines',
    libelleEn: 'Dessalines Day',
    libelleHt: 'Jou Desalin',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 9,
    jour: 20,
    source: sourceDecret2024(
      '7°) : « le 20 Septembre, Jour de DESSALINES »',
      AJOUT_DE_2024,
      'La version 1 le portait sur l’autorité de la rédaction : le corpus ne portait que ' +
        'l’« Arrêté déclarant la journée du 20 septembre “Jour de Dessalines” » (LM2020-151), ' +
        'une dénomination qui ne disait ni « fériée » ni « chômée ». Le décret de 2024, lui, ' +
        'le range parmi les Fêtes Légales.',
    ),
    sourceDocId: DOC_DECRET_2024,
    appliqueDepuis: DEPUIS_2024,
  },
  {
    cle: '17-octobre',
    typeEntree: 'PERMANENT',
    libelleFr: 'Commémoration de la Mort de Dessalines',
    libelleEn: 'Commemoration of the Death of Dessalines',
    libelleHt: 'Komemorasyon Lanmò Desalin',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 10,
    jour: 17,
    source: sourceDecret2024(
      '8°) : « le 17 Octobre, Commémoration de la Mort de DESSALINES »',
      RECONDUIT_DE_1989,
    ),
    sourceDocId: DOC_DECRET_2024,
    appliqueDepuis: DEPUIS_1989,
  },
  {
    cle: '1er-novembre',
    typeEntree: 'PERMANENT',
    libelleFr: 'La Toussaint',
    libelleEn: 'All Saints’ Day',
    libelleHt: 'Latousen',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 11,
    jour: 1,
    source: sourceDecret2024(
      '9°) : « le 1er Novembre, la Toussaint »',
      AJOUT_DE_2024,
      'La version 1 le portait sur l’autorité de la rédaction, alors que le corpus comptait ' +
        '15 arrêtés de chômage visant le 1er novembre de 1982 à 2019 (LM1982-75 … LM2019-185) ' +
        '— un chômage ponctuel par arrêté, jamais une fête permanente. Il en est une depuis ' +
        'le 11 décembre 2024.',
    ),
    sourceDocId: DOC_DECRET_2024,
    appliqueDepuis: DEPUIS_2024,
  },
  {
    cle: '2-novembre',
    typeEntree: 'PERMANENT',
    libelleFr: 'Fête des Morts',
    libelleEn: 'All Souls’ Day',
    libelleHt: 'Fèt Mò',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    // § 4.10 — ⚠️ **CHANGEMENT DE LA VERSION 1 À LA VERSION 2.** La version 1 le portait
    // `DEMI_JOURNEE_APRES_MIDI`, sur les décrets de 1982 et 1985 qui le chômaient « à partir
    // de midi ». Le décret du 11 décembre 2024 ne reprend pas cette mention : il l'énumère
    // sans restriction d'horaire, à côté du Lundi Gras qui, lui, la porte expressément. La
    // journée est donc ENTIÈRE.
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 11,
    jour: 2,
    source: sourceDecret2024(
      '10°) : « le 2 Novembre, Fête des Morts »',
      RECONDUIT_DE_1989,
      '⚠️ Le décret de 2024 ne reprend PAS la mention « à partir de midi » que les décrets ' +
        'de 1982 et 1985 portaient pour ce jour, et que la version 1 du calendrier avait ' +
        'retenue : la seule demi-journée de la liste de 2024 est le Lundi Gras. Le 2 novembre ' +
        'est chômé en journée entière.',
    ),
    sourceDocId: DOC_DECRET_2024,
    appliqueDepuis: DEPUIS_1989,
  },
  {
    cle: '25-decembre',
    typeEntree: 'PERMANENT',
    libelleFr: 'Jour de Noël',
    libelleEn: 'Christmas Day',
    libelleHt: 'Jou Nwèl',
    categorie: 'FETE_LEGALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 12,
    jour: 25,
    source: sourceDecret2024('11°) : « le 25 Décembre, Jour de Noël »', RECONDUIT_DE_1989),
    sourceDocId: DOC_DECRET_2024,
    appliqueDepuis: DEPUIS_1989,
  },

  // ---- 5 FETE_NATIONALE / TEXTE — Constitution de 1987, art. 275.1 ----
  //
  // Elles ne changent pas : le décret du 11 décembre 2024 détermine les fêtes LÉGALES, et
  // son article 3 confirme que les fêtes NATIONALES sont chômées au même titre — « à
  // l'occasion des Fêtes Nationales et Légales ». Leur fondement reste l'art. 275.1 de la
  // Constitution.
  //
  // ⚠️ **ELLES PROROGENT LA TÊTE D'AFFICHE DEPUIS LE 20 AOÛT 2026 (SOIR).** L'art. 991 al. 3
  // C. pr. civ. ne vise, à la lettre, que « un dimanche ou un jour de fête légale » : c'est ce
  // que la réserve R1 nommait. Me Vaval a répondu que ces cinq jours prorogent — le chômage est
  // observé « à l'occasion des Fêtes Nationales et des Fêtes Légales » (Const., art. 275) —, la
  // réserve a été retirée et la règle est portée par la version 2 des règles de lecture.
  {
    cle: '1er-janvier',
    typeEntree: 'PERMANENT',
    libelleFr: 'La Fête de l’Indépendance Nationale',
    libelleEn: 'National Independence Day',
    libelleHt: 'Fèt Endepandans Nasyonal',
    categorie: 'FETE_NATIONALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 1,
    jour: 1,
    source: SOURCE_CONSTITUTION,
    sourceDocId: DOC_CONSTITUTION,
    appliqueDepuis: DEPUIS_1989,
  },
  {
    cle: '2-janvier',
    typeEntree: 'PERMANENT',
    libelleFr: 'Le Jour des Aïeux',
    libelleEn: 'Ancestors’ Day',
    libelleHt: 'Jou Zansèt yo',
    categorie: 'FETE_NATIONALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 1,
    jour: 2,
    source: SOURCE_CONSTITUTION,
    sourceDocId: DOC_CONSTITUTION,
    appliqueDepuis: DEPUIS_1989,
  },
  {
    cle: '1er-mai',
    typeEntree: 'PERMANENT',
    libelleFr: 'La Fête de l’Agriculture et du Travail',
    libelleEn: 'Agriculture and Labour Day',
    libelleHt: 'Fèt Agrikilti ak Travay',
    categorie: 'FETE_NATIONALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 5,
    jour: 1,
    source: SOURCE_CONSTITUTION,
    sourceDocId: DOC_CONSTITUTION,
    appliqueDepuis: DEPUIS_1989,
  },
  {
    cle: '18-mai',
    typeEntree: 'PERMANENT',
    libelleFr: 'La Fête du Drapeau et de l’Université',
    libelleEn: 'Flag and University Day',
    libelleHt: 'Fèt Drapo ak Inivèsite',
    categorie: 'FETE_NATIONALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 5,
    jour: 18,
    source: SOURCE_CONSTITUTION,
    sourceDocId: DOC_CONSTITUTION,
    appliqueDepuis: DEPUIS_1989,
  },
  {
    cle: '18-novembre',
    typeEntree: 'PERMANENT',
    libelleFr:
      'La Commémoration de la Bataille de Vertières, Jour des forces armées d’Haïti',
    libelleEn: 'Commemoration of the Battle of Vertières, Armed Forces Day',
    libelleHt: 'Komemorasyon Batay Vètyè, Jou Fòs Ame d’Ayiti',
    categorie: 'FETE_NATIONALE',
    autorite: 'TEXTE',
    journee: 'JOURNEE_ENTIERE',
    traductionRelue: false,
    mobile: false,
    mois: 11,
    jour: 18,
    source: SOURCE_CONSTITUTION,
    sourceDocId: DOC_CONSTITUTION,
    appliqueDepuis: DEPUIS_1989,
  },

  // ---- 5 A_SURVEILLER — § 5.4 bis. RECONDUITES TELLES QUELLES depuis la version 1. ----
  //
  // Le décret du 11 décembre 2024 ne dit rien de ces cinq jours : ils restent ce qu'ils
  // étaient, un chômage ponctuel par arrêté, année par année. Les arguments ci-dessous sont
  // ceux de la version 1, au caractère près — `feries.test.ts` le contrôle ligne à ligne
  // plutôt que de partager les objets entre les deux versions, ce qui rendrait une édition
  // de la v2 capable de réécrire la v1.
  aSurveiller(
    {
      cle: 'mercredi-des-cendres',
      libelleFr: 'Mercredi des Cendres',
      libelleEn: 'Ash Wednesday',
      libelleHt: 'Mèkredi Sann',
      mobile: true,
      offsetPaques: -46,
    },
    14,
    OBS_CENDRES,
    'carnaval',
  ),
  aSurveiller(
    {
      cle: 'ascension',
      libelleFr: 'Ascension',
      libelleEn: 'Ascension Day',
      libelleHt: 'Asansyon',
      mobile: true,
      offsetPaques: 39,
    },
    5,
    OBS_ASCENSION,
    'ascension',
  ),
  aSurveiller(
    {
      cle: 'jeudi-saint',
      libelleFr: 'Jeudi Saint',
      libelleEn: 'Maundy Thursday',
      libelleHt: 'Jedi Sen',
      mobile: true,
      offsetPaques: -3,
    },
    5,
    OBS_JEUDI_SAINT,
    'semaine sainte',
  ),
  aSurveiller(
    {
      cle: '24-octobre',
      libelleFr: '24 octobre — Jour des Nations Unies',
      libelleEn: '24 October — United Nations Day',
      libelleHt: '24 oktòb — Jou Nasyonzini',
      mois: 10,
      jour: 24,
    },
    16,
    OBS_24_OCTOBRE,
    'nations unies',
  ),
  aSurveiller(
    {
      cle: '7-fevrier',
      libelleFr: '7 février',
      libelleEn: '7 February',
      libelleHt: '7 fevriye',
      mois: 2,
      jour: 7,
    },
    5,
    OBS_7_FEVRIER,
    '7 février',
  ),
]

/** Les versions connues du calendrier. Un permalien en désigne une ; il n'y a pas de repli. */
export const CALENDRIERS: Readonly<Record<number, readonly EntreeCalendrier[]>> = {
  1: CALENDRIER_V1,
  2: CALENDRIER_V2,
}

export const VERSION_CALENDRIER_COURANTE = 2

/**
 * Le calendrier de la version COURANTE. La graine et les contrôles le lisent d'ici plutôt
 * que de nommer `CALENDRIER_V1` à côté de `VERSION_CALENDRIER_COURANTE` : le jour où la
 * version change, les deux ne peuvent pas se désaccorder.
 */
export const CALENDRIER_COURANT: readonly EntreeCalendrier[] =
  CALENDRIERS[VERSION_CALENDRIER_COURANTE]

/**
 * Calendrier d'une version. **404 franc** si la version n'existe pas : un repli silencieux
 * sur la version courante afficherait une date sous une règle que l'utilisatrice n'a pas
 * choisie (§ 7.3).
 */
export function calendrier(version: number): readonly EntreeCalendrier[] {
  const c = CALENDRIERS[version]
  if (!c) throw new Error(`Version de calendrier inconnue : ${version}`)
  return c
}

/** Date d'une entrée pour une année donnée. */
export function dateEntree(e: EntreeCalendrier, annee: number): CivilDate {
  if (e.mobile) {
    if (e.offsetPaques == null) throw new Error(`Entrée mobile sans offsetPaques : ${e.cle}`)
    return jourMobile(cleMobileDepuisOffset(e.offsetPaques), annee)
  }
  if (e.mois == null || e.jour == null) throw new Error(`Entrée fixe incomplète : ${e.cle}`)
  return { y: annee, m: e.mois, d: e.jour }
}

const OFFSET_VERS_CLE: Record<number, CleMobile> = {
  [-48]: 'lundi-gras',
  [-47]: 'mardi-gras',
  [-46]: 'mercredi-des-cendres',
  [-3]: 'jeudi-saint',
  [-2]: 'vendredi-saint',
  39: 'ascension',
  60: 'fete-dieu',
}

function cleMobileDepuisOffset(offset: number): CleMobile {
  const cle = OFFSET_VERS_CLE[offset]
  if (!cle) throw new Error(`Décalage de Pâques inconnu : ${offset}`)
  return cle
}

/** Les entrées du calendrier qui tombent SUR cette date-là. Zéro, une, ou plusieurs. */
export function entreesDuJour(
  date: CivilDate,
  entrees: readonly EntreeCalendrier[],
): EntreeCalendrier[] {
  const trouvees: EntreeCalendrier[] = []
  for (const e of entrees) {
    const debut = parseIso(e.appliqueDepuis)
    if (debut && date.y * 10000 + date.m * 100 + date.d < debut.y * 10000 + debut.m * 100 + debut.d) {
      continue
    }
    if (egales(dateEntree(e, date.y), date)) trouvees.push(e)
  }
  return trouvees
}

/**
 * CORRECTIF défaut 3 — repli sur le français. Tant que `traductionRelue` est `false`, ou que
 * la variante demandée est absente, on rend le FRANÇAIS. Une traduction que personne n'a
 * relue ne doit pas passer pour relue sur un écran de délai de recours.
 */
export function texteLocalise(
  valeurs: { fr: string | null | undefined; en?: string | null; ht?: string | null },
  locale: Locale,
  traductionRelue: boolean,
): string {
  const fr = valeurs.fr ?? ''
  if (!traductionRelue || locale === 'fr') return fr
  const candidate = locale === 'en' ? valeurs.en : valeurs.ht
  return candidate && candidate.trim() ? candidate : fr
}

/**
 * § 8.2 — LE MÊME REPLI POUR LES ENTRÉES DU RÉPERTOIRE. Le back-office collecte `objetEn/Ht`,
 * `pointDepartEn/Ht`, `motifRefusEn/Ht`, `sanctionEn/Ht` et la case `traductionRelue` ; la
 * lecture publique les transportait fidèlement jusqu'à l'écran — où AUCUNE surface ne les
 * lisait. Un éditeur qui traduisait les 393 entrées ne voyait son travail nulle part.
 */
export function champEntree(
  entree: { traductionRelue?: boolean | null },
  fr: string | null | undefined,
  en: string | null | undefined,
  ht: string | null | undefined,
  locale: Locale,
): string {
  return texteLocalise({ fr, en, ht }, locale, entree.traductionRelue ?? false)
}

/** Libellé d'une entrée dans la langue demandée, avec repli. */
export function libelle(e: EntreeCalendrier, locale: Locale): string {
  return texteLocalise({ fr: e.libelleFr, en: e.libelleEn, ht: e.libelleHt }, locale, e.traductionRelue)
}

/** Texte d'observation d'une entrée A_SURVEILLER (A6), avec repli. */
export function observationsTexte(e: EntreeCalendrier, locale: Locale): string {
  return texteLocalise(
    { fr: e.observationsTexteFr, en: e.observationsTexteEn, ht: e.observationsTexteHt },
    locale,
    e.traductionRelue,
  )
}

/** Borne de l'Index (A6), avec repli. Jamais vide sur une entrée A_SURVEILLER. */
export function observationsBorne(e: EntreeCalendrier, locale: Locale): string {
  return texteLocalise(
    { fr: e.observationsBorneFr, en: e.observationsBorneEn, ht: e.observationsBorneHt },
    locale,
    e.traductionRelue,
  )
}

/** Note de demi-journée (§ 4.10), avec repli. */
export function noteJournee(e: EntreeCalendrier, locale: Locale): string {
  return texteLocalise(
    { fr: e.noteJourneeFr, en: e.noteJourneeEn, ht: e.noteJourneeHt },
    locale,
    e.traductionRelue,
  )
}
