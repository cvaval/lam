/**
 * LE CALCUL DE LA SURFACE PUBLIQUE — **déclaré une seule fois, ici.**
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚠️ **LA DÉCISION DU MATIN A ÉTÉ REPRISE L'APRÈS-MIDI. C'EST LA SECONDE QUI VAUT.**
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Me Vaval, 20 août 2026, le matin : « Les délais pouvant être prorogés n'ont aucune
 * incidence sur le calculateur public, car l'utilisateur indique uniquement la quantité de
 * jours francs qu'il souhaiterait calculer. » — le calcul public était alors FRANC PUR :
 * départ + N + 1, sans report.
 *
 * Me Vaval, le même jour, **après avoir vu une date limite tomber un dimanche** : « Attention,
 * la date limite est tombée un dimanche, il faut la proroger au prochain jour ouvrable, donc
 * le lundi 6 juillet. S'assurer que c'est conforme. »
 *
 * **Le texte lui donne raison**, et il a été relu en base (`Document`, source
 * `CODE_PROCEDURE_CIVILE`) — C. pr. civ., art. 991, alinéas 3 et 4 :
 *
 *   « Les délais légaux seront prorogés d'un jour, si le dernier est un dimanche ou un jour
 *   de fête légale. Il en est de même lorsque, au dernier jour, le chômage est prescrit par
 *   arrêté du Président de la République. »
 *
 * Le nom de ce fichier est HISTORIQUE : il ne reste « franc pur » que par son adresse. Ce
 * qu'il porte aujourd'hui, c'est la configuration de la surface publique — franc **et**
 * prorogé. Il n'a pas été renommé pour ne pas déplacer huit fichiers pendant qu'une autre
 * session travaille dans le dépôt ; l'en-tête fait foi contre l'adresse.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * CE QUE LA SURFACE PUBLIQUE CALCULE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Départ + N + 1 (le délai est franc), **puis le report** :
 *
 *   1. si ce jour est un **dimanche** ou porte l'une des **16 entrées PERMANENT** du
 *      calendrier, il est reporté d'un jour ;
 *   2. **et on recommence** — « au prochain jour ouvrable ». Cas de contrôle de la cliente :
 *      1er octobre 2025 + 30 jours francs → samedi 1er novembre (La Toussaint) → dimanche
 *      2 novembre (dimanche ET Fête des Morts) → **lundi 3 novembre 2025** ;
 *   3. ⚠️ **le SAMEDI n'est pas un jour de report.** Ni l'art. 991 al. 3 ni l'art. 511 al. 2
 *      C. trav. — la clause de prorogation du Code du travail, « Les délais légaux sont
 *      prorogés d'un jour si le dernier jour est un dimanche ou un jour férié légal ou prescrit
 *      par Arrêté Présidentiel », relue en base ; l'art. 512, lui, régit les HEURES et JOURS de
 *      signification, et c'est le pendant de l'art. 991 al. 2, pas de l'al. 3 — ne
 *      l'excluent : seuls les dimanches et les fêtes légales. Un délai qui expire un samedi
 *      ordinaire expire ce samedi-là — c'est ce que la Cour de cassation a jugé deux fois
 *      (samedi 23 juin 1962, Germeil ; samedi 2 novembre 1963, Brown and Root), et deux des
 *      six arrêts-oracle le gardent ;
 *   4. ⚠️ **les jours À SURVEILLER ne reportent rien** (Mercredi des Cendres, Ascension,
 *      Jeudi Saint, 24 octobre, 7 février) : aucun texte permanent ne les institue pour
 *      l'année considérée. Ils gardent leur mention en petits caractères, sans déplacer la
 *      date (§ 4.13, et `entreeProroge` les refuse en tête de fonction).
 *
 * ⚠️ **CE QUI ÉTAIT ICI TROIS “LECTURES ASSUMÉES” EST DEVENU LA RÈGLE — 20 août 2026 (soir).**
 * Les trois nuances que ce fichier portait seul, contre un portail qui les refusait, ont toutes
 * été tranchées dans la journée. Elles sont conservées ci-dessous parce qu'elles disent
 * pourquoi la plateforme calcule ce qu'elle calcule — mais aucune n'est plus une lecture de la
 * seule surface publique :
 *
 *   a) **La CASCADE.** La lettre de l'art. 991 proroge « d'UN jour » ; répéter le report
 *      jusqu'au point fixe était une lecture, que le portail nommait « R3 · Prorogation en
 *      cascade » et tenait hors de sa tête d'affiche. **Me Vaval a répondu OUI le 20 août 2026
 *      au soir** : c'est la règle, elle vaut pour les deux surfaces, et elle est portée par la
 *      version 2 des règles de lecture (`regles-lecture.ts`). **Elle est toujours DITE** : dès
 *      que le report franchit plus d'un jour, la clé `publicDeferredCascade` écrit que
 *      l'article proroge d'un jour et que la plateforme répète le report.
 *   b) **Les 4 jours autrefois sans texte** (Lundi Gras, 14 août, 20 septembre, 1er novembre).
 *      ⚠️ **CETTE LECTURE A CESSÉ D'EN ÊTRE UNE LE 20 AOÛT 2026 (MATIN)** : le *Décret du
 *      11 décembre 2024 déterminant les Fêtes Légales* (Moniteur, Spécial n° 66-A) les énumère
 *      à son article 2, au même titre que les sept autres. La **version 2** du calendrier les
 *      porte `autorite: 'TEXTE'` ; ils reportent maintenant des DEUX côtés, la réserve R6 a été
 *      retirée et la mention `publicDayEditorial` ne les atteint plus. **C'est le SEUL point où
 *      les deux surfaces peuvent encore diverger**, et seulement sous un permalien `c=1` : la
 *      version 1 du calendrier les porte sans texte instituant, le portail les refuse alors en
 *      tête d'affiche (§ 0, règle 4) et la surface publique les proroge — c'est ce que
 *      `prorogationTeteLarge` veut dire depuis qu'il a perdu ses deux autres effets.
 *   c) **Les 5 FÊTES NATIONALES.** L'art. 991 al. 3 ne vise que « un dimanche ou un jour de
 *      fête légale », et les deux catégories sont distinctes en droit haïtien : Const. 1987,
 *      art. 275.1 énumère les cinq fêtes NATIONALES ; l'art. 275.2 dit « Les Fêtes Légales sont
 *      déterminées par la Loi » ; et le décret du 23 mai 1989 s'intitule « déterminant, **en
 *      dehors des Fêtes Nationales**, les Fêtes Légales ». C'était la plus lourde des trois —
 *      25 des 56 divergences mesurées le MATIN du 20 août 2026 avec le portail (chiffre
 *      historique : la mesure d'aujourd'hui est en tête du § 0 de `franc-pur.test.ts`, et les
 *      fêtes nationales n'expliquent plus AUCUNE divergence, puisqu'elles prorogent des deux
 *      côtés). **Me Vaval a répondu OUI le 20 août 2026
 *      au soir** : elles prorogent en tête d'affiche des deux côtés (Const. 1987, art. 275 : le
 *      chômage est observé « à l'occasion des Fêtes Nationales et des Fêtes Légales »). La
 *      réserve R1 a été retirée, et la mention `publicDayNational` demeure : elle nomme la
 *      Constitution comme fondement du chômage et rappelle ce que l'art. 991 al. 3 vise, ce qui
 *      reste vrai et utile sous une règle qui, elle, a été tranchée.
 *
 * ⚠️ **L'ARBITRAGE EST CLOS, ET C'EST LE PORTAIL QUI A ÉTÉ ÉLARGI.** Ce fichier a porté, du
 * matin au soir du 20 août 2026, un « ARBITRAGE OUVERT, à Me Vaval » : resserrer la tête
 * publique, ou élargir celle du portail. Elle a choisi la seconde voie en répondant OUI aux
 * deux questions de droit. **Mesuré le 20 août 2026 au soir, sur 1 826 départs × 4 durées** :
 * sous le calendrier COURANT, les deux surfaces divergent ZÉRO fois ; sous celui de la
 * version 1, que rejouent les permaliens `c=1`, 16 fois — et ces 16 sont imputables en
 * totalité aux quatre jours que la version 1 portait sans texte instituant. Le second cas de
 * contrôle de la cliente — 1er octobre 2025 + 30 jours francs → lundi 3 novembre — est
 * désormais rendu par LES DEUX écrans.
 *
 * ⚠️ **AUCUN CHIFFRE DE CET EN-TÊTE N'EST ÉCRIT À LA MAIN SANS ÊTRE MESURÉ AILLEURS.** Les
 * comptes ci-dessus sont ceux que `franc-pur.test.ts` (§ 0) fixe et rejoue : un nombre porté
 * dans une prose de commentaire ne peut pas devenir rouge quand il cesse d'être vrai, et ce
 * fichier en a porté trois faux pendant une journée (« 56 cas sur 56 », « 53 divergences »,
 * « 5 des 18 déplacements »).
 *
 * ⚠️ **LE PORTAIL N'EST PAS ATTEINT PAR CE FICHIER**, et il faut lire cette phrase deux fois
 * depuis le 20 août au soir. `/{locale}/outils/delais` calcule sur une entrée du répertoire —
 * un article, une matière, un régime, un fondement — et garde ses lectures nommées, son bloc
 * praticable, ses avertissements et ses fenêtres de signification : rien de la restriction
 * ci-dessous ne l'atteint, `calculPublic(params, 'connecte')` ne passe jamais par ici. **Sa TÊTE
 * D'AFFICHE, elle, n'est plus étroite** : les fêtes nationales et la cascade lui viennent
 * maintenant de la version de règles, qui est la même pour les deux surfaces (`calcul.ts`,
 * bloc 7). C'est exactement ce qui met fin au désaccord des deux écrans.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * DEUX MÉCANIQUES, ET ELLES NE SONT PAS INTERCHANGEABLES
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * **1. Ce que le moteur fait de lui-même — `PROROGATION_FRANC_PUR`.**
 *
 * La surface de configuration du moteur (§ 4) est l'ENTRÉE : `calculer()` lit
 * `entree.prorogation991` et `entree.prorogationTeteLarge`, et en déduit tout le reste.
 * L'entrée synthétique du genre « Autre » (§ 4.12) est fabriquée par la plateforme, pas lue
 * en base : il suffit donc de la déclarer `prorogation991: 'OUI'` **et**
 * `prorogationTeteLarge: true` pour que le moteur, de lui-même :
 *
 *   - proroge la tête d'affiche sur les 16 entrées PERMANENT et le dimanche, en cascade ;
 *   - **n'ouvre AUCUNE lecture nommée** — R1, R3 et CUMUL rendent alors exactement la
 *     date de la tête d'affiche, et `ajouter()` les écarte lui-même ; PROROGATION_991 n'est
 *     ouverte que sur `INCERTAIN`, et REGIME_FRANC que sur un régime douteux (publiquement,
 *     `f` vaut « oui ») ;
 *   - ne rende aucune ligne CUMUL, donc aucune « lecture la plus large » distincte de la
 *     tête (`lectureLaPlusLarge === teteAffiche`) ;
 *   - **ne déclenche pas A4** : cet avertissement ne naît que des jours sans texte ayant
 *     RÉELLEMENT joué dans la lecture cumulée, qui n'est plus ouverte ici — et, depuis la
 *     version 2 du calendrier, il n'existe plus aucun jour de cette sorte.
 *
 * C'est un paramètre, pas un filtre : le calcul n'est jamais fait puis défait. **La date
 * rendue est celle que le moteur a calculée** — rien ici ne la recalcule, ne la déplace ni ne
 * la corrige après coup.
 *
 * **2. Ce que le moteur rend SANS condition — `AVERTISSEMENTS_FRANC_PUR`, le bloc praticable,
 * la phrase de sécurité et le renvoi final.** Quatre productions n'ont aucune commande dans
 * `calculer()` :
 *
 *   - **A1** (« un arrêté du Président de la République peut avoir prescrit le chômage de ce
 *     jour et proroger le délai d'un jour ») est poussé inconditionnellement. C'est l'alinéa 4
 *     de l'art. 991, et il est vrai — mais c'est un paragraphe permanent sur 100 % des
 *     résultats, alors que la cliente demande « uniquement la date ». Il reste dehors ;
 *   - **A6** (jour à surveiller) naît des seules entrées `A_SURVEILLER` du calendrier tombant
 *     sur la tête d'affiche, et **NOMME une date de report** que la plateforme ne fait pas
 *     (§ 4.13, point 4 ci-dessus). La mention `publicDayWatch` dit la même chose sans nommer
 *     de date : c'est elle qui reste ;
 *   - le **bloc « jour praticable »** naît de `estDimanche()` et du calendrier, sans lire la
 *     configuration de lecture ; il rend une seconde date, ANTÉRIEURE à la tête d'affiche, et
 *     suppose que l'acte EST une signification — une qualification que la surface publique
 *     n'a pas faite ;
 *   - le **renvoi de la dernière ÉTAPE** — « — voir les avertissements ci-dessous. » — que
 *     `calculer()` écrit (§ 4.13, `calcul.ts`) dès que la tête d'affiche tombe sur un jour du
 *     calendrier qui ne proroge pas. Depuis le report en cascade, il ne reste qu'un cas : un
 *     jour À SURVEILLER sur la date finale. Le renvoi pointerait vers un bloc où ne reste que
 *     A3, qui ne dit pas un mot de ce jour-là.
 *
 * Le moteur est **gelé** (§ 4 : « Ne jamais réintroduire… ») : on ne lui ajoute pas un drapeau
 * pour cela. La restriction est donc portée ici, en **liste fermée**, appliquée UNE fois, au
 * seul point où le résultat public est produit (`calculPublic`, accès `'public'`) — jamais
 * dans une route, jamais dans un écran. La route, la page et le presse-papiers voient ainsi
 * exactement le même objet : c'est la règle du dépôt contre les secondes vérités.
 *
 * **A3 reste**, et il est le seul : « Ce calcul ne remplace pas la vérification du texte. Lam
 * Veritab ne garantit aucun délai de recours. » A2 (le kilométrage) et A5 / A5-bis (le délai
 * de distance non chiffré) sont inatteignables publiquement : le genre « Autre » est de genre
 * `JOURS` et n'accepte aucune distance.
 *
 * ⚠️ **Ce fichier est PUR** : aucune E/S, aucun `Date`, aucune arithmétique de dates. Les deux
 * dates du bloc praticable neutralisé sont la tête d'affiche elle-même, RECOPIÉE — c'est la
 * définition que `calculer()` donne d'un bloc non nécessaire (`necessaire = !egales(prudent,
 * tête)`), et non un calcul refait ici.
 */
