/**
 * § 4.4, § 4.5, § 4.5 bis, § 5.2 bis et § 5.2 ter — LA DÉRIVATION DU RÉPERTOIRE.
 *
 * Le catalogue machine fait foi (`data/delais-repertoire.json`, 393 objets). Le `kind`, le
 * `slug`, le régime et les surcharges s'en **dérivent mécaniquement** : ils ne se choisissent
 * pas à la main, sauf les six surcharges nommées du § 4.5, listées ici en clair avec leur
 * justification.
 *
 * ⚠️ `data/delais-repertoire.json` = `delais-catalogue.json` (les 15 clés d'origine, inchangées)
 * + trois clés dérivées des trois sources de la rédaction : `tableau`, `ordre`,
 * `tableauTitreFr` (§ 5.2 ter). L'appariement a été contrôlé ligne à ligne sur l'`objet` :
 * 232/232 pour le C. pr. civ. (blocs « ── TABLEAU n » du répertoire), 114/114 pour le Code
 * civil et 47/47 pour le Code du travail (tableaux Word, dans l'ordre du document). Les
 * effectifs sont re-contrôlés à chaque passage de la graine : **un écart d'une seule ligne
 * arrête tout**.
 */
import repertoireJson from './data/delais-repertoire.json'
import type { EntreeDelai, KindDelai, Supplement } from './calcul'
import { kindCalcule } from './calcul'
import type { CodeDelai, Prorogation991, Regime } from './regimes'
import {
  FONDEMENT_PROROGATION_PAR_CODE,
  FONDEMENT_REGIME_PAR_CODE,
  LIBELLE_CODE,
  citationDeFranc,
  normaliserRegime,
} from './regimes'
import {
  CITATIONS_CIVIL_FRANC,
  CITATIONS_DISTANCE_LIEUES,
  CITATIONS_DUREE_AILLEURS,
} from './textes'

/** Une ligne du répertoire, telle qu'elle est dans le fichier. */
export type LigneRepertoire = {
  code: string
  abbr: string
  article: string
  objet: string
  duree: string
  depart: string
  observations: string
  determine: boolean
  valeur: number | null
  unite: string | null
  plus: string | null
  distance: boolean
  dit_franc: boolean
  regime: string
  fondement: string
  tableau: number
  ordre: number
  tableauTitreFr: string | null
}

export const REPERTOIRE = repertoireJson as unknown as LigneRepertoire[]

/** Effectifs attendus par tableau (§ 5.2 ter). Un écart = arrêt, jamais un recalage. */
export const VENTILATION_ATTENDUE: Record<CodeDelai, Record<number, number>> = {
  CPC: { 1: 4, 2: 19, 3: 58, 4: 14, 5: 16, 6: 15, 7: 77, 8: 11, 9: 11, 10: 7 },
  CIVIL: {
    1: 2, 2: 1, 3: 8, 4: 7, 5: 4, 6: 6, 7: 3, 8: 7, 9: 5, 10: 3,
    11: 6, 12: 9, 13: 9, 14: 8, 15: 10, 16: 2, 17: 2, 18: 9, 19: 9, 20: 4,
  },
  TRAVAIL: { 1: 3, 2: 9, 3: 3, 4: 6, 5: 5, 6: 3, 7: 4, 8: 5, 9: 9 },
}

/** Effectifs attendus par genre, AVANT les six surcharges (§ 4.4). */
export const KINDS_ATTENDUS_AVANT: Record<KindDelai, number> = {
  JOURS: 100,
  JOURS_PLUS_DISTANCE_KM: 14,
  JOURS_DISTANCE_NON_CHIFFREE: 4,
  HEURES: 19,
  MOIS: 31,
  ANNEES: 19,
  INDETERMINE: 206,
}

/** Et APRÈS : cinq lignes passent d'INDETERMINE à JOURS (§ 4.4). */
export const KINDS_ATTENDUS_APRES: Record<KindDelai, number> = {
  ...KINDS_ATTENDUS_AVANT,
  JOURS: 105,
  INDETERMINE: 201,
}

/**
 * § 4.4 — la dérivation mécanique. **La branche par défaut JETTE** : aucune ligne n'est
 * aujourd'hui `TRAVAIL` + jour + distance, et c'est justement pourquoi une ligne ajoutée
 * demain par le back-office ne doit pas tomber silencieusement dans `INDETERMINE`.
 */
export function deriverKind(l: LigneRepertoire): KindDelai {
  if (!l.determine) return 'INDETERMINE'
  switch (l.unite) {
    case 'heure':
      return 'HEURES'
    case 'mois':
      return 'MOIS'
    case 'an':
      return 'ANNEES'
    case 'jour':
      if (!l.distance) return 'JOURS'
      if (l.code === 'CPC') return 'JOURS_PLUS_DISTANCE_KM'
      if (l.code === 'CIVIL') return 'JOURS_DISTANCE_NON_CHIFFREE'
      throw new Error(
        `Genre indéterminable : ${l.code} art. ${l.article}, jours + distance. Le § 4.4 ne ` +
          `couvre pas ce cas — il faut une décision humaine, pas un genre deviné.`,
      )
    default:
      throw new Error(`Unité inconnue « ${l.unite} » : ${l.code} art. ${l.article}`)
  }
}

