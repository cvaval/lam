/**
 * § 8.2 — LES PHRASES DU MOTEUR, DANS LES TROIS LANGUES.
 *
 * Pourquoi ce fichier existe. Le moteur du § 4 ne produisait qu'un champ français : sur
 * `/en/delais` et `/ht/delais`, seules les DATES étaient traduites, et l'écran rendait des
 * phrases hybrides — « Agir au plus tard le Monday 6 July 2026 est sûr sous toutes les
 * lectures du texte. » Le § 8.2 ferme la liste de ce qui n'est jamais traduit — `dureeTexte`,
 * les citations d'articles, les extraits d'arrêts — et le RAISONNEMENT n'en fait pas partie.
 *
 * Trois règles de rédaction, et elles ne sont pas négociables :
 *
 *  1. **Les citations d'articles restent en français**, mot pour mot, dans les trois langues.
 *     Traduire « non plus que les dimanches et les jours de fêtes légales » ferait de la
 *     plateforme la source d'une version du texte qui n'a jamais été publiée. La phrase qui
 *     ENTOURE la citation, elle, est traduite : c'est le raisonnement, il est de la
 *     plateforme.
 *  2. **Les références restent en français** (« C. pr. civ., art. 991 al. 3 ») : c'est la
 *     forme sous laquelle un juge haïtien les lit, et la même dans une écriture anglaise.
 *  3. **Aucun `Date`, aucun `Intl`, aucune E/S.** Ce fichier se teste sans base et sans
 *     navigateur, comme le reste du noyau (§ 4.1).
 *
 * ⚠️ Le créole n'a **pas encore été relu par la rédaction**, exactement comme les douze mois
 * et les sept jours de `format.ts` (§ 8.2). À faire relire avant de le figer.
 */
import type { Locale } from './format'

/** Une table de phrases : la même forme dans les trois langues, contrôlée par le type. */
type Table = {
  // ── Refus (§ 4.4) ───────────────────────────────────────────────────────────
  dateInvalide: string
  genreNonCalculable: string
  regimeAVerifier: string
  dureeAbsente: string
  dureeInvalide: (valeur: string) => string
  optionInconnue: (cle: string) => string
  borneHistorique: string
  /**
   * § 0, règle 1 — la borne anti-boucle de la cascade a joué : le report a été répété
   * `CASCADE_MAX` fois sans atteindre un jour qui ne proroge pas. Le moteur REFUSE ; il ne
   * rend pas le onzième jour sans l'avoir vérifié.
   */
  refusCascadeBornee: (repetitions: number) => string
  /** § 4.6 — une version de règles de lecture qui n'est pas au registre. Le moteur ne devine pas. */
  refusReglesInconnues: (version: string) => string

  // ── Ce qui manque (§ 6.2 point 7) ───────────────────────────────────────────
  manqueKmDeux: string
  manqueKmUn: string
  manqueKmEntier: string
  manqueReponse: (question: string) => string

  // ── Régime affiché (§ 4.7) ──────────────────────────────────────────────────
  regimeFranc: string
  regimeOrdinaire: string
  regimeAVerifierLibelle: string
  regimeIncertainLibelle: string

  // ── Phrase de sécurité (§ 6.3 b) ────────────────────────────────────────────
  phraseSecurite: (date: string) => string
  /**
   * LA MÊME PHRASE, POUR UN CALCUL FRANC PUR (surface publique — voir `franc-pur.ts`).
   *
   * ⚠️ La phrase ordinaire renvoie à « l'une des lectures ci-dessous ». Sur la surface
   * publique il n'y en a plus AUCUNE, par construction : le renvoi pointerait dans le vide
   * sur 100 % des résultats. On ne touche pas `phraseSecurite`, que le portail emploie et où
   * le renvoi est juste ; on en écrit une seconde, qui dit ce que ce calcul-ci a fait et ce
   * qu'il n'a pas fait.
   */
  phraseSecuriteFrancPur: (date: string) => string

  // ── Les étapes (§ 6.3 c) ────────────────────────────────────────────────────
  etapeDepart: (pointDepart: string, date: string) => string
  etapeJourDepart: (fondement: string) => string
  fondementDroitCommunCivil: string
  etapeDuree: (a: {
    jours: number
    franc: boolean
    dureeTexte: string
    reference: string
    dureeFondement: string | null
    regimeFondement: string
  }) => string
  etapeSupplement: (jours: number) => string
  etapeDistanceDetaillee: (jours: number, detail: string) => string
  detailDistance: (a: { km: number; quotient: number; reste: number; jours: number }) => string
  etapeDistanceSimple: (jours: number) => string
  etapeDistanceNonChiffree: string
  etapeDistanceAucune: string
  etapeDernierJourCompte: (date: string) => string
  etapeEcheanceFranche: (fondement: string, date: string) => string
  etapeEcheanceIncertaine: (date: string) => string
  etapeEcheanceOrdinaire: (date: string) => string
  etapeProrogation: (a: {
    jour: string
    motif: string
    source: string
    suivant: string
  }) => string
  motifDimancheArticle: string
  /**
   * ⚠️ **QUATRE MOTIFS, UN PAR GENRE — ET C'ÉTAIT UN SEUL GABARIT JUSQU'AU 20 AOÛT 2026.**
   * `motifFeteLegale` recevait les libellés JOINTS de toutes les entrées du jour, dimanche
   * compris : « un jour de fête légale (Dimanche et Fête des Morts) », « … (La Fête du Drapeau
   * et de l'Université) ». Chaque motif porte désormais son genre (`MotifProrogation.genre`) et
   * son gabarit ; `calcul.ts` les compose entrée par entrée avec `jointureMotifs`.
   */
  motifFeteLegale: (nom: string) => string
  motifFeteNationale: (nom: string) => string
  motifJourRedaction: (nom: string) => string
  /** « et » — la conjonction qui joint deux motifs sur un même jour. Elle était EN DUR en fr. */
  jointureMotifs: string

  // L'étape finale — elle INTERROGE la date, elle ne la suppose pas.
  finaleSamedi: (date: string) => string
  finaleSamediEnOutre: (noms: string) => string
  finaleSamediPorteSansProroger: string
  finaleRas: (date: string) => string
  finaleEmpechee: (a: { date: string; luiMeme: boolean; noms: string }) => string
  finaleCalendrier: (a: { date: string; source: string; noms: string }) => string
  /** § 4.13 — on ne renvoie aux lectures nommées QUE s'il y en a (défaut 24). */
  voirLecturesEtAvertissements: string
  voirAvertissements: string
  /** Règles de la version 1 : la lettre proroge « d'un jour », et un seul. */
  consequenceUnJour: (source: string, date: string) => string
  consequencePasAcquise: (fondement: string) => string
  consequenceLecture991: (libelle: string, date: string) => string

  // ── Le jour praticable (§ 4.8) ──────────────────────────────────────────────
  praticableInterditTravail: (date: string) => string
  praticableInterditCpc: (date: string) => string
  praticableConditionnel: (date: string, noms: string, article: string) => string
  articleCpc991al2: string
  articleCtrav512: string
  praticableDeuxDates: (certain: string, prudent: string) => string
  praticableUneDate: (date: string) => string
  praticableGreffe: string
  /**
   * § 4.10 — la fenêtre d'un jour chômé « à partir de midi ». `noms` est la liste des entrées
   * du calendrier qui le portent, déjà jointe et localisée.
   */
  praticableMidi: (date: string, noms: string) => string
  praticableMidiTravail: (date: string, noms: string) => string

  // ── Les avertissements (§ 4.9) ──────────────────────────────────────────────
  a1: string
  a2: (dateSansDistance: string) => string
  a4: (noms: string, pluriel: boolean) => string
  a5: (citation: string | null) => string
  a5bis: string
  a3: string
  a6Phrase1: (date: string, libelle: string) => string
  a6Phrase3: (a: { annee: number; date: string; source: string }) => string
  a6Cascade: (motifs: string) => string
  a6Phrase4: (borne: string) => string
  /** § 4.13, exigence 4 — le LIBELLÉ du lien de recherche ; l'URL est construite à l'écran. */
  a6Recherche: (requete: string) => string

  // ── Les lectures nommées (§ 4.6) ────────────────────────────────────────────
  /**
   * ⚠️ **R1, R1_T ET R3 ONT QUITTÉ CETTE TABLE LE 20 AOÛT 2026 (SOIR)** : Me Vaval a répondu
   * OUI aux deux questions qu'elles portaient (les fêtes nationales prorogent ; la
   * prorogation cascade), et la tête d'affiche les APPLIQUE. Une réserve qui rend la date
   * de la tête ne nomme rien. Motif complet en tête de `lectures.ts`.
   */
  lectures: Record<
    'REGIME_FRANC' | 'PROROGATION_991' | 'DEMI_JOURNEE' | 'CUMUL',
    { libelle: string; fondement: string }
  >

  // ── Motifs de prorogation du texte lui-même ─────────────────────────────────
  dimanche: string
}