import type { Avertissement, CleAvertissement, Etape, Resultat } from './calcul'
import type { Locale } from './format'
import { dateEnToutesLettres } from './format'
import { phrases } from './phrases'
import type { Prorogation991 } from './regimes'

/**
 * § 4.12 — LE FONDEMENT DU REPORT, SUR L'ENTRÉE SYNTHÉTIQUE PUBLIQUE.
 *
 * ⚠️ **OÙ CE TEXTE VA VRAIMENT — l'en-tête précédent décrivait un chemin qui n'existe pas.**
 * Il annonçait « reproduit […] dans le raisonnement quand la tête d'affiche ne proroge pas » :
 * ce chemin-là est `consequencePasAcquise()` (`calcul.ts`), qui n'est atteint que si
 * `prorogation991 !== 'OUI'` — donc **jamais** sous la configuration publique, qui vaut `'OUI'`
 * depuis le 20 août 2026. Vérifié sur la réponse réelle de `/api/public/delais/calculer` :
 *
 *   - le champ voyage bien, mais dans `resultat.entree.prorogationFondement` — et **pas** dans
 *     le `entree` de premier niveau, que `entreeAutrePublique()` (`lecture-publique.ts`)
 *     compose clé par clé et qui ne le porte pas ;
 *   - **aucune surface ne l'AFFICHE.** Son unique lecteur d'écran est `DelaiForm.tsx` (le
 *     PORTAIL), qui rend le fondement de l'entrée du répertoire choisie et n'appelle jamais
 *     `prorogationFrancPur()`.
 *
 * Il reste ici parce qu'un champ sérialisé est un champ lu — presse-papiers, permalien rejoué,
 * inspection de l'API —, et parce que `EntreeDelai.prorogationFondement` est obligatoire. Mais
 * **ce n'est pas lui qui documente la lecture auprès du lecteur** : ce sont les clés i18n
 * `publicDeferred`, `publicDeferredCascade`, `publicDayNational` et `publicStrictReading`, que
 * `DelaiDatePublique` rend sous la date. Si tu réécris la lecture, réécris-les AUSSI.
 *
 * ⚠️ **ET IL EST TRADUIT.** Le résultat sérialisé est celui de la langue demandée : le laisser
 * en français mettrait un fondement français dans la charge utile de `/en` et de `/ht`.
 */
