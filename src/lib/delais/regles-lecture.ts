/**
 * § 4.6 — **LES RÈGLES DE LECTURE, ET LEUR VERSION.** Fichier PUR : aucun `Date`, aucune E/S.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 1. CE QUE ME VAVAL A TRANCHÉ LE 20 AOÛT 2026 (SOIR), ET CE QUE CELA EMPORTE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Deux questions de droit restaient ouvertes, et la plateforme les portait en RÉSERVES —
 * des lectures concurrentes nommées à côté de la date, jamais appliquées à la tête d'affiche :
 *
 *   - **R1 / R1-T** : les cinq fêtes NATIONALES de l'article 275.1 de la Constitution
 *     prorogent-elles au sens de l'art. 991 al. 3 C. pr. civ. (« un dimanche ou un jour de
 *     fête légale ») et de l'art. 511 al. 2 C. trav. (« un dimanche ou un jour férié légal ») ?
 *   - **R3** : la prorogation « d'un jour » se répète-t-elle quand ce jour-là est lui-même
 *     chômé — cas certain les 1er/2 novembre, fréquent autour du 25 décembre ?
 *
 * **Réponse de Me Vaval : OUI aux deux.** Ce ne sont donc plus des lectures concurrentes,
 * c'est la RÈGLE : la tête d'affiche proroge quand le dernier jour tombe un dimanche, une
 * fête légale (les onze du Décret du 11 décembre 2024) ou une fête nationale (les cinq de la
 * Constitution), et elle recommence jusqu'au premier jour qui n'est aucun des trois.
 *
 * R1, R1_T et R3 ont donc été retirées du moteur, comme R6 l'avait été le matin même quand la
 * rédaction a retrouvé le décret de 2024. **Ce qui SUBSISTE en réserve, et qu'aucune de ces
 * trois n'emporte** :
 *
 *   - **`PROROGATION_991`** — les 114 entrées du Code civil (`prorogation991: 'INCERTAIN'`).
 *     Le Code civil ne comporte AUCUNE clause de prorogation et l'art. 991 est dans le Code de
 *     procédure civile : leur tête d'affiche reste calculée SANS prorogation, et la réserve
 *     nomme la date qu'elle aurait si l'art. 991 s'y appliquait. Élargir la prorogation ne dit
 *     rien de la question de savoir si elle joue ;
 *   - **`REGIME_FRANC`** — les entrées `regimeIncertain`, dont la qualification (délai de
 *     procédure, donc franc) n'est pas acquise.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 2. POURQUOI CES DEUX DRAPEAUX SONT VERSIONNÉS, ET NON SUPPRIMÉS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **UN PERMALIEN PORTE LA VERSION DU CALENDRIER (`c`), CELLE DES FENÊTRES (`w`) ET LA
 * RÉVISION DE L'ENTRÉE (`r`) — IL NE PORTAIT PAS LA VERSION DES RÈGLES DE LECTURE.** Or le
 * § 6.3 est exprès : « il porte TOUT ce dont le calcul dépend […] un permalien qui omettrait
 * la révision rendrait, dans six mois, une autre date sous la même adresse ». Les règles de
 * lecture étaient, jusqu'ici, le SEUL paramètre du calcul sans coordonnée — et la journée du
 * 20 août 2026 démontre qu'elles varient : R6 est tombée le matin, R1 et R3 le soir.
 *
 * La décision, ÉCRITE ICI parce qu'elle se relira ici : **on introduit la version maintenant.**
 * Le raisonnement, y compris ce qui plaide contre :
 *
 *   a) **Le coût est asymétrique dans le temps.** Aujourd'hui : un paramètre de plus dans une
 *      liste figée, une table de deux lignes, un refus 404 sur une version inconnue. Rien à
 *      migrer — la fonctionnalité n'a jamais été mise en ligne, aucun permalien n'a jamais été
 *      émis, aucune signature n'est invalidée. Après la mise en ligne, la même introduction
 *      coûte un choix impossible : que vaut le paramètre ABSENT des liens déjà émis ? On ne
 *      peut pas le savoir — on n'a pas enregistré la règle du jour où ils ont été faits. Toute
 *      réponse est alors une supposition qui rend une date de forclusion.
 *   b) **L'objection sérieuse, et elle mérite d'être écrite** : figer une lecture, ce n'est pas
 *      figer un fait. Le calendrier est versionné parce qu'un décret a changé la liste des
 *      jours chômés ; les règles, elles, sont des OPINIONS de la maison, et rejouer fidèlement
 *      une opinion abandonnée peut rendre en 2028 une date que la rédaction tient pour fausse.
 *      Un permalien fidèle peut donc nuire.
 *   c) **La réponse est celle que le dépôt donne déjà pour `r`** : on rejoue fidèlement ET on
 *      DIT que la règle a changé — c'est `bandeauDeRevision` et son second permalien « refaire
 *      le calcul avec la règle actuelle ». Sans coordonnée, on n'a même pas de quoi savoir que
 *      le lien est ancien : la même adresse rendrait silencieusement une autre date, et la
 *      citation portée dans une assignation cesserait de correspondre à la page. C'est le
 *      défaut, pas la fidélité. Le pied de page nomme donc la version des règles à côté de
 *      celle du calendrier (`footerRules`) : une date rendue sous une règle périmée le dit.
 *   d) **Ce n'est pas un paramètre mort.** La table porte DEUX lignes : la version 1 est la
 *      lecture en vigueur jusqu'au 20 août 2026 au soir (tête étroite, un seul jour, la
 *      demi-journée comptée pour un jour plein), la version 2 est celle que Me Vaval vient de
 *      trancher. Le mécanisme est donc exercé, et `regles-lecture.test.ts` le MESURE au lieu
 *      de le supposer : il rejoue 2029-12-01 + 30 j et vérifie que les deux versions rendent
 *      deux dates différentes (2030-01-01 en v1, 2030-01-03 en v2).
 *
 * ⚠️ **CE QUE LA VERSION NE PORTE PAS.** Ni `franc`, ni `prorogation` — ils viennent de
 * l'ENTRÉE (son régime, son `prorogation991`), et une entrée a déjà sa révision `r`. Ni
 * `redaction`, qui ne concerne que les quatre lignes sans texte instituant du calendrier de la
 * VERSION 1 : c'est une propriété du calendrier, donc de `c`. Une version de règles ne dit que
 * ce qui n'est ni dans l'entrée ni dans le calendrier : **comment on lit l'art. 991 al. 3.**
 */