// ---------------------------------------------------------------------------
// Les trois citations que les phrases enchâssent. **Jamais traduites** (§ 8.2).
// ---------------------------------------------------------------------------

const CIT_991_AL2 =
  '« non plus que les dimanches et les jours de fêtes légales, si ce n’est en vertu de ' +
  'permission du juge, dans le cas où il y aura péril en la demeure »'
const CIT_512 =
  '« Aucune signification ni exécution ne pourra être faite avant huit heures du matin et ' +
  'après cinq heures du soir, non plus les dimanches et les jours fériés chômés. »'
const CIT_512_NULLITE = 'Toute signification ou exécution faite au mépris du présent article est nulle.'
const CIT_991_AL3_CAS3 = '« lorsque, au dernier jour, le chômage est prescrit par arrêté »'
const CIT_229 =
  '« fera citer le défendeur à comparaître dans le délai de huitaine franche, outre le délai de distance »'
const CIT_275 = '« à l’occasion des Fêtes Nationales et des Fêtes Légales »'
const CIT_991_AL3 = '« un dimanche ou un jour de fête légale »'
const CIT_511 =
  '« Les délais légaux sont prorogés d’un jour si le dernier jour est un dimanche ou un jour ' +
  'férié légal ou prescrit par Arrêté Présidentiel. »'
const CIT_511_PROC = '« Tous les délais DE PROCÉDURE prévus au Code du Travail sont francs. »'