const FONDEMENT_PROROGATION_PUBLIQUE: Record<Locale, string> = {
  fr:
    'C. pr. civ., art. 991 al. 3 — « Les délais légaux seront prorogés d’un jour, si le ' +
    'dernier est un dimanche ou un jour de fête légale. » Le report est répété jusqu’au ' +
    'premier jour qui n’est ni un dimanche ni un jour de fête légale. Le samedi n’est pas un ' +
    'jour de report.',
  en:
    'C. pr. civ., art. 991 §3 — “Legal periods shall be extended by one day where the last ' +
    'day is a Sunday or a legal holiday.” The extension is repeated until the first day that ' +
    'is neither a Sunday nor a legal holiday. Saturday is not a day of extension.',
  ht:
    'C. pr. civ., atik 991 al. 3 — « Delè legal yo pwolonje yon jou, si dènye jou a se yon ' +
    'dimanch oswa yon jou fèt legal. » Ranvwa a repete jouk premye jou ki pa ni yon dimanch ' +
    'ni yon jou fèt legal. Samdi se pa yon jou ranvwa.',
}

/** La configuration publique, dans la langue demandée. */
export function prorogationFrancPur(locale: Locale): {
  prorogation991: Prorogation991
  prorogationTeteLarge: boolean
  prorogationFondement: string
} {
  return {
    // ⚠️ `'OUI'` et non `'INCERTAIN'` : `INCERTAIN` veut dire « la plateforme ne sait pas si
    // l'art. 991 s'applique, elle ouvre donc une lecture nommée » — c'est-à-dire une SECONDE
    // date, exactement ce que la cliente a retiré de la surface publique. `'OUI'` dit ce
    // qu'elle a tranché : la date limite se proroge.
    prorogation991: 'OUI',
    // ⚠️ **CE DRAPEAU A PERDU DEUX DE SES TROIS EFFETS LE 20 AOÛT 2026 (SOIR)** : les fêtes
    // NATIONALES et la CASCADE sont passées dans la version de règles, qui vaut pour les deux
    // surfaces. Il ne gouverne plus que les quatre jours sans texte instituant du calendrier de
    // la VERSION 1 — sans lui, un permalien `c=1` rendrait « samedi 1er novembre 2025 » là où la
    // cliente a validé « lundi 3 novembre ». Sous le calendrier courant, il est SANS EFFET :
    // le décret du 11 décembre 2024 donne un texte à ces quatre jours.
    prorogationTeteLarge: true,
    prorogationFondement: FONDEMENT_PROROGATION_PUBLIQUE[locale],
  }
}

