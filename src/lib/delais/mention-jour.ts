/**
 * LA SEULE MENTION QUE LA SURFACE PUBLIQUE GARDE À CÔTÉ DE LA DATE.
 *
 * Décision de Me Vaval, 20 août 2026 : « Le portail public doit uniquement afficher la date.
 * Pas besoin de rediriger l'utilisateur vers une autre page, ou de lui expliquer le
 * raisonnement qui a mené au résultat. **Si la date calculée tombe un jour férié**, le
 * résultat l'affichera en petits caractères. »
 *
 * ⚠️ **C'est la date CALCULÉE qui est examinée, jamais l'intérieur du délai.** Un jour férié
 * situé entre le départ et l'échéance serait du bruit : le délai court, il ne s'interrompt
 * pas. Ce module ne regarde que deux choses : la tête d'affiche (`mentionsJour`), et les
 * jours que le report a FRANCHIS pour l'atteindre (`reportPublic`, en bas de fichier).
 *
 * ⚠️ **DEPUIS LE 20 AOÛT 2026 (après-midi), LA SURFACE PUBLIQUE PROROGE** — art. 991 al. 3,
 * en cascade, sur les 16 entrées PERMANENT et le dimanche (voir `franc-pur.ts`). Conséquence
 * directe sur ce module : la tête d'affiche **ne peut plus** être un dimanche ni une entrée
 * PERMANENT qui proroge, puisque ce sont exactement les jours dont on la fait sortir. Des six
 * genres ci-dessous, DEUX sont encore atteignables sur la date finale : `A_SURVEILLER`, et —
 * depuis le 20 août 2026, au vu du décret — `DEMI_JOURNEE`, le Lundi Gras, que le décret du
 * 11 décembre 2024 ne chôme qu'« à partir de midi » et sur lequel la date s'arrête donc. Les
 * quatre autres restent — ils servent aux jours FRANCHIS, que `reportPublic` fait décrire par
 * les mêmes gabarits, et ils redeviendraient atteignables le jour où la rédaction resserrerait
 * le report.
 *
 * ⚠️ **LE DIMANCHE EST UN AJOUT À L'INSTRUCTION, PAS UNE DÉDUCTION.** Me Vaval n'a nommé que
 * les jours fériés. Le dimanche est ajouté ici parce qu'il est aussi impraticable qu'une fête
 * pour signifier — taire l'un en disant l'autre serait incohérent — mais c'est un ajout : il
 * doit pouvoir être retiré d'une ligne (`estDimanche`, ci-dessous) sans toucher au reste.
 *
 * ⚠️ **QUATRE GENRES, ET ILS NE DISENT PAS LA MÊME CHOSE.** Le calendrier de la version 1
 * porte 21 lignes, et les confondre sous « jour de fête légale » ferait dire à la plateforme
 * ce qu'aucun texte ne dit :
 *
 *   - `FETE_LEGALE` + `autorite: 'TEXTE'` (7) → le décret du 23 mai 1989 : fête légale ;
 *   - `FETE_NATIONALE` (5) → la Constitution, art. 275.1 : fête NATIONALE. ⚠️ **Elles portent
 *     désormais LEUR PROPRE RÉSERVE** (`publicDayNational`, 20 août 2026 au soir), sur le
 *     modèle exact de `publicDayEditorial` : l'art. 991 al. 3 ne vise que « un dimanche ou un
 *     jour de fête légale », et la Constitution DISTINGUE les deux — art. 275.1 énumère les
 *     cinq fêtes nationales, art. 275.2 renvoie les fêtes légales à la loi, et le décret du
 *     23 mai 1989 s'intitule « déterminant, **en dehors des Fêtes Nationales**, les Fêtes
 *     Légales ». Me Vaval a tranché le 20 août 2026 (soir) : elles PROROGENT, sur les deux
 *     surfaces, et la réserve R1 a été retirée. La ligne fine ne peut pas pour autant les ranger
 *     sous l'art. 991 al. 3 sans le dire — l'arrêt Brown and Root (1re Sect. n° 13, 28 mars
 *     1966) tient le dimanche et la fête légale pour « les seuls cas », et c'est le fondement du
 *     CHÔMAGE (Const., art. 275) qu'elle nomme, pas la lettre de l'article ;
 *   - `autorite: 'REDACTION'` (4) → **aucun texte du corpus ne les institue** : la mention le
 *     dit, comme l'avertissement A4 le dit dans le portail ;
 *   - `A_SURVEILLER` (5) → chômage ponctuel par arrêté, jamais une fête permanente : la
 *     mention reprend le vocabulaire de A6 (« un jour à surveiller »), et surtout elle
 *     n'annonce AUCUN report — la surface publique n'en fait pas.
 *
 * ⚠️ **Ce fichier est PUR** : aucune E/S, aucun `Date`, aucune arithmétique de dates. Le nom
 * du jour est localisé ici, au moment où l'entrée du calendrier est encore disponible, pour
 * que la mention traverse ensuite en simple texte — ni la ligne du calendrier, ni sa source,
 * ni ses observations ne sortent avec elle.
 */
