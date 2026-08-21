/**
 * § 4.6 — LES LECTURES CONCURRENTES DU DROIT. **AUCUN `Date` DANS CE FICHIER.**
 *
 * « La date en gros caractères est TOUJOURS la plus PRÉCOCE des lectures concurrentes. »
 *
 * L'invariant du bloc 10 (« la tête d'affiche est ≤ à toutes les dates des lectures
 * nommées ») tient PAR CONSTRUCTION : chacune des configurations ci-dessous ne peut
 * qu'AJOUTER des jours à la lecture de tête. Si tu ajoutes une lecture, vérifie qu'elle est
 * elle aussi monotone — sinon l'invariant cesse de vouloir dire ce qu'il veut dire.
 *
 * ⚠️ Il n'y a PAS de réserve « R7 » pour les jours à surveiller (§ 4.13) : un jour à
 * surveiller produit une PHRASE (A6), jamais une date concurrente. `entreeProroge` le
 * verrouille en tête de fonction.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚠️ **LA RÉSERVE « R6 » A ÉTÉ RETIRÉE LE 20 AOÛT 2026. VOICI POURQUOI, ET POURQUOI ELLE
 * A EXISTÉ** — sans cette note, quelqu'un la réintroduira dans six mois.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * R6 s'intitulait « Calendrier de la rédaction (Lundi Gras, 14 août, 20 septembre,
 * 1er novembre) ». Ces quatre jours étaient au calendrier de la **version 1** sur
 * instruction de la rédaction du 19 août 2026, et **aucun texte du corpus ne les
 * instituait**. Les faire proroger en tête d'affiche aurait accordé un jour de plus sur un
 * fondement non textuel — c'est-à-dire fabriqué la forclusion que le calculateur existe pour
 * empêcher (§ 0, règle 4). Ils étaient donc tenus hors de la tête, et R6 les NOMMAIT, pour
 * que l'écran ne se taise pas sur ce qu'il écartait.
 *
 * **Le Décret du 11 décembre 2024 déterminant les Fêtes Légales** (Le Moniteur, Spécial
 * n° 66-A du mercredi 11 décembre 2024) a été retrouvé par la rédaction le 20 août 2026 :
 * son article 2 énumère ONZE fêtes légales, et les quatre jours en font partie. Ils ont un
 * texte, le même que les sept autres. La **version 2** du calendrier les porte
 * `autorite: 'TEXTE'` : ils prorogent désormais en tête d'affiche, comme les sept, et il n'y
 * a plus rien à nommer à part.
 *
 * Ce qui SUBSISTE, et pourquoi : `Configuration.redaction`, la branche `REDACTION` d'
 * `entreeProroge` et le genre `REDACTION` de `genreEntree`. Les 21 lignes de la version 1
 * sont en base et les permaliens `c=1` les rejouent ; les retirer ferait proroger en tête
 * d'affiche, sous la version 1, quatre jours que la version 1 en écartait — donc changerait
 * la date d'un calcul déjà rendu et déjà cité.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚠️ **LES RÉSERVES « R1 », « R1-T » ET « R3 » ONT ÉTÉ RETIRÉES LE 20 AOÛT 2026 (SOIR), AU
 * MÊME MOTIF QUE R6 : ELLES SONT DEVENUES LA RÈGLE.**
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * R1 s'intitulait « Lecture large de “fête légale” (tout jour légalement chômé) » et R1-T sa
 * jumelle en matière de travail : elles nommaient la date qu'on obtiendrait si les cinq fêtes
 * NATIONALES de l'article 275.1 de la Constitution prorogeaient. R3, « Prorogation en
 * cascade », nommait celle qu'on obtiendrait en répétant le report « d'un jour » jusqu'au
 * premier jour libre. Les trois étaient tenues HORS de la tête d'affiche parce que la lettre
 * de l'art. 991 al. 3 (« un dimanche ou un jour de fête légale ») ne les dit pas — et que la
 * tête d'affiche est la lecture la plus étroite, donc la plus précoce, donc la plus sûre.
 *
 * **Me Vaval a répondu OUI aux deux questions le 20 août 2026.** Ce ne sont donc plus des
 * lectures concurrentes : la tête d'affiche proroge sur le dimanche, les onze fêtes légales du
 * Décret du 11 décembre 2024 ET les cinq fêtes nationales, en cascade jusqu'au premier jour
 * qui n'est aucun des trois. Une réserve qui rend la même date que la tête n'a plus rien à
 * nommer, et `ajouter()` l'écarterait de toute façon.
 *
 * ⚠️ **CE QUI SUBSISTE DES DEUX RÉSERVES : `Configuration.feteNationale` et
 * `Configuration.cascade`.** Elles ne sont plus des lectures, elles sont les deux drapeaux
 * d'une VERSION DE RÈGLES (`regles-lecture.ts`, § 4.6) : la version 1 les pose à `false` — la
 * lecture d'avant le 20 août au soir —, la version 2 à `true`. Les retirer supprimerait la
 * possibilité même de rejouer un permalien sous la règle qu'il portait.
 *
 * ⚠️ **CE QUE LEUR RETRAIT N'EMPORTE PAS**, et qui reste en réserve nommée : `PROROGATION_991`
 * (les 114 entrées du Code civil — élargir la prorogation ne dit pas si elle s'applique) et
 * `REGIME_FRANC` (les entrées dont la qualification n'est pas acquise).
 */