/** Le même, en français — la forme historique, gardée pour les appelants qui n'ont pas de locale. */
export const PROROGATION_FRANC_PUR: {
  prorogation991: Prorogation991
  prorogationTeteLarge: boolean
  prorogationFondement: string
} = prorogationFrancPur('fr')

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LA LECTURE STRICTE — **ce qu'il en RESTE après l'arbitrage du 20 août 2026 (soir)**
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **CE MÉCANISME A ÉTÉ ÉCRIT CONTRE UN DÉSACCORD ENTRE DEUX ÉCRANS DE LA MÊME MAISON.**
 * À durée et régime identiques, la surface publique (tête large, cascade) et le portail (tête
 * étroite, un jour) rendaient deux dates, et la publique était TOUJOURS la plus tardive.
 * ⚠️ **LES TROIS NOMBRES QUI ÉTAIENT ÉCRITS ICI ÉTAIENT PÉRIMÉS** — « 56 cas sur 56 », « 3,1 % »,
 * « 53 cas et 71 jours cumulés sous le calendrier de la version 2 » : chiffres HISTORIQUES du
 * MATIN du 20 août 2026, quand le portail gardait une tête étroite. Le dernier était devenu
 * franchement trompeur, puisqu'il attribuait 53 divergences à un calendrier qui n'en porte plus
 * aucune. **Aucun compte n'est réécrit ici** : ils vivent tous dans `franc-pur.test.ts`, § 0, qui
 * les remesure à chaque exécution — un nombre porté dans une prose ne peut pas rougir.
 * Sur le cas de contrôle de la
 * cliente — 30 jours francs, acte reçu le 1er octobre 2025 —, le portail mettait la tête
 * d'affiche au SAMEDI 1er novembre quand la page publique disait LUNDI 3 NOVEMBRE : trois
 * jours d'amplitude sur un délai de forclusion.
 *
 * ⚠️ **L'ESSENTIEL DE CE DÉSACCORD A DISPARU LE 20 AOÛT 2026 AU SOIR.** Me Vaval a répondu OUI
 * aux deux questions de droit : les fêtes NATIONALES prorogent, et la prorogation cascade. Les
 * deux têtes d'affiche appliquent désormais la MÊME version de règles, et sous le calendrier
 * courant les deux surfaces rendent la même date sur les 1 826 départs — l'écart est de ZÉRO.
 * Il est mesuré DEUX fois, et il faut les deux : `franc-pur.test.ts` (§ 0, `LE ZÉRO DE LA V2`)
 * le mesure sur le MOTEUR, et `DelaiCalculateur.rendu.test.tsx` (§ 0, `LE ZÉRO DE LA V2, À LA
 * SURFACE`) le remesure à travers `calculPublic` — la chaîne que la page et l'API empruntent
 * réellement, et la seule où `lectureStricte` est calculée.
 *
 * ⚠️ **CE QUI SUBSISTE, ET POURQUOI ON NE RETIRE PAS LE MÉCANISME.** Sous un permalien `c=1`,
 * le calendrier de la version 1 porte quatre jours qu'aucun texte du corpus n'instituait alors
 * (Lundi Gras, 14 août, 20 septembre, 1er novembre) : le portail les refuse en tête d'affiche
 * (§ 0, règle 4) et la surface publique les proroge, sur la définition que la cliente a donnée
 * du report. La publique y reste la plus tardive, et l'écran doit donc continuer à NOMMER la
 * date étroite. La ligne s'éteint d'elle-même partout ailleurs : sous le calendrier courant,
 * les deux dates sont égales et `lectureStricte` vaut `null`.
 *
 * ⚠️ **CE N'EST PAS UN SECOND CALCUL, C'EST LE MÊME MOTEUR SOUS UNE SECONDE CONFIGURATION.**
 * Aucune arithmétique de dates n'est écrite ici : on repose l'entrée avec
 * `prorogationTeteLarge: false` et on relit la tête d'affiche que `calculer()` rend. Deux
 * implémentations, ce serait deux vérités ; deux CONFIGURATIONS d'un même moteur, c'est ce que
 * le § 4.6 organise depuis le premier jour.
 */
