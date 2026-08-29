/**
 * CORPUS DES MARCHÉS PUBLICS — la table des 25 fiches et les outils de PREUVE partagés
 * par `scripts/importer-marches-publics.ts` (B) et `scripts/graphe-marches-publics.ts` (C).
 *
 * (Feuille de route « Lam — Prompt marchés publics (corpus) », 27 août 2026, § 4 et § 8.4.)
 *
 * ─── CE QUE CE FICHIER N'EST PAS ────────────────────────────────────────────────────────
 * Ce n'est PAS une source de confiance. Aucune de ses chaînes n'entre en base sans avoir été
 * confrontée au corps préparé — leçon payée sur la loi CEC : une coquille injectée dans un
 * fichier de préparation passait toute la simulation en vert. D'où :
 *
 *  · `titre.composition` — chaque morceau marqué CORPS doit se LIRE à la pièce canonique (à
 *    la casse, aux apostrophes, aux espaces et aux tirets près : `plier()`), et le titre
 *    entier doit être EXACTEMENT le recollement des morceaux. Tout mot du titre qui n'est PAS
 *    à la pièce doit être déclaré EDITORIAL et appartenir à `LIANTS_AUTORISES` — liste
 *    FERMÉE, affichée au rapport texte par texte. C'est le seul endroit où un mot d'éditeur
 *    entre dans un intitulé, et il est compté. ⚠️ Depuis la découpe du 28 août, le rapport
 *    dit AUSSI où chaque morceau se lit : dans l'acte versé, ou au seul sommaire du fascicule.
 *    Six textes ont été dans ce cas (n° 01, 05, 08, 16, 18, 23) ; depuis la RESTITUTION des
 *    intitulés (décision de Me Vaval du 28 août, « ajouter les titres au début »), leur
 *    intitulé se lit de nouveau AU CORPS. Le mécanisme reste, et le compte se RECALCULE :
 *    il dira le prochain texte qui tombera dans ce cas.
 *  · `adoption.appui` / `publication.appui` / `fascicule.appui` — fragments de la pièce
 *    (bloc « Donné » pour l'adoption, qui est AU CORPS ; bandeau du fascicule pour la
 *    publication et le numéro, qui n'y sont PLUS depuis le 28 août). La date écrite en base
 *    est recalculée en toutes lettres (`dateFrancaise`) et doit se lire DANS l'appui : une
 *    date fausse ne passe pas.
 *  · `deriverCorps()` — le corps versé est RE-DÉRIVÉ de la pièce canonique en rejouant la
 *    découpe déclarée (segments − retraits + insertions + jointures) ; il doit retomber sur le
 *    corps préparé À L'OCTET. Les 90 jointures d'en-tête sont en outre prouvées SANS PERTE :
 *    le libellé, séparateurs mis à plat, égale les lignes sources mises bout à bout.
 *  · `decoupe.insertions` — le PENDANT de `hors_segments`. La garde de couverture contrôle ce
 *    qui SORT du corps ; rien ne contrôlait ce qui y ENTRE. Depuis la décision de Me Vaval du
 *    28 août 2026 (« ajouter les titres au début »), les corps qui n'ouvraient pas sur leur
 *    objet portent en tête l'INTITULÉ que le Journal officiel n'imprime qu'au SOMMAIRE du même
 *    fascicule. Cet intitulé ne s'invente pas : il se RESTITUE, et la garde le prouve —
 *    `texte_source` doit se lire VERBATIM, exactement une fois, à la ligne de la PIÈCE qu'elle
 *    déclare, et porter un motif non vide.
 *    Deux refus, sur le modèle exact de ceux des `retraits` et des `hors_segments` (leçon CEC :
 *    un champ de fondation qui finit dans un corps se PROUVE, il ne se recopie pas).
 *    ⚠️ ET UN TROISIÈME DEPUIS LE SOIR DU 28 AOÛT — LE CONTRAT À DEUX CHAÎNES. Me Vaval a
 *    tranché la CASSE : « ayez les majuscules comme pour le traitement des autres et non en
 *    all caps ». Quatre lignes de sommaire sur dix étant composées en CAPITALES par le J.O.,
 *    ce qui entre au corps n'est plus toujours la chaîne de la pièce à l'octet. La garde
 *    n'a pas été affaiblie, elle a été DÉDOUBLÉE : `texte_source` (la pièce, prouvée comme
 *    avant) et `texte` (le corps), plus une `transformation` déclarée dès que les deux
 *    diffèrent — et `ecartHorsCasse()` refuse tout écart qui ne soit pas de casse. Aucun des
 *    douze sabotages typographiques que la garde refusait ne passe : ni un mot changé, ni une
 *    ponctuation déplacée, ni une apostrophe redressée, ni un accent ôté.
 *
 * Aucun nombre fixe n'est asserté ici : les comptes sont des PRODUITS recalculés.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { articleAnchorFromHeading, articleAnchorFromNum } from '../../../src/lib/doc/anchors'

export const DIR = join(process.cwd(), 'scripts/data/marches-publics')

export const md5 = (s: string | Buffer): string => createHash('md5').update(s as never).digest('hex')

/**
 * Pliage de comparaison — apostrophes, espaces (insécables comprises), tirets, casse.
 * ⚠️ NE SERT QU'À COMPARER. Rien de ce qui est écrit en base ne passe par cette fonction :
 * les citations ne sont jamais normalisées (interdit n° 8).
 */
export function plier(s: string): string {
  const out: string[] = []
  let espace = true
  for (const ch of s) {
    let c = ch
    if (c === '’' || c === '‘') c = "'"
    if (c === ' ' || c === ' ' || c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ' ') c = ' '
    if (c === '–' || c === '—' || c === '‒') c = '-'
    c = c.toLowerCase()
    if (c === ' ') {
      if (espace) continue
      espace = true
    } else espace = false
    out.push(c)
  }
  return out.join('').trim()
}

/**
 * LE PLIAGE QUI NE REPLIE QUE LA CASSE — et rien d'autre (§ 8.4, décision de Me Vaval du
 * 28 août 2026 sur la casse des intitulés restitués).
 *
 * Rend `null` si `entre` ne diffère de `source` QUE par la casse de ses lettres ; sinon, la
 * DÉSIGNATION du premier écart, pour que le refus dise ce qu'il refuse.
 *
 * ⚠️ NE PAS EMPLOYER `plier()` ICI, ET NE PAS ÔTER LES ACCENTS. Deux pièges, mesurés avant
 * d'écrire cette fonction :
 *  · `plier()` replie AUSSI les apostrophes, les espaces (insécables comprises) et les tirets.
 *    Il déclarerait « d’intervention » et « d'intervention » identiques : une apostrophe
 *    redressée passerait pour de la casse, alors que c'est une citation NORMALISÉE dans un
 *    corps (interdit n° 8) — précisément ce que la garde des insertions a refusé douze fois.
 *  · un pliage qui ôterait les accents déclarerait « É » et « E » identiques. « É » → « E »
 *    n'est PAS de la casse : c'est un changement de LETTRE. Il doit être refusé.
 * D'où une comparaison point de code par point de code : même longueur, et tout écart doit
 * opposer deux LETTRES qui sont l'une la variante de casse de l'autre — dans les DEUX sens
 * (`toLowerCase` ET `toUpperCase`), ce qui ferme au passage les homoglyphes de casse comme
 * le K de Kelvin (U+212A), qui minusculise en « k » sans être un « K ».
 */
export function ecartHorsCasse(source: string, entre: string): string | null {
  const a = Array.from(source)
  const b = Array.from(entre)
  const pt = (c: string): string => `« ${c} » (U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')})`
  if (a.length !== b.length)
    return `longueurs différentes — ${a.length} caractère(s) à la pièce, ${b.length} au corps : ce n'est pas une affaire de casse`
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue
    const lettres = /\p{L}/u.test(a[i]) && /\p{L}/u.test(b[i])
    const memeLettre = a[i].toLowerCase() === b[i].toLowerCase() && a[i].toUpperCase() === b[i].toUpperCase()
    if (!lettres || !memeLettre) return `caractère ${i + 1} : ${pt(a[i])} à la pièce, ${pt(b[i])} au corps`
  }
  return null
}

/** Les seules LETTRES d'une chaîne, dans l'ordre, casse comprise. Sert à confronter une casse
 *  à celle d'un intitulé sans que la ponctuation ni les espaces s'en mêlent. */
const lettresDe = (s: string): string => Array.from(s).filter((c) => /\p{L}/u.test(c)).join('')

/**
 * LA CASSE D'UNE LIGNE RESTITUÉE NE SE JUGE PAS : ELLE SE DÉRIVE DU `titleFr` DE LA FICHE.
 *
 * Compte combien de fois les lettres de `chaine` — À LA CASSE — se lisent d'affilée dans les
 * lettres de `titre`. 1 = la casse de la chaîne est celle du titre, à cet endroit-là et à un
 * seul ; 0 = quelqu'un a jugé « Cahier » ou « cahier » à la main, et l'assertion tombe.
 *
 * ⚠️ On ne compare QUE les lettres : le titre de fiche ne porte pas le point final que le J.O.
 * imprime au sommaire, et il porte parfois une apostrophe d'une autre graphie. Ce que le titre
 * commande est la CASSE, rien d'autre — la ponctuation et les apostrophes restent celles de la
 * PIÈCE, et c'est `ecartHorsCasse()` qui l'assure de son côté.
 */
export function casseLueDansLeTitre(titre: string, chaine: string): number {
  const t = lettresDe(titre)
  const c = lettresDe(chaine)
  if (!c) return 0
  let n = 0
  let i = t.indexOf(c)
  while (i >= 0) {
    n++
    i = t.indexOf(c, i + 1)
  }
  return n
}