import type { JourEcarte, Resultat } from './calcul'
import type { CivilDate } from './civil'
import { estDimanche } from './civil'
import type { EntreeCalendrier, Locale } from './feries'
import { DEPUIS_2024, entreesDuJour, libelle } from './feries'
import type { GenreJour } from './lectures'
import { genreEntree } from './lectures'
import { ARTICLE_PROROGATION_PAR_CODE } from './regimes'

/**
 * Ce que la mention affirme du jour. Une clé i18n par genre — jamais une phrase composée.
 *
 * ⚠️ **LE CLASSEMENT LUI-MÊME A DÉMÉNAGÉ DANS `lectures.ts`** (20 août 2026, soir) : le MOTEUR
 * en a besoin pour composer le raisonnement entrée par entrée, et deux exemplaires du même
 * classement, c'est la dérive garantie. Le type et la fonction sont ré-exportés ici pour les
 * appelants historiques ; leur définition est à côté d'`entreeProroge`, dont ils sont le
 * pendant.
 */
export type GenreMentionJour = GenreJour
export { genreEntree }

/**
 * Une mention, prête à écrire. `nom` est DÉJÀ localisé (avec le repli sur le français de
 * `texteLocalise` : une traduction que personne n'a relue ne passe pas pour relue) ; `cle`
 * n'est là que pour la clé de rendu React et les tests.
 */
export type MentionJour = { genre: GenreMentionJour; cle: string; nom: string }

/**
 * § 4.10 — **LA DEMI-JOURNÉE SE DIT, MÊME QUAND ELLE NE DÉPLACE RIEN** (Me Vaval, 20 août 2026,
 * au vu du décret : « avec la mention en petits caractères que l'après-midi est chômé »).
 *
 * Depuis que `entreeProroge` lit `journee`, une échéance qui tombe le Lundi Gras y RESTE : la
 * matinée est ouvrable, l'acte peut y être signifié, et lui accorder un jour entier retarderait
 * la date limite (§ 0, règle 4). L'écran ne peut pas pour autant se taire — sans mention, la
 * page affiche une date limite qui tombe un jour à demi chômé sans dire que la fenêtre s'y
 * ferme à midi. Le gabarit `publicDayHoliday` (« est un jour de fête légale ») serait, lui,
 * doublement faux : il ne dit pas l'heure, et il laisse croire à un report qui n'a pas eu lieu.
 *
 * ⚠️ **LE GENRE DÉPEND DE LA RÈGLE, PAS DE LA LIGNE.** Sous les règles de la version 1, que
 * rejoue un permalien `rl=1`, la demi-journée EST comptée pour un jour plein : elle proroge, le
 * jour est alors pleinement chômé pour la plateforme, et la mention doit rester celle d'une
 * fête légale. `matineeOuvrable` est donc `!regles.demiJournee`, jamais une propriété de
 * l'entrée.
 *
 * ⚠️ **LA MENTION CITE LE DÉCRET DU 11 DÉCEMBRE 2024 ; ELLE N'EST DONC POSÉE QUE SUR LES
 * ENTRÉES QU'IL INSTITUE** (`appliqueDepuis === DEPUIS_2024`). Le calendrier de la version 1
 * porte lui aussi une demi-journée — le 2 novembre, sur les décrets de 1982 et 1985 —, et un
 * permalien `c=1&rl=2` la rencontrerait : lui coller la citation de 2024 ferait dire à un texte
 * ce qu'il ne dit pas. Elle garde donc sa mention de fête légale, comme avant ce correctif. Le
 * jour où une seconde demi-journée serait instituée, c'est ici qu'on l'ouvre — et la citation
 * devra alors quitter le gabarit pour venir de la donnée.
 *
 * ⚠️ **CE N'EST PAS `sourceDocId`, ET IL A FALLU LE MESURER POUR LE SAVOIR.** Le premier essai
 * comparait `e.sourceDocId` à `DOC_DECRET_2024` : lu sur la base de production le 20 août 2026,
 * la ligne y porte `cmt1x4eza0001m0c3gp6996w7` quand la constante du code vaut
 * `cmqcb6mq5007fzywi4vem7v0g` — un script de liaison a remplacé l'identifiant de la graine, et
 * la mention ne se déclenchait donc JAMAIS en production. Aucun test ne l'aurait dit : ils
 * passent le calendrier du CODE. `appliqueDepuis` est une DATE, écrite à l'identique des deux
 * côtés, et c'est exactement ce que la citation affirme. **Ne reviens pas à l'identifiant.**
 */