export function entreeLectureStricte<T extends { prorogationTeteLarge?: boolean }>(entree: T): T {
  return { ...entree, prorogationTeteLarge: false }
}

/**
 * LA LISTE FERMÉE des avertissements que la surface publique rend. Toute clé absente d'ici
 * est retirée — y compris une clé ajoutée demain au moteur : on énumère ce qu'on garde, pas
 * ce qu'on jette, pour qu'un ajout au § 4.9 n'apparaisse pas en public sans décision.
 */
export const AVERTISSEMENTS_FRANC_PUR: readonly CleAvertissement[] = ['A3']

/** L'avertissement est-il de ceux que le calcul public rend ? */
export function avertissementFrancPur(a: Avertissement): boolean {
  return AVERTISSEMENTS_FRANC_PUR.includes(a.cle)
}

/**
 * Retire de la DERNIÈRE étape le renvoi « — voir les avertissements ci-dessous. ».
 *
 * ⚠️ **Ce n'est pas un nettoyage du raisonnement, et ce n'en est pas le début.** On ne touche
 * ni au fond de la phrase, ni à sa date, ni à aucune autre étape : on retire le seul segment
 * qui ne raconte rien du calcul et qui pointe vers un bloc que la liste fermée vient de vider.
 * La phrase reste entière — elle nomme déjà le jour et dit qu'il ne proroge pas — et le point
 * final la referme, puisque `finaleCalendrier` et `finaleSamediPorteSansProroger` s'arrêtent
 * l'un sur une parenthèse, l'autre sur un mot.
 *
 * On ne coupe QUE `voirAvertissements` : `voirLecturesEtAvertissements` suppose une lecture
 * nommée ouverte, et le bloc vers lequel il renvoie existe alors pour de bon.
 *
 * ⚠️ **CETTE NOTE DISAIT « la configuration publique n'en ouvre aucune » — CE N'EST PLUS VRAI
 * DEPUIS LE 20 AOÛT 2026 AU SOIR.** La lecture `DEMI_JOURNEE` s'ouvre en public sur les cinq
 * Lundis Gras de la fenêtre 2025-2029 (40 des 7 304 calculs du balayage, § 0 de
 * `franc-pur.test.ts`), et le second renvoi est donc écrit puis rendu tel quel. Il n'est
 * qu'à MOITIÉ orphelin : `lectures` traverse intact — la lecture est bien là, dans la charge
 * utile publique —, mais sa seconde moitié pointe encore vers le bloc d'avertissements que le
 * filtre ci-dessous réduit à A3. **Question ouverte à la rédaction** : couper la seule moitié
 * fausse demanderait un troisième gabarit de renvoi. L'état est MESURÉ, dans les trois langues,
 * par le § 4 de `franc-pur.test.ts` (« le renvoi aux LECTURES, lui, traverse ») — de sorte que
 * la décision, quand elle viendra, fera rougir un test au lieu de se perdre.
 */