/** Nombre d'occurrences de `aiguille` (pliée) dans `meule` (pliée). 0 = introuvable. */
export function occurrencesPliees(meule: string, aiguille: string): number {
  const m = plier(meule)
  const a = plier(aiguille)
  if (!a) return 0
  let n = 0
  let i = m.indexOf(a)
  while (i >= 0) {
    n++
    i = m.indexOf(a, i + 1)
  }
  return n
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
/** « 2022-06-01 » → « 1er juin 2022 » ; « 2004-12-03 » → « 3 décembre 2004 ». */
export function dateFrancaise(iso: string): string {
  const [a, m, j] = iso.split('-').map(Number)
  return `${j === 1 ? '1er' : j} ${MOIS[m - 1]} ${a}`
}

// ════════════════════════════════════════════════════════════════════════════════════════
// LES MOTS D'ÉDITEUR ADMIS DANS UN INTITULÉ — liste FERMÉE (§ 8.4, interdit n° 16)
// ════════════════════════════════════════════════════════════════════════════════════════
/**
 * Une partie des intitulés du lot n'est pas imprimée en toutes lettres par le J.O. : le
 * fascicule n'annonce l'acte que par son objet (« Est et demeure sanctionné pour sortir son
 * plein et entier effet le dossier… »). L'intitulé de fiche se construit alors de la NATURE de
 * l'acte (imprimée : « ARRÊTÉ ») + un participe + l'objet LU AU DISPOSITIF. Seuls ces
 * participes sont admis, et chaque emploi est affiché au rapport.
 *
 * ⚠️ AUCUN NOMBRE N'EST AFFIRMÉ ICI (§ 10.8) : le rapport de B RECOMPTE les emplois. La
 * RESTITUTION des intitulés du 28 août en a fait tomber deux — les textes n° 07 et n° 17
 * portent désormais au corps l'intitulé que le J.O. imprime au sommaire de leur fascicule,
 * mot pour mot ; leur participe (« sanctionnant », « nommant ») n'est donc plus un mot
 * d'éditeur, et leur composition est redevenue un seul morceau LU À LA PIÈCE. La CHARTE
 * D'ÉTHIQUE (n° 09) a rejoint ce cas le soir même, sur décision de Me Vaval : son sommaire
 * imprime aussi l'intitulé entier. La liste ci-dessous reste une PERMISSION FERMÉE, pas un
 * relevé d'usage : « nommant » n'est plus employé par aucune fiche, et il est conservé — le
 * retirer ne prouverait rien de plus. Le rapport de B dit, lui, qui l'emploie encore.
 */
export const LIANTS_AUTORISES = ['sanctionnant', 'nommant'] as const

// ════════════════════════════════════════════════════════════════════════════════════════
// § 13.2 — LA NOMINATION DU 26 DÉCEMBRE 2019 : UNE SEULE LIGNE, LUE PAR B ET PAR C
// ════════════════════════════════════════════════════════════════════════════════════════
/**
 * L'arrêté publié au Moniteur n° 221 du 30 décembre 2019 est un acte de NOMINATION individuel,
 * au mandat de trois ans échu. Le § 13.2 posait la question — « verser en PUBLIE avec sa note,
 * ou l'écarter du corpus ? »
 *
 * **TRANCHÉ PAR ME VAVAL LE 28 AOÛT 2026 : « à verser ».** L'acte entre au corpus, en PUBLIE,
 * avec sa note ; le lot passe de 24 à 25 textes et l'arête F17 du graphe revient avec lui.
 *
 * ⚠️ CE DRAPEAU EST DÉCLARÉ UNE SEULE FOIS, et B (les 25 fiches) comme C (le graphe, y compris
 * en pré-vol) le lisent ici : elles ne peuvent pas diverger. C'est la leçon du 28 août au matin
 * — les deux fondations portaient alors des valeurs CONTRAIRES (B versait, `graphe-pastilles.json`
 * déclarait « ne pas verser sans décision »), et un `--apply` aurait tranché à la place de
 * Me Vaval. `graphe-pastilles.json` porte désormais la DÉCISION, plus un défaut d'attente.
 */
export const VERSER_NOMINATION_2019 = true

export interface MorceauTitre {
  src: 'CORPS' | 'EDITORIAL'
  txt: string
}
export interface Fiche {
  /** n° de la liste canonique du § 4 (« 00 » = la loi-mère). */
  id: string
  slug: string
  /** `Document.source` — préfixe MARCHES_, mesuré libre le 27 août (0 source existante). */
  source: string
  /** fiche de préparation (tâche 2) : `prep-NN-<slug>.json` + son `-corps.txt`. */
  prep: string
  titre: { fr: string; composition: MorceauTitre[] }
  /** `adoptionDate` = bloc « Donné » (§ 8.4). RÈGLE RÉVISÉE PAR ME VAVAL LE 28 AOÛT 2026 : pour une LOI,
   *  le bloc du DERNIER VOTE parlementaire (la promulgation ne compte pas) ; pour un décret ou un arrêté,
   *  celui de la promulgation/signature. Le type reste nullable, mais AUCUNE fiche du lot ne porte `null`
   *  depuis cette révision — la loi-mère porte 2009-06-10 (vote de la Chambre). */
  adoption: { iso: string; appui: string } | null
  publication: { iso: string; appui: string } | null
  /** n° d'Index du Moniteur + le fragment de bandeau qui le prouve au corps. */
  fascicule: { numeroIndex: string; appui: string } | null
  moniteurRef: string
  /** Statut à la CRÉATION (B). Les statuts ABROGE sont fondés sur la clause d'un autre texte
   *  du lot, prouvée par C ; ils sont posés dès B pour qu'aucune fiche abrogée ne s'affiche
   *  « en vigueur » entre les deux étapes. */
  status: 'EN_VIGUEUR' | 'ABROGE' | 'PUBLIE'
  /** Réserve de complétude / mention obligatoire (§ 4.3, § 8.4) — écrite en `summaryFr` par B. */
  note: string | null
  /** Question du § 13 attachée à ce texte — affichée au rapport, jamais tranchée. */
  question: string | null
}

// ════════════════════════════════════════════════════════════════════════════════════════
// LES 25 FICHES
// ════════════════════════════════════════════════════════════════════════════════════════
const C = (txt: string): MorceauTitre => ({ src: 'CORPS', txt })
const E = (txt: string): MorceauTitre => ({ src: 'EDITORIAL', txt })

export const FICHES: Fiche[] = [
  {
    id: '00',
    slug: 'loi-mere-2009',
    source: 'MARCHES_LOI_2009',
    prep: 'prep-00-loi-mere-2009',
    titre: {
      fr: 'Loi fixant les règles générales relatives aux Marchés Publics et aux Conventions de Concession d’Ouvrage de Service Public',
      composition: [C("Loi fixant les règles générales relatives aux Marchés Publics et aux Conventions de Concession d'Ouvrage de Service Public")],
    },
    // ⚠️ RÈGLE RÉVISÉE PAR ME VAVAL LE 28 AOÛT 2026 — elle remplace celle du 27 et tranche ce
    // qui était en suspens : « la date d'une LOI est la date du DERNIER VOTE (Chambre des
    // Députés ou Sénat), la date de promulgation par la présidence NE COMPTE PAS. Pour les
    // décrets et les arrêtés, la date est celle de la promulgation et de la signature. »
    // Le corps porte TROIS blocs « Donné » : Sénat 4 juin, Chambre 10 juin, Palais National
    // 12 juin. Le dernier VOTE est celui de la Chambre ⇒ 2009-06-10. La promulgation ne compte
    // plus. ⚠️ Et la règle rejoint le nom d'usage : « Loi du 10 juin 2009 » EST sa date
    // d'adoption. Les 24 autres textes du lot sont des décrets et des arrêtés : leur date
    // reste la promulgation, la règle révisée le confirme.
    adoption: {
      iso: '2009-06-10',
      appui: 'Donnée à la Chambre des Députés à Port-au-Prince, le mercredi 10 juin 2009',
    },
    publication: { iso: '2009-07-28', appui: 'Mardi 28 Juillet 2009' },
    fascicule: { numeroIndex: 'LM2009-78', appui: 'No. 78' },
    moniteurRef:
      'Le Moniteur · LM2009-78 · 164ème année, n° 78 du mardi 28 juillet 2009 — reproduction pour erreurs matérielles ; voir Le Moniteur n° 60 du vendredi 12 juin 2009 (LM2009-60)',
    status: 'EN_VIGUEUR',
    note:
      'La pièce transcrite est la reproduction pour erreurs matérielles publiée au Moniteur n° 78 du mardi 28 juillet 2009, qui renvoie au Moniteur n° 60 du vendredi 12 juin 2009 : laquelle des deux publications fait foi n’est pas tranchée ici. Le texte est désigné, ici comme dans les visas de tous ses arrêtés d’application, « Loi du 10 juin 2009 » — date du vote de la Chambre des Députés. Le Sénat l’a votée le 4 juin 2009 ; la promulgation présidentielle est datée du 12 juin 2009. La date d’adoption portée en fiche est celle de ce dernier vote, le 10 juin 2009 : la règle révisée par Me Vaval le 28 août 2026 veut que, pour une loi, ce soit le dernier vote parlementaire qui compte, la promulgation ne comptant pas.',
    question:
      '§ 13.1 — l’intitulé de fiche est celui que le J.O. imprime, sans millésime. Faut-il y faire figurer le nom d’usage « Loi du 10 juin 2009 » ?',
  },
  {
    id: '01',
    slug: 'decret-2004',
    source: 'MARCHES_DECRET_2004',
    prep: 'prep-01-decret-2004',
    titre: {
      fr: 'Décret fixant la réglementation des marchés publics de services, de fournitures et de travaux',
      composition: [C('DÉCRET FIXANT\nLA RÉGLEMENTATION DES MARCHÉS PUBLICS DE SERVICES, DE FOURNITURES ET DE TRAVAUX')],
    },
    adoption: { iso: '2004-12-03', appui: "Donné au Palais National, à Port-au-Prince, le 3 décembre 2004, An 201ème de l'Indépendance." },
    publication: { iso: '2005-02-14', appui: 'Lundi 14 Février 2005' },
    fascicule: { numeroIndex: 'LM2005-12', appui: 'No. 12' },
    moniteurRef: 'Le Moniteur · LM2005-12 · 160ème année, n° 12 du lundi 14 février 2005',
    // Abrogé par l'article 99 de la Loi du 10 juin 2009, qui le NOMME (clause prouvée par C).
    status: 'ABROGE',
    note: null,
    question: null,
  },
  {
    id: '02',
    slug: 'arr-modalites-2009',
    source: 'MARCHES_ARR_MODALITES_2009',
    prep: 'prep-02-arr-modalites-2009',
    titre: {
      fr: 'Arrêté précisant les modalités d’application de la Loi fixant les règles générales relatives aux Marchés Publics et aux Conventions de Concession d’Ouvrage de Service Public',
      composition: [
        C('Arrêté précisant les modalités d’application de la Loi fixant les Règles Générales Relatives aux Marchés Publics et aux Conventions de Concession d’Ouvrage de Service Public'),
      ],
    },
    adoption: { iso: '2009-10-26', appui: 'Donné au Palais National, à Port-au-Prince, le 26 octobre 2009, An 206ème de l’Indépendance.' },
    publication: { iso: '2009-11-04', appui: 'Mercredi 4 Novembre 2009' },
    fascicule: { numeroIndex: 'LM2009-SP10', appui: 'Spécial No. 10' },
    moniteurRef: 'Le Moniteur · LM2009-SP10 · 164ème année, Spécial n° 10 du mercredi 4 novembre 2009 (1er texte du fascicule)',
    status: 'EN_VIGUEUR',
    note:
      'RÉSERVE DE COMPLÉTUDE : à l’article 174, l’exemplaire source est partiellement illisible ; la transcription porte, en plein corps, la mention d’éditeur « [Début d’article partiellement illisible dans l’exemplaire source — le texte reprend comme suit :] ». Le début de cet article manque.',
    question: null,
  },
  {
    id: '03',
    slug: 'arr-manuel-2009',
    source: 'MARCHES_ARR_MANUEL_2009',
    prep: 'prep-03-arr-manuel-2009',
    titre: {
      fr: 'Arrêté sanctionnant le Manuel de Procédures pour la Passation des Marchés Publics et des Conventions de Concession d’Ouvrage de Service Public',
      composition: [
        C('Arrêté sanctionnant le Manuel de Procédures pour la Passation des Marchés Publics et des Conventions de Concession d’Ouvrage de Service Public'),
      ],
    },
    adoption: { iso: '2009-10-26', appui: 'Donné au Palais National, à Port-au-Prince, le 26 octobre 2009, An 206ème de l’Indépendance' },
    publication: { iso: '2009-11-04', appui: 'Mercredi 4 Novembre 2009' },
    fascicule: { numeroIndex: 'LM2009-SP10', appui: 'Spécial No. 10' },
    moniteurRef: 'Le Moniteur · LM2009-SP10 · 164ème année, Spécial n° 10 du mercredi 4 novembre 2009 (2e texte du fascicule)',
    status: 'EN_VIGUEUR',
    note:
      'RÉSERVE DE COMPLÉTUDE (§ 4.3) : le Manuel de procédures annexé s’achève sans colophon, au point 2 de la section 4.2.1, sur une phrase close. La fin est plausible mais n’est pas certifiable sur pièces. ' +
      'CONJECTURE D’ÉDITEUR RETIRÉE DU DISPOSITIF (§ 11.11) : au § 3.1.2.11, la phrase « … à réaliser les actions énumérées au § 2.8 ci-dessous » portait, entre crochets, la mention « [sic — renvoi tel que figurant dans le texte source ; il s’agit vraisemblablement du § 3.1.2.12] ». Le renvoi « § 2.8 » est celui du Journal officiel et reste tel quel ; la conjecture sur le § réellement visé n’est pas du texte officiel et est reportée ici. Elle N’EST PAS vérifiée : le § 3.1.2.12 n’est qu’une hypothèse de l’éditeur de la transcription.',
    question:
      '§ 13.11 — accepter la réserve sur la fin du Manuel, ou chercher la fin sur le fac-similé du Spécial n° 10 ? Et le renvoi « § 2.8 » de l’article 3.1.2.11 : coquille du J.O. (lire § 3.1.2.12) ou renvoi exact ? Rien n’a été lu sur le scan.',
  },
  {
    id: '04',
    slug: 'arr-org-cnmp-2009',
    source: 'MARCHES_ARR_ORG_CNMP_2009',
    prep: 'prep-04-arr-org-cnmp-2009',
    titre: {
      fr: 'Arrêté déterminant les modalités d’organisation et de fonctionnement de la Commission Nationale des Marchés Publics (CNMP)',
      composition: [C("ARRÊTÉ\ndéterminant les modalités d'organisation et de fonctionnement de la Commission Nationale des Marchés Publics (CNMP)")],
    },
    adoption: { iso: '2009-10-26', appui: "Donné au Palais National, à Port-au-Prince, le 26 octobre 2009, An 206ème de l'Indépendance." },
    publication: { iso: '2009-11-04', appui: 'Mercredi 4 Novembre 2009' },
    fascicule: { numeroIndex: 'LM2009-SP10', appui: 'Spécial No. 10' },
    moniteurRef: 'Le Moniteur · LM2009-SP10 · 164ème année, Spécial n° 10 du mercredi 4 novembre 2009 (3e texte du fascicule)',
    status: 'EN_VIGUEUR',
    note:
      'SIC DU JOURNAL OFFICIEL conservé : l’article 30 vit sous la tête « Articles 30.- », au pluriel. L’ancre reste `art-30`. ' +
      'APPAREIL D’ÉDITEUR ÉCARTÉ DU CORPS (§ 8.4) : le colophon des Presses Nationales, qui suivait la dernière signature, n’est pas versé ; il portait la mention d’éditeur « [lecture incertaine sur l’original] » sur l’adresse, laquelle part avec lui. Le N.B. de l’éditeur sur les signatures « pr. » (apposées par délégation) est également retiré du dispositif — il est reporté ici : les signatures précédées de « pr. » l’ont été par délégation, le nom du signataire effectif figurant en seconde ligne.',
    question:
      '⚠️ VISA CONSTITUTIONNEL NON VÉRIFIÉ SUR LE SCAN (§ 4.2, mesuré le 28 août) — la transcription retenue et l’une des deux rivales écartées lisent « … 159, 160, 165, 200-1 et 200-2 » ; l’autre rivale lit « 166 ». La majorité est du côté de la leçon versée, mais aucune des deux n’a été lue sur le fac-similé du Spécial n° 10 : faut-il vérifier 165 contre 166 sur le scan avant de verser ?',
  },
  {
    id: '05',
    slug: 'arr-dao-travaux-2011',
    source: 'MARCHES_ARR_DAO_TRAVAUX_2011',
    prep: 'prep-05-arr-dao-travaux-2011',
    titre: {
      fr: 'Arrêté sanctionnant pour sortir son plein et entier effet le Dossier d’Appel d’Offres standard pour la Réalisation de Travaux',
      composition: [C("Arrêté sanctionnant pour sortir son plein et entier effet le Dossier d'Appel d'Offres standard pour la Réalisation de Travaux")],
    },
    adoption: { iso: '2011-05-10', appui: "Donné au Palais National à Port-au-Prince, le 10 mai 2011, An 208ème de l'Indépendance." },
    publication: { iso: '2011-05-13', appui: 'Vendredi 13 Mai 2011' },
    fascicule: { numeroIndex: 'LM2011-SP3', appui: 'Spécial No. 3' },
    moniteurRef: 'Le Moniteur · LM2011-SP3 · 166ème année, Spécial n° 3 du vendredi 13 mai 2011 (Tome I)',
    status: 'EN_VIGUEUR',
    note:
      'ARRÊTÉ-CHAPEAU de deux articles, complet. L’ANNEXE qu’il sanctionne — le Dossier d’Appel d’Offres standard lui-même — n’est pas transcrite et ne figure donc pas ici. La série du 10 mai 2011 compte dix arrêtés (énumérés aux visas de la Charte de 2012) ; le corpus n’en porte que trois.',
    question: null,
  },
  {
    id: '06',
    slug: 'arr-dtp-consultants-2011',
    source: 'MARCHES_ARR_DTP_CONSULTANTS_2011',
    prep: 'prep-06-arr-dtp-consultants-2011',
    titre: {
      fr: 'Arrêté sanctionnant pour sortir son plein et entier effet le dossier de demandes types de propositions pour des services de consultants et modèles de contrats',
      composition: [
        C('ARRÊTÉ'),
        E('sanctionnant'),
        C('pour sortir son plein et entier effet le dossier de demandes types de propositions pour des services de consultants et modèles de contrats'),
      ],
    },
    adoption: { iso: '2011-05-10', appui: 'Donné au Palais National, à Port-au-Prince, le 10 mai 2011, An 208ème de l’Indépendance.' },
    publication: { iso: '2011-05-13', appui: 'Vendredi 13 Mai 2011' },
    fascicule: { numeroIndex: 'LM2011-SP3', appui: 'Spécial No. 3' },
    moniteurRef: 'Le Moniteur · LM2011-SP3 · 166ème année, Spécial n° 3 du vendredi 13 mai 2011 (Tome III)',
    status: 'EN_VIGUEUR',
    note:
      'ARRÊTÉ-CHAPEAU de deux articles, complet. L’ANNEXE qu’il sanctionne n’est pas transcrite. ⚠️ Le nom du fichier de transcription désignait un « DAO informatique » : l’identification est faite au corps — le dispositif sanctionne le dossier de demandes types de propositions pour des services de consultants.',
    question: null,
  },
  {
    id: '07',
    slug: 'arr-ccag-2011',
    source: 'MARCHES_ARR_CCAG_2011',
    prep: 'prep-07-arr-ccag-2011',
    titre: {
      fr: 'Arrêté sanctionnant pour sortir son plein et entier effet le Cahier des clauses administratives générales (CCAG) applicables aux marchés publics de fournitures, de services, d’informatique et de bureautique',
      // ⚠️ UN SEUL MORCEAU DEPUIS LA RESTITUTION DU 28 AOÛT : le sommaire du Spécial n° 3
      // imprime l'intitulé entier (l. 11 de la pièce), et il est désormais au corps. Le
      // participe « sanctionnant » n'est plus un mot d'éditeur — il est du Journal officiel.
      composition: [
        C('Arrêté sanctionnant pour sortir son plein et entier effet le Cahier des clauses administratives générales (CCAG) applicables aux marchés publics de fournitures, de services, d’informatique et de bureautique'),
      ],
    },
    adoption: { iso: '2011-05-10', appui: 'Donné au Palais National, à Port-au-Prince, le 10 mai 2011, An 208ème de l’Indépendance.' },
    publication: { iso: '2011-05-13', appui: 'Vendredi 13 Mai 2011' },
    fascicule: { numeroIndex: 'LM2011-SP3', appui: 'Spécial No. 3' },
    moniteurRef: 'Le Moniteur · LM2011-SP3 · 166ème année, Spécial n° 3 du vendredi 13 mai 2011 (Tome IV)',
    status: 'EN_VIGUEUR',
    note:
      'FRAGMENT (§ 4.3) : la page 2 du Moniteur manque au scan source. L’en-tête propre de l’arrêté, les visas et les premiers considérants ne sont pas reproduits ; le texte reprend au milieu des considérants, page 3. Dispositif et signatures sont complets. LA LACUNE N’EST PAS COMBLÉE : rien du fragment manquant n’a été reconstitué. L’ANNEXE sanctionnée — le CCAG lui-même — n’est pas transcrite. ' +
      '⚠️ DEUX LIGNES SE SUIVENT EN TÊTE DU CORPS, ET ELLES NE VIENNENT PAS DU MÊME ENDROIT. La première est l’INTITULÉ de l’acte, RESTITUÉ mot pour mot du sommaire du même fascicule (Spécial n° 3 du 13 mai 2011, l. 11 de la pièce), où le Journal officiel l’imprime — décision de Me Vaval du 28 août 2026 ; la classification « COMMISSION NATIONALE DES MARCHÉS PUBLICS (CNMP). » qui l’ouvre au sommaire et la mention « TEXTES Y ANNEXÉS. » qui le ferme sont restées dehors. La seconde est la MENTION D’ÉDITEUR « [Début de l’extrait — le texte reprend au milieu des considérants, page 3 du Moniteur] », qui n’est pas du Journal officiel et qui a été conservée parce qu’elle borne le fragment. L’intitulé est placé AU-DESSUS d’elle, et non en dessous, précisément pour qu’elle continue de dire vrai : tout ce qui la SUIT est l’extrait survivant de la page 3 ; ce qui la précède vient du sommaire. Le bloc de note de transcription qui la suivait, lui, reste retiré du dispositif.',
    question:
      '§ ouvert — la mention d’éditeur « [Début de l’extrait…] » est le seul repère du début du fragment : la laisser au corps, la déplacer en note de fiche, ou la remplacer par une marque de rendu ?',
  },
  {
    id: '08',
    slug: 'arr-seuils-2012',
    source: 'MARCHES_ARR_SEUILS_2012',
    prep: 'prep-08-arr-seuils-2012',
    titre: {
      fr: 'Arrêté fixant les seuils de passation des marchés publics et les seuils d’intervention de la Commission Nationale des Marchés Publics',
      composition: [C("Arrêté fixant les seuils de passation des marchés publics\net les seuils d'intervention de la Commission Nationale des Marchés Publics")],
    },
    adoption: { iso: '2012-05-25', appui: "Donné au Palais National, à Port-au-Prince, le 25 mai 2012, An 209ème de l'Indépendance." },
    publication: { iso: '2012-06-29', appui: 'Vendredi 29 Juin 2012' },
    fascicule: { numeroIndex: 'LM2012-104', appui: 'No. 104' },
    moniteurRef:
      'Le Moniteur · LM2012-104 · 167ème année, n° 104 du vendredi 29 juin 2012 — transcrit sur la reproduction pour erreurs matérielles ; publication d’origine : Le Moniteur n° 93 du jeudi 14 juin 2012 (LM2012-93)',
    status: 'EN_VIGUEUR',
    note:
      'Le texte est transcrit sur la REPRODUCTION pour erreurs matérielles (n° 104 du 29 juin 2012), et non sur la publication d’origine (n° 93 du 14 juin 2012). La date du 29 juin est celle que porte le fac-similé de la reproduction.',
    question: null,
  },
  {
    id: '09',
    slug: 'arr-charte-ethique-2012',
    source: 'MARCHES_ARR_CHARTE_2012',
    prep: 'prep-09-arr-charte-ethique-2012',
    titre: {
      fr: 'Arrêté sanctionnant pour sortir son plein et entier effet la Charte d’Éthique applicable aux acteurs des marchés publics et des conventions de concession d’ouvrage de service public',
      // ⚠️ UN SEUL MORCEAU DEPUIS LA RESTITUTION DU 28 AOÛT AU SOIR (décision de Me Vaval sur
      // la Charte d'éthique, « oui »), comme pour les n° 07 et 17 : le sommaire du n° 3 du
      // 9 janvier 2013 imprime l'intitulé ENTIER sur une ligne (l. 9 de la pièce), et il est
      // désormais au corps. Le participe « sanctionnant » n'est donc plus un mot d'éditeur —
      // il est du Journal officiel. MESURÉ : la l. 9, puce « •\t » ôtée, est le `titleFr`
      // suivi de son point final, caractère pour caractère, casse comprise.
      composition: [
        C('Arrêté sanctionnant pour sortir son plein et entier effet la Charte d’Éthique applicable aux acteurs des marchés publics et des conventions de concession d’ouvrage de service public'),
      ],
    },
    adoption: { iso: '2012-12-21', appui: 'Donné au Palais National, à Port-au-Prince, le 21 décembre 2012, An 209ème de l’Indépendance.' },
    publication: { iso: '2013-01-09', appui: 'Mercredi 9 Janvier 2013' },
    fascicule: { numeroIndex: 'LM2013-3', appui: 'No. 3' },
    moniteurRef: 'Le Moniteur · LM2013-3 · 168ème année, n° 3 du mercredi 9 janvier 2013',
    status: 'EN_VIGUEUR',
    note:
      'La CHARTE D’ÉTHIQUE annexée (22 articles, plus les articles 5.1 et 5.2 et un modèle d’engagement) est transcrite après le bloc « Donné » de l’arrêté-chapeau : elle reste dans le même document, comme annexe sanctionnée. ⚠️ Ses articles ne portent PAS d’ancre : leur numérotation recommence à 1 et entrerait en collision avec celle du chapeau.',
    question:
      '§ ouvert — les 22 articles de la Charte annexée sont sans ancre (annexe `kind: connexe`). Les laisser tels quels, ancrer la Charte au prix d’une incohérence visible, ou en faire un document distinct lié à son arrêté ?',
  },
  {
    id: '10',
    slug: 'arr-demande-prix-fournitures-2017',
    source: 'MARCHES_ARR_DP_FOURNITURES_2017',
    prep: 'prep-10-arr-demande-prix-fournitures-2017',
    titre: {
      fr: 'Arrêté sanctionnant pour sortir leur plein et entier effet le « Manuel de procédures de demande de prix pour acquisition de fournitures » et le « Dossier de demande de prix pour acquisition de fournitures »',
      composition: [
        C('ARRÊTÉ'),
        E('sanctionnant'),
        C('pour sortir leur plein et entier effet le « Manuel de procédures de demande de prix pour acquisition de fournitures » et le « Dossier de demande de prix pour acquisition de fournitures »'),
      ],
    },
    adoption: { iso: '2017-08-30', appui: "Donné au Palais National, à Port-au-Prince, le 30 août 2017, An 214e de l'Indépendance." },
    publication: { iso: '2017-09-14', appui: 'Jeudi 14 Septembre 2017' },
    fascicule: { numeroIndex: 'LM2017-SP25', appui: 'Spécial N° 25' },
    moniteurRef: 'Le Moniteur · LM2017-SP25 · 172e année, Spécial n° 25 du jeudi 14 septembre 2017',
    status: 'EN_VIGUEUR',
    note:
      'Les pièces sanctionnées (Manuel et Dossier) sont transcrites à la suite de l’arrêté-chapeau, comme annexes sanctionnées. Leurs articles ne portent PAS d’ancre : leur numérotation est celle des contrats-types, pas celle de l’arrêté.',
    question: null,
  },
  {
    id: '11',
    slug: 'arr-procedures-celeres-2017',
    source: 'MARCHES_ARR_CELERES_2017',
    prep: 'prep-11-arr-procedures-celeres-2017',
    titre: {
      fr: 'Arrêté sanctionnant pour sortir leur plein et entier effet le « Manuel de procédures célères pour la passation des marchés publics en état d’urgence déclaré », le « Document-type de préqualification d’entreprises en vue de travaux sous un état d’urgence déclaré » et le « Modèle de marché pour intervention en situation d’état d’urgence déclaré »',
      composition: [
        C('ARRÊTÉ'),
        E('sanctionnant'),
        C("pour sortir leur plein et entier effet le « Manuel de procédures célères pour la passation des marchés publics en état d'urgence déclaré », le « Document-type de préqualification d'entreprises en vue de travaux sous un état d'urgence déclaré » et le « Modèle de marché pour intervention en situation d'état d'urgence déclaré »"),
      ],
    },
    adoption: { iso: '2017-08-30', appui: "Donné au Palais National, à Port-au-Prince, le 30 août 2017, An 214e de l'Indépendance." },
    publication: { iso: '2017-09-15', appui: 'Vendredi 15 Septembre 2017' },
    fascicule: { numeroIndex: 'LM2017-SP26', appui: 'Spécial N° 26' },
    moniteurRef: 'Le Moniteur · LM2017-SP26 · 172e année, Spécial n° 26 du vendredi 15 septembre 2017',
    status: 'EN_VIGUEUR',
    note:
      'Intitulé LU AU DISPOSITIF (article 1er) : le considérant du même arrêté écrit « en vue de travaux d’intervention sous un état d’urgence déclaré » là où l’article 1er écrit « en vue de travaux sous un état d’urgence déclaré ». Le dispositif prime. Les pièces sanctionnées sont transcrites en annexe, sans ancre d’article.',
    question: null,
  },
  {
    id: '12',
    slug: 'arr-cotations-travaux-2017',
    source: 'MARCHES_ARR_COTATIONS_TRAVAUX_2017',
    prep: 'prep-12-arr-cotations-travaux-2017',
    titre: {
      fr: 'Arrêté sanctionnant pour sortir leur plein et entier effet le « Manuel de procédures de demande de cotations pour les contrats de travaux » et le « Dossier de demande de cotations pour l’exécution de contrats de travaux »',
      composition: [
        C('ARRÊTÉ'),
        E('sanctionnant'),
        C('pour sortir leur plein et entier effet le « Manuel de procédures de demande de cotations pour les contrats de travaux » et le « Dossier de demande de cotations pour l’exécution de contrats de travaux »'),
      ],
    },
    adoption: { iso: '2017-08-30', appui: 'Donné au Palais National, à Port-au-Prince, le 30 août 2017, An 214e de l’Indépendance.' },
    publication: { iso: '2017-09-20', appui: 'Mercredi 20 Septembre 2017' },
    fascicule: { numeroIndex: 'LM2017-SP28', appui: 'Spécial No 28' },
    moniteurRef: 'Le Moniteur · LM2017-SP28 · 172e année, Spécial n° 28 du mercredi 20 septembre 2017',
    status: 'EN_VIGUEUR',
    note: 'Les pièces sanctionnées sont transcrites en annexe, sans ancre d’article.',
    question: null,
  },
  {
    id: '13',
    slug: 'arr-alleges-travaux-2017',
    source: 'MARCHES_ARR_ALLEGES_TRAVAUX_2017',
    prep: 'prep-13-arr-alleges-travaux-2017',
    titre: {
      fr: 'Arrêté sanctionnant pour sortir leur plein et entier effet le « Manuel de procédures allégées pour la passation des marchés de travaux » et le « Dossier d’Appel d’Offres allégé pour la passation des marchés de travaux »',
      composition: [
        C('ARRÊTÉ'),
        E('sanctionnant'),
        C("pour sortir leur plein et entier effet le « Manuel de procédures allégées pour la passation des marchés de travaux » et le « Dossier d'Appel d'Offres allégé pour la passation des marchés de travaux »"),
      ],
    },
    adoption: { iso: '2017-08-30', appui: "Donné au Palais National, à Port-au-Prince, le 30 août 2017, An 214e de l'Indépendance." },
    publication: { iso: '2017-09-26', appui: 'Mardi 26 Septembre 2017' },
    fascicule: { numeroIndex: 'LM2017-SP31', appui: 'Spécial N° 31' },
    moniteurRef: 'Le Moniteur · LM2017-SP31 · 172e année, Spécial n° 31 du mardi 26 septembre 2017',
    status: 'EN_VIGUEUR',
    note: 'Les pièces sanctionnées sont transcrites en annexe, sans ancre d’article.',
    question: null,
  },
  {
    id: '14',
    slug: 'arr-alleges-fournitures-2017',
    source: 'MARCHES_ARR_ALLEGES_FOURNITURES_2017',
    prep: 'prep-14-arr-alleges-fournitures-2017',
    titre: {
      fr: 'Arrêté sanctionnant pour sortir leur plein et entier effet le « Manuel de procédures allégées pour la passation des marchés de fournitures » et le « Dossier d’Appel d’Offres allégé pour la passation des marchés de fournitures »',
      composition: [
        C('ARRÊTÉ'),
        E('sanctionnant'),
        C("pour sortir leur plein et entier effet le « Manuel de procédures allégées pour la passation des marchés de fournitures » et le « Dossier d'Appel d'Offres allégé pour la passation des marchés de fournitures »"),
      ],
    },
    adoption: { iso: '2017-08-30', appui: "Donné au Palais National, à Port-au-Prince, le 30 août 2017, An 214e de l'Indépendance." },
    publication: { iso: '2017-10-06', appui: 'Vendredi 6 Octobre 2017' },
    fascicule: { numeroIndex: 'LM2017-SP35', appui: 'Spécial No 35' },
    moniteurRef: 'Le Moniteur · LM2017-SP35 · 172e année, Spécial n° 35 du vendredi 6 octobre 2017',
    status: 'EN_VIGUEUR',
    note:
      'Les pièces sanctionnées sont transcrites en annexe, sans ancre d’article. ⚠️ Seule pièce du lot dont le .docx d’origine porte des éléments <w:tab/> : l’extraction retenue conserve ses 188 tabulations, une extraction fautive les avait toutes perdues.',
    question: null,
  },
  {
    id: '15',
    slug: 'arr-alleges-consultants-2017',
    source: 'MARCHES_ARR_ALLEGES_CONSULTANTS_2017',
    prep: 'prep-15-arr-alleges-consultants-2017',
    titre: {
      fr: 'Arrêté sanctionnant pour sortir leur plein et entier effet le « Manuel de procédures allégées pour la sélection de consultants » et le « Dossier allégé de demande de propositions pour services de consultants »',
      composition: [
        C('ARRÊTÉ'),
        E('sanctionnant'),
        C('pour sortir leur plein et entier effet le « Manuel de procédures allégées pour la sélection de consultants » et le « Dossier allégé de demande de propositions pour services de consultants »'),
      ],
    },
    adoption: { iso: '2017-08-30', appui: 'Donné au Palais National, à Port-au-Prince, le 30 août 2017, An 214e de l’Indépendance.' },
    publication: { iso: '2017-12-05', appui: 'Mardi 5 Décembre 2017' },
    fascicule: { numeroIndex: 'LM2017-SP42', appui: 'Spécial N° 42' },
    moniteurRef: 'Le Moniteur · LM2017-SP42 · 172e année, Spécial n° 42 du mardi 5 décembre 2017',
    status: 'EN_VIGUEUR',
    note:
      'Les pièces sanctionnées sont transcrites en annexe, sans ancre d’article. ' +
      'NOTE D’ÉDITEUR RETIRÉE DU DISPOSITIF (§ 11.11) et reportée ici : au calendrier indicatif de la section V.2.3, l’original présente un diagramme restitué en tableau ; les cellules grisées y indiquent la position de chaque étape dans la séquence des durées. La note strictement équivalente était déjà retirée des documents n° 10, 12, 13 et 14.',
    question: null,
  },
  {
    id: '16',
    slug: 'arr-defense-2019',
    source: 'MARCHES_ARR_DEFENSE_2019',
    prep: 'prep-16-arr-defense-2019',
    titre: {
      fr: 'Arrêté portant révision de l’arrêté du 30 août 2017 fixant les règles de procédures de passation de certains marchés de travaux, de fournitures, de prestations intellectuelles et de services dans les domaines de défense ou de sécurité nationale',
      composition: [
        C('Arrêté portant révision de l’arrêté du 30 août 2017 fixant les règles de procédures de passation de certains marchés de travaux, de fournitures, de prestations intellectuelles et de services dans les domaines de défense ou de sécurité nationale'),
      ],
    },
    adoption: { iso: '2019-01-09', appui: 'Donné au Palais National, à Port-au-Prince, le 9 janvier 2019, An 216e de l’Indépendance.' },
    publication: { iso: '2019-01-16', appui: 'Mercredi 16 Janvier 2019' },
    fascicule: { numeroIndex: 'LM2019-SP3', appui: 'Spécial N° 3' },
    moniteurRef: 'Le Moniteur · LM2019-SP3 · 174e année, Spécial n° 3 du mercredi 16 janvier 2019',
    // Remplacé par l'article 15 de l'arrêté du 12 février 2020, qui le NOMME (clause prouvée par C).
    status: 'ABROGE',
    note: null,
    question: null,
  },
  {
    id: '17',
    slug: 'arr-nomination-cnmp-2019',
    source: 'MARCHES_ARR_NOMINATION_CNMP_2019',
    prep: 'prep-17-arr-nomination-cnmp-2019',
    titre: {
      fr: 'Arrêté nommant les membres de la Commission Nationale des Marchés Publics (CNMP)',
      // ⚠️ UN SEUL MORCEAU DEPUIS LA RESTITUTION DU 28 AOÛT : le sommaire du n° 221 imprime
      // l'intitulé entier (l. 13 de la pièce), et il est désormais au corps. « nommant » n'est
      // plus un mot d'éditeur — il est du Journal officiel.
      composition: [C('Arrêté nommant les membres de la Commission Nationale des Marchés Publics (CNMP)')],
    },
    adoption: { iso: '2019-12-26', appui: "Donné à la Primature, à Port-au-Prince, le 26 décembre 2019, An 216e de l'Indépendance." },
    publication: { iso: '2019-12-30', appui: 'Lundi 30 Décembre 2019' },
    fascicule: { numeroIndex: 'LM2019-221', appui: 'N° 221' },
    moniteurRef: 'Le Moniteur · LM2019-221 · 174e année, n° 221 du lundi 30 décembre 2019',
    // § 13.2 — acte de NOMINATION individuel. TRANCHÉ le 28 août 2026 par Me Vaval : « à
    // verser ». Le versement se commande par `VERSER_NOMINATION_2019` (en tête de ce fichier),
    // désormais à `true` ; ce `status` est celui sous lequel l'acte entre.
    status: 'PUBLIE',
    note:
      'ACTE DE NOMINATION INDIVIDUEL, complet (4 articles, « Vu et approuvé »). Le mandat de trois ans qu’il ouvre est échu. Le reste du n° 221 du 30 décembre 2019 (Extraits du Registre des Marques) n’est pas transcrit : la brièveté de la pièce ne signale pas un fragment.',
    // La question du § 13.2 est TRANCHÉE (28 août 2026, « à verser ») : elle n'est plus
    // affichée comme ouverte. Le versement lui-même reste dit au rapport, drapeau à l'appui.
    question: null,
  },
  {
    id: '18',
    slug: 'arr-defense-2020',
    source: 'MARCHES_ARR_DEFENSE_2020',
    prep: 'prep-18-arr-defense-2020',
    titre: {
      fr: 'Arrêté soumettant les marchés publics de défense ou de sécurité nationale au respect des principes de passation des marchés',
      composition: [C('Arrêté soumettant les marchés publics de défense ou de sécurité nationale au respect des principes de passation des marchés')],
    },
    adoption: { iso: '2020-02-12', appui: "Donné au Palais National, à Port-au-Prince, le 12 février 2020, An 217e de l'Indépendance." },
    publication: { iso: '2020-02-12', appui: 'Mercredi 12 Février 2020' },
    fascicule: { numeroIndex: 'LM2020-SP1', appui: 'Spécial N° 1' },
    moniteurRef: 'Le Moniteur · LM2020-SP1 · 175e année, Spécial n° 1 du mercredi 12 février 2020',
    status: 'EN_VIGUEUR',
    note:
      '⚠️ Une TRANSCRIPTION RIVALE de cet arrêté (2 862 mots contre 3 103) a été trouvée hors des vingt-huit fichiers de la livraison ; elle n’a jamais été arbitrée et n’est pas versée. La transcription retenue est celle du lot.',
    question:
      '§ ouvert — rejouer sur la transcription rivale du 12 février 2020 (hors liste) le critère d’arbitrage du § 4.2, ou la laisser dehors ?',
  },
  {
    id: '19',
    slug: 'arr-modif-227-2020',
    source: 'MARCHES_ARR_MODIF_227_2020',
    prep: 'prep-19-arr-modif-227-2020',
    titre: {
      fr: 'Arrêté modifiant les articles 227 et 227.1 de l’Arrêté du 26 octobre 2009 précisant les modalités d’application de la Loi du 10 juin 2009 fixant les règles générales relatives aux Marchés Publics et aux Conventions de Concession d’Ouvrage de Service Public',
      composition: [
        C('ARRÊTÉ\nMODIFIANT LES ARTICLES 227 ET 227.1 DE L’ARRÊTÉ DU 26 OCTOBRE 2009 PRÉCISANT LES MODALITÉS D’APPLICATION DE LA LOI DU 10 JUIN 2009 FIXANT LES RÈGLES GÉNÉRALES RELATIVES AUX MARCHÉS PUBLICS ET AUX CONVENTIONS DE CONCESSION D’OUVRAGE DE SERVICE PUBLIC'),
      ],
    },
    adoption: { iso: '2020-12-09', appui: 'Donné au Palais National, à Port-au-Prince, le 9 décembre 2020, An 217e de l’Indépendance.' },
    publication: { iso: '2021-02-04', appui: 'Jeudi 4 Février 2021' },
    fascicule: { numeroIndex: 'LM2021-SP8', appui: 'Spécial No 8' },
    moniteurRef: 'Le Moniteur · LM2021-SP8 · 176e année, Spécial n° 8 du jeudi 4 février 2021 (1er texte marchés publics du fascicule)',
    status: 'EN_VIGUEUR',
    note:
      'SIC DU JOURNAL OFFICIEL conservé : le présent arrêté écrit « article 227.1 » (décimale à POINT) là où l’arrêté du 26 octobre 2009 écrit « article 227-1 » (TRAIT D’UNION). Chaque graphie reste dans son texte ; l’ancre commune est `art-227-1`.',
    question: null,
  },
  {
    id: '20',
    slug: 'arr-composition-cmmp-2020',
    source: 'MARCHES_ARR_COMPOSITION_CMMP_2020',
    prep: 'prep-20-arr-composition-cmmp-2020',
    titre: {
      fr: 'Arrêté fixant la composition des Commissions Ministérielles des Marchés Publics (CMMP) et des Commissions Spécialisées des Marchés Publics (CSMP) ainsi que les critères de choix et tâches spécifiques de leurs membres',
      composition: [
        C('ARRÊTÉ\nFIXANT LA COMPOSITION DES COMMISSIONS MINISTÉRIELLES DES MARCHÉS PUBLICS (CMMP) ET DES COMMISSIONS SPÉCIALISÉES DES MARCHÉS PUBLICS (CSMP) AINSI QUE LES CRITÈRES DE CHOIX ET TÂCHES SPÉCIFIQUES DE LEURS MEMBRES'),
      ],
    },
    adoption: { iso: '2020-12-09', appui: 'Donné au Palais National, à Port-au-Prince, le 9 décembre 2020, An 217e de l’Indépendance.' },
    publication: { iso: '2021-02-04', appui: 'Jeudi 4 Février 2021' },
    fascicule: { numeroIndex: 'LM2021-SP8', appui: 'Spécial No 8' },
    moniteurRef: 'Le Moniteur · LM2021-SP8 · 176e année, Spécial n° 8 du jeudi 4 février 2021 (2e texte marchés publics du fascicule)',
    status: 'EN_VIGUEUR',
    note: null,
    question: null,
  },
  {
    id: '21',
    slug: 'decret-beneficiaires-effectifs-2021',
    source: 'MARCHES_DECRET_BENEFICIAIRES_2021',
    prep: 'prep-21-decret-beneficiaires-effectifs-2021',
    titre: {
      fr: 'Décret établissant l’obligation de présenter des informations permettant d’identifier les Bénéficiaires effectifs des Marchés publics et des Concessions',
      composition: [
        C("Décret établissant l'obligation de présenter des informations permettant d'identifier les Bénéficiaires effectifs des Marchés publics et des Concessions"),
      ],
    },
    adoption: { iso: '2021-10-21', appui: "Donné à Port-au-Prince, le 21 octobre 2021, An 218e de l'Indépendance." },
    publication: { iso: '2021-11-09', appui: 'Mardi 9 Novembre 2021' },
    fascicule: { numeroIndex: 'LM2021-SP52', appui: 'Spécial N° 52' },
    moniteurRef: 'Le Moniteur · LM2021-SP52 · 176e année, Spécial n° 52 du mardi 9 novembre 2021 (1er texte du fascicule)',
    status: 'EN_VIGUEUR',
    note:
      'Le visa constitutionnel de ce décret porte « 149* » : l’astérisque est un appel de note de l’éditeur de la transcription, non un sic du Journal officiel.',
    question: null,
  },
  {
    id: '22',
    slug: 'arr-seuils-sous-intervention-2021',
    source: 'MARCHES_ARR_SEUILS_2021',
    prep: 'prep-22-arr-seuils-sous-intervention-2021',
    titre: {
      fr: 'Arrêté fixant les seuils de passation des Marchés publics en dessous des seuils d’intervention de la Commission nationale des Marchés publics',
      composition: [
        C("Arrêté fixant les seuils de passation des Marchés publics en dessous des seuils d'intervention de la Commission nationale des Marchés publics"),
      ],
    },
    adoption: { iso: '2021-10-21', appui: "Donné à Port-au-Prince, le 21 octobre 2021, An 218e de l'Indépendance." },
    publication: { iso: '2021-11-09', appui: 'Mardi 9 Novembre 2021' },
    fascicule: { numeroIndex: 'LM2021-SP52', appui: 'Spécial N° 52' },
    moniteurRef: 'Le Moniteur · LM2021-SP52 · 176e année, Spécial n° 52 du mardi 9 novembre 2021 (2e texte du fascicule)',
    status: 'EN_VIGUEUR',
    note:
      'Le visa constitutionnel de cet arrêté porte « 223* » : l’astérisque est un appel de note de l’éditeur de la transcription, non un sic du Journal officiel.',
    question: null,
  },
  {
    id: '23',
    slug: 'arr-seuils-2022',
    source: 'MARCHES_ARR_SEUILS_2022',
    prep: 'prep-23-arr-seuils-2022',
    titre: {
      fr: 'Arrêté fixant les seuils de passation des marchés publics et les seuils d’intervention de la Commission Nationale des Marchés Publics (CNMP)',
      composition: [C('ARRÊTÉ FIXANT LES SEUILS DE PASSATION DES MARCHÉS PUBLICS ET LES SEUILS D’INTERVENTION DE LA COMMISSION NATIONALE DES MARCHÉS PUBLICS (CNMP)')],
    },
    adoption: { iso: '2022-06-01', appui: 'Donné au Palais National, à Port-au-Prince, le 1er juin 2022, An 219ème de l’Indépendance.' },
    publication: { iso: '2022-06-10', appui: 'Vendredi 10 Juin 2022' },
    fascicule: { numeroIndex: 'LM2022-SP15', appui: 'Spécial N° 15' },
    moniteurRef: 'Le Moniteur · LM2022-SP15 · 177e année, Spécial n° 15 du vendredi 10 juin 2022',
    status: 'EN_VIGUEUR',
    note:
      '⚠️ ÉCART D’INTITULÉ INTERNE AU TEXTE, conservé verbatim : le VISA désigne l’arrêté du 21 octobre 2021 sous son intitulé exact (« … en dessous des seuils d’intervention de la CNMP »), tandis que l’article 7-1 le désigne sous l’intitulé de l’arrêté de 2012 (« … et les seuils d’intervention »). Coquille du texte officiel, ou second arrêté du même jour ? Non tranché.',
    question: '§ 13.10 — un second arrêté du 21 octobre 2021 existe-t-il, ou l’article 7-1 porte-t-il une coquille ?',
  },
  {
    id: '24',
    slug: 'circulaire-010-2023',
    source: 'MARCHES_CIRC_010_2023',
    prep: 'prep-24-circulaire-010-2023',
    titre: {
      fr: 'Circulaire 010 relative aux procédures de passation et d’exécution des marchés publics',
      composition: [C('CIRCULAIRE 010\nRELATIVE AUX PROCÉDURES DE PASSATION ET D’EXÉCUTION DES MARCHÉS PUBLICS')],
    },
    adoption: { iso: '2023-12-04', appui: 'Port-au-Prince, le 4 décembre 2023.' },
    publication: null,
    fascicule: null,
    moniteurRef: 'Sans référence Moniteur (papier Primature)',
    status: 'EN_VIGUEUR',
    note:
      'La circulaire ne porte AUCUN article : ce sont des directives en prose, complètes, signées du Premier Ministre, sur papier de la Primature et sans publication au Moniteur. Aucune division ni numérotation n’a été fabriquée (§ 9.6).',
    question: null,
  },
]

// ════════════════════════════════════════════════════════════════════════════════════════
// LA FICHE DE PRÉPARATION (tâche 2) ET LA RE-DÉRIVATION DU CORPS
// ════════════════════════════════════════════════════════════════════════════════════════
export interface TocPrep {
  level: number
  label: string
  anchor: string
  kind: string
  ligne_source?: number
}
export interface NavPrep {
  label: string
  anchor: string
  children?: NavPrep[]
}
/** Une plage de la pièce que la découpe laisse HORS du corps, et le motif qui l'y laisse.
 *  C'est une DÉCLARATION d'éditeur : `deriverCorps` refuse toute ligne non vide qui ne soit
 *  ni versée, ni couverte par l'une de ces plages (§ 8.3). */
export interface HorsSegment {
  plage: [number, number]
  motif: string
}
/**
 * Une ligne que la découpe fait ENTRER au corps, et la ligne de la PIÈCE dont elle est LUE.
 *
 * ⚠️ LE PENDANT EXACT DE `HorsSegment`, ET IL MANQUAIT. La garde de couverture (§ 8.3) contrôle
 * ce qui SORT du corps : toute ligne non vide non versée doit être déclarée avec son motif.
 * Rien ne contrôlait ce qui y ENTRE — un intitulé retapé, reformulé, ou simplement recopié du
 * `titleFr` de la fiche, serait entré dans le dispositif d'un texte publié sans qu'aucune
 * assertion ne parle. C'est la leçon de la loi CEC, au mot près : un champ de fondation qui
 * finit dans un corps se PROUVE, il ne se recopie pas.
 *
 * D'où les refus de `deriverCorps`, calqués sur ceux des `retraits` :
 *  · `texte_source` doit se lire VERBATIM — comparaison LITTÉRALE, jamais pliée — et exactement
 *    une fois, dans `lignes[ligne_source - 1]` de la pièce canonique (dont le md5 vient d'être
 *    asserté). Un mot changé, une apostrophe redressée, une majuscule : l'assertion tombe.
 *  · `motif` doit être non vide : on n'ajoute pas une ligne au dispositif d'un texte publié
 *    sans dire pourquoi, pas plus qu'on n'en ôte une.
 * Et un troisième, mesuré : le point d'entrée doit être une ligne réellement ÉMISE, sans quoi
 * l'insertion serait un no-op silencieux — le piège des `retraitsSansEffet`, dans l'autre sens.
 *
 * ─── LE CONTRAT À DEUX CHAÎNES (décision de Me Vaval du 28 août 2026, au soir) ──────────────
 * « Ayez les majuscules comme pour le traitement des autres et non en all caps. » Six des dix
 * lignes de sommaire restituées sont composées par le J.O. en casse de phrase ; quatre sont en
 * CAPITALES. Ces quatre-là entrent au corps en casse de phrase — et la garde ci-dessus, telle
 * qu'elle était écrite, tombait : une chaîne abaissée ne se lit plus VERBATIM à sa ligne.
 *
 * On ne l'a ni contournée ni affaiblie : on l'a rendue EXPLICITE. Une insertion déclare
 * désormais DEUX chaînes, et l'écart entre elles est lui-même une déclaration prouvée :
 *  · `texte_source` — la ligne du sommaire, VERBATIM, prouvée exactement comme avant ;
 *  · `texte` — ce qui entre au corps ;
 *  · `transformation` — OBLIGATOIRE dès que les deux diffèrent, INTERDITE quand elles sont
 *    égales (une transformation déclarée qui ne transforme rien est le pendant exact d'un
 *    `retraitSansEffet` : elle affirme un acte d'éditeur qui n'a pas eu lieu) ;
 *  · et la différence doit n'être QUE de casse — `ecartHorsCasse()` la mesure caractère par
 *    caractère. Un mot changé, une ponctuation déplacée, une apostrophe redressée, un accent
 *    ôté (« É » → « E ») restent REFUSÉS, transformation déclarée ou non.
 * La casse cible ne se juge pas à l'œil : elle est DÉRIVÉE du `titleFr` de la fiche, lettre par
 * lettre — voir le rapport de B, qui reprouve l'écart pour chacune des insertions.
 */
export interface Insertion {
  /** ligne de la PIÈCE où le J.O. imprime cette chaîne (en pratique : une plage `hors_segments`
   *  déclarée SOMMAIRE — le seul endroit où le fascicule imprime l'intitulé de l'acte). */
  ligne_source: number
  /** LA CHAÎNE LUE À LA PIÈCE : sous-chaîne VERBATIM de cette ligne-là. Jamais retapée. */
  texte_source: string
  /** CE QUI ENTRE AU CORPS. Égal à `texte_source`, sauf transformation DÉCLARÉE ci-dessous —
   *  et la seule transformation admise est un changement de CASSE. */
  texte: string
  /** L'acte d'éditeur qui sépare les deux chaînes. Obligatoire si elles diffèrent, interdit
   *  sinon. `null` (ou absent) = `texte` est la chaîne de la pièce, à l'octet. */
  transformation?: string | null
  /** où elle entre : juste AVANT cette ligne de la pièce, qui doit être versée par un segment. */
  position: { avant_ligne_source: number }
  /** pourquoi elle entre, et ce qui a été laissé dehors (puce, rubrique, mention annexe). */
  motif: string
}
export interface Prep {
  id: string
  slug: string
  titre_provisoire: string
  source: { fichier: string; md5_txt: string; lignes_fichier: number }
  decoupe: {
    segments: [number, number][]
    /** OBLIGATOIRE, même vide : tout ce qui n'entre dans aucun segment doit être déclaré. */
    hors_segments: HorsSegment[]
    note: string | null
    /** `texte` = la ligne ENTIÈRE de la pièce, relue avant tout retrait.
     *  Sans `fragment`, la ligne entière est ôtée. Avec `fragment`, SEUL ce fragment l'est —
     *  c'est le cas d'une mention d'éditeur enchâssée au milieu d'une phrase du J.O., qu'on
     *  ne peut pas ôter en supprimant la ligne sans emporter du droit avec (§ 11.11). */
    retraits: { ligne_source: number; motif: string; texte: string; fragment?: string }[]
    /** OBLIGATOIRE, même vide : symétrique de `hors_segments`. Ce qui ENTRE au corps se déclare
     *  comme ce qui en sort — avec sa ligne d'origine à la pièce et son motif (§ 8.4). */
    insertions: Insertion[]
  }
  jointures_entetes: { ligne_source: number; lignes_jointes: number; libelle: string }[]
  toc: TocPrep[]
  labels: Record<string, string>
  navToc: NavPrep[]
  pointAnchors: string[] | null
  comptes: Record<string, number>
  gardes: Record<string, boolean>
  md5_corps: string
  apostrophes: { droites: number; courbes: number }
  reserve: string | null
  sans_appareil: string | null
}

export function lirePrep(f: Fiche): Prep {
  return JSON.parse(readFileSync(join(DIR, `${f.prep}.json`), 'utf8')) as Prep
}
export function lireCorps(f: Fiche): string {
  return readFileSync(join(DIR, `${f.prep}-corps.txt`), 'utf8')
}

export interface Derivation {
  corps: string
  /** La PIÈCE entière, telle que lue (md5 asserté juste au-dessus). Les preuves de fiche en
   *  ont besoin depuis la découpe du 28 août : le bandeau et le sommaire du fascicule ne sont
   *  plus au corps versé, mais ils restent sur la pièce, et c'est là qu'ils se lisent. */
  piece: string
  lignesPiece: number
  lignesCorps: number
  /** Retraits de LIGNE entière (notes de transcription posées seules). */
  retraits: number
  /**
   * Parmi `retraits`, ceux qui n'ÔTENT RIEN : la ligne visée n'entre dans aucun segment —
   * elle est déjà hors du corps, le plus souvent parce qu'une plage `hors_segments` la
   * couvre depuis la découpe du 28 août. Mesuré par le contrôle adverse : le rapport
   * annonçait « N lignes retirées du dispositif » en comptant ces retraits-là, alors
   * qu'ils ne retirent aucune ligne du corps. On les compte à part plutôt que de les
   * effacer : la déclaration reste, mais le total dit désormais ce qu'il vaut.
   */
  retraitsSansEffet: number
  /** Retraits de FRAGMENT enchâssé dans une ligne du J.O. (§ 11.11) — la ligne reste. */
  retraitsInline: number
  jointures: number
  lignesAbsorbees: number
  /** Lignes non vides de la pièce que la découpe écarte, et qui sont DÉCLARÉES (§ 8.3). */
  horsSegments: number
  horsSegmentsPlages: HorsSegment[]
  /** Lignes RESTITUÉES au corps depuis le sommaire de la pièce, chacune prouvée verbatim. */
  insertions: number
  insertionsDetail: (Insertion & { id: string })[]
  /** Le DÉTAIL des retraits — le rapport les énumère, comme les plages hors-segment. */
  retraitsDetail: { id: string; ligne: number; motif: string; texte: string }[]
}

/**
 * RE-DÉRIVE le corps depuis la pièce canonique, en rejouant la découpe déclarée.
 * C'est l'assertion réversible du corps : ce que le script versera n'est pas le fichier
 * `-corps.txt` pris de confiance, mais le produit d'une opération qu'on refait.
 *
 * Trois contrôles, dans cet ordre : les segments sont BORNÉS (entiers, dans le fichier,
 * ordonnés, sans chevauchement) ; leur somme COUVRE la pièce (toute ligne non vide écartée
 * est déclarée avec son motif dans `decoupe.hors_segments`) ; le corps produit retombe sur
 * le corps préparé À L'OCTET. Le troisième seul ne prouve rien — le md5 se recalcule.
 *
 * Chaque jointure d'en-tête est en outre prouvée SANS PERTE : le libellé, ses séparateurs
 * « — » mis à plat, doit égaler les lignes sources non vides mises bout à bout. Un mot ajouté
 * ou perdu dans un libellé fait tomber l'assertion (leçon CEC : le champ « fusion » ne se
 * recopie pas, il se prouve).
 *
 * ⚠️ `titreFiche` — le `titleFr` de la fiche. Il est OBLIGATOIRE dès que la fiche de
 * préparation déclare UNE insertion, transformée ou non : c'est lui qui dit que la ligne
 * restituée est l'intitulé de CET acte et non celui du voisin annoncé par le même sommaire,
 * et c'est de lui que la casse cible est dérivée, lettre par lettre (décision de Me Vaval du
 * 28 août 2026 au soir). Les deux appelants (B et C) le passent.
 */
export function deriverCorps(prep: Prep, titreFiche?: string): Derivation {
  const piece = readFileSync(join(DIR, prep.source.fichier), 'utf8')
  if (md5(piece) !== prep.source.md5_txt)
    throw new Error(
      `${prep.id} — pièce ${prep.source.fichier} : md5 ${md5(piece)}, attendu ${prep.source.md5_txt} (manifeste d'empreintes) — STOP`,
    )
  const lignes = piece.split('\n')
  if (lignes.length !== prep.source.lignes_fichier)
    throw new Error(`${prep.id} — pièce ${prep.source.fichier} : ${lignes.length} lignes, attendu ${prep.source.lignes_fichier} — STOP`)

  // ⚠️ Les bornes de segment n'étaient bornées par RIEN : un segment débordant du fichier, ou
  // deux segments qui se chevauchent, produisaient un corps que seul le md5 déclaré contrôlait
  // — et ce md5 se recalcule. On borne (contrôle adverse du 28 août).
  let precedent = 0
  for (const [a, b] of prep.decoupe.segments) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a || b > lignes.length)
      throw new Error(`${prep.id} — segment [${a}, ${b}] hors des bornes du fichier (1..${lignes.length}) — STOP`)
    if (a <= precedent) throw new Error(`${prep.id} — segment [${a}, ${b}] chevauche ou précède le segment antérieur (fin ${precedent}) — STOP`)
    precedent = b
  }

  // ⚠️ COUVERTURE (§ 8.3) — LE DÉFAUT LE PLUS GRAVE DU CONTRÔLE DU 28 AOÛT. Borner les segments
  // ne suffit pas : rien n'assurait que leur SOMME couvre la pièce. Mesuré par le contrôleur —
  // les segments de `prep-13` ramenés de [[1,2700]] à [[1,1200]] et la chaîne d'empreintes
  // re-synchronisée : toute la simulation repassait au vert, 1 498 lignes de manuel et de DAO
  // annexés disparues en silence, le rapport imprimant simplement un total plus petit. Le md5
  // du corps ne protège de rien : il se recalcule AVEC la découpe.
  // Donc : toute ligne NON VIDE qui n'entre dans aucun segment doit être DÉCLARÉE, avec son
  // motif, dans `decoupe.hors_segments`. Amputer un segment fait alors tomber l'assertion.
  if (!Array.isArray(prep.decoupe.hors_segments))
    throw new Error(
      `${prep.id} — la fiche de préparation ne déclare pas \`decoupe.hors_segments\` : ` +
        `tant qu'aucune plage exclue n'est déclarée, une amputation de segment passerait en silence (§ 8.3) — STOP`,
    )
  const couvert = new Set<number>()
  for (const [a, b] of prep.decoupe.segments) for (let i = a; i <= b; i++) couvert.add(i)
  const declarees = new Set<number>()
  for (const h of prep.decoupe.hors_segments) {
    const [a, b] = h.plage
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a || b > lignes.length)
      throw new Error(`${prep.id} — plage hors-segment [${a}, ${b}] hors des bornes du fichier (1..${lignes.length}) — STOP`)
    if (!h.motif || !h.motif.trim())
      throw new Error(`${prep.id} — plage hors-segment [${a}, ${b}] déclarée SANS MOTIF : on n'écarte pas des lignes sans dire pourquoi — STOP`)
    for (let i = a; i <= b; i++) {
      if (couvert.has(i)) throw new Error(`${prep.id} — la ligne ${i} est à la fois VERSÉE (segment) et déclarée hors-corpus — STOP`)
      declarees.add(i)
    }
  }
  const nonDeclarees: number[] = []
  for (let i = 1; i <= lignes.length; i++)
    if (!couvert.has(i) && !declarees.has(i) && lignes[i - 1].trim() !== '') nonDeclarees.push(i)
  if (nonDeclarees.length)
    throw new Error(
      `${prep.id} — ${nonDeclarees.length} ligne(s) non vides de ${prep.source.fichier} ne sont ni versées ni ` +
        `déclarées hors-corpus (l. ${nonDeclarees.slice(0, 12).join(', ')}${nonDeclarees.length > 12 ? '…' : ''}) : ` +
        `la somme des morceaux n'égale plus le fichier — STOP`,
    )
  const horsSegments = [...declarees].filter((i) => lignes[i - 1].trim() !== '').length

  for (const r of prep.decoupe.retraits) {
    if (lignes[r.ligne_source - 1] !== r.texte)
      throw new Error(
        `${prep.id} — retrait l.${r.ligne_source} : la ligne de la pièce n'est pas celle déclarée (« ${lignes[r.ligne_source - 1]?.slice(0, 60)}… ») — STOP`,
      )
    // ⚠️ LA MÊME EXIGENCE QUE POUR UNE PLAGE HORS-SEGMENT. Le contrôle adverse a montré que
    // `retraits` était le jumeau de `hors_segments` SANS sa garde de motif : un 22ᵉ retrait
    // déclaré `motif: ''` sur la ligne d'intitulé de la loi-mère passait la simulation au
    // vert, le seul signe étant un total qui baisse d'une unité. On n'ôte pas une ligne du
    // dispositif d'un texte publié sans dire pourquoi (§ 11.11).
    if (!r.motif || !r.motif.trim())
      throw new Error(
        `${prep.id} — retrait l.${r.ligne_source} déclaré SANS MOTIF : on n'ôte pas une ligne du dispositif sans dire pourquoi (§ 11.11) — STOP`,
      )
  }
  // Deux retraits distincts : la LIGNE entière (note de transcription posée seule) et le
  // FRAGMENT enchâssé (mention d'éditeur au milieu d'une phrase du J.O. — ôter la ligne
  // emporterait du droit). Le fragment est asserté UNIQUE dans sa ligne, et son retrait ne
  // peut pas vider la ligne : sinon c'est un retrait de ligne, et il doit se déclarer comme tel.
  const retraits = new Set<number>()
  const reecrites = new Map<number, string>()
  for (const r of prep.decoupe.retraits) {
    if (r.fragment === undefined) {
      retraits.add(r.ligne_source)
      continue
    }
    const n = r.texte.split(r.fragment).length - 1
    if (n !== 1)
      throw new Error(
        `${prep.id} — retrait inline l.${r.ligne_source} : le fragment déclaré apparaît ${n} fois dans la ligne (1 attendue) — STOP`,
      )
    const reste = r.texte.split(r.fragment).join('')
    if (!reste.trim())
      throw new Error(`${prep.id} — retrait inline l.${r.ligne_source} : le retrait viderait la ligne — déclarer un retrait de LIGNE — STOP`)
    reecrites.set(r.ligne_source, reste)
  }
  // ⚠️ LES INSERTIONS — LA GARDE QUI MANQUAIT (§ 8.4, décision de Me Vaval du 28 août 2026).
  // `hors_segments` prouve ce qui SORT du corps ; rien ne prouvait ce qui y ENTRE. Depuis que
  // huit corps portent en tête l'intitulé que le J.O. n'imprime qu'au sommaire du fascicule,
  // il faut le pendant : **un intitulé ne s'invente pas, il se RESTITUE**, et la restitution
  // s'assertionne. Trois refus, dans cet ordre.
  if (!Array.isArray(prep.decoupe.insertions))
    throw new Error(
      `${prep.id} — la fiche de préparation ne déclare pas \`decoupe.insertions\` : la garde de ` +
        `couverture ne contrôle que ce qui SORT du corps, une ligne ENTRÉE sans déclaration passerait en silence (§ 8.4) — STOP`,
    )
  const insertionsPar = new Map<number, Insertion[]>()
  for (const ins of prep.decoupe.insertions) {
    if (!Number.isInteger(ins.ligne_source) || ins.ligne_source < 1 || ins.ligne_source > lignes.length)
      throw new Error(`${prep.id} — insertion : ligne d'origine ${ins.ligne_source} hors des bornes de la pièce (1..${lignes.length}) — STOP`)
    for (const [champ, val] of [['texte_source', ins.texte_source], ['texte', ins.texte]] as const)
      if (typeof val !== 'string' || !val.trim() || val.includes('\n'))
        throw new Error(
          `${prep.id} — insertion l.${ins.ligne_source} : \`${champ}\` vide, absent ou multi-lignes — ` +
            `une insertion déclare DEUX chaînes d'une ligne chacune (celle de la pièce, celle du corps) — STOP`,
        )
    // (1) `texte_source` VERBATIM À LA LIGNE DÉCLARÉE. Comparaison LITTÉRALE — `plier()` ne sert
    // qu'à comparer des libellés, et l'employer ici laisserait passer une apostrophe redressée
    // ou une casse changée, c'est-à-dire une citation NORMALISÉE dans un corps (interdit n° 8).
    const n = lignes[ins.ligne_source - 1].split(ins.texte_source).length - 1
    if (n !== 1)
      throw new Error(
        `${prep.id} — insertion l.${ins.ligne_source} : la chaîne LUE À LA PIÈCE se lit ${n} fois dans la ligne de la pièce (1 attendue).\n` +
          `      texte_source : « ${ins.texte_source} »\n` +
          `      pièce        : « ${lignes[ins.ligne_source - 1]} »\n` +
          `      un intitulé ne se retape pas et ne se reformule pas : il se RESTITUE, mot pour mot — STOP`,
      )
    // (1 bis) LE CONTRAT À DEUX CHAÎNES (décision de Me Vaval du 28 août 2026, au soir).
    // `texte_source` est prouvé à la pièce ; `texte` est ce qui entre au corps. Quand les deux
    // diffèrent, l'écart est un ACTE D'ÉDITEUR : il se déclare, et il ne peut être QUE de casse.
    const transfo = (ins.transformation ?? '').trim()
    if (ins.texte === ins.texte_source) {
      // Le pendant exact d'un `retraitSansEffet` : une transformation déclarée qui ne
      // transforme rien affirme un acte d'éditeur qui n'a pas eu lieu.
      if (transfo)
        throw new Error(
          `${prep.id} — insertion l.${ins.ligne_source} : une \`transformation\` est déclarée (« ${transfo.slice(0, 60)}… ») ` +
            `alors que \`texte\` est IDENTIQUE à \`texte_source\` — elle n'affirme rien qui ait eu lieu, la retirer — STOP`,
        )
    } else {
      if (!transfo)
        throw new Error(
          `${prep.id} — insertion l.${ins.ligne_source} : \`texte\` DIFFÈRE de \`texte_source\` sans \`transformation\` déclarée.\n` +
            `      pièce : « ${ins.texte_source} »\n` +
            `      corps : « ${ins.texte} »\n` +
            `      ce qui entre au corps est ou bien la chaîne de la pièce à l'octet, ou bien une chaîne TRANSFORMÉE, ` +
            `et alors la transformation se DIT — STOP`,
        )
      // D'ABORD LA QUESTION ÉTROITE : l'écart est-il un écart de CASSE ? Elle passe avant la
      // suivante parce qu'elle est la plus fondamentale — et parce que son refus NOMME le
      // caractère fautif, ce qui vaut mieux qu'un refus tiré du titre pour une apostrophe.
      const ecart = ecartHorsCasse(ins.texte_source, ins.texte)
      if (ecart)
        throw new Error(
          `${prep.id} — insertion l.${ins.ligne_source} : l'écart entre la pièce et le corps n'est PAS un écart de casse.\n` +
            `      ${ecart}\n` +
            `      pièce : « ${ins.texte_source} »\n` +
            `      corps : « ${ins.texte} »\n` +
            `      transformation déclarée : « ${transfo} »\n` +
            `      SEULE la casse est admise (décision de Me Vaval du 28 août 2026). Un mot changé, une ponctuation ` +
            `déplacée, une apostrophe redressée, un accent ôté (« É » → « E ») restent refusés — STOP`,
        )
    }
    // (1 ter) ⚠️ C'EST L'INTITULÉ DE **CET** ACTE, PAS CELUI DU VOISIN DE SOMMAIRE.
    // Mesuré par le contrôle adverse du 28 août au soir : la garde (4) prouve que la ligne
    // vient d'une plage ÉCARTÉE — le sommaire — et rien de plus. Or un sommaire de fascicule
    // annonce PLUSIEURS actes : au n° 09, la l. 8 annonce l'arrêté d'utilité publique de
    // Delmas, et elle est dans la même plage [6,12] que la l. 9. Une insertion la déclarant
    // verbatim, avec un motif plausible, passait TOUTE la garde des insertions ; seul
    // `md5_corps` la rattrapait ensuite — c'est-à-dire l'empreinte qu'un saboteur recalcule,
    // celle dont ce fichier répète partout qu'elle ne prouve rien seule.
    // Donc : les lettres de la chaîne qui entre au corps doivent se lire d'affilée, À LA
    // CASSE, dans le `titleFr` de la fiche — établi plus tôt sur le corpus. C'est le même
    // contrôle qui, pour une insertion TRANSFORMÉE, DÉRIVE la casse au lieu de la juger
    // (« CAHIER », « cahier », « CaHiEr » passeraient sinon l'écart-de-casse) ; il vaut
    // désormais pour les DEUX sortes d'insertion, transformée ou à l'octet. Il ne compare que
    // les LETTRES : le titre de fiche ne porte pas le point final du J.O. et porte parfois une
    // apostrophe d'une autre graphie — la ponctuation reste celle de la PIÈCE, et c'est
    // `ecartHorsCasse()` qui l'assure.
    if (typeof titreFiche !== 'string' || !titreFiche.trim())
      throw new Error(
        `${prep.id} — insertion l.${ins.ligne_source} : la dérivation n'a pas reçu le \`titleFr\` de la fiche. ` +
          `Une ligne restituée doit être confrontée à l'intitulé de SON acte — ni son choix dans le sommaire ni ` +
          `sa casse ne se jugent à l'œil : appeler deriverCorps(prep, f.titre.fr) — STOP`,
      )
    const place = casseLueDansLeTitre(titreFiche, ins.texte)
    if (place !== 1)
      throw new Error(
        `${prep.id} — insertion l.${ins.ligne_source} : la chaîne qui entre au corps ne se lit pas, À LA CASSE, dans ` +
          `le \`titleFr\` de la fiche (${place} occurrence(s), 1 attendue).\n` +
          `      corps    : « ${ins.texte} »\n` +
          `      titleFr  : « ${titreFiche} »\n` +
          `      ou bien c'est l'intitulé d'un AUTRE acte du même sommaire, ou bien sa casse a été saisie à la main : ` +
          `une restitution se DÉRIVE du titre de fiche, lettre par lettre — STOP`,
      )
    // (2) LE MOTIF, exactement comme pour un retrait ou une plage hors-segment.
    if (!ins.motif || !ins.motif.trim())
      throw new Error(
        `${prep.id} — insertion l.${ins.ligne_source} déclarée SANS MOTIF : on n'ajoute pas une ligne au dispositif ` +
          `d'un texte publié sans dire pourquoi, pas plus qu'on n'en ôte une (§ 8.4, § 11.11) — STOP`,
      )
    // (3) LE POINT D'ENTRÉE EST RÉELLEMENT ÉMIS — sinon l'insertion est un no-op silencieux
    // (le piège des `retraitsSansEffet`, dans l'autre sens). Le compte final le reconfirme.
    const avant = ins.position?.avant_ligne_source
    if (!Number.isInteger(avant) || !couvert.has(avant))
      throw new Error(
        `${prep.id} — insertion l.${ins.ligne_source} : son point d'entrée (avant la ligne ${avant} de la pièce) ` +
          `n'est couvert par aucun segment — elle ne serait jamais émise au corps — STOP`,
      )
    // (4) ⚠️ ELLE DOIT VENIR DU SOMMAIRE, PAS DE N'IMPORTE OÙ DANS LA PIÈCE. La garde (1)
    // prouve la PROVENANCE (« la chaîne est bien dans la pièce »), jamais la SÉLECTION. Le
    // contrôle adverse l'a montré : une insertion pointant une ligne du DISPOSITIF (« Vu la
    // Constitution, notamment son article 136 ; ») passait toutes les simulations au vert et
    // dupliquait cette ligne au corps — le `motif` étant du texte libre, il ne rattrape rien.
    // Une ligne restituée vient de ce que la recoupe a ÉCARTÉ, et de rien d'autre.
    const plage = prep.decoupe.hors_segments.find(
      (h) => ins.ligne_source >= h.plage[0] && ins.ligne_source <= h.plage[1],
    )
    if (!plage)
      throw new Error(
        `${prep.id} — insertion l.${ins.ligne_source} : cette ligne n'est dans AUCUNE plage écartée. ` +
          `Un intitulé se restitue de ce que la recoupe a mis dehors (le sommaire du fascicule), ` +
          `jamais d'une ligne du dispositif — STOP`,
      )
    if (!insertionsPar.has(avant)) insertionsPar.set(avant, [])
    insertionsPar.get(avant)!.push(ins)
  }

  const jointures = new Map(prep.jointures_entetes.map((j) => [j.ligne_source, j]))
  for (const j of prep.jointures_entetes)
    for (let k = j.ligne_source; k < j.ligne_source + j.lignes_jointes; k++)
      if (reecrites.has(k))
        throw new Error(`${prep.id} — l.${k} porte à la fois un retrait inline et une jointure d'en-tête : les deux réécrivent la ligne — STOP`)

  const out: string[] = []
  let absorbees = 0
  let inserees = 0
  for (const [a, b] of prep.decoupe.segments) {
    let i = a
    while (i <= b) {
      // Les insertions passent AVANT tout le reste : leur point d'entrée est « avant la ligne
      // i », que cette ligne soit ensuite versée, retirée ou absorbée par une jointure.
      const aRestituer = insertionsPar.get(i)
      if (aRestituer) {
        for (const x of aRestituer) {
          out.push(x.texte)
          inserees++
        }
      }
      if (retraits.has(i)) {
        i++
        continue
      }
      const j = jointures.get(i)
      if (j) {
        const parts: string[] = []
        for (let k = i; k < i + j.lignes_jointes; k++) {
          const t = (lignes[k - 1] ?? '').trim()
          if (t) parts.push(t)
        }
        // PREUVE de non-perte : le libellé, séparateurs à plat, == les lignes bout à bout.
        const aplat = plier(j.libelle.split(' — ').join(' '))
        const attendu = plier(parts.join(' '))
        if (aplat !== attendu)
          throw new Error(
            `${prep.id} — jointure l.${j.ligne_source} : le libellé n'est pas le recollement exact des ${j.lignes_jointes} lignes sources.\n` +
              `      libellé : « ${j.libelle} »\n      lignes  : « ${parts.join(' ')} »`,
          )
        out.push(j.libelle)
        absorbees += j.lignes_jointes - 1
        i += j.lignes_jointes
        continue
      }
      out.push(reecrites.get(i) ?? lignes[i - 1])
      i++
    }
  }
  // Une insertion dont le point d'entrée tombe à l'INTÉRIEUR d'un bloc de jointure n'est jamais
  // visitée par la boucle : le compte le dit, plutôt que de la perdre en silence.
  if (inserees !== prep.decoupe.insertions.length)
    throw new Error(
      `${prep.id} — ${inserees} insertion(s) émise(s) au corps pour ${prep.decoupe.insertions.length} déclarée(s) : ` +
        `un point d'entrée tombe dans une ligne que la boucle ne visite pas (absorbée par une jointure d'en-tête) — STOP`,
    )
  const corps = out.join('\n')
  if (md5(corps) !== prep.md5_corps)
    throw new Error(
      `${prep.id} — corps RE-DÉRIVÉ de la pièce : md5 ${md5(corps)}, attendu ${prep.md5_corps}. La découpe déclarée ne reproduit plus le corps préparé — STOP`,
    )
  // ⚠️ LE TÉMOIN QUI DORMAIT SUR LE DISQUE. `prep.comptes` est déclaré dans les 25 fiches de
  // préparation depuis le début, et AUCUN des trois scripts ne le lisait. Le contrôle adverse
  // a montré le trou qu'il ferme : amputer un segment de 1 341 lignes, DÉCLARER la plage avec
  // un motif plausible et re-synchroniser les empreintes passait toutes les simulations au
  // vert — le manuel et le DAO annexés disparaissaient, et le seul signe était un total plus
  // petit qu'un humain devait remarquer. Un compte attendu, écrit par le préparateur AVANT la
  // découpe, n'est pas un « nombre fixe dans une assertion » (§ 10.8) : c'est une empreinte,
  // au même titre qu'un md5. Elle est ici, et elle parle.
  if (Number.isInteger(prep.comptes?.lignes_corps) && out.length !== prep.comptes.lignes_corps)
    throw new Error(
      `${prep.id} — le corps dérivé fait ${out.length} lignes, la fiche de préparation en ` +
        `annonce ${prep.comptes.lignes_corps}. Un segment a été amputé, ou une plage écartée à ` +
        `tort : re-mesurer avant d'écrire — STOP`,
    )

  return {
    corps,
    piece,
    lignesPiece: lignes.length,
    lignesCorps: out.length,
    retraits: retraits.size,
    retraitsSansEffet: [...retraits].filter((l) => !couvert.has(l)).length,
    retraitsInline: reecrites.size,
    jointures: prep.jointures_entetes.length,
    lignesAbsorbees: absorbees,
    horsSegments,
    horsSegmentsPlages: prep.decoupe.hors_segments,
    insertions: inserees,
    insertionsDetail: prep.decoupe.insertions.map((x) => ({ ...x, id: prep.id })),
    retraitsDetail: prep.decoupe.retraits.map((r) => ({
      id: prep.id, ligne: r.ligne_source, motif: r.motif, texte: r.texte,
    })),
  }
}

