/**
 * § 6.3 j / § 8.2 — LES INTITULÉS DU PRESSE-PAPIERS ET DU BLOC « TEXTES APPLIQUÉS ».
 *
 * Ils vivent à part de `phrases.ts` parce qu'ils ne sont pas produits par le moteur : ce sont
 * les titres de sections du texte que « Copier le raisonnement » met dans le presse-papiers,
 * et les deux lignes de source du bloc « Textes appliqués ». Le § 6.3 j les veut opposables
 * tels quels — c'est la citation que l'avocate collera dans une écriture —, donc dans la
 * langue qu'elle lit.
 *
 * ⚠️ Aucune E/S, aucun `Date` : ce fichier se teste sans base, comme `affichage.ts`.
 */
import type { Locale } from './format'

type Table = {
  // Le bloc « Textes appliqués »
  sourceCitation: string
  sourceRepertoire: string
  /** § 4.12 — le genre « Autre » n'a ni code, ni article, ni ligne au répertoire. */
  autreReference: string
  autreTexte: (nature: string, duree: string) => string
  autreSource: string
  autreEnTete: (nature: string) => string

  // Les titres du presse-papiers, en majuscules comme le gabarit du § 6.3 j
  dureeLabel: string
  motifLabel: string
  regimeLabel: string
  titreRefus: string
  titreIncomplet: string
  titreDate: string
  titreEtapes: string
  titreJoursEcartes: string
  aucunJourEcarte: string
  sansSourceTextuelle: string
  titrePraticable: string
  titreLectures: string
  aucuneLecture: string
  lectureLaPlusLarge: string
  titreTextes: string
  titreAvertissements: string
  /**
   * § 4.6 — le pied technique du texte COLLÉ. Il nomme les TROIS coordonnées du calcul :
   * calendrier, fenêtres, et **règles de lecture** — celles-ci depuis le 20 août 2026, jour où
   * elles ont changé pour la seconde fois. Une date collée dans une écriture doit dire sous
   * quelle règle elle a été rendue.
   */
  pied: (calendrier: number, fenetres: number, regles: number | null) => string
  piedEntree: (code: string, article: string, revision: number) => string

  // § 7.3 — les deux bandeaux, EN TÊTE du texte copié
  bandeauRetiree: (date: string | null, motif: string | null) => string
  bandeauRegleChangee: (de: number, vers: number, date: string | null) => string
}

const FR: Table = {
  sourceCitation: 'Texte de l’article, tel que lu au corpus.',
  sourceRepertoire:
    'Durée telle qu’écrite au répertoire ; le texte intégral de l’article se lit au corpus.',
  autreReference: 'Délai saisi par l’utilisatrice — hors répertoire',
  autreTexte: (nature, duree) => `Nature indiquée : « ${nature} ». Durée saisie : ${duree}.`,
  autreSource:
    'Ce délai ne vient d’aucune entrée du répertoire : la plateforme ne le qualifie pas et ne ' +
    'lui attache aucun article.',
  autreEnTete: (nature) => `Délai saisi (hors répertoire) — nature indiquée : « ${nature} »`,

  dureeLabel: 'Durée telle qu’écrite',
  motifLabel: 'Motif',
  regimeLabel: 'Régime',
  titreRefus: 'CET ARTICLE NE PERMET PAS DE CALCULER UNE DATE.',
  titreIncomplet: 'CALCUL IMPOSSIBLE EN L’ÉTAT — il manque une réponse.',
  titreDate: 'DATE LIMITE',
  titreEtapes: 'LE RAISONNEMENT, PAS À PAS',
  titreJoursEcartes: 'JOURS ÉCARTÉS',
  aucunJourEcarte: 'Aucun jour écarté.',
  sansSourceTextuelle: '— sans source textuelle',
  titrePraticable: 'DERNIER JOUR OÙ L’ACTE PEUT MATÉRIELLEMENT ÊTRE FAIT',
  titreLectures: 'LECTURES CONCURRENTES DU TEXTE',
  aucuneLecture: 'Aucune lecture concurrente ne donne une date différente.',
  lectureLaPlusLarge: 'Lecture la plus large (toutes les réserves cumulées)',
  titreTextes: 'TEXTES APPLIQUÉS',
  titreAvertissements: 'AVERTISSEMENTS',
  pied: (c, w, rl) =>
    `Calendrier des fêtes : version ${c} · Fenêtres de signification : version ${w}` +
    (rl == null ? '' : ` · Règles de lecture : version ${rl}`),
  piedEntree: (code, article, r) => `Entrée : ${code} art. ${article}, révision ${r}`,

  bandeauRetiree: (date, motif) =>
    `⚠ CETTE ENTRÉE A ÉTÉ RETIRÉE DU RÉPERTOIRE${date ? ` LE ${date}` : ''}.` +
    (motif ? ` MOTIF : ${motif}` : '') +
    ' CE CALCUL EST CONSERVÉ TEL QU’IL A ÉTÉ RENDU ; LA PLATEFORME NE PROPOSE PLUS CETTE ENTRÉE.',
  bandeauRegleChangee: (de, vers, date) =>
    `⚠ LA RÈGLE A CHANGÉ DEPUIS CE CALCUL : révision ${de} → révision courante ${vers}` +
    (date ? `, le ${date}` : '') +
    '. CE RÉSULTAT EST CELUI DE LA RÈGLE EN VIGUEUR AU MOMENT DU CALCUL.',
}