function sansRenvoiOrphelin(etapes: readonly Etape[], renvoi: string): Etape[] {
  const derniere = etapes[etapes.length - 1]
  if (!derniere || !derniere.texte.endsWith(renvoi)) return [...etapes]
  return [
    ...etapes.slice(0, -1),
    { ...derniere, texte: `${derniere.texte.slice(0, -renvoi.length)}.` },
  ]
}

/**
 * Applique la restriction aux productions inconditionnelles du moteur. Le reste du résultat —
 * la tête d'affiche, les jours écartés, les lectures, la lecture la plus large — est rendu
 * **tel que le moteur l'a produit sous la configuration publique**, et n'est jamais retouché
 * ici. Des étapes, seul le renvoi terminal tombe (voir `sansRenvoiOrphelin`) : leur nombre,
 * leur ordre, leurs clés, leurs dates et le fond de leurs phrases sont intacts.
 *
 * ⚠️ **`joursEcartes` traverse INTACT, et c'est essentiel** : c'est de lui que la ligne en
 * petits caractères du report est tirée (`reportPublic`, `mention-jour.ts`). Le retirer
 * rendrait le report muet — une date qui a bougé sans que rien ne dise pourquoi.
 *
 * Un refus (`REFUS`) ou une saisie incomplète (`INCOMPLET`) n'ont ni bloc praticable, ni
 * avertissements, ni phrase de sécurité : ils traversent inchangés.
 */