/**
 * L'appareil du lecteur annoté, tel que B l'écrit dans `Document.annotationsJson` :
 * sommaire + menu latéral + libellés d'article, RIEN DE PLUS. Aucun index n'est fabriqué,
 * aucune division inventée (interdit n° 16) ; `pointAnchors` n'est posé que si la fiche de
 * préparation en déclare. C partage cette fonction pour pouvoir simuler AVANT que B n'écrive.
 */
export function construireAnnotations(f: Fiche, prep: Prep): Record<string, unknown> {
  return {
    title: f.titre.fr,
    annotationAuthor: '',
    navToc: prep.navToc,
    toc: prep.toc.map((e) => ({ level: e.level, label: e.label, anchor: e.anchor, kind: e.kind })),
    connexes: [],
    jurisprudence: {},
    indexEntries: [],
    labels: prep.labels,
    ...(prep.pointAnchors ? { pointAnchors: prep.pointAnchors } : {}),
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════
// LA PREUVE DES CHAMPS DE FICHE
// ════════════════════════════════════════════════════════════════════════════════════════
/**
 * OÙ un appui de fiche se lit sur la pièce canonique — « acte » (dans le corps versé) ou
 * « fascicule » (sur la pièce, hors du corps versé).
 *
 * ⚠️ DÉCISION DE ME VAVAL DU 28 AOÛT 2026 — « il faut découper chaque fascicule : éliminer le
 * bandeau ainsi que tout ce qui n'a rien à voir avec le marché public ». Le bandeau du
 * Moniteur et le sommaire du fascicule ont donc quitté les 25 corps. Or c'est là, et nulle
 * part ailleurs, que se lisaient la DATE DE PARUTION et le NUMÉRO DU FASCICULE de chaque
 * fiche — et, pour six textes (n° 01, 05, 08, 16, 18, 23), l'INTITULÉ MÊME de l'acte, que le
 * Journal officiel n'imprime qu'au sommaire.
 *
 * ⚠️ SECONDE DÉCISION DU MÊME JOUR — « ajouter les titres au début ». Les corps qui n'ouvraient
 * pas sur leur objet le portent désormais : l'intitulé est RESTITUÉ de la ligne de sommaire de
 * leur propre pièce, mot pour mot, et déclaré dans `decoupe.insertions` avec sa ligne d'origine
 * et son motif. La date de parution et le numéro du fascicule, eux, restent hors du corps et
 * continuent de se prouver sur la PIÈCE : c'est de l'appareil de fascicule, pas de l'acte.
 *
 * Ces appuis ne sont pas perdus et ne sont toujours pas recopiés : ils se prouvent sur la
 * PIÈCE, dont le md5 est asserté par `assertionEmpreintes` AVANT toute lecture, et dont
 * `deriverCorps` revérifie l'empreinte à chaque dérivation. Ce qui change, c'est qu'on DIT
 * désormais où chaque appui se lit — le rapport de B les nomme un par un.
 */
export type LieuAppui = 'acte' | 'fascicule'

/** L'appui se lit-il au corps versé, à défaut sur la pièce, ou nulle part ? */
function lieuAppui(corps: string, piece: string, aiguille: string): LieuAppui | null {
  if (occurrencesPliees(corps, aiguille) > 0) return 'acte'
  if (occurrencesPliees(piece, aiguille) > 0) return 'fascicule'
  return null
}

export interface PreuveTitre {
  fr: string
  morceauxCorps: number
  morceauxEditoriaux: string[]
  carsCorps: number
  carsEditoriaux: number
  /** Morceaux CORPS qui ne se lisent PLUS au corps versé, mais seulement au fascicule
   *  (bandeau ou sommaire) — mesuré, nommé au rapport, jamais tu. */
  morceauxAuFascicule: string[]
}

/** Le titre se PROUVE : chaque morceau CORPS se lit à la PIÈCE — au corps versé quand l'acte
 *  porte son intitulé, à défaut au seul sommaire du fascicule. `morceauxAuFascicule` NOMME les
 *  seconds ; depuis la restitution du 28 août, le compte est censé être NUL, mais on le mesure
 *  toujours — c'est lui qui dira le prochain texte à restituer. */
export function prouverTitre(f: Fiche, corps: string, piece: string): PreuveTitre {
  const editoriaux: string[] = []
  const auFascicule: string[] = []
  let carsCorps = 0
  let carsEdit = 0
  for (const m of f.titre.composition) {
    if (m.src === 'CORPS') {
      const ou = lieuAppui(corps, piece, m.txt)
      if (ou === null)
        throw new Error(`${f.id} — titre : le morceau « ${m.txt.slice(0, 70)}… » ne se lit NI au corps NI à la pièce — le titre ne se recopie pas, il se prouve`)
      if (ou === 'fascicule') auFascicule.push(m.txt)
      carsCorps += plier(m.txt).length
    } else {
      if (!(LIANTS_AUTORISES as readonly string[]).includes(m.txt))
        throw new Error(`${f.id} — titre : le mot d'éditeur « ${m.txt} » n'est pas dans la liste FERMÉE des liants autorisés`)
      editoriaux.push(m.txt)
      carsEdit += plier(m.txt).length
    }
  }
  const recolle = plier(f.titre.composition.map((m) => m.txt).join(' '))
  if (plier(f.titre.fr) !== recolle)
    throw new Error(
      `${f.id} — titre : l'intitulé n'est pas EXACTEMENT le recollement de sa composition.\n` +
        `      titre    : « ${f.titre.fr} »\n      recollé  : « ${recolle} »`,
    )
  return {
    fr: f.titre.fr,
    morceauxCorps: f.titre.composition.filter((m) => m.src === 'CORPS').length,
    morceauxEditoriaux: editoriaux,
    carsCorps,
    carsEditoriaux: carsEdit,
    morceauxAuFascicule: auFascicule,
  }
}

/** Une date de fiche se PROUVE : son écriture française doit se lire dans l'appui déclaré,
 *  et l'appui doit se lire à la PIÈCE. Aucune date n'est recopiée d'un tableau.
 *  ⚠️ L'adoption se lit au bloc « Donné », donc au corps ; la PUBLICATION se lit au bandeau du
 *  fascicule, donc — depuis le 28 août — hors du corps. `ou` le dit, et le rapport l'affiche. */
export function prouverDate(
  f: Fiche,
  corps: string,
  piece: string,
  quoi: 'adoption' | 'publication',
): { iso: string; enLettres: string; appui: string; ou: LieuAppui } | null {
  const d = quoi === 'adoption' ? f.adoption : f.publication
  if (!d) return null
  const ou = lieuAppui(corps, piece, d.appui)
  if (ou === null)
    throw new Error(`${f.id} — ${quoi} : l'appui « ${d.appui.slice(0, 70)} » ne se lit NI au corps NI à la pièce — STOP`)
  const enLettres = dateFrancaise(d.iso)
  if (!plier(d.appui).includes(plier(enLettres)))
    throw new Error(`${f.id} — ${quoi} : « ${enLettres} » ne se lit pas dans l'appui « ${d.appui} » — la date de fiche ne correspond pas à la pièce`)
  return { iso: d.iso, enLettres, appui: d.appui, ou }
}

/** Le numéro de fascicule se PROUVE au bandeau de la PIÈCE (il sert ensuite à l'Index, § 8.6).
 *  Le bandeau ayant quitté les corps le 28 août, il s'y lit désormais hors du corps versé :
 *  la référence du fascicule vit dans le CHAMP `moniteurRef` de la fiche, pas dans le corps. */
export function prouverFascicule(f: Fiche, corps: string, piece: string): { numeroIndex: string; appui: string; ou: LieuAppui } | null {
  if (!f.fascicule) return null
  const ou = lieuAppui(corps, piece, f.fascicule.appui)
  if (ou === null)
    throw new Error(`${f.id} — fascicule : « ${f.fascicule.appui} » ne se lit NI au corps NI au bandeau de la pièce — STOP`)
  return { ...f.fascicule, ou }
}

/**
 * HORS-CORPUS (§ 8.3, § 11.3) — désignations des actes découpés hors du corpus.
 * Aucune ne doit apparaître dans un corps versé. « Presses Nationales » en est ABSENTE à
 * dessein : elle figure au colophon de treize corps, c'est une mention légitime du fascicule.
 * « Delmas » aussi : l'arrêté du 21 octobre 2021 cite légitimement la Commune de Delmas.
 *
 * ⚠️ LA COMPARAISON EST LITTÉRALE (`corps.split(s)`), jamais pliée : une sentinelle dont la
 * casse ou l'apostrophe ne sont pas celles de la pièce ne mord sur rien. Contrôle adverse du
 * 28 août 2026 — trois entrées corrigées, chacune MESURÉE sur `piece-19-20` :
 *  · « Mompremier » RETIRÉE : Marie Ghislaine MOMPREMIER est une SIGNATAIRE légitime des deux
 *    arrêtés versés n° 19 et 20 ; la sentinelle ne les épargnait que par accident de casse ;
 *  · « Carte d'Identification Nationale » RETIRÉE : apostrophe droite là où la pièce en porte
 *    une courbe (elle ne mordait sur rien), et l'expression se lit légitimement aux corps
 *    n° 02, 12 et 21 — elle aurait fait tomber trois textes du corpus ;
 *  · « Circulaire No 009 » → « Circulaire no 009 », la graphie du sommaire du fascicule.
 * Deux désignations mesurées discriminantes sont ajoutées pour couvrir le hors-corpus du
 * Spécial n° 8 que ces trois entrées laissaient passer.
 */
export const SENTINELLES_HORS_CORPUS = [
  'Maïs Gâté',
  'Banque Nationale de Crédit',
  'BNDA',
  'CNAL',
  'Judy BAZILE',
  'Verrettes',
  'St Raphaël',
  'Pointe-à-Raquette',
  'Grand-Bassin',
  'Terrier-Rouge',
  'Registre des Marques',
  'Circulaire no 009',
  'Commission Municipale',
  'a.i. de la Banque',
  'utilité publique',
]

// ════════════════════════════════════════════════════════════════════════════════════════
// LA PREMIÈRE ASSERTION DES TROIS SCRIPTS — les empreintes des pièces sources (§ 11.1)
// ════════════════════════════════════════════════════════════════════════════════════════
export interface PieceManifeste {
  groupe: string
  cible: string
  docx_origine: string
  md5_docx_origine: string
  md5_docx_attendu_prompt: string | null
  md5_docx_concordant: boolean | null
  /** « prompt § 4/4.1/4.2/11.2 » = la feuille de route le chiffre ; sinon première mesure. */
  md5_docx_origine_de_lattendu: string
  md5_extraction: string
  /**
   * § 8.2 / § 11.1 — nombre de TÊTES D'ARTICLE que le lecteur réel (`articleAnchorFromHeading`)
   * reconnaît dans la PIÈCE ENTIÈRE, avant toute découpe. C'est une EMPREINTE, au même titre
   * qu'un md5 — pas un « nombre fixe dans une assertion » (§ 10.8) : elle ne juge pas le
   * corpus, elle constate que la pièce n'a pas bougé sous une plume qui ne changerait pas sa
   * longueur. Le md5 seul ne dit rien de ce que le PARSEUR y voit ; deux transcriptions du
   * même acte peuvent avoir le même nombre d'octets et pas les mêmes têtes.
   */
  tetes_fichier_entier: number
  /** Têtes reconnues par l'OUTIL DE PRÉPARATION (autre reconnaisseur, plus étroit que celui
   *  du lecteur) et la désignation de chacune. Les deux comptes doivent s'accorder entre eux. */
  nb_tetes_article: number
  tetes_article: string[]
  ancres: string[]
  /** Compte que la feuille de route chiffre au § 8.2, quand elle le chiffre. */
  tetes_attendues_prompt_8_2: number | null
  /** ⚠️ NON LU — booléen que personne ne calcule, exactement comme `md5_docx_concordant`
   *  avant le 28 août. La concordance est RECALCULÉE ci-dessous, jamais recopiée. */
  tetes_concordantes: boolean | null
}
export interface Manifeste {
  genere_le: string
  source_docx: string
  pieces: PieceManifeste[]
}
export interface Empreintes {
  manifeste: Manifeste
  groupes: Record<string, number>
  docxVerifies: number
  docxAbsents: string[]
  confirmesParLePrompt: number
  fixesParPremiereMesure: number
  /** § 8.2 — têtes : ce qui a été RECALCULÉ, jamais lu dans un booléen du manifeste. */
  tetes: { total: number; confrontesAuPrompt: number; sansAttenduAuPrompt: number }
  /** Défaut mesuré, non bloquant : ancres du manifeste ≠ ancres du lecteur. */
  ancresDivergentes: string[]
}

/**
 * DEUX séries d'empreintes, étiquetées (§ 4, § 11.1) :
 *  · md5 des EXTRACTIONS (`piece-*.txt` du dépôt) — toujours vérifiables, toujours bloquantes ;
 *  · md5 des `.docx` D'ORIGINE (`~/Downloads/`) — la chaîne de garde. Une pièce absente ne
 *    bloque pas la SIMULATION (le poste peut avoir changé) mais bloque `--apply` : on n'écrit
 *    pas en production sans pouvoir remonter au fichier de la cliente.
 */
export function assertionEmpreintes(apply: boolean): Empreintes {
  const manifeste = JSON.parse(readFileSync(join(DIR, 'manifeste-empreintes.json'), 'utf8')) as Manifeste
  if (!Array.isArray(manifeste.pieces) || manifeste.pieces.length === 0) throw new Error('manifeste d’empreintes vide ou illisible — STOP')

  const groupes: Record<string, number> = {}
  let docxVerifies = 0
  let confirmes = 0
  let premiereMesure = 0
  const docxAbsents: string[] = []
  const ancresDivergentes: string[] = []
  let tetesTotal = 0
  let tetesConfrontees = 0
  let tetesSansAttendu = 0
  for (const p of manifeste.pieces) {
    const chemin = join(DIR, p.cible)
    if (!existsSync(chemin)) throw new Error(`pièce absente du dépôt : ${p.cible} — le corpus sécurisé est incomplet, STOP`)
    const contenu = readFileSync(chemin)
    const h = md5(contenu)
    if (h !== p.md5_extraction) throw new Error(`pièce ${p.cible} : md5 ${h}, attendu ${p.md5_extraction} (manifeste) — quelqu'un est passé, STOP`)
    groupes[p.groupe] = (groupes[p.groupe] ?? 0) + 1

    // ══ § 8.2 / § 11.1 — LES COMPTES DE TÊTES, CONFRONTÉS ═══════════════════════════════
    // Le manifeste portait `nb_tetes_article`, `tetes_attendues_prompt_8_2` et un booléen
    // `tetes_concordantes` — et rien ne les confrontait, exactement comme pour les md5 des
    // `.docx` (défaut n° 2 du contrôle adverse). Sept pièces portaient même « concordantes:
    // true » en face d'un attendu NUL : un booléen qui n'affirme rien. On MESURE.
    if (typeof p.tetes_fichier_entier !== 'number')
      throw new Error(`${p.cible} : le manifeste ne porte pas \`tetes_fichier_entier\` — empreinte manquante, STOP`)
    const tetesLues = contenu
      .toString('utf8')
      .split('\n')
      .filter((l) => articleAnchorFromHeading(l.trim())).length
    if (tetesLues !== p.tetes_fichier_entier)
      throw new Error(
        `${p.cible} : ${tetesLues} têtes d'article reconnues par le lecteur réel, ${p.tetes_fichier_entier} au manifeste — ` +
          `la pièce ne porte plus les mêmes articles (§ 8.2), STOP`,
      )
    tetesTotal += tetesLues
    if (!Array.isArray(p.tetes_article) || p.nb_tetes_article !== p.tetes_article.length)
      throw new Error(`${p.cible} : nb_tetes_article ${p.nb_tetes_article} ≠ ${p.tetes_article?.length} désignations listées — STOP`)
    if (!Array.isArray(p.ancres) || p.ancres.length !== p.tetes_article.length)
      throw new Error(`${p.cible} : ${p.ancres?.length} ancres pour ${p.tetes_article.length} têtes — STOP`)
    // ⚠️ DÉFAUT MESURÉ, NON BLOQUANT — le champ `ancres` du manifeste n'est pas celui du
    // lecteur : l'outil de préparation a écrit « art-1er » là où `articleAnchorFromNum` rend
    // « art-1 ». Rien de faux n'entre en base pour autant (B construit ses ancres avec les
    // fonctions RÉELLES du rendu et les confronte à `labels`), mais la documentation du
    // manifeste ment sur 50 lignes. On le COMPTE et on le dit, on ne le réécrit pas en
    // silence : réécrire une empreinte pour faire passer une assertion est l'inverse du métier.
    for (const [i, d] of p.tetes_article.entries())
      if (articleAnchorFromNum(d) !== p.ancres[i]) ancresDivergentes.push(`${p.cible} « ${d} » : manifeste ${p.ancres[i]} ≠ calcul ${articleAnchorFromNum(d)}`)
    if (p.tetes_attendues_prompt_8_2 === null) tetesSansAttendu++
    else {
      if (p.nb_tetes_article !== p.tetes_attendues_prompt_8_2)
        throw new Error(
          `${p.cible} : ${p.nb_tetes_article} têtes mesurées, ${p.tetes_attendues_prompt_8_2} chiffrées par la feuille de route (§ 8.2) — STOP`,
        )
      tetesConfrontees++
    }
    // ⚠️ « tous concordants » était une CHAÎNE CONSTANTE : le manifeste portait
    // `md5_docx_attendu_prompt` et `md5_docx_concordant`, et personne ne les confrontait.
    // Contrôle adverse du 28 août : les 17 attendus remplacés par « deadbeef00 » et tous les
    // `concordant` passés à false, le rapport disait encore « tous concordants ». On COMPARE.
    if (p.md5_docx_origine_de_lattendu.startsWith('prompt')) {
      if (!p.md5_docx_attendu_prompt)
        throw new Error(`${p.cible} : md5 dit « chiffré par la feuille de route » mais md5_docx_attendu_prompt est vide — STOP`)
      if (!p.md5_docx_origine.startsWith(p.md5_docx_attendu_prompt))
        throw new Error(
          `${p.cible} : md5 du .docx ${p.md5_docx_origine} ne commence PAS par ` +
            `${p.md5_docx_attendu_prompt}, que la feuille de route chiffre (§ 4/4.1/4.2/11.2) — STOP`,
        )
      confirmes++
    } else premiereMesure++
    const docx = join(manifeste.source_docx, p.docx_origine)
    if (!existsSync(docx)) {
      docxAbsents.push(p.docx_origine)
      continue
    }
    const hd = md5(readFileSync(docx))
    if (hd !== p.md5_docx_origine)
      throw new Error(`.docx d'origine « ${p.docx_origine} » : md5 ${hd}, attendu ${p.md5_docx_origine} — la pièce de la cliente a changé, STOP`)
    docxVerifies++
  }
  if (apply && docxAbsents.length)
    throw new Error(
      `${docxAbsents.length} .docx d'origine introuvable(s) dans ${manifeste.source_docx} — ` +
        `on n'écrit pas en production sans pouvoir remonter aux pièces de la cliente :\n      ${docxAbsents.join('\n      ')}`,
    )
  return {
    manifeste,
    groupes,
    docxVerifies,
    docxAbsents,
    confirmesParLePrompt: confirmes,
    fixesParPremiereMesure: premiereMesure,
    tetes: { total: tetesTotal, confrontesAuPrompt: tetesConfrontees, sansAttenduAuPrompt: tetesSansAttendu },
    ancresDivergentes,
  }
}

/** Une ligne de rapport, identique dans les trois scripts. */
export function rapportEmpreintes(e: Empreintes, p: (s?: string) => void): void {
  p('EMPREINTES DES PIÈCES SOURCES (première assertion, § 11.1)')
  p(
    `  manifeste du ${e.manifeste.genere_le} · ${e.manifeste.pieces.length} pièces : ` +
      Object.entries(e.groupes)
        .map(([g, n]) => `${n} ${g}`)
        .join(' + '),
  )
  p(`  extractions du dépôt conformes : ${e.manifeste.pieces.length}/${e.manifeste.pieces.length}`)
  p(`  .docx d'origine (${e.manifeste.source_docx}) : ${e.docxVerifies} vérifiés${e.docxAbsents.length ? ` · ${e.docxAbsents.length} ABSENTS (bloquant à --apply)` : ''}`)
  p(`  md5 que la feuille de route chiffre expressément : ${e.confirmesParLePrompt} — CONFRONTÉS un à un au .docx, tous concordants`)
  p(`  md5 fixés par première mesure (le prompt ne les chiffre pas) : ${e.fixesParPremiereMesure} — le manifeste ne CONFIRME rien pour eux`)
  p(
    `  têtes d'article (§ 8.2) : ${e.tetes.total} RE-COMPTÉES par le lecteur réel sur les pièces entières et confrontées à leur empreinte · ` +
      `${e.tetes.confrontesAuPrompt} pièces confrontées au compte que la feuille de route chiffre · ` +
      `${e.tetes.sansAttenduAuPrompt} sans attendu au prompt (le booléen « tetes_concordantes » du manifeste n'est pas lu : il ne prouve rien)`,
  )
  if (e.ancresDivergentes.length) {
    const exemple = e.ancresDivergentes[0].replace(/^.*« /, '« ')
    p(
      `  ⚠️ DÉFAUT MESURÉ (non bloquant) : ${e.ancresDivergentes.length} ancres du manifeste ne sont pas celles du lecteur — ` +
        `toutes du même motif, ${exemple}. Rien de faux n'entre en base (B recalcule ses ancres avec les fonctions du rendu ` +
        `et les confronte à « labels ») : c'est la DOCUMENTATION du manifeste qui est fautive, à corriger à sa source.`,
    )
  }
}

/** Les six écartés du § 4.1-4.2 — jamais versés, jamais fusionnés (§ 11.2). */
export const ECARTES = [
  { fichier: 'ecartees/ecartee-a-2009-organisation-fonctionnement-cnmp.txt', md5Docx: 'fa178c8d34', motif: 'rivale du texte n° 4 — « 64ème », « rémunéré »' },
  { fichier: 'ecartees/ecartee-b-2009-organisation-4-novembre-2009.txt', md5Docx: '952a9c370e', motif: 'rivale du texte n° 4 — « prévus »' },
  { fichier: 'ecartees/ecartee-c-2017-sp35-transcription-abregee.txt', md5Docx: '5bece78c8b', motif: 'transcription abrégée du texte n° 14' },
  { fichier: 'ecartees/ecartee-d-2021-sp8-transcription-base.txt', md5Docx: 'ff16667a79', motif: 'rivale du Spécial n° 8 (base)' },
  { fichier: 'ecartees/ecartee-e-2021-sp8-transcription-1.txt', md5Docx: 'cc799360bd', motif: 'rivale du Spécial n° 8 (_1) — exposants Unicode' },
  // ⚠️ Doublon À L'OCTET de la gagnante : il s'exclut PAR SON NOM, jamais par son md5 (§ 11.2).
  { fichier: 'ecartees/ecartee-f-2021-sp8-doublon-a-octet.txt', md5Docx: 'a85cae5e01', motif: 'doublon à l’octet de la gagnante — exclu par NOM' },
]