const EN: Table = {
  sourceCitation: 'Text of the article, as read in the corpus.',
  sourceRepertoire:
    'Duration as written in the directory; the full text of the article is in the corpus.',
  autreReference: 'Period entered by the user — outside the directory',
  autreTexte: (nature, duree) => `Nature given: « ${nature} ». Duration entered: ${duree}.`,
  autreSource:
    'This period comes from no directory entry: the platform does not qualify it and attaches ' +
    'no article to it.',
  autreEnTete: (nature) => `Period entered (outside the directory) — nature given: « ${nature} »`,

  dureeLabel: 'Duration as written',
  motifLabel: 'Reason',
  regimeLabel: 'Regime',
  titreRefus: 'THIS ARTICLE DOES NOT ALLOW A DATE TO BE COMPUTED.',
  titreIncomplet: 'COMPUTATION NOT POSSIBLE AS IT STANDS — an answer is missing.',
  titreDate: 'DEADLINE',
  titreEtapes: 'THE REASONING, STEP BY STEP',
  titreJoursEcartes: 'DAYS SET ASIDE',
  aucunJourEcarte: 'No day set aside.',
  sansSourceTextuelle: '— no textual source',
  titrePraticable: 'LAST DAY ON WHICH THE ACT CAN PHYSICALLY BE DONE',
  titreLectures: 'COMPETING READINGS OF THE TEXT',
  aucuneLecture: 'No competing reading gives a different date.',
  lectureLaPlusLarge: 'Broadest reading (all caveats combined)',
  titreTextes: 'TEXTS APPLIED',
  titreAvertissements: 'WARNINGS',
  pied: (c, w, rl) =>
    `Holiday calendar: version ${c} · Service windows: version ${w}` +
    (rl == null ? '' : ` · Reading rules: version ${rl}`),
  piedEntree: (code, article, r) => `Entry: ${code} art. ${article}, revision ${r}`,

  bandeauRetiree: (date, motif) =>
    `⚠ THIS ENTRY WAS WITHDRAWN FROM THE DIRECTORY${date ? ` ON ${date}` : ''}.` +
    (motif ? ` REASON: ${motif}` : '') +
    ' THIS COMPUTATION IS KEPT AS IT WAS RENDERED; THE PLATFORM NO LONGER OFFERS THIS ENTRY.',
  bandeauRegleChangee: (de, vers, date) =>
    `⚠ THE RULE HAS CHANGED SINCE THIS COMPUTATION: revision ${de} → current revision ${vers}` +
    (date ? `, on ${date}` : '') +
    '. THIS RESULT IS THE ONE UNDER THE RULE IN FORCE AT THE TIME OF THE COMPUTATION.',
}

const HT: Table = {
  sourceCitation: 'Tèks atik la, jan yo li l nan koutim nan.',
  sourceRepertoire:
    'Dire a jan li ekri nan repètwa a ; tèks konplè atik la nan koutim nan.',
  autreReference: 'Delè itilizatè a antre — deyò repètwa a',
  autreTexte: (nature, duree) => `Kalite yo bay : « ${nature} ». Dire yo antre : ${duree}.`,
  autreSource:
    'Delè sa a pa soti nan okenn antre nan repètwa a : platfòm nan pa kalifye l e li pa mete ' +
    'okenn atik dèyè l.',
  autreEnTete: (nature) => `Delè yo antre (deyò repètwa a) — kalite yo bay : « ${nature} »`,

  dureeLabel: 'Dire jan li ekri',
  motifLabel: 'Motif',
  regimeLabel: 'Rejim',
  titreRefus: 'ATIK SA A PA PÈMÈT KALKILE YON DAT.',
  titreIncomplet: 'KALKIL LA PA POSIB KONSA — GEN YON REPONS KI MANKE.',
  titreDate: 'DAT LIMIT',
  titreEtapes: 'RÈZÒNMAN AN, ETAP PA ETAP',
  titreJoursEcartes: 'JOU YO METE SOU KOTE',
  aucunJourEcarte: 'Pa gen jou ki mete sou kote.',
  sansSourceTextuelle: '— san sous tèks',
  titrePraticable: 'DÈNYE JOU KOTE ZAK LA KA FÈT TOUTBON',
  titreLectures: 'LEKTI KONKIRAN TÈKS LA',
  aucuneLecture: 'Pa gen lekti konkiran ki bay yon lòt dat.',
  lectureLaPlusLarge: 'Lekti ki pi laj la (tout rezèv yo ansanm)',
  titreTextes: 'TÈKS YO APLIKE',
  titreAvertissements: 'AVÈTISMAN',
  pied: (c, w, rl) =>
    `Kalandriye fèt yo : vèsyon ${c} · Fennèt siyifikasyon : vèsyon ${w}` +
    (rl == null ? '' : ` · Règ lekti yo : vèsyon ${rl}`),
  piedEntree: (code, article, r) => `Antre : ${code} atik ${article}, revizyon ${r}`,

  bandeauRetiree: (date, motif) =>
    `⚠ YO TE RETIRE ANTRE SA A NAN REPÈTWA A${date ? ` ${date}` : ''}.` +
    (motif ? ` MOTIF : ${motif}` : '') +
    ' KALKIL SA A KONSÈVE JAN YO TE BAY LI ; PLATFÒM NAN PA PWOPOZE ANTRE SA A ANKÒ.',
  bandeauRegleChangee: (de, vers, date) =>
    `⚠ RÈG LA CHANJE DEPI KALKIL SA A : revizyon ${de} → revizyon kounye a ${vers}` +
    (date ? `, ${date}` : '') +
    '. REZILTA SA A SE SA RÈG KI TE ANVIGÈ LÈ KALKIL LA TE FÈT.',
}

const TABLES: Record<Locale, Table> = { fr: FR, en: EN, ht: HT }

export function phrasesAffichage(locale: Locale = 'fr'): Table {
  return TABLES[locale] ?? FR
}