export function restreindreAuFrancPur(resultat: Resultat, locale: Locale = 'fr'): Resultat {
  if (resultat.statut !== 'CALCUL') return resultat
  const p = phrases(locale)
  return {
    ...resultat,
    // ⚠️ Le renvoi part AVEC les avertissements qu'il annonçait : le même geste, sinon
    // l'étape invite à consulter un bloc que le filtre ci-dessous vient de réduire à A3.
    etapes: sansRenvoiOrphelin(resultat.etapes, p.voirAvertissements),
    // La DATE ne change pas : on ne réécrit que la phrase qui l'entoure, et qui renvoyait à
    // des lectures concurrentes que ce calcul n'ouvre plus.
    phraseSecurite: p.phraseSecuriteFrancPur(dateEnToutesLettres(resultat.teteAffiche, locale)),
    praticable: {
      necessaire: false,
      // La tête d'affiche, RECOPIÉE : aucun jour n'est reculé, aucune date n'est calculée.
      dernierJourPraticable: resultat.teteAffiche,
      dernierJourPraticableCertain: resultat.teteAffiche,
      joursEmpeches: [],
      texte: '',
      // § 4.10 — la fenêtre écourtée du Lundi Gras part AVEC le bloc : la surface publique ne
      // rend pas le jour praticable (liste fermée, § 1 ci-dessus), et une phrase sur les heures
      // de signification suppose que l'acte EST une signification — une qualification que la
      // page publique n'a pas faite. Ce qu'elle DIT, elle le dit à sa place : la mention en
      // petits caractères `publicDayHalfDay` (« un acte à signifier doit l'être avant midi »),
      // que `mentionsJour` pose sur la date finale.
      texteMidi: '',
    },
    avertissements: resultat.avertissements.filter(avertissementFrancPur),
  }
}