const FR: Table = {
  dateInvalide: 'Cette date n’existe pas. Vérifiez le jour et le mois.',
  genreNonCalculable:
    'Ce délai n’est pas calculable en jours par ce calculateur ; aucun motif n’a été rédigé pour cette entrée.',
  regimeAVerifier:
    'Régime à vérifier : la rédaction n’a pas qualifié ce délai (franc ou ordinaire). ' +
    'La plateforme ne tranche pas à sa place ; aucune date n’est affichée.',
  dureeAbsente:
    'Aucune durée n’est portée par cette entrée. Une ligne qui ne porte pas un nombre ne reçoit pas de jours.',
  dureeInvalide: (v) =>
    `La durée doit être un nombre entier de jours, positif ou nul ; celle-ci vaut « ${v} ». ` +
    'Aucune date n’est affichée : un délai ne se compte pas en fractions de jour, et un nombre ' +
    'négatif ferait expirer le délai avant son point de départ.',
  optionInconnue: (c) => `La réponse « ${c} » n’est pas une option de cette entrée.`,
  borneHistorique:
    'La liste des fêtes légales applicable avant le 22 juin 1989 n’est pas établie dans ce ' +
    'corpus (les décrets de 1982 et 1985 donnent d’autres listes). Ce calculateur ne sert pas ' +
    'les dossiers antérieurs à cette date.',
  refusCascadeBornee: (n) =>
    `Le report a été répété ${n} fois sans atteindre un jour qui ne proroge pas. La plateforme ` +
    'ne rend AUCUNE date : celle qu’elle calculerait tomberait elle-même un jour prorogé, et ' +
    'une date que le moteur sait fausse ne s’affiche pas. Vérifiez le calendrier employé.',
  refusReglesInconnues: (v) =>
    `Les règles de lecture « ${v} » ne figurent pas au registre de la plateforme. Aucune date ` +
    'n’est rendue : la calculer sous les règles du jour reviendrait à répondre autre chose que ' +
    'ce qui a été demandé.',

  manqueKmDeux:
    'les DEUX kilométrages que cet article fait mesurer (vous les saisissez ; la plateforme ne les calcule pas)',
  manqueKmUn: 'le kilométrage (vous le saisissez ; la plateforme ne le calcule pas)',
  manqueKmEntier: 'un kilométrage entier et positif',
  manqueReponse: (q) => `une réponse à : « ${q} »`,

  regimeFranc: 'Délai franc',
  regimeOrdinaire: 'Délai ordinaire',
  regimeAVerifierLibelle: 'Régime à vérifier — la rédaction n’a pas qualifié ce délai',
  regimeIncertainLibelle: 'Régime incertain — voir la lecture nommée',

  phraseSecurite: (d) =>
    `Agir au plus tard le ${d} est sûr sous toutes les lectures du texte. Agir plus tard ` +
    'suppose que le juge retienne l’une des lectures ci-dessous.',
  /**
   * ⚠️ 20 août 2026, SECONDE décision de Me Vaval : la surface publique PROROGE. La phrase
   * disait « ne lui applique aucun report » — elle est devenue fausse le jour même.
   *
   * ⚠️ **ELLE SOUS-DÉCRIVAIT ENCORE LE CALCUL** (correctif du soir). « proroge LE dernier
   * (singulier) s'il tombe un dimanche ou un jour de FÊTE LÉGALE (art. 991) » disait trois
   * choses fausses d'un calcul qui reporte EN CASCADE, sur seize entrées dont cinq fêtes
   * NATIONALES et quatre jours de la seule rédaction, et dont le fondement se lit à l'art. 991
   * al. 3 pour la procédure civile comme à l'art. 511 al. 2 du Code du travail. Le samedi n'est
   * pas nommé comme jour de report, parce qu'il n'en est pas un.
   *
   * ⚠️ **AUCUNE SURFACE PUBLIQUE NE LA REND** : elle voyage dans `resultat.phraseSecurite`
   * (API, presse-papiers, aperçus d'admin), et la page publique n'affiche que la date, ses
   * mentions et son report. Elle est tenue juste parce qu'un champ sérialisé est lu — pas
   * parce qu'un écran l'affiche.
   */
  phraseSecuriteFrancPur: (d) =>
    `Le délai franc que vous avez indiqué expire le ${d}. Ce calcul compte les jours, puis ` +
    'reporte l’échéance — de proche en proche, jusqu’au premier jour qui ne soit ni un ' +
    'dimanche, ni l’un des seize jours chômés du calendrier de la plateforme (art. 991 al. 3 ' +
    'C. pr. civ. ; art. 511 al. 2 C. trav. en matière de travail). Le samedi n’est pas un jour ' +
    'de report. Ce calcul ne qualifie pas votre délai.',

  etapeDepart: (p, d) => `Point de départ : ${p}, le ${d}.`,
  etapeJourDepart: (f) => `Le jour du départ ne se compte pas (${f}).`,
  fondementDroitCommunCivil:
    'règle de droit commun ; le Code civil ne comporte pas de règle générale de computation, ' +
    'et l’art. 987 C. pr. civ. ne vise que les délais du Code de procédure civile',
  etapeDuree: (a) => {
    const s = a.jours > 1 ? 's' : ''
    return (
      `Délai : ${a.jours} jour${s}${a.franc ? ` franc${s}` : ''} ` +
      `(« ${a.dureeTexte} »${a.reference ? `, ${a.reference}` : ''}). ` +
      (a.dureeFondement ? `${a.dureeFondement} ` : '') +
      `Régime : ${a.franc ? 'franc' : 'ordinaire'} — ${a.regimeFondement}`
    )
  },
  etapeSupplement: (n) =>
    `Augmentation de l’article 74 : ${n} jours. Les composantes s’additionnent, puis UN SEUL ` +
    'jour d’échéance s’ajoute (Cass. 1re Sect. n° 13, 28 mars 1966).',
  etapeDistanceDetaillee: (n, detail) =>
    `Délai de distance : ${n} jour${n > 1 ? 's' : ''} (${detail}) — C. pr. civ., art. 987.`,
  detailDistance: (a) =>
    `${a.km} km ÷ 40 = ${a.quotient} ; reste ${a.reste} km, ` +
    `${a.reste >= 30 ? 'égal ou supérieur à 30, compté' : 'inférieur à 30, non compté'} ` +
    `→ ${a.jours} jour${a.jours > 1 ? 's' : ''}`,
  etapeDistanceSimple: (n) => `Délai de distance : ${n} jour${n > 1 ? 's' : ''}.`,
  etapeDistanceNonChiffree:
    'Délai de distance : non calculé — l’article en prévoit un, mais aucun texte du corpus ne ' +
    'le chiffre (voir l’avertissement ci-dessous).',
  etapeDistanceAucune:
    'Délai de distance : aucun (aucun kilométrage saisi ; cet article n’en prévoit pas).',
  etapeDernierJourCompte: (d) => `Dernier jour compté : ${d}.`,
  etapeEcheanceFranche: (f, d) =>
    `Le jour de l’échéance ne se compte pas : un jour s’ajoute (${f}) → ${d}.`,
  etapeEcheanceIncertaine: (d) =>
    'Le régime franc n’est pas acquis pour ce délai : la tête d’affiche est calculée en régime ' +
    `ORDINAIRE, la plus précoce — le jour de l’échéance compte, et le dernier jour utile est le ` +
    `${d}. Le régime franc est nommé en lecture concurrente ci-dessous.`,
  etapeEcheanceOrdinaire: (d) =>
    `Le jour de l’échéance compte (délai ordinaire) : le dernier jour utile est le ${d}.`,
  etapeProrogation: (a) =>
    `Le ${a.jour} est ${a.motif} : le délai est prorogé d’un jour (${a.source}) → ${a.suivant}.`,
  motifDimancheArticle: 'un dimanche',
  motifFeteLegale: (n) => `un jour de fête légale (${n})`,
  // ⚠️ Const. 1987, art. 275.1 énumère les cinq fêtes NATIONALES ; l'art. 275.2 renvoie les
  // fêtes LÉGALES à la loi, et le décret du 23 mai 1989 s'intitule « déterminant, en dehors
  // des Fêtes Nationales, les Fêtes Légales ». Deux catégories, deux phrases.
  motifFeteNationale: (n) => `un jour de fête nationale (${n})`,
  motifJourRedaction: (n) =>
    `porté au calendrier comme fête légale (${n}) sans texte instituant — calendrier de la ` +
    'version 1, antérieur au décret du 11 décembre 2024',
  jointureMotifs: ' et ',

  finaleSamedi: (d) =>
    'Le samedi n’est pas un jour de prorogation : l’article 991 ne vise que le dimanche, la ' +
    `fête légale et le chômage prescrit par arrêté. La date reste le ${d}.`,
  finaleSamediEnOutre: (n) => ` Ce samedi est en outre ${n}`,
  finaleSamediPorteSansProroger:
    ' : ce jour est porté au calendrier de la plateforme sans proroger sous la lecture retenue',
  finaleRas: (d) => `Le ${d} n’est ni un dimanche ni une fête légale : aucune autre prorogation.`,
  finaleEmpechee: (a) => `Le ${a.date} est ${a.luiMeme ? 'lui-même ' : ''}${a.noms}`,
  finaleCalendrier: (a) =>
    `Le ${a.date} n’est pas un dimanche, et ${a.source} ne le proroge pas dans la lecture ` +
    `retenue ; le calendrier de la plateforme le porte néanmoins (${a.noms})`,
  voirLecturesEtAvertissements: ' — voir les lectures nommées et les avertissements ci-dessous.',
  voirAvertissements: ' — voir les avertissements ci-dessous.',
  consequenceUnJour: (s, d) =>
    ` ; ${s} ne proroge que d’UN jour : la tête d’affiche reste au ${d}.`,
  consequencePasAcquise: (f) =>
    `, mais la prorogation n’est pas acquise pour ce délai. ${f}`,
  consequenceLecture991: (l, d) => ` La lecture nommée « ${l} » donne le ${d}.`,

  praticableInterditTravail: (d) =>
    `Aucune signification ni exécution ne peut être faite le ${d} (C. trav., art. 512 : ` +
    `${CIT_512}). ${CIT_512_NULLITE}`,
  praticableInterditCpc: (d) =>
    `Aucune signification ni exécution ne peut être faite le ${d} ` +
    `(C. pr. civ., art. 991 al. 2 : ${CIT_991_AL2}).`,
  praticableConditionnel: (d, noms, article) =>
    `Le ${d} est porté au calendrier de la plateforme (${noms}) sans texte permanent qui ` +
    `l’institue : ${article} ne ferme pas expressément ce jour-là, mais un huissier peut ne pas ` +
    'instrumenter et un greffe peut être fermé.',
  articleCpc991al2: 'l’article 991 al. 2 C. pr. civ.',
  articleCtrav512: 'l’article 512 C. trav.',
  praticableDeuxDates: (certain, prudent) =>
    'Si votre acte doit être signifié ou exécuté : au plus tard le ' +
    `${certain} en ne retenant que ce que le texte interdit expressément (dimanche, fêtes ` +
    `légales et fêtes nationales) ; au plus tard le ${prudent} si l’on écarte aussi les jours ` +
    'que le calendrier de la plateforme porte sans texte permanent qui les institue.',
  praticableUneDate: (d) =>
    `Si votre acte doit être signifié ou exécuté : au plus tard le ${d}.`,
  praticableGreffe:
    'S’il s’agit d’un dépôt au greffe ou d’une déclaration, l’article 991 ne le régit pas : ' +
    'renseignez-vous sur l’ouverture du greffe.',
  // § 4.10 — la SEULE demi-journée du calendrier. La fenêtre s’y ferme à midi ; les heures
  // d’ouverture, elles, sont CELLES DE L’ARTICLE (991 al. 2 : « avant six heures du matin » ;
  // 512 : « avant huit heures du matin »), et non celles de la table réglable des fenêtres.
  praticableMidi: (d, noms) =>
    `Le ${d} est chômé à partir de midi (${noms}) : la matinée reste ouvrable, mais la fenêtre ` +
    's’y ferme à midi — de six heures du matin à midi (C. pr. civ., art. 991 al. 2). Un acte à ' +
    'signifier doit l’être avant midi.',
  praticableMidiTravail: (d, noms) =>
    `Le ${d} est chômé à partir de midi (${noms}) : la matinée reste ouvrable, mais la fenêtre ` +
    's’y ferme à midi — de huit heures du matin à midi (C. trav., art. 512). Un acte à signifier ' +
    `doit l’être avant midi. ${CIT_512_NULLITE}`,

  a1:
    'Un arrêté du Président de la République peut avoir prescrit le chômage de ce jour et ' +
    'proroger le délai d’un jour. La plateforme ne connaît pas ces arrêtés. La charge de la ' +
    'preuve pèse sur qui l’invoque (Cass. 1re Sect. n° 13, 28 mars 1966).',
  a2: (d) =>
    'Le kilométrage est celui que vous avez saisi. La plateforme ne le calcule pas et ne le ' +
    'propose pas. Aucun texte ne dit si la distance est routière ou à vol d’oiseau. Ce délai ' +
    'est prévu dans l’intérêt privé des parties : il peut se perdre par renonciation ' +
    `(Cass. 2e Sect. n° 3, 9 déc. 1965). Sans augmentation de distance, la date serait le ${d}.`,
  a4: (noms, pluriel) =>
    `${noms.charAt(0).toUpperCase()}${noms.slice(1)} ${pluriel ? 'sont portés' : 'est porté'} ` +
    'au calendrier de la VERSION 1 comme fête légale sans texte instituant ; ce calendrier est ' +
    'antérieur au décret du 11 décembre 2024, qui énumère onze fêtes légales et ' +
    `${pluriel ? 'les' : 'l’'}institue. Sous la version 1, c’est ` +
    `${pluriel ? 'de ces jours' : 'de ce jour'} que découle la date de la lecture la plus large ` +
    `ci-dessous, et c’est pourquoi ${pluriel ? 'ils sont écartés' : 'il est écarté'} de la tête ` +
    'd’affiche. Rejouez le calcul sous le calendrier courant pour la date d’aujourd’hui.',
  a5: (citation) =>
    'Cet article augmente le délai d’un jour par cinq lieues' +
    (citation ? ` (« ${citation} »)` : '') +
    '. Aucun texte du corpus ne convertit la lieue en kilomètres, et la règle des fractions de ' +
    'l’article 987 (40 km / 30 km) est propre au Code de procédure civile. La plateforme ne ' +
    'calcule pas cette augmentation. La date ci-dessus est celle sans augmentation : c’est la ' +
    'plus précoce, donc la plus sûre ; ajoutez vous-même les jours que vous retenez.',
  a5bis:
    `Cet article ajoute « outre le délai de distance » (C. civ., art. 229, L. du 5 mai 1949 : ` +
    `${CIT_229}). L’article ne chiffre pas ce délai, et aucun texte du corpus ne dit s’il faut ` +
    'lire la règle en lieues du Code civil ou celle en kilomètres de l’article 987 du Code de ' +
    'procédure civile. La plateforme ne calcule pas cette augmentation. La date ci-dessus est ' +
    'celle sans augmentation : c’est la plus précoce, donc la plus sûre.',
  a3: 'Ce calcul ne remplace pas la vérification du texte. Lam Veritab ne garantit aucun délai de recours.',
  a6Phrase1: (d, l) => `Le ${d} est un jour à surveiller : ${l}.`,
  a6Phrase3: (a) =>
    `Si un arrêté a été pris pour ${a.annee}, le délai est prorogé d’un jour et la date limite ` +
    `devient le ${a.date} (${a.source}, troisième cas : ${CIT_991_AL3_CAS3}). La plateforme ne ` +
    'le sait pas : elle ne proroge pas, et cette date-là n’est pas la sienne.',
  a6Cascade: (m) =>
    ` Ce jour étant lui-même ${m}, le report se poursuivrait au-delà — la prorogation joue ` +
    'jusqu’au premier jour qui n’est ni un dimanche, ni une fête légale, ni une fête nationale.',
  a6Phrase4: (b) => `Vérifiez le Moniteur de l’année. ${b}`,
  a6Recherche: (q) => `Rechercher « ${q} » dans le corpus`,

  lectures: {
    REGIME_FRANC: {
      libelle: 'Si ce délai est un délai de procédure, il est franc',
      fondement:
        `C. trav., art. 511 — ${CIT_511_PROC} La qualification de ce délai n’est pas acquise : ` +
        'la tête d’affiche est calculée en régime ORDINAIRE, la plus précoce, donc la plus sûre.',
    },
    PROROGATION_991: {
      libelle: 'Si l’article 991 C. pr. civ. s’applique à ce délai',
      fondement:
        'Le Code civil ne comporte aucune clause de prorogation, et l’art. 991 est dans le Code ' +
        'de procédure civile. La tête d’affiche est donc calculée SANS prorogation.',
    },
    DEMI_JOURNEE: {
      libelle: 'Si un jour chômé à partir de midi proroge le délai d’un jour entier',
      fondement:
        'Le décret du 11 décembre 2024 ne chôme le Lundi Gras qu’« à partir de midi » ' +
        '(art. 2, 1°) — la seule restriction d’horaire de la liste. La matinée reste ouvrable : ' +
        'la tête d’affiche ne proroge donc PAS sur ce jour, et cette lecture nomme la date ' +
        'qu’elle aurait si la demi-journée comptait pour un jour entier.',
    },
    CUMUL: {
      libelle: 'Lecture la plus large (toutes les réserves cumulées)',
      fondement:
        'C’est la date maximale que l’écran ait nommée ; elle borne l’exposition. Elle n’est la ' +
        'date d’aucun texte : elle est la somme des lectures ci-dessus.',
    },
  },

  dimanche: 'Dimanche',
}