import type { EntreeCalendrier } from './feries'

export type CleLecture = 'TETE' | 'REGIME_FRANC' | 'PROROGATION_991' | 'DEMI_JOURNEE' | 'CUMUL'

/**
 * Une configuration de lecture. `franc` et `prorogation` viennent de l'entrée (ou d'une
 * réserve qui les force) ; les trois autres disent quelles entrées du calendrier prorogent
 * et si la prorogation joue en cascade.
 */
export type Configuration = {
  /** Le délai est-il franc dans cette lecture ? (+1 jour d'échéance.) */
  franc: boolean
  /** La prorogation de l'art. 991 / 511 joue-t-elle dans cette lecture ? */
  prorogation: boolean
  /**
   * Les 5 fêtes NATIONALES prorogent-elles ? — **drapeau de la VERSION DE RÈGLES**
   * (`regles-lecture.ts`) depuis le 20 août 2026 : `false` en version 1, `true` en version 2.
   * Il nommait la réserve R1 / R1-T ; il ne nomme plus rien, il applique.
   */
  feteNationale: boolean
  /**
   * Les entrées `autorite: 'REDACTION'` prorogent-elles ?
   *
   * ⚠️ **CE DRAPEAU N'OUVRE PLUS DE LECTURE NOMMÉE** (20 août 2026, voir l'en-tête). Il ne
   * sert plus qu'à DEUX choses : la lecture cumulée (« la plus large »), et la tête d'affiche
   * de la surface publique (`prorogationTeteLarge`). Il ne peut rien atteindre dans la
   * version 2 du calendrier, qui ne porte aucune entrée de cette autorité — mais il reste
   * indispensable aux permaliens `c=1`, dont les quatre entrées sans texte doivent continuer
   * à ne PAS proroger en tête d'affiche.
   */
  redaction: boolean
  /**
   * La prorogation joue-t-elle en cascade jusqu'au point fixe ? — **drapeau de la VERSION DE
   * RÈGLES** (`regles-lecture.ts`) : `false` en version 1, `true` en version 2. Il nommait la
   * réserve R3 ; il ne nomme plus rien, il applique.
   */
  cascade: boolean
  /**
   * Une entrée chômée SEULEMENT à partir de midi (`journee: 'DEMI_JOURNEE_APRES_MIDI'`)
   * proroge-t-elle ? — **drapeau de la VERSION DE RÈGLES** (`regles-lecture.ts`) : `true` en
   * version 1, `false` en version 2.
   *
   * ⚠️ **C'EST LE SEUL DRAPEAU QUI RETIRE DES JOURS AU LIEU D'EN AJOUTER**, et c'est pour cela
   * qu'il est posé à `false` en tête d'affiche : la matinée du Lundi Gras reste ouvrable, et
   * compter la demi-journée pour un jour plein retardait 40 dates limites sur 7 304 calculs,
   * de DEUX jours chacune — le Mardi Gras, chômé en journée entière, suit le Lundi Gras.
   * La lecture nommée `DEMI_JOURNEE` le repose à `true` et porte la date tardive : l'invariant
   * du bloc 10 tient donc toujours — chaque lecture nommée ne peut qu'AJOUTER des jours à la
   * tête, jamais en retirer.
   */
  demiJournee: boolean
}