function estDemiJourneeOuvrable(e: EntreeCalendrier, matineeOuvrable: boolean): boolean {
  return (
    matineeOuvrable &&
    e.journee === 'DEMI_JOURNEE_APRES_MIDI' &&
    e.appliqueDepuis === DEPUIS_2024
  )
}

/**
 * Les mentions d'une date : les entrées du calendrier qui tombent dessus, puis le dimanche.
 *
 * L'ordre est stable et il a un sens : ce que le calendrier NOMME d'abord, la qualité du jour
 * de semaine ensuite. Le cas « les deux » existe (le 1er janvier tombe un dimanche une année
 * sur sept) : on rend alors DEUX lignes fines plutôt qu'une phrase composée, qui demanderait
 * un gabarit combinatoire dans les trois langues.
 *
 * `matineeOuvrable` — voir `estDemiJourneeOuvrable`. Le défaut est `false` : la valeur qui ne
 * change RIEN pour un appelant qui ne l'a pas encore posée.
 */
export function mentionsJour(
  date: CivilDate,
  entrees: readonly EntreeCalendrier[],
  locale: Locale = 'fr',
  matineeOuvrable = false,
): MentionJour[] {
  const mentions: MentionJour[] = entreesDuJour(date, entrees).map((e) => ({
    genre: estDemiJourneeOuvrable(e, matineeOuvrable)
      ? ('DEMI_JOURNEE' as const)
      : genreEntree(e),
    cle: e.cle,
    nom: libelle(e, locale),
  }))
  if (estDimanche(date)) mentions.push({ genre: 'DIMANCHE', cle: 'dimanche', nom: '' })
  return mentions
}