const EN: Table = {
  dateInvalide: 'That date does not exist. Check the day and the month.',
  genreNonCalculable:
    'This period cannot be computed in days by this calculator; no reason has been drafted for this entry.',
  regimeAVerifier:
    'Regime to be checked: the editors have not qualified this period (clear days or ordinary ' +
    'days). The platform does not decide in their place; no date is shown.',
  dureeAbsente:
    'This entry carries no duration. A row that does not carry a number receives no days.',
  dureeInvalide: (v) =>
    `The duration must be a whole number of days, zero or positive; this one is “${v}”. No date ` +
    'is shown: a period is not counted in fractions of a day, and a negative number would make ' +
    'the period expire before it started.',
  optionInconnue: (c) => `The answer “${c}” is not an option for this entry.`,
  borneHistorique:
    'The list of legal holidays applicable before 22 June 1989 is not established in this corpus ' +
    '(the 1982 and 1985 decrees give different lists). This calculator does not serve matters ' +
    'earlier than that date.',
  refusCascadeBornee: (n) =>
    `The extension was repeated ${n} times without reaching a day that does not extend. The ` +
    'platform returns NO date: the one it would compute would itself fall on an extended day, ' +
    'and a date the engine knows to be wrong is not displayed. Check the calendar in use.',
  refusReglesInconnues: (v) =>
    `Reading rules « ${v} » are not in the platform’s register. No date is returned: computing ` +
    'it under today’s rules would answer something other than what was asked.',

  manqueKmDeux:
    'the TWO distances this article requires you to measure (you enter them; the platform does not compute them)',
  manqueKmUn: 'the distance (you enter it; the platform does not compute it)',
  manqueKmEntier: 'a whole, positive distance',
  manqueReponse: (q) => `an answer to: « ${q} »`,

  regimeFranc: 'Clear days',
  regimeOrdinaire: 'Ordinary days',
  regimeAVerifierLibelle: 'Regime to be checked — the editors have not qualified this period',
  regimeIncertainLibelle: 'Uncertain regime — see the named reading',

  phraseSecurite: (d) =>
    `Acting no later than ${d} is safe under every reading of the text. Acting later assumes ` +
    'that the court adopts one of the readings below.',
  phraseSecuriteFrancPur: (d) =>
    `The clear-day period you entered expires on ${d}. This computation counts the days, then ` +
    'carries the due date forward — step by step, to the first day that is neither a Sunday ' +
    'nor one of the sixteen non-working days in the platform’s calendar (art. 991 §3 C. pr. ' +
    'civ.; art. 511 §2 Labour Code in labour matters). Saturday is not a day of extension. ' +
    'This computation does not classify your period.',

  etapeDepart: (p, d) => `Starting point: ${p}, on ${d}.`,
  etapeJourDepart: (f) => `The starting day is not counted (${f}).`,
  fondementDroitCommunCivil:
    'general law; the Civil Code has no general rule of computation, and art. 987 C. pr. civ. ' +
    'covers only periods under the Code of Civil Procedure',
  etapeDuree: (a) => {
    const s = a.jours > 1 ? 's' : ''
    return (
      `Period: ${a.jours} ${a.franc ? 'clear ' : ''}day${s} ` +
      `(« ${a.dureeTexte} »${a.reference ? `, ${a.reference}` : ''}). ` +
      (a.dureeFondement ? `${a.dureeFondement} ` : '') +
      `Regime: ${a.franc ? 'clear days' : 'ordinary days'} — ${a.regimeFondement}`
    )
  },
  etapeSupplement: (n) =>
    `Increase under article 74: ${n} days. The components are added together, and then ONE ` +
    'single expiry day is added (Cass. 1st Section no. 13, 28 March 1966).',
  etapeDistanceDetaillee: (n, detail) =>
    `Distance allowance: ${n} day${n > 1 ? 's' : ''} (${detail}) — C. pr. civ., art. 987.`,
  detailDistance: (a) =>
    `${a.km} km ÷ 40 = ${a.quotient}; remainder ${a.reste} km, ` +
    `${a.reste >= 30 ? '30 or more, counted' : 'under 30, not counted'} ` +
    `→ ${a.jours} day${a.jours > 1 ? 's' : ''}`,
  etapeDistanceSimple: (n) => `Distance allowance: ${n} day${n > 1 ? 's' : ''}.`,
  etapeDistanceNonChiffree:
    'Distance allowance: not computed — the article provides for one, but no text in the corpus ' +
    'puts a figure on it (see the warning below).',
  etapeDistanceAucune:
    'Distance allowance: none (no distance entered; this article does not provide for one).',
  etapeDernierJourCompte: (d) => `Last day counted: ${d}.`,
  etapeEcheanceFranche: (f, d) =>
    `The expiry day is not counted: one day is added (${f}) → ${d}.`,
  etapeEcheanceIncertaine: (d) =>
    'Clear-day treatment is not settled for this period: the headline date is computed on the ' +
    `ORDINARY regime, the earliest one — the expiry day counts, and the last usable day is ${d}. ` +
    'Clear-day treatment is named as a competing reading below.',
  etapeEcheanceOrdinaire: (d) =>
    `The expiry day counts (ordinary period): the last usable day is ${d}.`,
  etapeProrogation: (a) =>
    `${a.jour} is ${a.motif}: the period is extended by one day (${a.source}) → ${a.suivant}.`,
  motifDimancheArticle: 'a Sunday',
  motifFeteLegale: (n) => `a legal holiday (${n})`,
  motifFeteNationale: (n) => `a national holiday (${n})`,
  motifJourRedaction: (n) =>
    `carried in the calendar as a legal holiday (${n}) with no establishing text — calendar ` +
    'version 1, predating the decree of 11 December 2024',
  jointureMotifs: ' and ',

  finaleSamedi: (d) =>
    'Saturday is not a day of extension: article 991 covers only Sundays, legal holidays and ' +
    `closure ordered by executive order. The date remains ${d}.`,
  finaleSamediEnOutre: (n) => ` This Saturday is also ${n}`,
  finaleSamediPorteSansProroger:
    ': that day is carried in the platform’s calendar without extending the period under the reading adopted',
  finaleRas: (d) => `${d} is neither a Sunday nor a legal holiday: no further extension.`,
  finaleEmpechee: (a) => `${a.date} is ${a.luiMeme ? 'itself ' : ''}${a.noms}`,
  finaleCalendrier: (a) =>
    `${a.date} is not a Sunday, and ${a.source} does not extend it under the reading adopted; ` +
    `the platform’s calendar nevertheless carries it (${a.noms})`,
  voirLecturesEtAvertissements: ' — see the named readings and the warnings below.',
  voirAvertissements: ' — see the warnings below.',
  consequenceUnJour: (s, d) =>
    `; ${s} extends by ONE day only: the headline date remains ${d}.`,
  consequencePasAcquise: (f) => `, but extension is not settled for this period. ${f}`,
  consequenceLecture991: (l, d) => ` The named reading « ${l} » gives ${d}.`,

  praticableInterditTravail: (d) =>
    `No service or enforcement may be carried out on ${d} (C. trav., art. 512: ${CIT_512}). ` +
    CIT_512_NULLITE,
  praticableInterditCpc: (d) =>
    `No service or enforcement may be carried out on ${d} ` +
    `(C. pr. civ., art. 991 al. 2: ${CIT_991_AL2}).`,
  praticableConditionnel: (d, noms, article) =>
    `${d} is carried in the platform’s calendar (${noms}) with no permanent text establishing ` +
    `it: ${article} does not expressly close that day, but a bailiff may decline to act and a ` +
    'court registry may be closed.',
  articleCpc991al2: 'article 991 al. 2 C. pr. civ.',
  articleCtrav512: 'article 512 C. trav.',
  praticableDeuxDates: (certain, prudent) =>
    'If your document must be served or enforced: no later than ' +
    `${certain} counting only what the text expressly forbids (Sundays, legal holidays and ` +
    `national holidays); no later than ${prudent} if you also set aside the days the ` +
    'platform’s calendar carries with no permanent establishing text.',
  praticableUneDate: (d) => `If your document must be served or enforced: no later than ${d}.`,
  praticableGreffe:
    'If it is a filing with the registry or a declaration, article 991 does not govern it: ' +
    'check the registry’s opening hours.',
  // § 4.10 — voir la version française : les heures viennent de l’ARTICLE, pas de la table
  // réglable des fenêtres de signification.
  praticableMidi: (d, noms) =>
    `${d} is a holiday from noon onwards (${noms}): the morning remains a working period, but ` +
    'the window closes at noon — from six in the morning until noon (C. pr. civ., art. 991 ' +
    'al. 2). A document to be served must be served before noon.',
  praticableMidiTravail: (d, noms) =>
    `${d} is a holiday from noon onwards (${noms}): the morning remains a working period, but ` +
    'the window closes at noon — from eight in the morning until noon (C. trav., art. 512). ' +
    `A document to be served must be served before noon. ${CIT_512_NULLITE}`,

  a1:
    'An order of the President of the Republic may have declared that day closed and extended ' +
    'the period by one day. The platform does not know these orders. The burden of proof lies ' +
    'on whoever relies on it (Cass. 1st Section no. 13, 28 March 1966).',
  a2: (d) =>
    'The distance is the one you entered. The platform neither computes nor suggests it. No text ' +
    'says whether the distance is by road or as the crow flies. This period exists in the private ' +
    'interest of the parties: it can be lost by waiver (Cass. 2nd Section no. 3, 9 Dec. 1965). ' +
    `Without the distance allowance, the date would be ${d}.`,
  a4: (noms, pluriel) =>
    `${noms.charAt(0).toUpperCase()}${noms.slice(1)} ${pluriel ? 'are carried' : 'is carried'} ` +
    'in the VERSION 1 calendar as a legal holiday with no establishing text; that calendar ' +
    'predates the decree of 11 December 2024, which lists eleven legal holidays and establishes ' +
    `${pluriel ? 'them' : 'it'}. Under version 1 it is from ` +
    `${pluriel ? 'those days' : 'that day'} that the date of the broadest reading below ` +
    `follows, and that is why ${pluriel ? 'they are' : 'it is'} set aside from the headline ` +
    'date. Replay the calculation under the current calendar for today’s date.',
  a5: (citation) =>
    'This article increases the period by one day per five leagues' +
    (citation ? ` (« ${citation} »)` : '') +
    '. No text in the corpus converts the league into kilometres, and the fraction rule of ' +
    'article 987 (40 km / 30 km) belongs to the Code of Civil Procedure. The platform does not ' +
    'compute that increase. The date above is the one without it: the earliest, therefore the ' +
    'safest; add the days you consider due yourself.',
  a5bis:
    'This article adds « outre le délai de distance » (C. civ., art. 229, Act of 5 May 1949: ' +
    `${CIT_229}). The article puts no figure on that allowance, and no text in the corpus says ` +
    'whether to read the Civil Code’s rule in leagues or article 987’s rule in kilometres. The ' +
    'platform does not compute that increase. The date above is the one without it: the ' +
    'earliest, therefore the safest.',
  a3:
    'This computation does not replace checking the text. Lam Veritab guarantees no appeal period.',
  a6Phrase1: (d, l) => `${d} is a day to watch: ${l}.`,
  a6Phrase3: (a) =>
    `If an order was made for ${a.annee}, the period is extended by one day and the deadline ` +
    `becomes ${a.date} (${a.source}, third case: ${CIT_991_AL3_CAS3}). The platform does not ` +
    'know: it does not extend, and that date is not its own.',
  a6Cascade: (m) =>
    ` That day being itself ${m}, the extension would carry on — it runs to the first day ` +
    'that is neither a Sunday, nor a legal holiday, nor a national holiday.',
  a6Phrase4: (b) => `Check the Moniteur for that year. ${b}`,
  a6Recherche: (q) => `Search “${q}” in the corpus`,

  lectures: {
    REGIME_FRANC: {
      libelle: 'If this period is a procedural one, it runs in clear days',
      fondement:
        `C. trav., art. 511 — ${CIT_511_PROC} The qualification of this period is not settled: ` +
        'the headline date is computed on the ORDINARY regime, the earliest, therefore the safest.',
    },
    PROROGATION_991: {
      libelle: 'If article 991 C. pr. civ. applies to this period',
      fondement:
        'The Civil Code contains no extension clause, and art. 991 is in the Code of Civil ' +
        'Procedure. The headline date is therefore computed WITHOUT extension.',
    },
    DEMI_JOURNEE: {
      libelle: 'If a day closed from noon extends the period by a whole day',
      fondement:
        'The decree of 11 December 2024 closes Shrove Monday only “from noon” (art. 2, 1°) — ' +
        'the only time restriction in the list. The morning remains open for business: the ' +
        'headline date therefore does NOT extend over that day, and this reading names the date ' +
        'it would have if the half-day counted as a whole one.',
    },
    CUMUL: {
      libelle: 'Broadest reading (all caveats combined)',
      fondement:
        'This is the latest date the screen has named; it bounds the exposure. It is no text’s ' +
        'date: it is the sum of the readings above.',
    },
  },

  dimanche: 'Sunday',
}

