import { BRAND } from '../../brand'
import { JOURS, MOIS } from '../../delais/format'

/**
 * Dictionnaire FRANÇAIS — forme canonique du catalogue i18n (§02).
 * Le type Dictionary est dérivé de cet objet (dictionaries.ts) ; en.ts et ht.ts
 * sont typés contre lui : une clé manquante = erreur de compilation.
 */
export const fr = {
  /**
   * § 8.2 — Les noms de jours et de mois du CALCULATEUR DE DÉLAIS (défaut 17 a).
   * Ils viennent de `src/lib/delais/format.ts`, qui reste la SEULE copie : le noyau de
   * calcul doit pouvoir dater l'avertissement A6 en toutes lettres sans dépendre de ce
   * catalogue (§ 4.1). Une clé i18n doit exister dans les TROIS locales, sinon le
   * typecheck casse — d'où l'ajout simultané ici, dans `en.ts` et dans `ht.ts`.
   * ⚠️ Les noms créoles n'ont pas été relus par la rédaction : à faire avant de les figer.
   */
  delais: {
    jours: JOURS.fr,
    mois: MOIS.fr,

    // ─── Identité et navigation ────────────────────────────────────────────────
    navLabel: 'Calculateur de délais',
    metaTitle: 'Calculateur de jours francs — Lam',
    /**
     * LA NOTE DU PORTAIL — elle dit ce que l’outil FAIT (Me Vaval, 20 août 2026).
     *
     * ⚠️ L’ancienne rédaction annonçait « prorogation de l’article 991 » dans la même
     * énumération que le décompte et la distance : elle PROMETTAIT donc la prorogation, alors
     * que la règle de prudence est l’inverse — **la date affichée est la plus PRÉCOCE, elle ne
     * proroge pas**, et la prorogation se lit à côté, nommée, avec son fondement
     * (`teteAffiche` = « LA date. La plus précoce des lectures concurrentes. », `calcul.ts`).
     * Une note qui promet un report que la date de tête n’applique pas fait manquer un délai.
     */
    metaDescription:
      'Calculez une date limite en droit haïtien : jours francs ou jours calendaires, délai de distance. La date affichée est la plus précoce — celle qui reste bonne quelle que soit la lecture du texte. Les lectures qui la reportent, dont la prorogation de l’article 991, sont montrées à côté, chacune avec son fondement.',
    /**
     * LA MÊME NOTE, POUR LA SURFACE PUBLIQUE — et elle DOIT être distincte.
     *
     * ⚠️ `metaDescription` était partagée par les deux pages. Réécrite pour le portail, elle
     * annoncerait publiquement des « lectures montrées à côté » qui n’y existent plus : depuis
     * `franc-pur.ts`, `/[locale]/delais` ne rend PAS de lecture nommée, PAS de « lecture la plus
     * large », PAS de jour praticable. C’est la même exigence que celle qui a fait retirer
     * `publicFrancOnlyNote` : une page ne promet pas ce qu’elle ne fait pas.
     *
     * ⚠️ **CE COMMENTAIRE DISAIT « SANS PROROGATION » JUSQU’AU 20 AOÛT 2026 AU SOIR — et c’était
     * l’inverse du code livré.** La surface publique PROROGE depuis la seconde décision du jour :
     * report de l’art. 991 al. 3, en cascade, sur le dimanche et les 16 entrées PERMANENT du
     * calendrier. Trois autres en-têtes portaient la même phrase périmée (`lecture-publique.ts`,
     * `surfaces-delais.test.ts`, et les commentaires jumeaux d’`en.ts` et de `ht.ts`) ; dans un
     * dépôt où les commentaires tiennent lieu de spécification, la prochaine session aurait
     * « rétabli » le franc pur en croyant obéir.
     *
     * ⚠️ Le LIBELLÉ, lui, ne change pas, et le test qui lui interdit de promettre « 991 » reste
     * juste : ce qui est proscrit, c’est la promesse invérifiable dans une note de page. Le
     * report se dit AU MOMENT OÙ IL A LIEU, en petits caractères sous la date (`publicDeferred`).
     */
    metaDescriptionPublique:
      'Calculez une date limite en droit haïtien : donnez la date de réception de l’acte et le nombre de jours francs qu’il indique. La plateforme compte ces jours et rend la date.',
    breadcrumbHome: 'Accueil',
    breadcrumbHere: 'Calculateur de délais',
    title: 'Calculateur de jours francs',
    /**
     * LA NOTE VISIBLE DU PORTAIL, sous le titre — celle que l’avocate lit vraiment, quand
     * `metaDescription` ne sort que dans un résultat de recherche. Elle dit désormais la même
     * chose, et c’est la demande de Me Vaval du 20 août 2026.
     *
     * ⚠️ L’ancienne rédaction ÉNUMÉRAIT ce que la page rend (« la date la plus sûre, les
     * étapes, les jours écartés, les lectures concurrentes ») sans jamais dire **ce que la
     * date garantit ni ce qu’une lecture nommée signifie**. Sur un écran qui affiche jusqu’à
     * quatre dates — tête d’affiche, lecture nommée, lecture la plus large, jour praticable —,
     * un inventaire laisse choisir la plus tardive, et le recours est forclos. La note énonce
     * donc la règle de prudence : **la tête d’affiche est la plus PRÉCOCE et ne proroge pas**
     * (`teteAffiche` = « LA date. La plus précoce des lectures concurrentes. »), et une lecture
     * nommée n’allonge le délai que si le juge la retient.
     *
     * ⚠️ **LA PREMIÈRE PROPOSITION A ÉTÉ RÉÉCRITE LE 20 AOÛT 2026.** Elle disait « Choisissez
     * l’article, donnez le point de départ. » — une consigne que l’écran ne présente plus :
     * l’option vide « Choisissez un article… » a été retirée, `<option value={SLUG_AUTRE}>`
     * est désormais la PREMIÈRE du menu et l’état initial vaut `valeurs.e || SLUG_AUTRE`
     * (`DelaiForm.tsx`). Le portail s’ouvre donc sur « Autre — saisir le nombre de jours », où
     * il n’y a aucun article à choisir. Le dépôt avait identifié le risque de l’autre côté —
     * c’est la raison d’être de `publicIntro` — et la même phrase était devenue bancale sur le
     * portail lui-même. La note couvre maintenant les DEUX chemins, dans l’ordre où le menu
     * les offre. La suite (« La date affichée est la plus précoce… ») est exacte et n’a pas
     * bougé.
     *
     * ⚠️ **ARBITRAGE OUVERT, à Me Vaval** : le portail doit-il vraiment s’ouvrir sur la saisie
     * manuelle plutôt que sur le répertoire ? Cette note SUIVRA la réponse — si le répertoire
     * redevient le défaut, la première proposition redevient « Choisissez l’article ».
     */
    intro:
      'Saisissez votre délai, ou choisissez l’article ; donnez le point de départ. La date affichée est la plus précoce : agir au plus tard ce jour-là est sûr sous toutes les lectures du texte. Celles qui reportent l’échéance — dont la prorogation de l’article 991 — sont nommées à côté, avec leur fondement ; elles n’allongent le délai que si le juge les retient.',
    frameworkNote:
      'Cet outil applique l’article 987 du Code de procédure civile, l’article 511 du Code du travail, et le droit commun pour le Code civil. Il ne connaît pas les arrêtés de chômage.',
    disclaimer:
      'Information documentaire, non officielle. Le calcul ne remplace ni la lecture du texte ni l’avis d’un praticien : en cas de divergence, les publications officielles font foi.',

    // ─── Héros de l’accueil (§ 6.1) — il navigue, il ne calcule pas ────────────
    // ⚠️ Le SOUS-TITRE du héros a été RETIRÉ par Me Vaval (20 août 2026) : « La date de
    // réception de l’acte, le nombre de jours francs qu’il indique — et le raisonnement qui
    // fonde la date. » La phrase survit sous `toolsSubtitle`, où elle sert la tuile du
    // tableau de bord connecté ; le héros, lui, n’a plus qu’un titre et la règle de droit.
    heroKicker: 'Nouveau',
    heroTitle: 'Quand expire votre délai ?',
    heroSubmit: 'Calculer',

    // ─── LES SURFACES PUBLIQUES : DEUX CHAMPS, ET DEUX SEULEMENT ──────────────
    // Le héros et /[locale]/delais ne demandent que la date de réception et le nombre de
    // jours francs. Le répertoire — ses entrées, leurs libellés, leurs fondements — vit dans
    // l’espace connecté, et la route qui le sert exige une session.
    publicDateLabel: 'Date de réception de l’acte',
    publicDaysLabel: 'Nombre de jour(s) francs',
    publicDaysHint: 'Le nombre de jours indiqué dans l’acte.',
    // ⚠️ `publicIntro` a été RETIRÉ le 20 août 2026, avec le raisonnement lui-même : « le
    // portail public doit uniquement afficher la date » (Me Vaval). La phrase promettait
    // « le raisonnement qui la fonde » — elle est devenue fausse le jour où la surface
    // publique a cessé de le rendre. Ne pas la réintroduire : la page porte son titre, ses
    // deux champs, la date, et la règle de droit.
    /**
     * LA RÈGLE DE DROIT DES DEUX SURFACES PUBLIQUES, dans les mots de Me Vaval (20 août 2026).
     *
     * ⚠️ Elle remplace TROIS clés retirées ce jour-là : `heroNoResultNote` (« Le résultat
     * s’affiche sur la page du calculateur, avec ses réserves. » — « cette note concerne le
     * navigateur complet »), `heroFrancOnlyNote` et `publicFrancOnlyNote`. Cette dernière
     * ajoutait « Si le dernier jour tombe un dimanche ou une fête légale, il est prorogé d’un
     * jour (art. 991) » : c’est devenu FAUX sur la surface publique, qui ne proroge plus.
     * Une seule clé pour les deux surfaces — elles portent les mêmes champs, elles doivent en
     * dire la même chose, et une phrase de droit ne se recopie pas en deux exemplaires.
     */
    francRule:
      'Conformément au Code de procédure civile haïtien et au Code du travail, le délai franc ne compte ni le jour de la réception, ni le jour de l’échéance.',
    // ⚠️ « Il manque : Date de réception de l’acte · Nombre de jour(s) francs » a été jugé
    // pédant par Me Vaval : une consigne, pas un constat. Le PORTAIL garde son « Il manque : »
    // et sa liste (`submitMissingPrefix`), qui peut y énumérer un kilométrage et une question
    // de suite. Publiquement il n’y a que deux champs : on nomme le premier qui manque.
    missingDate: 'Indiquer la date de réception de l’acte',
    missingDays: 'Indiquer le nombre de jour(s) francs',

    /**
     * ─── LA SEULE MENTION GARDÉE SOUS LA DATE (Me Vaval, 20 août 2026) ──────────
     *
     * « Si la date calculée tombe un jour férié, le résultat l’affichera en petits
     * caractères. » Du TEXTE FIN, sous la date : pas d’encadré, pas de couleur d’alerte, pas
     * de pastille — la charte réserve le Sitwon à une source attestée (§ 8.1), et une mention
     * de jour n’en est pas une.
     *
     * ⚠️ **QUATRE GABARITS, PARCE QUE LE CALENDRIER PORTE QUATRE GENRES DE LIGNES.** Les
     * confondre sous « jour de fête légale » ferait dire à la plateforme ce qu’aucun texte ne
     * dit : les 4 entrées `REDACTION` ne sont instituées par aucun texte du corpus (c’est ce
     * que l’avertissement A4 énonce dans le portail), et les 5 `A_SURVEILLER` sont un chômage
     * ponctuel par arrêté, jamais une fête permanente (§ 4.13). Voir `mention-jour.ts`.
     *
     * ⚠️ **Aucun de ces gabarits n’annonce un report** : ils QUALIFIENT un jour, ils ne
     * déplacent pas la date. C’est `publicDeferred`, plus bas, qui dit le report — et ces
     * gabarits-là servent alors à décrire les jours FRANCHIS, un par un.
     */
    publicDayHoliday: 'Le {date} est un jour de fête légale ({nom}).',
    /**
     * ⚠️ **CE GABARIT NE PORTAIT AUCUNE RÉSERVE, ET C’EST LE PLUS LOURD DES TROIS.** Il nommait
     * le jour et se taisait sur le fondement, pendant que la ligne du report imputait le décalage
     * au seul art. 991 al. 3 — lequel ne vise que « un dimanche ou un jour de fête légale ».
     *
     * Les trois textes sont en base et ils distinguent DEUX catégories : Const. 1987, art. 275.1
     * énumère les cinq fêtes NATIONALES ; l’art. 275.2 dit « Les Fêtes Légales sont déterminées
     * par la Loi » ; et le décret du 23 mai 1989 s’intitule « déterminant, EN DEHORS DES FÊTES
     * NATIONALES, les Fêtes Légales ». La réserve R1 le disait noir sur blanc, et 25 des
     * 56 divergences mesurées avec le portail le MATIN du 20 août 2026 venaient de ces cinq
     * jours-là. ⚠️ Chiffre HISTORIQUE : depuis le soir, les fêtes nationales prorogent des deux
     * côtés et n'expliquent plus aucune divergence — la mesure du jour est dans
     * `franc-pur.test.ts`, § 0, et non dans un commentaire.
     *
     * ⚠️ **LA QUESTION A ÉTÉ TRANCHÉE LE 20 AOÛT 2026 (SOIR) : Me Vaval a répondu OUI.** Les
     * cinq fêtes nationales prorogent la tête d’affiche, des DEUX côtés — R1 a été retirée, et
     * la règle est portée par la version 2 des règles de lecture (`regles-lecture.ts`). La
     * ligne, elle, RESTE : nommer le fondement du chômage (la Constitution) et rappeler ce que
     * l’art. 991 al. 3 vise n’est pas une réserve, c’est ce qui permet à la lectrice de vérifier
     * une date que la lettre de l’article ne donne pas à elle seule.
     */
    publicDayNational:
      'Le {date} est un jour de fête nationale ({nom}), chômé au titre de la Constitution de 1987, art. 275.1 ; l’art. 991 al. 3 C. pr. civ. ne vise, lui, que le dimanche et la fête légale.',
    /**
     * ⚠️ **CETTE MENTION N'EST PLUS ATTEIGNABLE QUE SOUS LE CALENDRIER DE LA VERSION 1**
     * (20 août 2026). Le décret du 11 décembre 2024 institue les quatre jours qui la
     * déclenchaient ; la version 2 ne porte plus aucune entrée `REDACTION`. Elle reste parce
     * qu'un permalien `c=1` doit se rejouer à l'identique — et la phrase ne dit plus « sur
     * instruction de la rédaction » : elle NOMME la version qui la produit.
     */
    publicDayEditorial:
      'Le {date} est porté au calendrier comme fête légale ({nom}) sans texte instituant : ce calendrier (version 1) est antérieur au décret du 11 décembre 2024.',
    publicDayWatch:
      'Le {date} est un jour à surveiller ({nom}) : il est souvent chômé par arrêté.',
    /**
     * § 4.10 — ⚠️ **LA SEULE DEMI-JOURNÉE DU CALENDRIER, ET LA SEULE MENTION QUI PARLE D'UNE
     * HEURE.** Me Vaval, 20 août 2026, au vu du décret : « Le Lundi Gras cesse de proroger et
     * redevient un jour ouvrable, avec la mention en petits caractères que l'après-midi est
     * chômé. »
     *
     * Le décret du 11 décembre 2024 ne chôme le Lundi Gras qu'« à partir de midi » (art. 2,
     * 1°) : la matinée reste ouvrable, l'acte peut y être signifié, et la date limite ne se
     * reporte donc PAS sur ce jour — lui accorder un jour entier la retarderait, et une date
     * plus tardive que celle que le texte autorise est un risque de forclusion (§ 0, règle 4).
     * Reste que la fenêtre s'y ferme à midi : le taire laisserait croire à une journée entière.
     *
     * ⚠️ **`publicDayHoliday` NE PEUT PAS SERVIR ICI**, et c'est le motif de la clé : il dit
     * « est un jour de fête légale », ce qui est vrai mais laisse attendre le report que les
     * quatre autres gabarits annoncent. Deux affirmations contradictoires dans une seule page.
     *
     * ⚠️ **CE GABARIT CITE LE DÉCRET DE 2024** : il n'est donc posé que sur les entrées que ce
     * décret institue (`mention-jour.ts`, `estDemiJourneeOuvrable`). Le 2 novembre de la
     * version 1 du calendrier, demi-journée lui aussi mais sur les décrets de 1982 et 1985,
     * garde sa mention de fête légale.
     */
    publicDayHalfDay:
      'Le {date} est chômé à partir de midi ({nom} — décret du 11 décembre 2024, art. 2, 1°). Un acte à signifier doit l’être avant midi.',
    /**
     * ⚠️ **LE DIMANCHE EST UN AJOUT À L’INSTRUCTION, PAS UNE DÉDUCTION.** Me Vaval n’a nommé
     * que les jours fériés ; le dimanche est ajouté parce qu’il est aussi impraticable qu’une
     * fête pour signifier, et que taire l’un en disant l’autre serait incohérent. Il lui a été
     * signalé comme un ajout : s’il est retiré, c’est cette clé et la ligne `estDimanche` de
     * `mention-jour.ts` qui partent, rien d’autre.
     *
     * ⚠️ **CE GABARIT SE RÉPÉTAIT, DANS LES TROIS LANGUES.** Il recevait la date en toutes
     * lettres, qui porte DÉJÀ le nom du jour : « Le dimanche 5 juillet 2026 est un dimanche. » ;
     * « Sunday 5 July 2026 is a Sunday. » ; « dimanch 5 jiyè 2026 se yon dimanch. » Sur une page
     * dont la cliente a exigé qu’elle n’affiche que la date, une ligne tautologique se lit comme
     * un bogue. Deux correctifs, et ils vont ensemble : la date arrive ici SANS jour de semaine
     * (`dateSansJourSemaine`, `DelaiDatePublique`), et le verbe devient « tombe un ». Les quatre
     * autres gabarits gardent la date en toutes lettres : eux apportent une information neuve
     * (le nom de la fête, l’autorité), la répétition n’y coûte rien et le jour de semaine y sert.
     */
    publicDaySunday: 'Le {date} tombe un dimanche.',

    /**
     * ─── LA LIGNE DU REPORT (Me Vaval, 20 août 2026, SECONDE décision du jour) ───
     *
     * « Attention, la date limite est tombée un dimanche, il faut la proroger au prochain
     * jour ouvrable, donc le lundi 6 juillet. » Le calcul public proroge désormais — mais un
     * report muet est incompréhensible : la personne a saisi 31 jours, elle compte sur ses
     * doigts, et elle trouve un jour de moins que l'écran.
     *
     * ⚠️ **Elle vient APRÈS les lignes qui qualifient les jours franchis**, et elle est la
     * seule clé neuve : les gabarits `publicDay…` ci-dessus disent ce qu'est chaque jour
     * sauté (y compris « aucun texte du corpus ne l'institue » pour les quatre jours de la
     * rédaction, qui déplacent pourtant la date), et celle-ci conclut sur la date d'arrivée.
     * Deux lignes fines plutôt qu'une phrase composée : un gabarit combinatoire demanderait,
     * dans les trois langues, une phrase par combinaison de genres.
     *
     * ⚠️ `{source}` est l'article que le MOTEUR a cité sur le motif — « C. pr. civ., art. 991
     * al. 3 », ou l'art. 511 al. 2 en matière de travail. Jamais une constante d'écran.
     *
     * ⚠️ **« DROIT COMMUN DE LA COMPUTATION », ET NON « L’ARTICLE APPLICABLE À VOTRE DÉLAI ».**
     * L’entrée synthétique publique est déclarée `code: 'CIVIL'`, et la table
     * `ARTICLE_PROROGATION_PAR_CODE` y fait correspondre l’art. 991 al. 3. Une personne qui
     * saisit à la main un délai de procédure du Code du TRAVAIL — dont la clause de prorogation
     * est l’art. 511 al. 2 C. trav., que la plateforme cite correctement sur les 47 entrées
     * TRAVAIL du portail — lisait donc une référence au Code de procédure civile. La date, elle,
     * est juste : les deux clauses ont le même contenu utile. Mais la surface publique NE DEMANDE
     * PAS la matière (`src` est refusé, § 4.12) : elle ne peut pas savoir, et le reste du dépôt
     * s’interdit d’affirmer ce qu’il n’a pas vérifié. Le gabarit présente donc l’article pour ce
     * qu’il est ici — le droit commun de la computation — au lieu de le donner pour la clause
     * applicable au délai de l’utilisatrice. ⚠️ **Ne pas “réparer” en ajoutant un champ
     * “matière” à la surface publique : la cliente l’a explicitement retiré.**
     */
    publicDeferred: 'Le délai est prorogé au {date} — droit commun de la computation, {source}.',
    /**
     * ─── LA CASCADE, DITE COMME UNE LECTURE (et non comme la lettre) ─────────────
     *
     * ⚠️ **L’ÉCRAN IMPUTAIT DEUX JOURS DE REPORT À UN ARTICLE QUI EN DONNE UN.** `publicDeferred`
     * cite l’art. 991 al. 3, dont la lettre proroge « d’UN jour » ; sur `?d=2025-10-01&n=30` la
     * page écrivait « Le délai est prorogé au lundi 3 novembre 2025 (C. pr. civ., art. 991
     * al. 3) » après un report de DEUX jours. 39 résultats sur 1 825 franchissent deux jours ou
     * plus. La plateforme le savait : la réserve R3 écrivait « L’art. 991 al. 3 proroge “d’un
     * jour”. […] La lettre ne le dit pas. » — mais cela vivait dans un commentaire de source et
     * un test unitaire, qui ne sont pas une documentation pour la personne qui lit la date.
     *
     * ⚠️ **R3 A ÉTÉ RETIRÉE LE 20 AOÛT 2026 (SOIR) : Me Vaval a répondu OUI à la cascade**, et
     * la règle vaut maintenant pour les deux surfaces. Cette ligne-ci n’en devient que plus
     * nécessaire : c’est le seul endroit où la personne qui lit la date apprend que le report
     * répété est une lecture de l’article, et non sa lettre.
     *
     * Rendue UNIQUEMENT quand le report a franchi plus d’un jour : sur un report d’un seul jour,
     * il n’y a pas de cascade, et la phrase serait du bruit sous une date que la personne a
     * demandée. C’est aussi l’endroit où loge, enfin visible, ce que `FONDEMENT_PROROGATION_
     * PUBLIQUE` (`franc-pur.ts`) énonçait sans qu’aucun écran ne le rende.
     */
    publicDeferredCascade:
      'L’art. 991 al. 3 proroge d’un jour ; la plateforme répète le report jusqu’au premier jour qui n’est ni un dimanche ni un jour chômé de son calendrier. Le samedi n’est pas un jour de report.',
    /**
     * ─── LA DATE DE L’AUTRE SURFACE (§ 0) ────────────────────────────────────────
     *
     * ⚠️ **DEUX ÉCRANS DE LA MÊME PLATEFORME RENDAIENT DEUX DATES, ET LE PUBLIC ÉTAIT TOUJOURS
     * LE PLUS TARDIF.** Mesuré sur les 1 826 départs de 2025 à 2029, à durée et régime
     * identiques, le MATIN du 20 août 2026 : 56 divergences sous le calendrier de la version 1,
     * 53 sous celui de la version 2, jamais dans l’autre sens. ⚠️ Chiffres HISTORIQUES : la
     * mesure du jour est **0 sous le calendrier courant, 16 sous celui de la version 1**, et
     * elle est faite par `franc-pur.test.ts` (§ 0), qui rougit quand elle change.
     *
     * ⚠️ **ME VAVAL A TRANCHÉ LE 20 AOÛT 2026 (SOIR), ET C’EST LE PORTAIL QUI A ÉTÉ ÉLARGI** :
     * les fêtes nationales prorogent, la prorogation cascade. Sous le calendrier courant, les
     * deux surfaces rendent la MÊME date — l’écart est de zéro, et cette ligne ne paraît plus.
     *
     * ⚠️ **ELLE RESTE POUR UN SEUL CAS, ET IL EST RÉEL** : un permalien `c=1` rejoue le
     * calendrier de la version 1, où quatre jours (Lundi Gras, 14 août, 20 septembre,
     * 1er novembre) n’étaient institués par aucun texte du corpus. Le portail les refuse alors
     * en tête d’affiche, la page publique les proroge, et la publique redevient la plus
     * tardive. « Une date juste, sans ses réserves, est plus dangereuse qu’une absence de
     * calculateur » (§ 0) : la page NOMME donc la date étroite au lieu de la taire.
     *
     * ⚠️ **LA PHRASE A CHANGÉ AVEC SON OBJET.** Elle disait « sous la lecture stricte de
     * l’art. 991 al. 3 — un seul jour de report » : c’était vrai tant que le portail prorogeait
     * d’un jour, et c’est faux depuis que la cascade est la règle des deux côtés. Ce que la
     * ligne oppose désormais, c’est un CALENDRIER, pas une lecture de l’article.
     */
    publicStrictReading:
      'Ce calcul rejoue le calendrier de la version 1, antérieur au décret du 11 décembre 2024 : sans les jours qu’aucun texte n’instituait alors, le délai expirait le {date}. C’est la date que rend le calculateur du portail, et la plus prudente des deux.',
    /**
     * ─── LA VERSION DES RÈGLES DE LECTURE (§ 4.6) ────────────────────────────────
     *
     * ⚠️ **AJOUTÉE LE 20 AOÛT 2026 (SOIR) — défaut 10 de la troisième recette.** L'argument (c)
     * de `regles-lecture.ts` justifie la coordonnée `rl` par le pied de page : « une date rendue
     * sous une règle périmée le dit ». C'était vrai du PORTAIL (`DelaiResult`, `footerRules`) et
     * faux de la surface publique, qui rend `DelaiDatePublique` — sans pied, sans permalien,
     * sans mention de version. Vérifié : `/fr/delais?d=2029-12-01&n=30&c=2&w=1&rl=1` affichait
     * « mardi 1er janvier 2030 » là où la règle courante donne « jeudi 3 janvier 2030 » — DEUX
     * jours d'écart, et pas un mot à l'écran.
     *
     * La ligne ne paraît QUE sur une version périmée : sous la version courante, un calcul n'a
     * rien à dire de sa règle. `lectureStricte` ne rattrapait rien — elle compare les deux
     * surfaces SOUS LA MÊME version de règles.
     */
    publicRulesVersion:
      'Ce calcul est rendu sous les règles de lecture version {version} ; la version en vigueur est la {courante}, et elle peut donner une autre date.',
    publicRulesVersionLink: 'Refaire le calcul avec la règle actuelle',

    // ─── Colonne de saisie (§ 6.2) ─────────────────────────────────────────────
    startLabelDefault: 'Point de départ du délai',
    // ⚠️ La phrase ÉNONÇAIT un ordre avant de dire qu'elle n'en énonçait pas : « Jour, mois,
    // année — l'ordre affiché suit votre navigateur. » Sur un poste dont le champ natif rend
    // `aaaa-mm-jj`, la première moitié — la seule que l'œil retient — nomme l'ordre INVERSE ;
    // sur un poste en anglais américain (`mm/dd/yyyy`), un troisième encore. Me Vaval a coupé
    // ce qui restait de l'énumération (20 août 2026) : ne pas la réintroduire — le champ est
    // natif, il montre déjà ses trois segments, et les NOMMER ne servait qu'à les ordonner.
    startFormatHint: 'Indiquer la date ; l’ordre affiché est celui de votre navigateur.',
    significationNote:
      'L’article 996 fait courir les délais des recours de la signification. La Cour de cassation a écarté la réception effective des pièces (9 juillet 1963) au profit de la signification au Parquet (20 février 1963) — 1re Sect. n° 13, 28 mars 1966.',
    codeLabel: 'Code',
    codeCPC: 'Procédure civile',
    codeTRAVAIL: 'Travail',
    codeCIVIL: 'Civil',
    entryLabel: 'Entrée du répertoire',
    // ⚠️ `entryPlaceholder` (« Choisissez un article… ») a été RETIRÉ le 20 août 2026 : la
    // saisie manuelle est désormais la PREMIÈRE option du menu et sa valeur par défaut
    // (`entryOther`), et une option vide au-dessus d’elle la reléguait au second rang tout en
    // faisant du menu un champ « non renseigné » de plus à réclamer.
    entryFilterLabel: 'Filtrer la liste',
    entryFilterPlaceholder: 'Numéro d’article ou mot de l’objet…',
    entryGroupTableau: 'Tableau {n}',
    entryNotCalculable: 'Ne produit pas de date',
    entryResultsCount: '{n} entrées',
    regimeLabel: 'Régime',
    regimeFranc: 'Délai franc',
    regimeOrdinaire: 'Délai ordinaire',
    regimeIncertain: 'Régime incertain — voir la lecture nommée',
    regimeAVerifier: 'Régime à vérifier — la rédaction n’a pas qualifié ce délai',
    prorogationLabel: 'Prorogation',
    kmLabel: 'Kilométrage',
    kmLabelFirst: 'Premier kilométrage',
    kmLabelSecond: 'Second kilométrage',
    kmHint: 'Distance en kilomètres, nombre entier.',
    kmYouEnter: 'Vous la saisissez ; la plateforme ne la calcule pas.',
    supplementLegend: 'Question de suite',
    otherLegend: 'Autre délai (lu dans un document)',
    otherDaysLabel: 'Nombre de jours',
    otherSourceLabel: 'Nature du délai',
    otherSourceHint: 'Reproduite dans le résultat et à l’impression.',

    /**
     * ─── LE COMMUTATEUR DE DÉCOMPTE (Me Vaval, 20 août 2026) ────────────────────
     *
     * ⚠️ **Il remplace la question « Ce délai est-il franc ? » et ses TROIS réponses**
     * (`otherFrancLabel`, `otherFrancYes`, `otherFrancNo`, `otherFrancUnknown`,
     * `otherFrancUnknownNote`, retirées des trois langues). Ce n’est pas le même acte : on ne
     * demande plus à l’utilisatrice de QUALIFIER son délai — une question de droit qu’elle
     * peut ne pas savoir trancher —, on lui demande COMMENT elle veut qu’on compte. D’où deux
     * positions et non trois : « je ne sais pas » n’est pas une réponse à « que voulez-vous ? ».
     *
     * ⚠️ **Chaque position porte son libellé ET sa règle**, et l’état est marqué par le bouton
     * radio natif : la charte interdit qu’une couleur dise seule l’état (Wouj et Vèt sont à
     * 1,05:1). Retirez toute la couleur de ce bloc, il dit exactement la même chose.
     *
     * ⚠️ **Aucune position n’est cochée d’avance.** Un jour d’écart, et le recours est forclos :
     * la plateforme ne choisit pas à la place de l’utilisatrice. La ligne « Il manque : » le dit.
     */
    countingLegend: 'Comment compter les jours ?',
    countingClear: 'Jours francs',
    countingClearRule:
      'Ni le jour de départ ni le jour de l’échéance ne comptent : départ + nombre de jours + 1.',
    countingCalendar: 'Jours calendaires',
    countingCalendarRule:
      'Le jour de départ ne compte pas, le jour de l’échéance compte : départ + nombre de jours.',
    /**
     * Un permalien d’avant le commutateur porte `f=ne-sais-pas`. Il se REJOUE à l’identique —
     * c’est la règle du § 6.3 —, mais le commutateur n’a alors aucune position : on l’écrit,
     * plutôt que d’afficher un commutateur muet ou de trancher rétroactivement.
     */
    countingLegacyUnknown:
      'Ce calcul a été fait sous l’ancienne réponse « Je ne sais pas » : les deux décomptes sont rendus côte à côte, le plus précoce en tête. Choisissez une position pour recalculer.',
    /**
     * § 4.7 — sur une entrée du répertoire, le décompte VIENT DU TEXTE. Le commutateur n’est
     * pas seulement caché : le champ n’est pas rendu, et le serveur refuse un `f` fabriqué à
     * la main (`errRegimeImpose`). La phrase dit pourquoi il n’y a rien à choisir.
     */
    countingFixedByText:
      'Sur une entrée du répertoire, le décompte n’est pas un choix : il vient du texte (art. 987 C. pr. civ., art. 511 C. trav., ou droit commun).',
    submit: 'Calculer',
    submitMissingPrefix: 'Il manque :',
    reset: 'Effacer',

    // ─── Résultat (§ 6.3) — tout déplié, rien de repliable ─────────────────────
    resultTitle: 'Date limite',
    stepsTitle: 'Le raisonnement, pas à pas',
    skippedTitle: 'Jours écartés',
    skippedDate: 'Jour',
    skippedReason: 'Motif',
    skippedSource: 'Source',
    readingsTitle: 'Lectures concurrentes du texte',
    readingsDate: 'Date',
    readingsBasis: 'Fondement',
    widestReading: 'Lecture la plus large',
    warningsTitle: 'Avertissements',
    textsTitle: 'Textes appliqués',
    practicableTitle: 'Dernier jour où l’acte peut matériellement être fait',
    windowsTitle: 'Fenêtres de signification',
    windowsNullity: 'Sanction : nullité',
    footerCalendar: 'Calendrier des fêtes : version {n}',
    /**
     * § 4.6 — **CE QUE LA DATE DOIT À UNE LECTURE, ET NON AU SEUL CALENDRIER.** Les règles de
     * lecture (les fêtes nationales prorogent-elles ? la prorogation cascade-t-elle ?) ont
     * changé le 20 août 2026 : elles sont donc versionnées et portées par le permalien, et le
     * pied de page les nomme — un calcul cité doit dire sous quelle règle il a été rendu.
     */
    footerRules: 'Règles de lecture : version {n}',
    footerWindows: 'Fenêtres de signification : version {n}',
    footerEntry: 'Entrée : {code} art. {article}, révision {r}',
    permalinkLabel: 'Lien permanent de ce calcul',
    copyReasoning: 'Copier le raisonnement',
    copied: 'Copié ✓',
    copyFallbackHint: 'Copie automatique refusée : sélectionnez le texte ci-dessous.',
    print: 'Imprimer',

    // ─── Refus et saisie incomplète (§ 4.4) ────────────────────────────────────
    refusalTitle: 'Cet article ne permet pas de calculer une date',
    refusalReason: 'Motif',
    incompleteTitle: 'Il manque une réponse pour calculer',
    incompleteMissing: 'Ce qui manque',

    // ─── Erreurs, avec leur libellé écrit ─────────────────────────────────────
    errDateImpossible: 'Cette date n’existe pas. Vérifiez le jour et le mois.',
    errBeforeBound:
      'La liste des fêtes légales applicable avant le 22 juin 1989 n’est pas établie dans ce corpus : le calculateur ne sert pas les dossiers antérieurs à cette date.',
    errFarFuture:
      'Cette date est à plus de dix ans : vérifiez l’année. Le calcul reste possible.',
    errKilometrage: 'Le kilométrage doit être un nombre entier de kilomètres, positif.',
    errUnknownEntry: 'Cette entrée du répertoire n’existe pas.',
    errUnknownRevision:
      'Cette révision de l’entrée n’existe pas. Le lien a peut-être été modifié à la main.',
    errUnknownCalendar: 'Cette version du calendrier des fêtes n’existe pas.',
    /**
     * § 4.6 — la version des RÈGLES DE LECTURE (`rl`), refusée comme celle du calendrier :
     * une version inconnue ne se rabat JAMAIS sur celle du jour, sinon l’adresse promettrait
     * une date et en rendrait une autre.
     */
    errUnknownRules: 'Cette version des règles de lecture n’existe pas.',
    errUnknownWindows: 'Cette version des fenêtres de signification n’existe pas.',
    errOtherIncomplete:
      'Un délai « autre » demande trois choses : le nombre de jours, la nature du délai, et le mode de décompte — jours francs ou jours calendaires.',
    /**
     * ⚠️ « Rends-le impossible, pas seulement caché » (Me Vaval). `?e=cpc-354-…&f=non` était
     * ACCEPTÉ et le paramètre abandonné en silence : l’adresse portait un mode de décompte que
     * le calcul n’avait pas appliqué. Refus explicite, comme pour `src` en public et pour un
     * kilométrage surnuméraire.
     */
    errRegimeImpose:
      'Le mode de décompte ne se choisit pas sur une entrée du répertoire : il vient du texte. Retirez ce paramètre de l’adresse, ou choisissez « Autre — saisir le nombre de jours ».',
    errRate: 'Trop de calculs en peu de temps — patientez quelques instants.',
    errNotReady:
      'Le calculateur de délais n’est pas encore ouvert : son répertoire n’a pas été versé en base.',
    errRepertoireReserve:
      'Le répertoire des délais est réservé aux titulaires d’un compte. Sur cette page, le calcul se fait sur un nombre de jours francs saisi.',
    errFrancSeulement:
      'Cette page ne calcule que des délais francs. Un délai ordinaire se calcule depuis le répertoire, dans l’espace connecté.',

    // ─── Bandeaux d’un permalien rouvert (§ 7.3) ──────────────────────────────
    bannerRuleChangedTitle: 'La règle a changé depuis ce calcul.',
    bannerRuleChangedBody:
      'L’entrée art. {article} est passée de la révision {de} à la révision {vers} le {date}. Ce résultat est celui de la règle en vigueur au moment du calcul.',
    bannerRecompute: 'Refaire le calcul avec la règle actuelle',
    bannerWithdrawnTitle: 'Cette entrée a été retirée du répertoire le {date}.',
    bannerWithdrawnReason: 'Motif : {motif}',
    bannerWithdrawnKept:
      'Ce calcul est conservé tel qu’il a été rendu ; la plateforme ne propose plus cette entrée.',

    // ─── Renvois au corpus ────────────────────────────────────────────────────
    searchCorpus: 'Rechercher « {q} » dans le corpus',
    searchCorpusLoginRequired: 'Rechercher dans le corpus (connexion requise)',
    openCode: 'Ouvrir le texte du Code',

    // ─── État vide (§ 6.2) ────────────────────────────────────────────────────
    emptyTitle: 'Comment ce calculateur compte',
    emptyGermeilTitle: 'Exemple travaillé — Cass. 1re Sect. n° 45, 7 juillet 1965 (Germeil)',
    emptyGermeilBody:
      'Signification le jeudi 17 mai 1962, 30 jours francs, 267 km de distance : 267 ÷ 40 = 6 jours (le reste de 27 km, inférieur à 30, n’est pas compté). Dernier jour utile : le samedi 23 juin 1962 — un samedi, qui n’est pas prorogé.',
    emptyGermeilHistorical:
      'Exemple historique : la borne du calculateur interdit de le rejouer dans l’outil.',

    // ─── Ajouts des surfaces visibles (§ 6.2, § 6.3) ──────────────────────────
    /** Le Sitwon atteste la SOURCE d'une fête, jamais la date calculée (§ 8.1). */
    sourceVerified: 'Source vérifiée',
    /** Les entrées `autorite: REDACTION` — la mention est ÉCRITE, jamais une couleur (A4). */
    sourceNoText: 'Sans source textuelle',
    skippedNone: 'Aucun jour écarté.',
    readingsNone: 'Aucune lecture concurrente ne donne une date différente.',
    certaintySure: 'interdiction certaine',
    certaintyConditional: 'interdiction conditionnelle',
    entryDurationLabel: 'Durée telle qu’écrite',
    entryStartLabel: 'Point de départ',
    entrySanctionLabel: 'Sanction',
    entryOther: 'Autre — saisir le nombre de jours',
    entryFilterNone: 'Aucune entrée ne correspond à ce filtre.',
    windowsCivil: 'Matière civile',
    windowsWork: 'Matière du travail',
    windowsHours: 'de {a} h à {b} h',
    errWithdrawn:
      'Cette entrée a été retirée du répertoire : la plateforme ne la propose plus pour un nouveau calcul.',
    errInvalid: 'Cette demande n’est pas lisible. Reprenez la saisie ci-contre.',
    errUnreadable:
      'Une donnée du calculateur n’a pas pu être relue. Le calcul est refusé plutôt qu’approximé ; signalez-le à la rédaction.',
    toolsTitle: 'Outils',
    /**
     * Le sous-titre de la TUILE du tableau de bord connecté. Anciennement `heroSubtitle` : la
     * phrase servait aux deux endroits, et Me Vaval a retiré le sous-titre du HÉROS le 20 août
     * 2026. La clé est renommée pour ne plus nommer une surface qu’elle ne sert plus ; le
     * texte, lui, est inchangé — la tuile n’était pas dans la demande.
     */
    toolsSubtitle:
      'La date de réception de l’acte, le nombre de jours francs qu’il indique — et le raisonnement qui fonde la date.',
  },
  brand: { baseline: BRAND.baseline.fr },
  nav: {
    features: 'Fonctionnalités',
    pricing: 'Tarifs',
    about: 'À propos',
    createAccount: 'Créer un compte',
    login: 'Connexion',
    logout: 'Déconnexion',
    dashboard: 'Tableau de bord',
    search: 'Recherche',
    admin: 'Master Admin',
    edition: 'Espace d’édition',
    account: 'Mon compte',
  },
  home: {
    title: "Le savoir juridique d'Haïti, rendu clair.",
    subtitle:
      'Recherchez la législation, les circulaires BRH, la jurisprudence, la doctrine, les lois de finances et les marques — sourcées au Moniteur.',
    signinTitle: 'Connexion sécurisée',
    signinSubtitle: 'Accès activé par votre administrateur',
    emailLabel: 'Adresse courriel / Email',
    passwordLabel: 'Mot de passe / Password',
    signinBtn: 'Se connecter',
    forgot: 'Mot de passe oublié ?',
    lostEmail: "Vous n'êtes pas sûre de l'adresse utilisée à l'inscription ? Passez par « Mot de passe oublié » : si un compte existe, un message part vers l'adresse exacte enregistrée.",
    cardNote:
      "Le bouton « Créer un compte » mène à une demande d'accès — le compte reste en attente d'activation par le master admin.",
  },
  verify: {
    title: 'Double authentification',
    instruction: 'Entrez le code à 6 chiffres envoyé sur votre appareil.',
    // « Alt » = seconde ligne dans l'AUTRE langue principale (EN ici, FR dans le dico EN).
    instructionAlt: 'Enter the 6-digit code sent to your device.',
    trust: 'Se souvenir de cet appareil pendant 30 jours',
    trustAlt: 'Trust this device for 30 days',
    validate: "Valider l'accès",
    sensitiveNote: 'La fenêtre de 30 jours est indisponible pour Éditeur et Master Admin.',
    j3: 'Votre appareil de confiance expire dans 3 jours',
  },
  register: {
    title: 'Demander un accès',
    subtitle: "Votre compte sera créé en attente — un master admin l'activera et vous attribuera votre type d'accès.",
    name: 'Nom complet',
    org: 'Organisation (optionnel)',
    submit: 'Envoyer la demande',
    done: "Demande reçue. Vous recevrez un e-mail de bienvenue dès l'activation de votre compte.",
  },
  dashboard: {
    omnibox: 'Recherchez une loi, une circulaire, une société, une marque…',
    quickAccess: 'Accès rapides',
    recent: 'Recherches récentes',
    favorites: 'Favoris',
    empty: 'Rien pour le moment',
    greeting: 'Bonjour',
    whatsNew: 'Nouveauté',
    whatsNewSub: 'Données importées ces 15 derniers jours',
    newEntries: 'nouvelles entrées',
    reorderHint: 'Glisser pour réorganiser (ou flèches du clavier)',
    reorderTip: 'Glissez la poignée ⠿ pour réorganiser',
    reorderMoved: 'déplacé',
    reorderPosition: 'position',
    reorderOf: 'sur',
    reorderSaveError: "Échec de l'enregistrement — ordre rétabli",
    viewAll: 'Voir tout',
  },
  search: {
    placeholder: 'Rechercher…',
    resultsFor: 'Résultats pour',
    results: 'résultats',
    noResults: 'Aucun résultat',
    filters: 'Filtres',
    allTypes: 'Tous les types',
    type: 'Type',
    status: 'Statut',
    juridiction: 'Juridiction',
    matiere: 'Matière',
    fiscalYear: 'Exercice fiscal',
    niceClass: 'Classe de Nice',
    companies: 'Sociétés',
    open: 'Ouvrir',
    translingualNote: 'Recherche translingue : une requête EN retrouve les documents FR.',
    indexOnlyBadge: 'Index du Moniteur — accès restreint',
    publications: 'publications',
    fuzzyTag: 'orthographe proche',
    abrogatedBy: 'abrogée par',
    fuzzySection: 'Résultats approchants — orthographe proche',
    categoryLabel: 'Catégorie',
    numberLabel: 'Numéro',
    numberPh: 'ex. 114',
    queryLabel: 'Mots recherchés',
    queryPh: 'ex. loyer, Port-au-Prince',
    queryLabelIndex: 'Nom ou intitulé',
    queryPhIndex: 'ex. SOGEBANK, expropriation, Delmas',
    numberGo: 'Chercher',
    yearLabel: 'Année',
    noDateLabel: 'Sans date',
    sigYearLabel: 'Signée en',
    effYearLabel: 'Entrée en vigueur',
    sortLabel: 'Trier',
    sortSig: 'Date de signature',
    sortPub: 'Date de publication',
    sortEff: 'Entrée en vigueur',
    sortNumAsc: 'N° croissant',
    sortNumDesc: 'N° décroissant',
    sortRecent: 'Nouveautés',
    partiesLabel: 'Parties / intitulé',
    partiesPh: 'ex. CESAR LALANNE',
    domaineLabel: 'Domaine du droit',
    domainePh: 'ex. procédure civile',
    judgeLabel: 'Magistrat',
    judgePh: 'ex. Rousseau',
    mpLabel: 'Ministère public',
    mpPh: 'ex. Amisial',
    judgeDecisions: 'Décisions',
    judgePresided: 'Présidées',
    judgeSat: 'A siégé',
    judgeMp: 'Ministère public',
    judgeGreffe: 'Greffe',
    judgeAllOf: 'Toutes les décisions de ce magistrat',
    judgeNone: 'Aucune décision rattachée à ce magistrat.',
    judgeSpellings: 'Graphies relevées dans le recueil',
    judgeNotFound: 'Ce magistrat n’existe pas ou plus.',
    quotaLow: 'Quota de recherches bientôt épuisé',
    advanced: 'Recherche avancée',
    section: 'Section',
    period: 'Période',
    yearFrom: 'De l’année',
    yearTo: 'à l’année',
    apply: 'Rechercher',
    reset: 'Réinitialiser',
    clearField: 'Effacer',
    indexCategories: {
      LOI: 'Lois',
      DECRET: 'Décrets',
      ARRETE: 'Arrêtés',
      AVIS: 'Avis',
      SOCIETE: 'Sociétés',
      MARQUE: 'Marques',
      CIRCULAIRE: 'Circulaires',
      AUTRE: 'Autres',
    },
  },
  doc: {
    officialText: 'Texte officiel',
    unofficialNote:
      "Les versions anglaise et kreyòl de l'interface et des résumés sont fournies à titre informatif : elles sont NON OFFICIELLES et n'ont aucune valeur juridique. Seul le texte officiel en français fait foi.",
    editorialSummary: 'Résumé éditorial',
    means: 'Sa sa vle di / What it means',
    editorial: 'Éditorial',
    versions: 'Versions & historique',
    citations: 'Citations croisées',
    publications: 'Publications de la société',
    addFavorite: 'Ajouter aux favoris',
    removeFavorite: 'Retirer des favoris',
    export: 'Exporter le PDF scellé',
    source: 'PDF source',
    downloadPdf: 'Télécharger le PDF',
    cite: 'Citer',
    copied: 'Copié',
    print: 'Imprimer',
    citeArticle: 'Citer l’article',
    copyArticle: 'Copier l’article',
    otherService: 'Document d’un autre service',
    scannedEditionSearchable: 'Ce document est un fascicule scanné du journal officiel « Le Moniteur ». Son texte intégral est indexé et se retrouve par la recherche ; il n’est pas reproduit ici — la transcription automatique du microfilm sert à trouver, non à citer. Seul le fac-similé fait foi.',
    scannedEditionTranscribed: 'Transcription automatique du fascicule scanné, reproduite telle quelle : l’océrisation d’un microfilm laisse des coquilles. Elle sert à lire et à chercher — pour citer, se reporter au fac-similé, qui seul fait foi.',
    transcriptionHeading: 'Transcription du fascicule',
    scannedEdition: 'Ce document est un fascicule scanné du journal officiel « Le Moniteur ». Le texte intégral n’est pas encore océrisé — consultez le PDF original.',
    openPdf: 'Consulter le fascicule (PDF)',
    pdfNotIncluded: 'La consultation du PDF n’est pas incluse dans votre offre.',
    annexes: 'Télécharger les annexes',
    annexesHint: 'Formulaires et tableaux à compléter — filigrane Lam, à vérifier avant usage.',
    moniteur: 'Publié au',
    adopted: 'Adopté le',
    published: 'Publié le',
    anneeLabel: 'Année',
    dgLabel: 'Directeur général',
    abrogatedBanner: 'Ce texte est abrogé. Consultez la version en vigueur.',
    abrogatedByPrefix: 'Ce texte est abrogé par la',
    keywords: 'Mots-clés',
    verified: 'Dokiman verifye',
    indexNote:
      "Entrée de l'Index du Moniteur. Référence de publication ; le texte intégral n'est pas disponible dans cette fiche. Consultez les services à texte intégral pour les versions complètes.",
  },
  legal: {
    back: 'Retour à l’accueil',
    toc: 'Sommaire',
    updated: 'Dernière mise à jour',
    frenchNote: 'Document de référence en français. En cas de traduction, seule la version française fait foi.',
    cgu: 'Conditions Générales d’Utilisation',
    confidentialite: 'Politique de confidentialité',
    mentions: 'Mentions légales',
  },
  paywall: {
    extractOnly: 'Vous lisez un extrait.',
    upgrade: 'Passez au palier Pwofesyonèl pour la lecture intégrale, l’export scellé et les alertes.',
    cta: 'Voir les tarifs',
    companyLocked: "L'index des sociétés et l'antériorité des marques sont réservés aux paliers Pro et Institution.",
  },
  admin: {
    title: 'Master Admin',
    overview: "Vue d'ensemble",
    users: 'Utilisateurs',
    upload: 'Téléverser documents',
    ocr: 'Pipeline OCR',
    logs: 'Logs de sécurité',
    kpiUsers: 'Inscrits',
    kpiSearches: "Recherches aujourd'hui",
    kpiScraping: 'Alertes scraping',
    kpiPending: 'Demandes en attente',
    pendingOldest: 'la plus ancienne remonte à {n} jours',
    pendingNone: 'aucune demande à traiter',
    pending: 'Comptes en attente',
    requestedOn: 'Demandé le',
    typeToAssign: 'Type à attribuer',
    action: 'Action',
    activate: 'Activer',
    reject: 'Rejeter',
    suspend: 'Suspendre',
    reactivate: 'Réactiver',
    changeType: 'Changer de type',
    reset2fa: 'Réinitialiser 2FA',
    services: 'Services',
    indexAlwaysOn: 'Index du Moniteur (toujours actif)',
    sourcePdfPerm: 'PDF original',
    staffAllServices: 'Compte interne — accès à tous les services et au PDF original.',
    save: 'Enregistrer',
    history: 'Historique',
    activateNote:
      "L'activation déclenche l'e-mail de bienvenue bilingue + l'enrôlement 2FA obligatoire à la première connexion.",
    allUsers: 'Tous les comptes',
    status: 'Statut',
    role: 'Type',
    noLogs: 'Aucun événement',
    logDate: 'Date',
    logAction: 'Action',
    logActor: 'Acteur',
    logIp: 'IP',
    createAccount: 'Créer un compte',
    emailField: 'Adresse courriel',
    nameField: 'Nom',
    orgField: 'Organisation (optionnel)',
    create: 'Créer le compte',
    tempPasswordNote: 'Mot de passe temporaire — à communiquer une seule fois :',
    copied: 'Copié',
    promoNav: 'Codes promo',
    moniteurNav: 'Le Moniteur',
    indexMoniteurNav: 'Index du Moniteur',
    marquesNav: 'Marques',
    brhNav: 'Circulaires BRH',
    tarifsNav: 'Tarifs douaniers',
    juridictionsNav: 'Carte judiciaire',
    themesNav: 'Législation annotée : thèmes',
    applyPromo: 'Appliquer un code',
  },
  tarifs: {
    title: 'Tarifs douaniers',
    subtitle: 'Positions tarifaires (Système Harmonisé) et taux applicables — droit de douane, TCA, accises.',
    searchPlaceholder: 'Code SH ou désignation du produit…',
    results: 'positions',
    shownMax: 'affichées',
    empty: 'Aucune position tarifaire pour cette recherche.',
    emptyAll: 'La table des tarifs est vide pour le moment.',
    thCode: 'Code SH',
    thDesignation: 'Désignation',
    thUnite: 'Unité',
    thDd: 'Droit de douane',
    thTca: 'TCA',
    thAccises: 'Accises',
    thNote: 'Note',
    docsTitle: 'Documents douaniers',
    docsSub: 'Tarif AGD, décrets et circulaires des douanes.',
    docsLink: 'Voir les documents',
    updatedAt: 'Mis à jour le',
    leviesTitle: 'Prélèvements connexes',
    leviesSub: 'Charges perçues à l’importation qui s’ajoutent au droit de douane — liquidées EN CASCADE (bordereau de douane). Ouvrez la calculatrice d’une position pour le détail chiffré.',
    thLevy: 'Prélèvement',
    thRate: 'Taux / montant',
    thBase: 'Base',
    thRef: 'Référence',
    thScope: 'Champ d’application',
    leviesScopeAll: 'Toutes marchandises',
    chaptersTitle: 'Parcourir par chapitre (Système Harmonisé)',
    allChapters: 'Tous les chapitres',
    chapterPrefix: 'Chapitre',
    loadMore: 'Charger 100 de plus',
    loadingTxt: 'Recherche…',
    rateLimited: 'Trop de requêtes — patientez quelques secondes puis réessayez.',
    copyCode: 'Copier le code',
    copied: 'Copié',
    tcaNote: 'TCA : 10 % sur toutes les positions (sauf exonérations).',
    ddUnknown: 'Droit de douane non renseigné',
    moreHint: 'Affinez la recherche ou choisissez un chapitre.',
    calc: 'Estimer',
    calcTitle: 'Estimation des droits et taxes à l’import',
    cifValue: 'Valeur CIF (HTG)',
    quantity: 'Quantité',
    calcValeurDouane: 'Valeur en douane (HTG)',
    calcDd: 'DD — Droit de douane',
    calcDaa: 'DAA — Droit d’accise ad valorem',
    calcFv: 'FV — Frais de vérification (6 %)',
    calcTca: 'TCA — Taxe sur le chiffre d’affaires (10 %)',
    calcTt: 'TT — Taxe touristique (10 %)',
    calcCfgdct: 'CFGDCT — Contribution au Fonds de gestion et de développement des collectivités territoriales (2 %)',
    calcDs: 'DS — Droits spéciaux (2 %)',
    calcTpi: 'TPI — Taxe de première immatriculation (20 %)',
    calcTpe: 'TPE — Taxe de protection de l’environnement (25 %)',
    calcVehicle: 'Véhicule (chapitre 87)',
    calcVehicleAuto: '(détecté automatiquement)',
    calcVehicleOld: 'Véhicule de plus de 7 ans',
    calcVehicleOldHint: '(par défaut — décocher si récent)',
    calcVariable: 'taux variable',
    calcVariableNote: 'Droit de douane à taux variable : tous les montants sont donnés en fourchette (borne basse – borne haute).',
    calcDaaSpecific: 'DAA — Droit d’accise spécifique',
    calcTotalExAccise: 'Total hors accise — saisir la quantité pour l’inclure.',
    calcTotal: 'Total droits et taxes',
    calcRinfo: 'Redevance informatique (1 %)',
    calcBordereau: 'Total du bordereau',
    calcGrand: 'Coût de revient (valeur en douane + bordereau)',
    calcDisclaimer: 'Estimation indicative — liquidation EN CASCADE, comme le bordereau de douane : la TCA porte sur CIF + DD + FV (+ accise) ; le CFGDCT et les Droits spéciaux sur la somme des droits et taxes en amont ; puis la redevance informatique (1 %). Hors droit de conteneur et frais portuaires ; à confirmer auprès de l’AGD / DGI.',
    calcSituational: 'Charges situationnelles : la TPI et la taxe environnementale (TPE) ne s’appliquent qu’aux véhicules (TPE : plus de 7 ans). Vérifiez que chaque taxe s’applique bien à votre marchandise.',
    close: 'Fermer',
    adminTitle: 'Tarifs douaniers — édition',
    adminSub: 'Ajouter, modifier ou supprimer les positions tarifaires (table dynamique).',
    add: 'Ajouter une position',
    edit: 'Modifier',
    del: 'Supprimer',
    save: 'Enregistrer',
    cancel: 'Annuler',
    confirmDel: 'Supprimer cette position tarifaire ?',
    saved: 'Enregistré',
  },
  codeIndex: {
    title: 'Index thématique (IA)',
    sub: 'Naviguez le Code par thème ; thèmes proches et renvois entre articles suggérés par l’IA.',
    searchPlaceholder: 'Rechercher un thème ou un sujet…',
    allThemes: 'Tous les thèmes',
    relatedThemes: 'Thèmes proches',
    related: 'Liés',
    articles: 'articles',
    noResult: 'Aucun thème ni article pour cette recherche.',
    articleLabel: 'Article',
  },
  moniteur: {
    title: 'Le Moniteur — éditions par année',
    subtitle: 'Liste complète des éditions régulières et spéciales, avec numéro et date de publication.',
    year: 'Année',
    show: 'Afficher',
    regular: 'Éditions régulières',
    special: 'Éditions spéciales',
    regularOne: 'Régulière',
    specialOne: 'Numéro spécial',
    indexedEntries: 'Publications indexées',
    reference: 'Référence',
    pubDate: 'Date de publication',
    entries: 'Publications',
    none: 'Aucune édition pour cette année',
    missing: 'Numéros manquants',
    missingNone: 'Aucun numéro manquant détecté pour cette année.',
    missingHint: 'Numéros sautés (125 → 127 ⇒ 126) et lettres sautées (125-a, 125-c ⇒ 125-b), détectés par séquence régulière/spéciale.',
    fasciculesMissing: 'Fascicules PDF manquants',
    fasciculesHint: 'Éditions connues (référencées dans l\'Index) dont le PDF scanné n\'a pas encore été importé — à retrouver pour compléter l\'année.',
    fasciculesComplete: 'Tous les fascicules connus de cette année ont été importés.',
    missingAllTitle: 'Numéros manquants — toutes les années',
    missingLink: 'Liste complète des manquants',
    missingCsv: 'Exporter CSV',
    missingTotal: 'numéros manquants au total',
    reasonNumero: 'numéro sauté',
    reasonSuffixe: 'lettre sautée',
  },
  brh: {
    title: 'Circulaires BRH',
    subtitle:
      "Circulaires et Lettres-Circulaires de la Banque de la République d'Haïti, avec détection des numéros manquants sur chaque série.",
    serieCirculaires: 'Circulaires',
    serieLettres: 'Lettres-Circulaires',
    total: 'Documents indexés',
    distinct: 'Numéros distincts',
    range: 'Plage couverte',
    missing: 'Numéros manquants',
    missingNone: 'Aucun numéro manquant détecté.',
    missingHint:
      "Trous internes des numéros de base (110 → 114 ⇒ 111, 112, 113 manquantes) et révisions sautées dans chaque sous-série N-M (115-2 et 115-5 ⇒ 115-1, 115-3, 115-4) ; des révisions sans le document d'origine signalent l'originale absente. Plusieurs versions d'une même référence (notes additionnelles) sont tolérées.",
    reasonNumero: 'numéro sauté',
    reasonRevision: 'révision sautée',
    reasonOriginale: 'version originale absente (seules des révisions sont présentes)',
    unusable: 'Documents non exploitables',
    unusableHint:
      "Documents numérisés sans couche texte exploitable : le texte intégral n'est pas disponible ni cherchable. Re-téléverser une version OCR via le studio (bouton « Reconnaître le texte »), ou remplacer le PDF source et relancer l'import.",
    unusableNone: 'Tous les documents ont une couche texte exploitable.',
    missingCsv: 'Exporter CSV',
    number: 'Numéro',
    pubDate: 'Date de publication',
    effDate: 'Entrée en vigueur',
    matiere: 'Matière',
    titleCol: 'Titre',
    none: 'Aucune circulaire',
    list: 'Toutes les circulaires',
    byNumber: 'Par numéro',
    byYear: 'Par année',
    noDate: 'Sans date',
    countSuffix: 'circulaires',
  },
  company: {
    kinds: {
      STATUTS: 'Statuts',
      MODIF_CAPITAL: 'Modification de capital',
      DISSOLUTION: 'Dissolution',
      MARQUE: 'Marque déposée',
      AUTRE: 'Publication',
    },
    capital: 'Capital',
    address: 'Adresse',
  },
  account: {
    capabilitiesTitle: 'Capacités de votre palier',
    searchesRemaining: 'recherches restantes ce mois-ci',
    caps: {
      'search.basic': 'Recherche',
      'read.full': 'Lecture intégrale des 6 types',
      'index.companies': 'Index sociétés & antériorité marques',
      'export.sealed': 'Export PDF scellé + citations',
      alerts: 'Alertes de veille',
      'multiuser.api': 'Multi-utilisateurs / API',
      'upload.publish': 'Téléverser / OCR / publier',
      'corpus.manage': 'Curer le corpus (éditions, index, marques, BRH, tarifs, thèmes)',
      'admin.accounts': 'Administration des comptes',
    },
    grants: {
      yes: 'Oui',
      no: 'Non',
      extracts: 'Extraits',
      read: 'Lecture',
      sectoral: 'Oui + sectorielles',
      own: 'Ses sièges',
    },
  },
  promo: {
    title: 'Codes promo',
    subtitle: 'Octroyez un palier payant gratuitement, pour une durée donnée.',
    create: 'Générer un code',
    code: 'Code',
    codeAuto: 'Laisser vide = code généré',
    label: 'Libellé (interne)',
    grants: 'Palier octroyé',
    duration: 'Durée',
    days: 'jours',
    permanent: 'Permanent',
    maxUses: 'Utilisations max',
    unlimited: 'Illimité',
    expires: 'Expire le',
    redeemedCount: 'Utilisé',
    none: 'Aucun code promo',
    assignTitle: 'Attribuer à un compte',
    assignTo: 'Compte',
    assign: 'Attribuer',
    assignDone: 'Code appliqué au compte.',
    active: 'Actif',
    inactive: 'Inactif',
    discountNote: 'Remise',
    redeemTitle: 'Activer un code promo',
    redeemPlaceholder: 'Saisissez votre code',
    redeem: 'Activer',
    redeemSuccess: 'Code activé. Votre palier a été mis à jour.',
    planExpires: 'Palier promo — expire le',
    errors: {
      unknown: 'Code inconnu.',
      inactive: 'Code désactivé.',
      expired: 'Code expiré.',
      exhausted: 'Code épuisé.',
      assigned: 'Code réservé à un autre compte.',
      already: 'Code déjà utilisé par ce compte.',
    },
  },
  cms: {
    title: 'Téléverser & publier',
    drop: 'Glissez un PDF ici, ou cliquez pour parcourir',
    typeRequired: 'Type de document (1–6)',
    ocrRun: 'Lancer l’OCR',
    validate: 'Texte de l’édition — corrigez l’orthographe au besoin',
    splitScreen: 'PDF source à gauche, texte à droite — corrigez l’orthographe avant publication.',
    publish: 'Publier (apposer le sceau)',
    titleField: 'Titre éditorial (FR)',
    moniteurField: 'Référence Moniteur',
    note: 'Le PDF source reste la référence (vue comparée). L’analyse distingue intelligemment les titres des textes.',
    analyze: 'Analyser le document',
    analyzing: 'Analyse en cours…',
    analyzeFailed: "L'analyse a échoué — réessayez ou utilisez la publication manuelle.",
    aiBadge: 'Analyse par IA',
    heuristicBadge: 'Analyse heuristique — IA non configurée (ANTHROPIC_API_KEY)',
    aiFailed: "L'IA a échoué, résultat heuristique affiché.",
    noTextLayer: 'Pas de couche texte (scan) — lancez la reconnaissance (OCR) ou saisissez le texte.',
    ocr: 'Reconnaître le texte (OCR)',
    ocrBusy: 'Reconnaissance en cours…',
    ocrSuggest: 'Document numérisé — reconnaissance recommandée',
    ocrHint: "Transcription intégrale du PDF numérisé par IA, à relire et corriger avant publication.",
    ocrDone: 'Texte reconnu et inséré dans l’éditeur',
    ocrPages: 'pages',
    ocrTruncated: 'document tronqué — vérifiez la fin',
    ocrFailed: "La reconnaissance a échoué — réessayez ou saisissez le texte manuellement.",
    editionMeta: "Édition du Moniteur",
    editionTypeLabel: "Type d'édition",
    moniteurNumber: 'Numéro du Moniteur',
    anneeParution: 'Année de parution',
    directeurGeneral: 'Directeur général',
    issn: 'ISSN',
    societeBlock: 'Société (index)',
    societeDenom: 'Dénomination sociale',
    societeNif: 'NIF / immatriculation',
    societeCapital: 'Capital',
    societeNotaire: 'Notaire',
    societeOp: '— Opération —',
    opConstitution: 'Constitution',
    opModification: 'Modification',
    opDissolution: 'Dissolution',
    societeLinked: 'fiche(s) société liée(s)',
    societeCreated: 'fiche(s) société',
    extractedTitles: 'Titres des publications extraits',
    editHint: "Corrigez l'orthographe des titres, ajustez le type, décochez ce qu'il ne faut pas publier.",
    publishSelected: 'Publier la sélection',
    published: 'publication(s) publiée(s) avec le sceau',
    manualMode: 'Publication manuelle (un seul document)',
    needBody: "Le texte de l'édition est requis (panneau de droite).",
    needFields: 'Type, titre et texte sont requis.',
    publishFailed: 'Publication échouée.',
    gapsWarning: 'Numéros manquants détectés pour',
    modeMoniteur: 'Édition du Moniteur',
    modeCirculaire: 'Circulaire BRH',
    docKindLabel: 'Nature du document',
    detectedCirculaire: 'Circulaire BRH détectée',
    detectedMoniteur: 'Édition du Moniteur détectée',
    circulaireMeta: 'Circulaire BRH',
    circulaireNumber: 'Numéro de circulaire',
    circulaireTitle: 'Titre / objet',
    matiereField: 'Matière (optionnel)',
    publishCirculaire: 'Publier la circulaire (apposer le sceau)',
    needCircFields: 'Numéro, titre et texte sont requis.',
    brhGapsWarning: 'Numéros de circulaires BRH manquants détectés',
    keywordsField: 'Mots-clés thématiques',
    keywordsHint: 'Séparés par des virgules — pré-remplis par l’analyse, corrigez avant publication. Ils indexent le document par thèmes pour la recherche.',
  },
  roles: {
    SITWAYEN: 'Sitwayen (gratuit)',
    PWOFESYONEL: 'Pwofesyonèl',
    ENSTITISYON: 'Enstitisyon',
    EDITEUR: 'Éditeur',
    MASTER_ADMIN: 'Master Admin',
  },
  statuses: {
    EN_VIGUEUR: 'En vigueur',
    ABROGE: 'Abrogé',
    MODIFIE: 'Modifié',
    PUBLIE: 'Publié',
    PENDING: 'En attente',
    ACTIVE: 'Actif',
    SUSPENDED: 'Suspendu',
  },
  // Carrousel du héros (accueil public) — deux diapositives, deux destinations.
  hero: {
    legislation: {
      eyebrow: "République d'Haïti · Recherche juridique",
      title: 'Le droit haïtien au bout des doigts.',
      description: "Accédez aux lois, décrets, circulaires de la BRH et autres ressources de la bibliothèque juridique virtuelle d'Haïti.",
      cta: 'Accéder au portail juridique',
      note: 'Vous serez dirigé vers le portail de connexion.',
    },
    map: {
      eyebrow: "République d'Haïti · Carte des juridictions",
      title: 'Trouvez la juridiction compétente. Partout en Haïti.',
      description: 'Recherchez une ville ou cliquez sur la carte pour connaître les tribunaux compétents et le code postal de la zone.',
      cta: 'Explorer la carte judiciaire',
      titleLead: 'Trouvez la juridiction compétente. Partout en',
      titleAccent: 'Haïti.',
      openRecord: 'Consulter la fiche complète',
      featureFuzzy: 'Recherche tolérante aux fautes',
      featureByCommune: 'Résultats par commune',
      featureVerified: 'Données vérifiées',
      note: 'Cliquez pour commencer la recherche.',
    },
    carousel: {
      label: "Présentation de Lam",
      slideLegislation: 'Législation',
      slideMap: 'Carte judiciaire',
      prev: 'Diapositive précédente',
      next: 'Diapositive suivante',
      goTo: 'Aller à la diapositive',
    },
  },
  // Carte judiciaire publique (/juridictions).
  judicial: {
    metaTitle: "Carte judiciaire d'Haïti — Tribunaux et codes postaux | Lam",
    metaDescription: "Recherchez une commune d'Haïti pour identifier les tribunaux compétents, la cour d'appel, la Cour de cassation et les codes postaux associés.",
    breadcrumbHome: 'Accueil',
    breadcrumbHere: 'Carte judiciaire',
    title: 'Trouvez la juridiction compétente',
    intro: "Recherchez une ville, une commune ou un code postal pour connaître les tribunaux compétents et les codes postaux de la zone. Les données proviennent de sources officielles citées sur chaque fiche.",
    searchLabel: 'Rechercher une ville, une commune ou un code postal',
    searchPlaceholder: 'Ex. Port-au-Prince, Jacmel, Les Cayes…',
    noResults: 'Aucune commune trouvée.',
    resultsAnnounce: 'suggestions disponibles',
    filtersLabel: 'Couches judiciaires affichées',
    layerPaix: 'Tribunaux de paix',
    layerTpi: 'Première instance',
    layerAppel: "Cours d'appel",
    layerCassation: 'Cour de cassation',
    reset: 'Réinitialiser',
    mapUsage: "Cliquez sur une commune de la carte, ou choisissez-la dans la liste ci-dessous : les tribunaux compétents s'affichent aussitôt.",
    legend: 'Légende',
    attributionLabel: 'Données cartographiques',
    reportIssue: 'Signaler une erreur de carte',
    peace: 'Tribunal de paix',
    firstInstance: 'Tribunal de première instance',
    appeal: "Cour d'appel",
    cassation: 'Cour de cassation',
    nationalRecourse: 'Recours national',
    nationalRecourseNote: "La Cour de cassation connaît des pourvois pour tout le territoire ; ce n'est pas un tribunal local de la commune.",
    primaryPostalCode: 'Code postal principal',
    otherPostalZones: 'Autres zones postales',
    plusCode: 'Plus Code (Google)',
    plusCodeNote: 'repère distinct du code postal',
    indicativePosition: 'Position indicative dans la commune',
    boundaryUnconfirmed: 'Limite cartographique à confirmer',
    sources: 'Sources',
    lastVerified: 'Dernière vérification',
    commune: 'Commune',
    department: 'Département',
    arrondissement: 'Arrondissement',
    seatCity: 'Ville-siège',
    seat: 'Siège',
    competentTpi: 'TPI compétent',
    competentAppeal: "Cour d'appel compétente",
    statusLabel: 'Statut',
    address: 'Adresse',
    communeList: 'Liste complète des communes',
    mapFallback: "La carte interactive nécessite JavaScript. Toute l'information reste disponible dans la liste et les fiches ci-dessous.",
    loadingMap: 'Chargement de la carte…',
    selectPrompt: 'Aucune commune sélectionnée.',
    notFoundCommune: 'Commune introuvable. Utilisez la recherche ou la liste des communes.',
    disclaimer: "Information documentaire, non officielle : en cas de divergence, les publications officielles font foi. Les positions indicatives ne valent pas adresse du tribunal.",
    resultsRegion: 'Résultats et fiche de la commune',
    openInMaps: "Itinéraire (adresse vérifiée)",
  },
  // Back-office du calculateur de délais (§ 7) — trois verbes, trois comportements.
  delaisAdmin: {
    nav: 'Calculateur de délais',
    title: 'Calculateur de délais',
    subtitle:
      'Répertoire des délais, calendrier des fêtes et fenêtres de signification. Ajouter, masquer, supprimer : trois verbes, trois comportements.',
    tabRepertoire: 'Répertoire',
    tabCalendrier: 'Calendrier des fêtes',
    tabFenetres: 'Fenêtres de signification',
    schemaMissingTitle: 'Les tables du calculateur n’existent pas encore en base.',
    schemaMissingBody:
      'Le schéma est écrit (modèles DelaiEntry, DelaiEntryRevision, DelaiFerie, DelaiFenetreSignification) mais sa migration n’a pas été passée : c’est une décision humaine. Cet écran restera vide tant qu’elle ne l’aura pas été.',
    neverWritten: 'Aucune écriture n’a été tentée.',

    // Répertoire
    repertoireTitle: 'Répertoire des délais',
    repertoireHint:
      'Une ligne = une ligne d’un des trois répertoires. Une entrée masquée quitte le menu mais reste en base : les calculs déjà rendus restent lisibles.',
    filterCode: 'Code',
    filterStatut: 'Statut',
    filterAll: 'Tous',
    searchPlaceholder: 'Article, objet, slug…',
    colArticle: 'Article',
    colObjet: 'Objet',
    colDuree: 'Durée (mot à mot)',
    colKind: 'Genre',
    colRegime: 'Régime',
    colStatut: 'Statut',
    colRevision: 'Rév.',
    colActions: 'Actions',
    statutVisible: 'Visible',
    statutMasque: 'Masquée',
    statutSupprime: 'Supprimée',
    notCalculable: 'Ne calcule pas',
    add: 'Ajouter une entrée',
    edit: 'Modifier',
    hide: 'Masquer',
    restore: 'Réafficher',
    remove: 'Supprimer',
    removeMasterOnly: 'Suppression réservée au Master Admin',
    /** § 7.3 — défaire une suppression est un verbe À PART, du même prix que la suppression. */
    undelete: 'Rétablir la suppression',
    undeleteMasterOnly: 'Rétablissement réservé au Master Admin',
    confirmUndeleteTitle: 'Rétablir cette entrée supprimée',
    confirmUndeleteNote:
      'Cette entrée avait été retirée du répertoire. La rétablir la remet au menu du calculateur public : dites pourquoi, et recopiez le numéro d’article.',
    /** § 8.2 — les traductions non relues, en tête du back-office. */
    translationsPendingTitle: 'Traductions à relire',
    translationsPendingBody:
      '{n} entrées portent encore `traductionRelue: false` : sur /en et /ht, elles s’affichent en français.',
    translationsPendingNone: 'Toutes les entrées ont une traduction relue.',
    cancel: 'Annuler',
    save: 'Enregistrer',
    saved: 'Enregistré ✓',
    none: 'Aucune entrée.',
    loading: 'Chargement…',

    // Motifs et confirmations
    motifLabel: 'Motif',
    motifHint: 'Affiché aux utilisateurs sur les calculs déjà rendus. Une phrase, lisible par un tiers.',
    confirmDeleteTitle: 'Supprimer cette entrée du répertoire',
    confirmDeleteTyped: 'Recopiez le numéro d’article pour confirmer : {valeur}',
    confirmDeleteNote:
      'La suppression n’est jamais physique : la ligne reste en base et les calculs déjà rendus restent reproductibles. L’entrée quitte le menu, et le calculateur refuse tout nouveau calcul avec elle.',
    confirmDeleteKeyTyped: 'Recopiez la clé pour confirmer : {valeur}',

    // Aperçu obligatoire
    previewTitle: 'Aperçu obligatoire',
    previewHint:
      'Ce que cette entrée rendrait sur la date d’exemple du lundi 2 mars 2026. On ne publie pas une règle de calcul sans avoir vu ce qu’elle rend.',
    previewCompute: 'Calculer l’aperçu',
    previewNone: 'Aucun aperçu calculé.',
    previewImpossible:
      'L’aperçu n’a pas pu être calculé sur les données réelles — il n’est PAS calculé sur d’autres.',
    previewRefusal: 'Cette entrée refuserait de calculer',
    previewIncomplete: 'Cette entrée demanderait une réponse de plus',
    previewSeen: 'J’ai lu l’aperçu',
    previewRequired: 'Calculez et lisez l’aperçu avant d’enregistrer.',

    // Verdicts
    blockingTitle: 'Enregistrement refusé —',
    warningsTitle: 'À lire —',

    // Champs du formulaire d’entrée
    fieldCode: 'Code',
    fieldArticle: 'Article',
    fieldArticleContexte: 'Section porteuse (obligatoire si le numéro a un homonyme)',
    fieldArticleOccurrence: 'Rang de l’en-tête dans le Code',
    fieldTableau: 'Tableau',
    fieldTableauTitre: 'Titre de la section d’origine',
    fieldOrdre: 'Rang dans le tableau',
    fieldObjetFr: 'Objet (français)',
    fieldObjetEn: 'Objet (anglais)',
    fieldObjetHt: 'Objet (créole)',
    fieldTraductionRelue: 'Traductions relues',
    fieldDureeTexte: 'Durée, mot à mot du répertoire',
    fieldDureeFondement: 'Article qui énonce la durée, s’il est autre',
    fieldKind: 'Genre',
    fieldJours: 'Jours',
    fieldNbDistances: 'Kilométrages à saisir',
    fieldDistanceAide: 'Aide : les deux points à mesurer',
    fieldDistanceDouble: 'Aide : la double distance',
    fieldSupplement: 'Question de suite (JSON, art. 74)',
    fieldAvisDistance: 'Avis de distance non calculée',
    fieldCitationArticle: 'Citation de l’article (obligatoire pour A5)',
    fieldRegime: 'Régime',
    fieldRegimeIncertain: 'Régime incertain (tête d’affiche en ordinaire, franc en lecture nommée)',
    fieldRegimeFondement: 'Fondement du régime — jamais vide',
    fieldProrogation: 'Prorogation de l’art. 991',
    fieldProrogationFondement: 'Fondement de la prorogation',
    fieldMotifRefusFr: 'Motif de refus (français)',
    fieldMotifRefusEn: 'Motif de refus (anglais)',
    fieldMotifRefusHt: 'Motif de refus (créole)',
    fieldPointDepartFr: 'Point de départ (français)',
    fieldPointDepartEn: 'Point de départ (anglais)',
    fieldPointDepartHt: 'Point de départ (créole)',
    fieldSanctionFr: 'Sanction (français)',
    fieldSanctionEn: 'Sanction (anglais)',
    fieldSanctionHt: 'Sanction (créole)',
    slugDerived: 'Le slug est dérivé de l’article et ne change jamais après création.',

    // Calendrier
    calendarTitle: 'Calendrier des fêtes',
    calendarVersion: 'Version {n}',
    calendarNewVersionNote:
      'Toute modification crée une nouvelle version du calendrier : les permaliens qui pointent l’ancienne continuent de la rendre à l’identique.',
    calendarCorpusNote:
      'Le dernier texte déterminant les fêtes légales est le Décret du 11 décembre 2024 (Le Moniteur, Spécial n° 66-A) : il en énumère onze à son article 2.',
    calendarCorpusNoteDetail:
      'Il succède au Décret du 23 mai 1989, dont il reprend les sept fêtes et auquel il en ajoute quatre : Lundi Gras (à partir de midi), 14 août, 20 septembre, 1er novembre. Le corpus porte par ailleurs 182 arrêtés de chômage indexés : ce sont des chômages ponctuels, pas des déterminations de fêtes légales.',
    /** L'entrée sans texte instituant. ⚠️ La réserve R6 a été retirée le 20 août 2026 : depuis le décret du 11 décembre 2024, une entrée de cette sorte est l'exception, et elle ne nomme plus aucune lecture. */
    calendarNoTextNote:
      'Cette entrée ne proroge pas la date en tête d’affiche : aucun texte du corpus ne l’institue. Elle n’apparaît que dans la lecture la plus large.',
    tablePermanentTitle: 'Jours permanents',
    tablePermanentHeader: 'Ces jours prorogent le délai quand la date limite y tombe.',
    tableWatchTitle: 'Jours à surveiller',
    tableWatchHeader:
      'Ces jours ne prorogent pas. Ils déclenchent un avertissement sur le résultat quand la date limite y tombe.',
    colCle: 'Clé',
    colLibelle: 'Libellé',
    colTypeEntree: 'Type',
    colCategorie: 'Catégorie',
    colAutorite: 'Autorité',
    colJournee: 'Journée',
    colMobile: 'Mobile / fixe',
    colSource: 'Source',
    colAppliqueDepuis: 'Appliqué depuis',
    colObservationsN: 'Arrêtés relevés',
    colObservationsTexte: 'Texte des observations',
    colObservationsBorne: 'Borne de l’Index',
    colRecherche: 'Requête corpus',
    fieldMobile: 'Fête mobile (décalage pascal)',
    fieldOffsetPaques: 'Décalage par rapport à Pâques',
    fieldMois: 'Mois',
    fieldJour: 'Jour',
    fieldSource: 'Source — jamais vide',
    fieldSourceDocId: 'Document du corpus (identifiant)',
    fieldAppliqueDepuis: 'Appliqué depuis (AAAA-MM-JJ)',
    fieldObservationsN: 'Nombre d’arrêtés relevés',
    observationsCountHint: 'Ce nombre doit être recompté sur le corpus, pas estimé.',
    fieldObservationsTexte: 'Texte des observations (repris dans l’avertissement)',
    fieldObservationsBorne: 'Borne de l’Index du Moniteur',
    fieldRecherche: 'Requête à passer à la recherche',
    switchToPermanentWarning:
      'Faire proroger un jour jusque-là seulement surveillé exige un texte versé au corpus et une autorité autre qu’« observation ».',
    journeeEntiere: 'Journée entière',
    journeeApresMidi: 'Demi-journée (après-midi)',
    mobileOui: 'Mobile',
    mobileNon: 'Fixe',

    // Fenêtres
    windowsTitle: 'Fenêtres de signification',
    windowsNote:
      'Ces valeurs sont celles que les codes écrivent. Ne les modifiez que sur un texte modificatif, en changeant la source dans le même enregistrement.',
    colMatiere: 'Matière',
    colHeureDebut: 'De',
    colHeureFin: 'À',
    colNullite: 'Nullité',
    windowsVersion: 'Version {n}',
    matiereCIVILE: 'Civile',
    matiereTRAVAIL: 'Travail',

    // Journal
    historyTitle: 'Historique des modifications',
    historyEmpty: 'Aucune entrée.',
  },
  juridictions: { CASSATION: 'Cassation', APPEL: 'Appel', PREMIERE_INSTANCE: 'Première instance' },
  alerts: {
    title: 'Alertes de veille',
    hint: 'Recevez un e-mail quand de nouveaux documents correspondent à vos alertes (envoi quotidien).',
    create: 'M’alerter sur cette recherche',
    created: 'Alerte créée ✓',
    limit: 'Limite de 20 alertes atteinte — supprimez-en une pour continuer.',
    empty: 'Aucune alerte pour le moment. Lancez une recherche puis « M’alerter sur cette recherche ».',
    pause: 'Mettre en pause',
    resume: 'Réactiver',
    delete: 'Supprimer',
    paused: 'En pause',
    everything: 'Tous vos services',
    lastSent: 'Dernier envoi',
    never: 'Jamais',
  },
  errorPage: {
    title: 'Une erreur est survenue',
    body: 'Réessayez dans un instant. Si le problème persiste, contactez legal@lam.ht.',
    retry: 'Réessayer',
    notFoundTitle: 'Page introuvable',
    notFoundBody: 'La page demandée n’existe pas ou a été déplacée.',
    home: 'Retour à l’accueil',
  },
  common: {
    /** AV-05 ch. 1 — le mot qui ouvre un bloc d'erreur. C'est LUI, non la couleur,
     *  qui satisfait le critère bloquant : en achromatopsie il subsiste seul. */
    erreur: 'Erreur —',
    echec: 'Échec —',
    avertissement: 'Attention —',
    loading: 'Chargement…',
    save: 'Enregistrer',
    cancel: 'Annuler',
    close: 'Fermer',
    back: 'Retour',
    all: 'Tous',
    yes: 'Oui',
    no: 'Non',
    search: 'Rechercher',
    signOut: 'Se déconnecter',
    poweredBy: 'préparé pour Me Christelle Vaval',
  },
  errors: {
    invalidCredentials: 'Identifiants invalides.',
    pending: "Votre compte est en attente d'activation par un administrateur.",
    suspended: 'Votre compte est suspendu. Contactez un administrateur.',
    locked: 'Trop de tentatives. Compte verrouillé 15 minutes.',
    badCode: 'Code invalide ou expiré.',
    wrongSecret: "Ce code ne provient pas du QR affiché ici. Si « Lam » figure déjà dans votre application d’authentification, SUPPRIMEZ cette ancienne entrée, puis scannez le QR ci-dessus : la clé a changé.",
    clockSkew: "L’horloge de votre téléphone est décalée de plus d’une minute. Activez le réglage automatique de la date et de l’heure, puis réessayez.",
    clockSkewFast: "L’horloge de votre téléphone avance d’environ {n} min. Activez le réglage automatique de la date et de l’heure, puis réessayez.",
    clockSkewSlow: "L’horloge de votre téléphone retarde d’environ {n} min. Activez le réglage automatique de la date et de l’heure, puis réessayez.",
    forbidden: "Accès refusé pour votre type de compte.",
    quota: 'Quota mensuel de recherches atteint. Passez à un palier supérieur.',
    rate: 'Trop de requêtes — veuillez ralentir quelques instants.',
    actionFailed: "L'action a échoué. Vérifiez vos droits et réessayez.",
    exists: 'Existe déjà.',
    invalidFields: 'Champs invalides.',
  },
}