/**
 * Borne dure anti-boucle de la cascade (§ 4.6). Elle n'est jamais atteinte par le calendrier
 * haïtien — la plus longue suite de jours prorogeants y est de deux (1er et 2 janvier, 1er et
 * 2 novembre) —, mais `entreesCalendrier` accepte un jeu quelconque : la borne existe pour que
 * le moteur s'arrête, et l'étape finale DIT qu'elle a joué plutôt que d'affirmer une date.
 */
export const CASCADE_MAX = 10

/**
 * Cette entrée du calendrier proroge-t-elle SOUS CETTE LECTURE ?
 *
 * 1. `A_SURVEILLER` → **jamais**, quelle que soit la lecture (§ 4.13, interdit n° 17) ;
 * 2. **chômée à partir de MIDI seulement** → sous `cfg.demiJournee`, c'est-à-dire sous les
 *    règles de la version 1 et non sous celles de la version 2 : la matinée reste ouvrable,
 *    l'acte peut y être fait, et un jour entier accordé pour une demi-journée RETARDE la date
 *    limite (§ 0, règle 4). Le décret du 11 décembre 2024 ne chôme le Lundi Gras qu'« à partir
 *    de midi » (art. 2, 1°) ; les décrets de 1982 et 1985 en disaient autant du 2 novembre,
 *    que la version 1 du calendrier porte encore ainsi ;
 * 3. fête NATIONALE → sous `cfg.feteNationale`, c'est-à-dire sous les règles de la version 2
 *    (Me Vaval, 20 août 2026) et non sous celles de la version 1 ;
 * 4. `autorite: 'REDACTION'` → **version 1 seulement** : seulement sous `cfg.redaction`, que
 *    plus aucune lecture nommée ne pose (la lecture cumulée et la tête publique large la
 *    posent encore) ;
 * 5. le reste — les fêtes légales du décret applicable, 7 en v1, 11 en v2 — proroge toujours.
 */
export function entreeProroge(e: EntreeCalendrier, cfg: Configuration): boolean {
  if (e.typeEntree === 'A_SURVEILLER') return false
  if (e.journee === 'DEMI_JOURNEE_APRES_MIDI' && !cfg.demiJournee) return false
  if (e.categorie === 'FETE_NATIONALE') return cfg.feteNationale
  if (e.autorite === 'REDACTION') return cfg.redaction
  return true
}

/**
 * CE QU'UNE LIGNE DU CALENDRIER EST — **et c'est une autre question que « proroge-t-elle ? ».**
 *
 * `entreeProroge` répond « cette ligne déplace-t-elle la date sous cette lecture ». Le genre,
 * lui, répond « comment la NOMMER » : le calendrier porte jusqu'à quatre sortes de lignes
 * (trois depuis la version 2, qui n'a plus d'entrée `REDACTION`), et les confondre sous
 * « jour de fête légale » fait dire à la plateforme ce qu'aucun
 * texte ne dit — la Constitution de 1987 distingue elle-même les FÊTES NATIONALES (art. 275.1,
 * énumérées) des FÊTES LÉGALES (art. 275.2 : « déterminées par la Loi »), et le décret du
 * 23 mai 1989 s'intitule « déterminant, **en dehors des Fêtes Nationales**, les Fêtes Légales ».
 *
 * ⚠️ **CETTE FONCTION VIT ICI, ET PAS DANS `mention-jour.ts`, DEPUIS LE 20 AOÛT 2026 (SOIR).**
 * Elle y était née pour la seule ligne en petits caractères de la surface publique. Or le
 * MOTEUR en a besoin lui aussi : `etapeProrogation` collait un unique gabarit « un jour de fête
 * légale (…) » sur des libellés joints, et le raisonnement sérialisé appelait donc « fête
 * légale » une fête nationale et un jour de la rédaction — pendant que la ligne fine du même
 * calcul écrivait « aucun texte du corpus ne l'institue ». Deux affirmations contradictoires
 * dans une seule réponse. Le classement est désormais déclaré UNE fois, à côté d'`entreeProroge`
 * dont il est le pendant, et `mention-jour.ts` le ré-exporte pour ses appelants historiques.
 *
 * `typeEntree` prime : il est le verrou du § 4.13.
 */