// ---------------------------------------------------------------------------
// § 5.2 bis — LA RÈGLE DE SLUG. Elle n'est pas au choix du développeur.
// ---------------------------------------------------------------------------

/**
 * Le préfixe de slug par code. EXPORTÉ (et non recopié dans le back-office) : le slug d'une
 * entrée créée à la main doit suivre exactement la même règle que les 393 de la graine, sinon
 * deux entrées du même article porteraient deux formes d'adresse.
 */
export const PREFIXE_CODE: Record<string, string> = { CPC: 'cpc', TRAVAIL: 'trav', CIVIL: 'civ' }

const MOTS_VIDES = new Set(
  ('de du des d la le les l en au aux a par pour et un une sur dans ou se sa son ses ce cet ' +
    'cette qui que').split(' '),
)

export function slugifier(s: string): string {
  return (s ?? '')
    .replace(/’/g, "'")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/°/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Numéro d'article slugifié : le préfixe « Art. » / « Article » / « Arts. » EN TÊTE est retiré. */
export function slugifierArticle(article: string): string {
  return slugifier((article ?? '').replace(/^\s*(?:arts?\.|articles?)\s*/i, ''))
}

/** Suffixe d'objet : mots vides retirés, tronqué à 40 caractères SUR UNE FRONTIÈRE DE MOT. */
export function suffixeObjet(objet: string): string {
  const mots = slugifier(objet).split('-').filter((m) => m && !MOTS_VIDES.has(m))
  if (mots.length === 0) return ''
  let out = mots[0] // le premier mot est toujours gardé
  for (const m of mots.slice(1)) {
    if (out.length + 1 + m.length > 40) break
    out += `-${m}`
  }
  return out
}

/**
 * Les 393 slugs, en trois temps. Vérifié : 393 slugs, 393 distincts, 0 collision, longueur
 * maximale 54, tous conformes à `/^[a-z0-9]+(-[a-z0-9]+)*$/`.
 *
 * ⚠️ **Un slug déjà écrit en base ne change JAMAIS** : il est gravé dans chaque permalien
 * imprimé, collé dans une écriture, cité devant un tribunal. Une édition de l'`objet` par le
 * back-office incrémente `revision`, elle ne recalcule pas le slug.
 */
export function construireSlugs(lignes: readonly LigneRepertoire[]): string[] {
  const bases = lignes.map((l) => `${PREFIXE_CODE[l.code]}-${slugifierArticle(l.article)}`)
  const compte = new Map<string, number>()
  for (const b of bases) compte.set(b, (compte.get(b) ?? 0) + 1)
  return bases.map((b, i) => (compte.get(b) === 1 ? b : `${b}-${suffixeObjet(lignes[i].objet)}`))
}

export const SLUG_VALIDE = /^[a-z0-9]+(-[a-z0-9]+)*$/

// ---------------------------------------------------------------------------
// § 4.5 — LES SIX SURCHARGES DE L'ARTICLE 74
// ---------------------------------------------------------------------------

const OPTIONS_74 = [
  {
    cle: 'haiti',
    jours: 0,
    libelleFr: 'En Haïti',
    noteFr: 'L’article 74 ne s’applique pas.',
  },
  {
    cle: 'antilles',
    jours: 30,
    libelleFr: 'Antilles ou continent américain',
    fondement: 'C. pr. civ., art. 74 — « trente jours francs »',
  },
  {
    cle: 'outre-ocean',
    jours: 45,
    libelleFr: 'Au-delà de l’un ou l’autre océan',
    fondement: 'C. pr. civ., art. 74 — « quarante-cinq jours francs »',
  },
] as const

function supplement74(avecHaiti: boolean): Supplement {
  return {
    type: 'ART_74',
    questionFr: 'Où demeure la partie ?',
    obligatoire: true,
    // Pour 10-4° et 584, dont la durée EST celle de l'art. 74, l'option « en Haïti » est
    // RETIRÉE : ces lignes ne visent que des personnes hors d'Haïti.
    options: avecHaiti ? [...OPTIONS_74] : OPTIONS_74.filter((o) => o.cle !== 'haiti'),
  }
}

export type Surcharge = {
  /** Identifie la ligne sans ambiguïté : l'article seul ne suffit pas (26 couples en double). */
  article: string
  objetDebut: string
  jours: number
  avecHaiti: boolean
  justification: string
}

/**
 * Les SIX surcharges, en clair, avec leur justification. Cinq déplacent une ligne
 * d'`INDETERMINE` vers `JOURS` ; la sixième (l'art. 296) enrichit une ligne déjà calculable
 * que le répertoire n'annote pas.
 *
 * « Un menu qui affiche 30 jours francs pour l'article 354, l'article 296 ou l'article 417
 * sans l'augmentation de l'article 74 donne une date fausse à l'avocate dont le client
 * demeure à l'étranger — l'hypothèse la plus fréquente en pratique. »
 */
export const SURCHARGES_ART_74: readonly Surcharge[] = [
  {
    article: '10-4°',
    objetDebut: 'Citation (défendeur établi à l',
    jours: 0,
    avecHaiti: false,
    justification:
      'La durée EST celle de l’art. 74 : « Citation (défendeur établi à l’étranger) — Délais ' +
      'de l’art. 74 ». Base 0 jour, option « en Haïti » retirée.',
  },
  {
    article: '296',
    objetDebut: 'Opposition (partie sans défenseur)',
    jours: 30,
    avecHaiti: true,
    justification:
      'Le répertoire n’écrit que « 30 jours francs », mais le Code ajoute : « Le délai de ' +
      'trente jours francs sera augmenté, le cas échéant, de ceux prévus à l’article 74 du ' +
      'présent Code. » Sixième surcharge, que le répertoire ne signale pas.',
  },
  {
    article: '354',
    objetDebut: 'Appel (parties demeurant hors d',
    jours: 30,
    avecHaiti: false,
    justification:
      '« Pour ceux qui demeurent hors d’Haïti, ce délai est augmenté des délais impartis par ' +
      'l’article 74 ci-dessus. » La ligne vise expressément les parties hors d’Haïti.',
  },
  {
    article: '397',
    objetDebut: 'Requête civile (personnes demeurant hors du territoire)',
    jours: 25,
    avecHaiti: false,
    justification: 'Requête civile, personnes demeurant hors du territoire : 25 jours + art. 74.',
  },
  {
    article: '417',
    objetDebut: 'Pourvoi (personnes habitant l',
    jours: 30,
    avecHaiti: false,
    justification:
      '« Les personnes qui habitent l’étranger auront, outre le délai de trente jours, les ' +
      'délais de l’art. 74 du présent Code, à partir de la signification, au Parquet du ' +
      'Ministère Public. » C’est exactement le cas de l’arrêt Brown and Root.',
  },
  {
    article: '584',
    objetDebut: 'Saisie entre les mains de personnes ne demeurant pas en',
    jours: 0,
    avecHaiti: false,
    justification:
      '« seront observés pour les ajournements, les délais prescrits par l’article 74 ». Base ' +
      '0 jour, option « en Haïti » retirée.',
  },
]

function surchargeDe(l: LigneRepertoire): Surcharge | undefined {
  if (l.code !== 'CPC') return undefined
  return SURCHARGES_ART_74.find(
    (s) => l.article === s.article && l.objet.startsWith(s.objetDebut),
  )
}

// ---------------------------------------------------------------------------
// § 4.5 — LES DURÉES QUI NE SONT PAS DANS L'ARTICLE QUI LES PORTE
// ---------------------------------------------------------------------------

/**
 * ⚠️ CORRECTIF (défaut 3 du cahier de recette). Le recoupement des durées contre le texte lu
 * en base a remonté l'**art. 356** : son texte ne porte AUCUNE durée — « Le délai de l'appel
 * courra à l'encontre de celui qui aura signifié le jugement, du jour de cette signification »
 * —, les 30 jours viennent de l'**art. 354**. La durée est juste au fond, mais le catalogue
 * l'attribuait à un article qui ne l'énonce pas, et rien ne le signalait à l'écran : une
 * avocate qui ouvrait l'art. 356 pour y lire « trente jours » ne l'y trouvait pas.
 *
 * Une entrée listée ici porte donc `dureeFondementFr`, qui est AFFICHÉ à l'étape de la durée
 * et qui fait sortir l'entrée du lot des divergences dans `verify-delais-durees.ts` : le
 * renvoi est une décision de la rédaction, pas un trou dans la donnée.
 *
 * **Ce n'est pas une liste où l'on range ce qui ne concorde pas.** Une durée introuvable
 * dans son article reste une divergence à trancher tant que la rédaction n'a pas nommé
 * l'article qui la porte.
 */
export type DureeAilleurs = {
  code: string
  article: string
  /** Ce que l'article DIT au lieu de chiffrer la durée. Verbatim, relu en base. */
  constatFr: string
}

export const DUREES_D_UN_AUTRE_ARTICLE: readonly DureeAilleurs[] = [
  {
    code: 'CPC',
    article: '356',
    constatFr:
      'L’article 356 ne chiffre pas ce délai : il ne fait qu’en fixer le point de départ ' +
      '(« Le délai de l’appel courra à l’encontre de celui qui aura signifié le jugement, du ' +
      'jour de cette signification »).',
  },
]

/**
 * La phrase affichée, composée du constat ET de la citation relue en base
 * (`CITATIONS_DUREE_AILLEURS`) : on ne recopie pas un texte de loi à la main dans une phrase,
 * on le prend là où `verify-delais-sources.ts` va le recouper.
 */
function dureeAilleurs(l: LigneRepertoire): string | null {
  const d = DUREES_D_UN_AUTRE_ARTICLE.find((x) => x.code === l.code && x.article === l.article)
  if (!d) return null
  const c = CITATIONS_DUREE_AILLEURS[l.article]
  if (!c?.citation) {
    throw new Error(
      `§ 4.5 — ${l.code} art. ${l.article} est déclaré « durée d’un autre article » mais ` +
        `aucune citation relue en base ne le fonde. Une durée sans son texte ne s’affiche pas.`,
    )
  }
  return `${d.constatFr} La durée est celle de ${c.reference} : « ${c.citation} »`
}

// ---------------------------------------------------------------------------
// § 4.5 bis — LES 8 ENTRÉES DU CODE DU TRAVAIL À NUMÉRO HOMONYME
// ---------------------------------------------------------------------------

const CH_III = 'Chapitre III — Des conflits collectifs de travail Règlements amiables Conciliation'
const CH_V = 'Chapitre V — Du conseil supérieur d’arbitrage'
const CH_XXVII =
  'CHAPITRE XXVII — DES DÉCLARATIONS D’ACCIDENTS ET DE MALADIES PROFESSIONNELLES'

export type Desambiguisation = {
  article: string
  objetDebut: string
  articleOccurrence: number
  articleContexte: string
  phraseDeControle: string
}

/**
 * `art-172` désigne TROIS articles différents dans le même document : le Code du travail en
 * base porte 991 en-têtes pour 520 ancres distinctes, soit **207 numéros en double**. Une
 * référence « C. trav., art. 172 » toute seule est ambiguë : ne l'écris jamais nue.
 */
export const DESAMBIGUISATION_TRAVAIL: readonly Desambiguisation[] = [
  { article: 'Art. 172', objetDebut: 'Réponse concrète aux revendications', articleOccurrence: 1, articleContexte: CH_III, phraseDeControle: 'dix jours' },
  { article: 'Art. 173', objetDebut: 'Transmission du procès-verbal', articleOccurrence: 1, articleContexte: CH_III, phraseDeControle: 'trois jours' },
  { article: 'Art. 179', objetDebut: 'Durée maximale de la procédure de conciliation', articleOccurrence: 1, articleContexte: CH_III, phraseDeControle: 'huit jours' },
  { article: 'Art. 194', objetDebut: 'Recours devant le Conseil supérieur', articleOccurrence: 1, articleContexte: CH_V, phraseDeControle: 'cinq jours francs' },
  { article: 'Art. 198', objetDebut: 'Prononcé des arrêts du Conseil supérieur', articleOccurrence: 1, articleContexte: CH_V, phraseDeControle: 'huit jours' },
  { article: 'Loi assurance, art. 168', objetDebut: 'Avis d’accident du travail', articleOccurrence: 2, articleContexte: CH_XXVII, phraseDeControle: 'trente jours' },
  { article: 'Art. 172', objetDebut: 'Transmission par l’employeur du formulaire', articleOccurrence: 3, articleContexte: CH_XXVII, phraseDeControle: 'cinq jours' },
  { article: 'Art. 173', objetDebut: 'Avis de la maladie professionnelle', articleOccurrence: 3, articleContexte: CH_XXVII, phraseDeControle: '30 jours' },
]

/**
 * § 2.12 — les DEUX articles qui font mesurer deux distances. « Pour les articles à double
 * distance, le formulaire présente deux champs de kilométrage, et le raisonnement montre les
 * deux conversions séparément. Un champ unique y donnerait la moitié des jours dus. »
 *  - art. 517 : « entre le domicile du tiers-saisi et celui du saisissant ; ET un jour par
 *    quarante kilomètres de distance entre le domicile de ce dernier et celui du débiteur
 *    saisi » (les DEUX lignes 517 du répertoire, paix et civil) ;
 *  - art. 586 : débiteur de la rente ↔ saisissant, ET saisissant ↔ partie saisie.
 */
const DEUX_DISTANCES = new Set(['517', '586'])

function desambiguisationDe(l: LigneRepertoire): Desambiguisation | undefined {
  if (l.code !== 'TRAVAIL') return undefined
  return DESAMBIGUISATION_TRAVAIL.find(
    (dd) => l.article === dd.article && l.objet.startsWith(dd.objetDebut),
  )
}

// ---------------------------------------------------------------------------
// § 4.7, garde-fou 2 — LES SIX DÉLAIS DU CODE DU TRAVAIL AU RÉGIME DOUTEUX
// ---------------------------------------------------------------------------

/**
 * « Délai de procédure » n'est PAS acquis, et le trancher tout seul serait la faute. Ces six
 * lignes portent `regimeIncertain: true` : tête d'affiche en ORDINAIRE (la plus précoce, donc
 * la plus sûre), régime franc en lecture nommée. **À faire trancher par la rédaction.**
 */
export const TRAVAIL_REGIME_DOUTEUX: readonly { article: string; objetDebut: string }[] = [
  { article: 'Art. 172', objetDebut: 'Transmission par l’employeur du formulaire' },
  { article: 'Art. 391', objetDebut: 'Déclaration d’entreprise' },
  { article: 'Assurance maternité', objetDebut: 'Avis de grossesse' },
  { article: 'Art. 172', objetDebut: 'Réponse concrète aux revendications' },
  { article: 'Loi assurance, art. 168', objetDebut: 'Avis d’accident du travail' },
  { article: 'Art. 173', objetDebut: 'Avis de la maladie professionnelle' },
]

function regimeDouteuxTravail(l: LigneRepertoire): boolean {
  return (
    l.code === 'TRAVAIL' &&
    TRAVAIL_REGIME_DOUTEUX.some((t) => l.article === t.article && l.objet.startsWith(t.objetDebut))
  )
}

// ---------------------------------------------------------------------------
// La construction d'une entrée
// ---------------------------------------------------------------------------

export type EntreeGrainee = EntreeDelai & {
  tableau: number
  ordre: number
  tableauTitreFr: string | null
  articleOccurrence: number
  objetEn: string
  objetHt: string
  traductionRelue: boolean
  pointDepartEn: string
  pointDepartHt: string
  sanctionFr: string | null
  sanctionEn: string | null
  sanctionHt: string | null
  motifRefusEn: string | null
  motifRefusHt: string | null
  statut: string
  /** Trace de la surcharge appliquée, pour le compte rendu de la graine. */
  surchargeAppliquee: string | null
}

const MOTIF_HEURES =
  'Ce délai est exprimé en heures. Un délai franc se compte en jours entiers ; « 24 heures ' +
  'franches » n’a pas de sens établi, et l’article 991 interdit toute signification avant 6 h ' +
  'et après 18 h. Ce calculateur de jours ne le traite pas.'

const MOTIF_MOIS_ANNEES =
  '« Ne pas compter le jour de l’échéance » n’a pas de sens établi pour un mois ou une année, ' +
  'et aucun texte du corpus ne dit de quel jour part un délai d’un mois commencé le 31 janvier.'

const MOTIF_REBOURS =
  'Délai à rebours. Si le jour obtenu tombe un dimanche, proroger raccourcirait le préavis et ' +
  'annulerait l’acte ; le texte ne prévoit que la prorogation, jamais l’anticipation. La ' +
  'question n’est pas tranchée ; la plateforme ne la tranche pas seule.'

/** Un délai à rebours ? Le répertoire l'écrit : « avant », « d'avance », « au moins avant ». */
function estARebours(l: LigneRepertoire): boolean {
  return /\bavant\b|d[’']avance/i.test(`${l.duree} ${l.objet}`)
}

function motifRefus(l: LigneRepertoire, kind: KindDelai): string | null {
  if (kindCalcule(kind)) return null
  if (kind === 'HEURES') return MOTIF_HEURES
  if (kind === 'MOIS' || kind === 'ANNEES') return MOTIF_MOIS_ANNEES
  if (estARebours(l)) return `${MOTIF_REBOURS} Durée telle qu’écrite au répertoire : « ${l.duree} ».`
  return (
    `Durée telle qu’écrite au répertoire : « ${l.duree} ». Ce délai n’est pas déterminé : la ` +
    `plateforme n’en tire aucune date. Saisissez vous-même le nombre de jours par l’option ` +
    `« Autre ».`
  )
}

/** Le régime et son fondement — § 4.7, avec le garde-fou de la citation (défaut 1 corrigé). */
function resoudreRegime(l: LigneRepertoire): {
  regime: Regime
  regimeIncertain: boolean
  regimeFondement: string
} {
  const regime = normaliserRegime(l.regime)
  const code = l.code as CodeDelai

  if (regime === 'A_VERIFIER') {
    return {
      regime,
      regimeIncertain: false,
      regimeFondement:
        'Régime à vérifier — la rédaction n’a pas qualifié ce délai. Fondement porté au ' +
        `catalogue : « ${l.fondement} ». Aucune conversion en FRANC ou en ORDINAIRE : ce serait ` +
        'trancher la question que la rédaction a refusé de trancher.',
    }
  }

  if (code === 'CIVIL' && regime === 'FRANC') {
    const verifiee = CITATIONS_CIVIL_FRANC[l.article]
    if (verifiee?.citation) {
      return {
        regime,
        regimeIncertain: false,
        regimeFondement: `${verifiee.reference} — « ${verifiee.citation} »`,
      }
    }
    // Pas de phrase d'article : on n'affirme PAS que le délai est franc.
    return {
      regime,
      regimeIncertain: true,
      // ⚠️ Rédigé POUR UNE AVOCATE, comme les `constat` de `CITATIONS_CIVIL_FRANC` : ni nom de
      // champ, ni renvoi à une spécification interne. Voir la note du 20 août 2026 sur
      // l'entrée « Loi, art. 10 » (`textes.ts`).
      regimeFondement:
        verifiee?.constat ??
        'Le répertoire donne ce délai pour franc, et aucun texte du corpus ne le dit. La ' +
          'plateforme ne tranche pas la qualification : elle retient la date la plus précoce — ' +
          'celle du régime ordinaire, où le jour de l’échéance compte — et nomme la date ' +
          'franche à côté, un jour plus tard. Vérifiez le texte dont vous tenez ce délai : ' +
          'c’est lui qui dira laquelle des deux dates vous engage.',
    }
  }

  if (code === 'TRAVAIL' && regimeDouteuxTravail(l)) {
    return {
      regime,
      regimeIncertain: true,
      /**
       * ⚠️ **RÉDIGÉ POUR UNE AVOCATE** (correctif du 20 août 2026). Ces six fiches finissaient
       * par « À faire trancher par la rédaction (§ 13, point 4) » — un renvoi à une
       * spécification interne, sous la date, sur une fiche publiée. Et la citation était
       * ALTÉRÉE : « Tous les délais DE PROCÉDURE… » n'est pas la phrase de l'article, qui écrit
       * « de procédure » en bas de casse. L'insistance est désormais dans la phrase de la
       * plateforme, où elle est chez elle ; la citation est rendue mot pour mot.
       */
      regimeFondement:
        'C. trav., art. 511 — « Tous les délais de procédure prévus au Code du Travail sont ' +
        'francs. » L’article ne rend francs que les délais DE PROCÉDURE, et celui-ci n’en ' +
        'paraît pas un. La plateforme ne tranche pas cette qualification : elle retient la date ' +
        'la plus précoce — celle du régime ordinaire, où le jour de l’échéance compte — et ' +
        'nomme la date franche à côté, un jour plus tard. Si vous tenez ce délai pour un délai ' +
        'de procédure, c’est la seconde qui vous engage.',
    }
  }

  return { regime, regimeIncertain: false, regimeFondement: FONDEMENT_REGIME_PAR_CODE[code] }
}

function prorogation(code: CodeDelai): { prorogation991: Prorogation991; fondement: string } {
  if (code === 'CIVIL') {
    return { prorogation991: 'INCERTAIN', fondement: FONDEMENT_PROROGATION_PAR_CODE.CIVIL }
  }
  return { prorogation991: 'OUI', fondement: FONDEMENT_PROROGATION_PAR_CODE[code] }
}

/**
 * L'avis de distance d'une entrée `JOURS_DISTANCE_NON_CHIFFREE` : A5 ou A5-bis (§ 4.9).
 *
 * ⚠️ CORRECTIF (défaut 9). Le tri se faisait sur le seul CATALOGUE (`duree` + `observations`),
 * alors que le § 4.9 exige un garde-fou qui « vérifie la présence du mot dans le texte lu
 * EN BASE ». Il se fait désormais sur la CITATION relue (`CITATIONS_DISTANCE_LIEUES`, que
 * `verify-delais-durees.ts` recoupe contre la base), le catalogue ne servant plus que de
 * second témoin : les deux doivent concorder, sinon `controler` remonte une anomalie
 * bloquante.
 */
function avisDistance(l: LigneRepertoire): 'A5' | 'A5_BIS' {
  return citationLieues(l) ? 'A5' : 'A5_BIS'
}

/** La phrase de l'article qui fonde A5, relue en base — ou `null` s'il n'y en a pas. */
function citationLieues(l: LigneRepertoire): string | null {
  const c = CITATIONS_DISTANCE_LIEUES[l.article]
  if (!c?.citation || !/lieue/i.test(c.citation)) return null
  return c.citation
}

/**
 * Construit les 393 entrées prêtes à verser. **Aucune traduction n'est inventée** :
 * `objetEn`, `objetHt`, `pointDepart*` et `motifRefus*` reprennent le français et
 * `traductionRelue` reste `false`, ce qui fait retomber l'affichage sur le français (§ 5.2).
 * Faire passer ~780 libellés juridiques pour traduits serait pire que de ne pas les traduire.
 */
export function construireEntrees(
  lignes: readonly LigneRepertoire[] = REPERTOIRE,
): EntreeGrainee[] {
  const slugs = construireSlugs(lignes)
  return lignes.map((l, i) => {
    const code = l.code as CodeDelai
    let kind = deriverKind(l)
    let jours = l.valeur
    let supplement: Supplement | null = null
    let surchargeAppliquee: string | null = null

    const surcharge = surchargeDe(l)
    if (surcharge) {
      kind = 'JOURS'
      jours = surcharge.jours
      supplement = supplement74(surcharge.avecHaiti)
      surchargeAppliquee = `art. 74 — ${surcharge.justification}`
    }

    const dd = desambiguisationDe(l)
    const { regime, regimeIncertain, regimeFondement } = resoudreRegime(l)
    const pror = prorogation(code)
    const motif = motifRefus(l, kind)

    return {
      slug: slugs[i],
      code,
      // § 5.1 — TRANCHÉ (défaut 16 c) : le LIBELLÉ LONG, comme le documente le modèle et
      // comme le portent les fixtures. `l.abbr` (« C. pr. civ. ») est une RÉFÉRENCE, pas un
      // libellé, et elle se dérive de `code` par `ABREGE_CODE`.
      codeLibelle: LIBELLE_CODE[code],
      article: l.article,
      articleOccurrence: dd?.articleOccurrence ?? 1,
      articleContexte: dd?.articleContexte ?? null,
      objetFr: l.objet,
      objetEn: l.objet,
      objetHt: l.objet,
      traductionRelue: false,
      dureeTexte: l.duree,
      kind,
      jours: kindCalcule(kind) ? (jours ?? 0) : null,
      nbDistances: kind === 'JOURS_PLUS_DISTANCE_KM' ? (DEUX_DISTANCES.has(l.article) ? 2 : 1) : 0,
      supplement,
      regime,
      regimeIncertain,
      regimeFondement,
      prorogation991: pror.prorogation991,
      prorogationFondement: pror.fondement,
      pointDepartFr: l.depart && l.depart !== '—' ? l.depart : 'Date de départ du délai',
      pointDepartEn: l.depart && l.depart !== '—' ? l.depart : 'Date de départ du délai',
      pointDepartHt: l.depart && l.depart !== '—' ? l.depart : 'Date de départ du délai',
      sanctionFr: l.observations || null,
      sanctionEn: l.observations || null,
      sanctionHt: l.observations || null,
      motifRefusFr: motif,
      motifRefusEn: motif,
      motifRefusHt: motif,
      avisDistance: kind === 'JOURS_DISTANCE_NON_CHIFFREE' ? avisDistance(l) : null,
      // § 4.9 — le gabarit de A5 impose « un jour par cinq lieues ([citation de l'article]) ».
      // Il s'écrivait `null` en dur pour les 393 lignes (défaut 9) : la plateforme affirmait
      // la règle en lieues sans produire la phrase qui la fonde.
      citationArticle:
        kind === 'JOURS_DISTANCE_NON_CHIFFREE'
          ? (citationLieues(l) ?? CITATIONS_CIVIL_FRANC[l.article]?.citation ?? null)
          : null,
      // § 4.5 — l'art. 356 ne chiffre pas sa durée : elle vient de l'art. 354 (défaut 3).
      dureeFondementFr: dureeAilleurs(l),
      statut: 'visible',
      revision: 1,
      tableau: l.tableau,
      ordre: l.ordre,
      tableauTitreFr: l.tableauTitreFr,
      surchargeAppliquee,
    }
  })
}

/** Les contrôles bloquants du § 5.3, en une passe. Rend la liste des anomalies. */
export function controler(entrees: readonly EntreeGrainee[]): string[] {
  const anomalies: string[] = []

  // 1 & 2 — les genres
  const parKind = new Map<string, number>()
  for (const e of entrees) parKind.set(e.kind, (parKind.get(e.kind) ?? 0) + 1)
  for (const [k, n] of Object.entries(KINDS_ATTENDUS_APRES)) {
    const obtenu = parKind.get(k) ?? 0
    if (obtenu !== n) anomalies.push(`genre ${k} : ${obtenu} lignes, ${n} attendues`)
  }

  // 3 — la répartition par code
  const parCode: Record<string, number> = { CPC: 232, CIVIL: 114, TRAVAIL: 47 }
  for (const [c, n] of Object.entries(parCode)) {
    const obtenu = entrees.filter((e) => e.code === c).length
    if (obtenu !== n) anomalies.push(`code ${c} : ${obtenu} lignes, ${n} attendues`)
  }

  // 7 — aucun fondement vide
  for (const e of entrees) {
    if (!e.regimeFondement.trim()) anomalies.push(`regimeFondement vide : ${e.slug}`)
    if (!e.prorogationFondement.trim()) anomalies.push(`prorogationFondement vide : ${e.slug}`)
    if (!kindCalcule(e.kind) && !e.motifRefusFr?.trim()) {
      anomalies.push(`motifRefus vide sur un genre qui refuse : ${e.slug}`)
    }
    if (kindCalcule(e.kind) && e.jours == null) anomalies.push(`jours absent : ${e.slug}`)
    // § 0, règle 1 (défaut 2) — une durée non entière ou négative ne produit AUCUNE date.
    // Le moteur la refuse (`DUREE_INVALIDE`) ; la graine ne doit pas l'écrire en base.
    if (kindCalcule(e.kind) && e.jours != null && (!Number.isInteger(e.jours) || e.jours < 0)) {
      anomalies.push(`jours non entier ou négatif (${e.jours}) : ${e.slug}`)
    }
    if (kindCalcule(e.kind) && e.jours === 0 && !e.supplement) {
      anomalies.push(`jours: 0 sans supplément obligatoire : ${e.slug}`)
    }
    if (!kindCalcule(e.kind) && e.jours != null) anomalies.push(`jours sur un genre qui refuse : ${e.slug}`)
  }

  // 4 — CIVIL/FRANC : citation exigée, ou regimeIncertain (défaut 1)
  for (const e of entrees) {
    if (e.code !== 'CIVIL' || e.regime !== 'FRANC') continue
    const { citation } = citationDeFranc(e.regimeFondement)
    if (!citation && !e.regimeIncertain) {
      anomalies.push(`CIVIL/FRANC sans citation réelle et sans regimeIncertain : ${e.slug}`)
    }
  }

  // 8 — les slugs
  const vus = new Map<string, string[]>()
  for (const e of entrees) {
    if (!SLUG_VALIDE.test(e.slug)) anomalies.push(`slug non conforme : ${e.slug}`)
    vus.set(e.slug, [...(vus.get(e.slug) ?? []), e.article])
  }
  for (const [s, arts] of vus) {
    if (arts.length > 1) anomalies.push(`slug en double (${arts.length}) : ${s}`)
  }

  // 9 — la ventilation par tableau
  for (const [code, attendus] of Object.entries(VENTILATION_ATTENDUE)) {
    const obtenus: Record<number, number> = {}
    for (const e of entrees.filter((x) => x.code === code)) {
      obtenus[e.tableau] = (obtenus[e.tableau] ?? 0) + 1
    }
    for (const [t, n] of Object.entries(attendus)) {
      if ((obtenus[Number(t)] ?? 0) !== n) {
        anomalies.push(`${code} tableau ${t} : ${obtenus[Number(t)] ?? 0} lignes, ${n} attendues`)
      }
    }
    if (Object.keys(obtenus).length !== Object.keys(attendus).length) {
      anomalies.push(
        `${code} : ${Object.keys(obtenus).length} tableaux, ${Object.keys(attendus).length} attendus`,
      )
    }
  }

  // 10 — les lignes A_VERIFIER : aucune ne doit calculer
  for (const e of entrees) {
    if (e.regime === 'A_VERIFIER' && kindCalcule(e.kind)) {
      anomalies.push(`regime A_VERIFIER sur un genre qui calcule : ${e.slug} — décision humaine requise`)
    }
  }

  // 11 — les 8 entrées TRAVAIL homonymes portent leur contexte
  const homonymes = entrees.filter((e) => e.code === 'TRAVAIL' && e.articleContexte)
  if (homonymes.length !== DESAMBIGUISATION_TRAVAIL.length) {
    anomalies.push(
      `désambiguïsation TRAVAIL : ${homonymes.length} entrées portent un contexte, ${DESAMBIGUISATION_TRAVAIL.length} attendues`,
    )
  }

  // A5 / A5-bis
  const a5 = entrees.filter((e) => e.avisDistance === 'A5')
  const a5bis = entrees.filter((e) => e.avisDistance === 'A5_BIS')
  if (a5.length !== 3) anomalies.push(`A5 : ${a5.length} entrées, 3 attendues (353, 1827, 1952)`)
  if (a5bis.length !== 1) anomalies.push(`A5-bis : ${a5bis.length} entrées, 1 attendue (art. 229)`)

  // § 4.9 (défaut 9) — GARDE-FOU BLOQUANT : A5 affirme « un jour par cinq lieues » ; le
  // gabarit impose d'en produire la CITATION. Une entrée A5 sans citation portant le mot
  // « lieue » ferait dire à la plateforme, sous sa signature, une règle qu'elle ne fonde pas.
  for (const e of a5) {
    if (!e.citationArticle || !/lieue/i.test(e.citationArticle)) {
      anomalies.push(
        `A5 sans citation d’article contenant « lieue » : ${e.slug} — § 4.9, gabarit ` +
          `« un jour par cinq lieues ([citation de l’article]) »`,
      )
    }
  }
  // … et le catalogue doit CONCORDER avec la citation relue en base : deux témoins, pas un.
  for (const e of entrees) {
    if (e.kind !== 'JOURS_DISTANCE_NON_CHIFFREE') continue
    const ligne = REPERTOIRE.find((l) => l.article === e.article && l.objet === e.objetFr)
    if (!ligne) continue
    const catalogueDitLieues = /lieue/i.test(`${ligne.duree} ${ligne.observations}`)
    if (catalogueDitLieues !== (e.avisDistance === 'A5')) {
      anomalies.push(
        `A5 / A5-bis : le catalogue et la citation en base se contredisent sur ${e.slug} ` +
          `(catalogue « lieue » : ${catalogueDitLieues}, avis retenu : ${e.avisDistance})`,
      )
    }
  }

  return anomalies
}