// ═══════════════════════════════════════════════════════════════════════════════
// LE REPORT — la seconde mention, et elle n'existe que si la date A BOUGÉ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Me Vaval, 20 août 2026 (seconde décision du jour) : « Attention, la date limite est tombée
 * un dimanche, il faut la proroger au prochain jour ouvrable, donc le lundi 6 juillet. »
 *
 * La surface publique n'affiche que la date — mais **un report muet est incompréhensible** :
 * la personne a saisi 31 jours, elle compte sur ses doigts, et elle trouve un jour de moins
 * que l'écran. La ligne en petits caractères dit d'où vient le jour supplémentaire.
 *
 * ⚠️ **ELLE EST DÉRIVÉE DU CALCUL, JAMAIS RECALCULÉE.** Les jours franchis sont ceux que le
 * moteur a réellement écartés (`resultat.joursEcartes`), et l'article cité est celui que le
 * moteur a porté sur le motif (`MotifProrogation.source` — « C. pr. civ., art. 991 al. 3 »,
 * ou l'art. 511 al. 2 en matière de travail). Rien ici ne décide d'un report, ne compte un
 * jour, ni ne nomme un texte de sa propre autorité.
 *
 * ⚠️ **DEUX LIGNES FINES PLUTÔT QU'UNE PHRASE COMPOSÉE.** C'est la règle que `mentionsJour`
 * suit déjà : un gabarit combinatoire (« Le X étant un dimanche ET une fête légale, et le Y
 * étant… ») demanderait, dans les trois langues, une phrase par combinaison de genres. On
 * réemploie donc les gabarits de mention EXISTANTS pour dire ce qu'est chaque jour franchi,
 * et une seule clé neuve (`publicDeferred`) pour conclure sur la date d'arrivée.
 *
 * ⚠️ **`A_SURVEILLER` EST RETIRÉ DES JOURS FRANCHIS.** Un jour à surveiller ne proroge jamais
 * (§ 4.13) : s'il tombe sur un jour franchi pour une AUTRE raison, le nommer là laisserait
 * croire qu'il y est pour quelque chose. Sur la date d'ARRIVÉE, en revanche, il garde sa
 * mention — c'est `mentionsJour` qui la rend, et elle ne déplace rien.
 */
export type JourFranchi = { date: CivilDate; mentions: MentionJour[] }

export type ReportPublic = {
  /** Les jours franchis, dans l'ordre où le délai les a rencontrés. Jamais vide. */
  jours: JourFranchi[]
  /** La date d'arrivée : la tête d'affiche, telle que le moteur l'a rendue. */
  arrivee: CivilDate
  /**
   * L'article QUI PROROGE — « C. pr. civ., art. 991 al. 3 », ou l'art. 511 al. 2 en matière
   * de travail.
   *
   * ⚠️ **CE N'EST PAS LA SOURCE DU MOTIF.** `MotifProrogation.source` porte, pour une entrée
   * du calendrier, le texte qui INSTITUE LA FÊTE — le décret du 23 mai 1989 et sa référence
   * au Moniteur, deux lignes entières. La ligne aurait alors dit « … le délai est prorogé au
   * samedi 26 décembre 2026 (Décret du 23 mai 1989 déterminant, en dehors des Fêtes
   * Nationales, … Le Moniteur n° 47-A du jeudi 22 juin 1989 ; reproduit à l'article 110 du
   * Code du travail.) ». Ce qu'on cite au bout d'un report, c'est l'article qui l'autorise.
   */
  source: string
}

/**
 * Le report d'un résultat — ou `null` s'il n'y en a pas eu, ce qui est le cas le plus
 * fréquent. Un refus et une saisie incomplète n'ont pas de date : ils rendent `null` aussi.
 */
export function reportPublic(
  resultat: Resultat,
  entrees: readonly EntreeCalendrier[],
  locale: Locale = 'fr',
  matineeOuvrable = false,
): ReportPublic | null {
  if (resultat.statut !== 'CALCUL') return null
  const ecartes: readonly JourEcarte[] = resultat.joursEcartes
  if (ecartes.length === 0) return null
  return {
    jours: ecartes.map((j) => ({
      date: j.date,
      // ⚠️ `matineeOuvrable` traverse, mais il ne peut RIEN atteindre ici sous les règles de la
      // version 2 : un jour dont la matinée reste ouvrable ne proroge pas, il n'est donc jamais
      // FRANCHI — la cascade s'arrête dessus. On le passe quand même, pour qu'une future règle
      // qui rouvrirait ce chemin ne trouve pas ici une seconde vérité.
      mentions: mentionsJour(j.date, entrees, locale, matineeOuvrable).filter(
        (m) => m.genre !== 'A_SURVEILLER',
      ),
    })),
    arrivee: resultat.teteAffiche,
    // La MÊME table que `sourceProrogation()` dans le moteur : une seule vérité (défaut 16 c).
    source: ARTICLE_PROROGATION_PAR_CODE[resultat.entree.code],
  }
}