export type GenreEntreeCalendrier = 'FETE_LEGALE' | 'FETE_NATIONALE' | 'REDACTION' | 'A_SURVEILLER'

/**
 * Le genre d'un MOTIF de prorogation — une ligne du calendrier, ou le dimanche, qui n'en est
 * pas une : il est dans l'article lui-même (art. 991 al. 3) et n'a donc aucune ligne à porter.
 *
 * ⚠️ **IL EST PLUS ÉTROIT QUE `GenreJour`, ET C'EST VOULU.** Un motif est ce qui a DÉPLACÉ la
 * date ; une demi-journée ouvrable, par définition, ne déplace rien. Le `switch` de
 * `construireEtapes` est exhaustif sur ce type-ci : élargir le sien laisserait passer un genre
 * sans phrase.
 */
export type GenreMotif = GenreEntreeCalendrier | 'DIMANCHE'

/**
 * Le genre d'un JOUR — un motif, ou la demi-journée dont la matinée reste ouvrable.
 *
 * ⚠️ **`DEMI_JOURNEE` N'EST PAS UN GENRE DE LIGNE, C'EST UN GENRE DE JOUR** — et c'est pour
 * cela qu'il est ici et non dans `GenreEntreeCalendrier` : `genreEntree` ne le rend JAMAIS. La
 * même ligne du calendrier (`lundi-gras`) est une fête légale sous les règles de la version 1,
 * où la demi-journée est comptée pour un jour plein, et une demi-journée ouvrable sous celles
 * de la version 2. Le genre dépend donc de la RÈGLE, pas de la ligne : c'est `mentionsJour`
 * qui le pose, et lui seul (§ 4.10, `mention-jour.ts`).
 */
export type GenreJour = GenreMotif | 'DEMI_JOURNEE'

/** Le genre d'une ligne du calendrier. `typeEntree` prime : il est le verrou du § 4.13. */
export function genreEntree(e: EntreeCalendrier): GenreEntreeCalendrier {
  if (e.typeEntree === 'A_SURVEILLER') return 'A_SURVEILLER'
  if (e.autorite === 'REDACTION') return 'REDACTION'
  return e.categorie === 'FETE_NATIONALE' ? 'FETE_NATIONALE' : 'FETE_LEGALE'
}

/**
 * ⚠️ **`LECTURES_NOMMEES` A ÉTÉ SUPPRIMÉE LE 20 AOÛT 2026 (SOIR). NE LA RÉINTRODUIS PAS.**
 *
 * C'était une table `Record<CleLecture, { libelleFr, fondementFr }>`, en français seul, qui
 * recopiait mot pour mot la table trilingue `phrases(locale).lectures` — la seule que
 * `calcul.ts` lise. Elle n'avait AUCUN consommateur : c'était le défaut 16 c (« deux vérités
 * pour une seule donnée »), avec le risque concret qu'une main corrige un libellé ici et
 * n'obtienne aucun effet à l'écran. Si une table française doit redevenir citable — écran
 * d'administration, documentation —, elle se DÉRIVE de `phrases('fr').lectures` ; elle ne se
 * recopie pas.
 */