/**
 * Les questions que la version tranche. Rien d'autre n'entre ici.
 *
 * ⚠️ **`demiJournee` A ÉTÉ AJOUTÉ LE 20 AOÛT 2026 (SOIR), APRÈS LA RECETTE.** Il ferme
 * l'erreur d'un jour décrite en tête de l'entrée `lundi-gras` de `feries.ts` : le décret du
 * 11 décembre 2024 ne chôme le Lundi Gras qu'« à partir de midi » (art. 2, 1°), la matinée
 * reste ouvrable, et la plateforme comptait pourtant la demi-journée pour un jour plein.
 * Mesuré (`franc-pur.test.ts`, § 0) : **40 dates limites retardées de DEUX jours sur 7 304
 * calculs** — deux, et non un : le Lundi Gras est toujours suivi du Mardi Gras, chômé en
 * journée ENTIÈRE (décret du 11 décembre 2024, art. 2, 2°), et la cascade sautait les deux.
 * Vingt de ces quarante ont leur échéance sur le Lundi Gras lui-même, vingt de plus l'atteignent
 * par la cascade. **TOUJOURS dans le sens du report**, c'est-à-dire du risque de forclusion :
 * c'est exactement ce que la règle 4 du § 0 interdit.
 */
export type ReglesLecture = {
  /**
   * Les cinq fêtes NATIONALES (Const. 1987, art. 275.1) prorogent-elles ?
   *
   * Version 1 : non — la lettre de l'art. 991 al. 3 ne vise que « un dimanche ou un jour de
   * fête légale », et la Constitution distingue elle-même les deux catégories (art. 275.1
   * énumère les fêtes NATIONALES, art. 275.2 renvoie les fêtes LÉGALES à la loi ; le décret du
   * 23 mai 1989 s'intitule « déterminant, **en dehors des Fêtes Nationales**, les Fêtes
   * Légales »). L'arrêt Brown and Root (1re Sect. n° 13, 28 mars 1966) tient le dimanche et la
   * fête légale pour « les seuls cas ».
   *
   * Version 2 : **oui** — Me Vaval, 20 août 2026. Const. 1987, art. 275 : le chômage est
   * observé « à l'occasion des Fêtes Nationales et des Fêtes Légales ». Un jour légalement
   * chômé est un jour où l'acte ne peut pas être fait ; la prorogation a cet objet.
   */
  feteNationale: boolean
  /**
   * La prorogation joue-t-elle en CASCADE, jusqu'au premier jour qui ne proroge plus ?
   *
   * Version 1 : non — l'art. 991 al. 3 proroge « d'un jour », et un seul.
   * Version 2 : **oui** — Me Vaval, 20 août 2026 : « il faut la proroger au prochain jour
   * ouvrable ». Un jour de report qui tombe lui-même un dimanche ne rouvre aucun greffe.
   */
  cascade: boolean
  /**
   * Une entrée chômée SEULEMENT à partir de midi proroge-t-elle la tête d'affiche ?
   *
   * Version 1 : **oui** — la demi-journée y était comptée pour un jour plein (décision de la
   * rédaction, prise quand elle n'avait aucun effet : `lundi-gras` y est `autorite:
   * 'REDACTION'` et n'a jamais prorogé la tête du portail ; seul `2-novembre`, chômé lui
   * aussi « à partir de midi » par les décrets de 1982 et 1985, la portait réellement).
   *
   * Version 2 : **non** — la matinée reste ouvrable, l'acte peut y être fait, et accorder un
   * jour entier à raison d'une demi-journée retarde la date limite. Le § 0, règle 4 :
   * « une lecture qui retarde la date est écartée de la tête d'affiche, quelle que soit
   * l'autorité qui la porte. » La date tardive n'est pas perdue pour autant : elle est
   * NOMMÉE, par la lecture `DEMI_JOURNEE` (§ 4.6), qui est le mécanisme fait pour ça.
   */
  demiJournee: boolean
}