const HT: Table = {
  dateInvalide: 'Dat sa a pa egziste. Verifye jou a ak mwa a.',
  genreNonCalculable:
    'Kalkilatè sa a pa ka konte delè sa a an jou ; pa gen okenn motif ki ekri pou antre sa a.',
  regimeAVerifier:
    'Rejim pou verifye : redaksyon an pa kalifye delè sa a (fran oswa òdinè). Platfòm nan pa ' +
    'deside nan plas li ; pa gen okenn dat ki parèt.',
  dureeAbsente:
    'Antre sa a pa pote okenn dire. Yon liy ki pa pote yon nonm pa resevwa jou.',
  dureeInvalide: (v) =>
    `Dire a dwe yon nonm antye jou, zewo oswa pozitif ; sa a se « ${v} ». Pa gen okenn dat ki ` +
    'parèt : yon delè pa konte an fraksyon jou, epi yon nonm negatif ta fè delè a ekspire anvan ' +
    'li kòmanse.',
  optionInconnue: (c) => `Repons « ${c} » a pa yon opsyon pou antre sa a.`,
  borneHistorique:
    'Lis fèt legal ki aplikab anvan 22 jen 1989 la pa etabli nan koutim sa a (dekrè 1982 ak 1985 ' +
    'yo bay lòt lis). Kalkilatè sa a pa sèvi dosye ki anvan dat sa a.',
  refusCascadeBornee: (n) =>
    `Ranvwa a repete ${n} fwa san li pa rive sou yon jou ki pa pwolonje. Platfòm nan pa bay ` +
    'OKENN dat : sa li ta kalkile a ta tonbe sou yon jou ki pwolonje tou, epi yon dat motè a ' +
    'konnen ki fo pa afiche. Tcheke kalandriye w ap sèvi a.',
  refusReglesInconnues: (v) =>
    `Règ lekti « ${v} » yo pa nan rejis platfòm nan. Li pa bay okenn dat : kalkile l anba règ ` +
    'jodi a ta reponn yon lòt bagay pase sa yo mande a.',

  manqueKmDeux:
    'DE distans atik sa a fè w mezire yo (se ou menm ki antre yo ; platfòm nan pa kalkile yo)',
  manqueKmUn: 'distans lan (se ou menm ki antre l ; platfòm nan pa kalkile l)',
  manqueKmEntier: 'yon distans antye e pozitif',
  manqueReponse: (q) => `yon repons pou : « ${q} »`,

  regimeFranc: 'Delè fran',
  regimeOrdinaire: 'Delè òdinè',
  regimeAVerifierLibelle: 'Rejim pou verifye — redaksyon an pa kalifye delè sa a',
  regimeIncertainLibelle: 'Rejim ensèten — gade lekti ki nonmen an',

  phraseSecurite: (d) =>
    `Aji pi ta ${d} se yon bagay ki si anba tout lekti tèks la. Aji apre sa vle di jij la dwe ` +
    'chwazi youn nan lekti ki anba yo.',
  phraseSecuriteFrancPur: (d) =>
    `Delè an jou fran ou endike a fini ${d}. Kalkil sa a konte jou yo, apre sa li ranvwaye ` +
    'echeyans lan — youn apre lòt, jouk premye jou ki pa ni yon dimanch, ni youn nan sèz jou ' +
    'chome kalandriye platfòm nan (atik 991 al. 3 C. pr. civ. ; atik 511 al. 2 Kòd travay la ' +
    'nan zafè travay). Samdi se pa yon jou ranvwa. Kalkil sa a pa kalifye delè ou a.',

  etapeDepart: (p, d) => `Pwen depa : ${p}, ${d}.`,
  etapeJourDepart: (f) => `Jou depa a pa konte (${f}).`,
  fondementDroitCommunCivil:
    'règ dwa komen ; Kòd sivil la pa gen règ jeneral pou konte, epi atik 987 C. pr. civ. la vize ' +
    'sèlman delè Kòd pwosedi sivil la',
  etapeDuree: (a) =>
    `Delè : ${a.jours} jou${a.franc ? ' fran' : ''} ` +
    `(« ${a.dureeTexte} »${a.reference ? `, ${a.reference}` : ''}). ` +
    (a.dureeFondement ? `${a.dureeFondement} ` : '') +
    `Rejim : ${a.franc ? 'fran' : 'òdinè'} — ${a.regimeFondement}`,
  etapeSupplement: (n) =>
    `Ogmantasyon atik 74 : ${n} jou. Eleman yo ajoute youn ak lòt, epi SÈLMAN YON jou echeyans ` +
    'ajoute apre (Kasasyon 1ye Seksyon n° 13, 28 mas 1966).',
  etapeDistanceDetaillee: (n, detail) =>
    `Delè distans : ${n} jou (${detail}) — C. pr. civ., art. 987.`,
  detailDistance: (a) =>
    `${a.km} km ÷ 40 = ${a.quotient} ; rès ${a.reste} km, ` +
    `${a.reste >= 30 ? 'egal oswa plis pase 30, konte' : 'mwens pase 30, pa konte'} ` +
    `→ ${a.jours} jou`,
  etapeDistanceSimple: (n) => `Delè distans : ${n} jou.`,
  etapeDistanceNonChiffree:
    'Delè distans : pa kalkile — atik la prevwa youn, men pa gen okenn tèks nan koutim nan ki ' +
    'bay chif li (gade avètisman ki anba a).',
  etapeDistanceAucune:
    'Delè distans : okenn (pa gen distans ki antre ; atik sa a pa prevwa youn).',
  etapeDernierJourCompte: (d) => `Dènye jou ki konte : ${d}.`,
  etapeEcheanceFranche: (f, d) =>
    `Jou echeyans lan pa konte : yon jou ajoute (${f}) → ${d}.`,
  etapeEcheanceIncertaine: (d) =>
    'Rejim fran an pa asire pou delè sa a : dat prensipal la kalkile nan rejim ÒDINÈ, sa ki pi ' +
    `bonè a — jou echeyans lan konte, epi dènye jou itil la se ${d}. Rejim fran an nonmen kòm ` +
    'yon lekti konkiran anba a.',
  etapeEcheanceOrdinaire: (d) =>
    `Jou echeyans lan konte (delè òdinè) : dènye jou itil la se ${d}.`,
  etapeProrogation: (a) =>
    `${a.jour} se ${a.motif} : delè a pwolonje yon jou (${a.source}) → ${a.suivant}.`,
  motifDimancheArticle: 'yon dimanch',
  motifFeteLegale: (n) => `yon jou fèt legal (${n})`,
  // ⚠️ Créole NON relu par la rédaction, comme les libellés du calendrier : à faire relire.
  motifFeteNationale: (n) => `yon jou fèt nasyonal (${n})`,
  motifJourRedaction: (n) =>
    `pote nan kalandriye a kòm fèt legal (${n}) san okenn tèks ki etabli l — kalandriye ` +
    'vèsyon 1, anvan dekrè 11 desanm 2024 la',
  jointureMotifs: ' ak ',

  finaleSamedi: (d) =>
    'Samdi se pa yon jou pwolongasyon : atik 991 vize sèlman dimanch, fèt legal ak chomaj yon ' +
    `arete preskri. Dat la rete ${d}.`,
  finaleSamediEnOutre: (n) => ` Samdi sa a se ${n} tou`,
  finaleSamediPorteSansProroger:
    ' : jou sa a nan kalandriye platfòm nan san li pa pwolonje anba lekti yo chwazi a',
  finaleRas: (d) => `${d} se ni yon dimanch ni yon fèt legal : pa gen lòt pwolongasyon.`,
  finaleEmpechee: (a) => `${a.date} se ${a.luiMeme ? 'li menm ' : ''}${a.noms}`,
  finaleCalendrier: (a) =>
    `${a.date} se pa yon dimanch, epi ${a.source} pa pwolonje l anba lekti yo chwazi a ; ` +
    `kalandriye platfòm nan pote l kanmenm (${a.noms})`,
  voirLecturesEtAvertissements: ' — gade lekti ki nonmen yo ak avètisman ki anba yo.',
  voirAvertissements: ' — gade avètisman ki anba yo.',
  consequenceUnJour: (s, d) =>
    ` ; ${s} pwolonje YON sèl jou : dat prensipal la rete ${d}.`,
  consequencePasAcquise: (f) => `, men pwolongasyon an pa asire pou delè sa a. ${f}`,
  consequenceLecture991: (l, d) => ` Lekti ki nonmen « ${l} » bay ${d}.`,

  praticableInterditTravail: (d) =>
    `Yo pa ka fè okenn siyifikasyon ni egzekisyon ${d} (C. trav., art. 512 : ${CIT_512}). ` +
    CIT_512_NULLITE,
  praticableInterditCpc: (d) =>
    `Yo pa ka fè okenn siyifikasyon ni egzekisyon ${d} ` +
    `(C. pr. civ., art. 991 al. 2 : ${CIT_991_AL2}).`,
  praticableConditionnel: (d, noms, article) =>
    `${d} nan kalandriye platfòm nan (${noms}) san okenn tèks pèmanan ki etabli l : ${article} pa ` +
    'fèmen jou sa a espreseman, men yon wisye ka refize enstrimante epi yon grèf ka fèmen.',
  articleCpc991al2: 'atik 991 al. 2 C. pr. civ.',
  articleCtrav512: 'atik 512 C. trav.',
  praticableDeuxDates: (certain, prudent) =>
    'Si zak ou a dwe siyifye oswa egzekite : pi ta ' +
    `${certain} si w kenbe sèlman sa tèks la entèdi espreseman (dimanch, fèt legal ak fèt ` +
    `nasyonal yo) ; pi ta ${prudent} si w mete sou kote tou jou kalandriye platfòm nan pote ` +
    'san okenn tèks pèmanan ki etabli yo.',
  praticableUneDate: (d) => `Si zak ou a dwe siyifye oswa egzekite : pi ta ${d}.`,
  praticableGreffe:
    'Si se yon depo nan grèf oswa yon deklarasyon, atik 991 pa gouvène l : enfòme w sou lè grèf ' +
    'la louvri.',
  // § 4.10 — voir la version française : les heures viennent de l’ARTICLE, pas de la table
  // réglable des fenêtres de signification.
  praticableMidi: (d, noms) =>
    `${d} chome apati midi (${noms}) : maten an rete ouvè, men fenèt la fèmen a midi — depi ` +
    'sizè dimaten jouk midi (C. pr. civ., art. 991 al. 2). Yon zak pou siyifye dwe siyifye ' +
    'anvan midi.',
  praticableMidiTravail: (d, noms) =>
    `${d} chome apati midi (${noms}) : maten an rete ouvè, men fenèt la fèmen a midi — depi ` +
    'uitè dimaten jouk midi (C. trav., art. 512). Yon zak pou siyifye dwe siyifye anvan midi. ' +
    `${CIT_512_NULLITE}`,

  a1:
    'Yon arete Prezidan Repiblik la ka te preskri chomaj jou sa a epi pwolonje delè a yon jou. ' +
    'Platfòm nan pa konnen arete sa yo. Chay prèv la sou moun ki envoke l ' +
    '(Kasasyon 1ye Seksyon n° 13, 28 mas 1966).',
  a2: (d) =>
    'Distans lan se sa ou antre a. Platfòm nan pa kalkile l e li pa pwopoze l. Pa gen tèks ki di ' +
    'si distans lan se sou wout oswa an liy dwat. Delè sa a la nan enterè prive pati yo : li ka ' +
    `pèdi si yon moun renonse l (Kasasyon 2yèm Seksyon n° 3, 9 des. 1965). San ogmantasyon ` +
    `distans, dat la ta ${d}.`,
  a4: (noms, pluriel) =>
    `${noms.charAt(0).toUpperCase()}${noms.slice(1)} pote nan kalandriye VÈSYON 1 an kòm fèt ` +
    'legal san okenn tèks ki etabli l ; kalandriye sa a anvan dekrè 11 desanm 2024 la, ki bay ' +
    `onz fèt legal epi ki etabli ${pluriel ? 'yo' : 'li'}. Anba vèsyon 1 an, se depi ` +
    `${pluriel ? 'jou sa yo' : 'jou sa a'} dat lekti ki pi laj la anba a soti, epi se poutèt sa ` +
    `${pluriel ? 'yo mete yo' : 'yo mete l'} sou kote nan dat prensipal la. Rejwe kalkil la ` +
    'anba kalandriye kouran an pou dat jodi a.',
  a5: (citation) =>
    'Atik sa a ogmante delè a yon jou pou chak senk lye' +
    (citation ? ` (« ${citation} »)` : '') +
    '. Pa gen okenn tèks nan koutim nan ki konvèti lye a an kilomèt, epi règ fraksyon atik 987 ' +
    '(40 km / 30 km) se pou Kòd pwosedi sivil la sèlman. Platfòm nan pa kalkile ogmantasyon sa a. ' +
    'Dat ki anwo a se sa san ogmantasyon : se sa ki pi bonè, donk sa ki pi si ; ajoute ou menm ' +
    'jou ou konsidere yo.',
  a5bis:
    'Atik sa a ajoute « outre le délai de distance » (C. civ., art. 229, Lwa 5 me 1949 : ' +
    `${CIT_229}). Atik la pa bay chif pou delè sa a, epi pa gen okenn tèks nan koutim nan ki di ` +
    'si se règ an lye Kòd sivil la oswa règ an kilomèt atik 987 Kòd pwosedi sivil la ki aplike. ' +
    'Platfòm nan pa kalkile ogmantasyon sa a. Dat ki anwo a se sa san ogmantasyon : se sa ki pi ' +
    'bonè, donk sa ki pi si.',
  a3:
    'Kalkil sa a pa ranplase verifikasyon tèks la. Lam Veritab pa garanti okenn delè rekou.',
  a6Phrase1: (d, l) => `${d} se yon jou pou siveye : ${l}.`,
  a6Phrase3: (a) =>
    `Si yo te pran yon arete pou ${a.annee}, delè a pwolonje yon jou epi dat limit la vin ` +
    `${a.date} (${a.source}, twazyèm ka : ${CIT_991_AL3_CAS3}). Platfòm nan pa konnen sa : li pa ` +
    'pwolonje, epi dat sa a se pa dat pa li.',
  a6Cascade: (m) =>
    ` Kòm jou sa a se ${m} li menm, ranvwa a t ap kontinye — pwolongasyon an ale jouk premye ` +
    'jou ki pa ni yon dimanch, ni yon fèt legal, ni yon fèt nasyonal.',
  a6Phrase4: (b) => `Verifye Moniteur ane a. ${b}`,
  a6Recherche: (q) => `Chèche « ${q} » nan koutim nan`,

  lectures: {
    REGIME_FRANC: {
      libelle: 'Si delè sa a se yon delè pwosedi, li fran',
      fondement:
        `C. trav., art. 511 — ${CIT_511_PROC} Kalifikasyon delè sa a pa asire : dat prensipal la ` +
        'kalkile nan rejim ÒDINÈ, sa ki pi bonè a, donk sa ki pi si a.',
    },
    PROROGATION_991: {
      libelle: 'Si atik 991 C. pr. civ. aplike pou delè sa a',
      fondement:
        'Kòd sivil la pa gen okenn kloz pwolongasyon, epi atik 991 nan Kòd pwosedi sivil la. Se ' +
        'poutèt sa dat prensipal la kalkile SAN pwolongasyon.',
    },
    DEMI_JOURNEE: {
      libelle: 'Si yon jou ki chome apati midi pwolonje delè a yon jou antye',
      fondement:
        'Dekrè 11 desanm 2024 la chome Lendi Gra sèlman « apati midi » (art. 2, 1°) — se sèl ' +
        'restriksyon lè nan lis la. Maten an rete ouvè : dat prensipal la pa pwolonje sou jou ' +
        'sa a, epi lekti sa a nonmen dat li ta genyen si demi-jounen an te konte pou yon jou ' +
        'antye.',
    },
    CUMUL: {
      libelle: 'Lekti ki pi laj la (tout rezèv yo ansanm)',
      fondement:
        'Se dat maksimòm ekran an nonmen ; li bòne ekspozisyon an. Li pa dat okenn tèks : se sòm ' +
        'lekti ki anwo yo.',
    },
  },

  dimanche: 'Dimanch',
}

const TABLES: Record<Locale, Table> = { fr: FR, en: EN, ht: HT }

/** Les phrases du moteur dans la langue demandée. Repli sur le français si la clé manque. */
export function phrases(locale: Locale = 'fr'): Table {
  return TABLES[locale] ?? FR
}

export type PhrasesMoteur = Table