/**
 * ⚠️ **LE REGISTRE EST APPEND-ONLY.** On n'édite JAMAIS une ligne existante : un permalien qui
 * la nomme rendrait une autre date sous la même adresse — exactement ce que la version existe
 * pour empêcher. Une lecture qui change ajoute une ligne et déplace `VERSION_REGLES_COURANTE`.
 */
export const REGLES_LECTURE: Readonly<Record<number, ReglesLecture>> = {
  /** Jusqu'au 20 août 2026 (soir) — jamais mise en ligne, R1/R1-T et R3 en réserves nommées. */
  1: { feteNationale: false, cascade: false, demiJournee: true },
  /** Depuis le 20 août 2026 (soir) — Me Vaval : oui aux fêtes nationales, oui à la cascade. */
  2: { feteNationale: true, cascade: true, demiJournee: false },
}

/**
 * ⚠️ **POURQUOI `demiJournee` A ÉTÉ PORTÉ DANS LA LIGNE 2 ET N'A PAS OUVERT UNE LIGNE 3** —
 * c'est la seule dérogation à l'append-only ci-dessus, et elle se relira ici.
 *
 * ⚠️ **DÉCISION RÉEXAMINÉE ET CONFIRMÉE LE 20 AOÛT 2026, AU VU DU DÉCRET** (Me Vaval avait
 * laissé le choix : « tranche toi-même entre amender les règles v2 et créer des règles v3, et
 * justifie »). La rédaction d'origine de ce paragraphe portait un argument FAUX, corrigé ici :
 * elle écrivait qu'ouvrir une ligne 3 « ferait porter à tous les liens du jour une version dont
 * la rédaction sait déjà qu'elle retarde 40 dates limites ». C'est l'inverse — une ligne 3
 * porterait la règle CORRIGÉE, et `VERSION_REGLES_COURANTE` la désignerait. L'argument ne tient
 * pas, et il ne doit pas servir à justifier autre chose.
 *
 * **Les trois raisons qui, elles, tiennent :**
 *
 *   a) **L'append-only protège les permaliens ÉMIS, et il n'y en a aucun.** Le calculateur
 *      n'est ni commité ni déployé — tout `src/lib/delais/`, `src/app/[locale]/delais/` et
 *      `src/app/[locale]/(app)/outils/delais/` sont encore hors du dépôt. Aucune adresse ne
 *      cite la ligne 2 ; la corriger ne change la date d'aucun calcul rendu. Elle est en cours
 *      de RÉDACTION, pas en cours de LECTURE.
 *   b) **Une ligne 3 laisserait au registre une ligne 2 MORTE — et atteignable.** `rl=2` resterait
 *      une adresse valide rendant, sur 40 calculs, une date que la rédaction tient pour fausse ;
 *      le pied de page l'annoncerait « périmée », ce qui se lit « ancienne », pas « erronée ».
 *      Une version qu'on n'a jamais servie et dont on sait qu'elle forclôt n'a pas à être
 *      conservable : ce que la version existe pour rejouer, c'est une lecture qui a été
 *      SUIVIE, pas une qui a été écrite un après-midi.
 *   c) **Le mécanisme reste exercé, donc éprouvé.** Deux lignes suffisent à le prouver, et
 *      `regles-lecture.test.ts` le MESURE : 2029-12-01 + 30 j rend deux dates différentes sous
 *      les versions 1 et 2. Une troisième ligne n'ajouterait aucune couverture.
 *
 * ⚠️ **À COMPTER DE LA MISE EN LIGNE, CETTE DÉROGATION EST FERMÉE** : toute lecture qui change
 * ajoute une ligne, sans exception — et la raison a) tombera d'elle-même au premier permalien
 * émis. La question de fond — compter ou non la matinée du Lundi Gras — a été tranchée par
 * Me Vaval le 20 août 2026 au vu du décret (« le Lundi Gras cesse de proroger et redevient un
 * jour ouvrable, avec la mention en petits caractères que l'après-midi est chômé ») ; la voie
 * retenue est celle qui ne peut pas forclore, elle NOMME l'autre (lecture `DEMI_JOURNEE`), et
 * elle la DIT sur les deux surfaces (`publicDayHalfDay`, `BlocPraticable.texteMidi`).
 */

/** La version en vigueur. C'est elle que porte tout permalien émis aujourd'hui. */
export const VERSION_REGLES_COURANTE = 2

/** Les versions connues, dans l'ordre — pour l'écran d'administration et les tests. */
export const VERSIONS_REGLES: readonly number[] = Object.keys(REGLES_LECTURE)
  .map(Number)
  .sort((a, b) => a - b)

/**
 * Les règles d'une version. `null` sur une version inconnue — un permalien qui en nomme une
 * est un 404 franc (§ 7.3), **jamais un calcul rendu sous les règles du jour** : ce serait
 * rendre une date sous une adresse qui en promet une autre.
 */
export function reglesLecture(version: number): ReglesLecture | null {
  return REGLES_LECTURE[version] ?? null
}
