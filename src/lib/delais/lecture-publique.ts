/**
 * LES DEUX LECTURES PUBLIQUES DU CALCULATEUR — le répertoire et le calcul.
 *
 * Pourquoi ce fichier existe. Les deux routes `/api/public/delais/*` portaient cette
 * logique dans leur `GET`, ce qui allait très bien tant que seul un client JavaScript les
 * appelait. Or le § 6.2 exige que **le résultat existe sans JavaScript** : la page
 * `/[locale]/delais` est un composant serveur qui doit rendre le même calcul, à partir des
 * mêmes `searchParams`, avant qu'aucun script ne s'exécute.
 *
 * Deux chemins pour un même calcul, c'est la définition d'une seconde vérité : le jour où
 * les deux divergeraient, l'écran aurait raison contre les tests de la route. La logique
 * vit donc ICI, une seule fois ; les routes en sont l'enveloppe HTTP (débit, codes, cache)
 * et la page l'appelle directement — sans requête réseau vers elle-même.
 *
 * ⚠️ **Aucune règle de droit n'est écrite ici.** Ce fichier valide, charge, appelle
 * `calculer()` — le moteur du § 4 — et rend. Toute arithmétique de dates ajoutée dans ce
 * fichier serait une réimplémentation du droit.
 *
 * ⚠️ **Aucune écriture, aucun horodatage.** Le bloc 12 exige qu'un permalien rechargé rende
 * un résultat identique au caractère près.
 */
import { z } from 'zod'
import { prisma } from '../db'
import { calculer, kindCalcule, parseIso } from './index'
import {
  ABREGE_CODE,
  FONDEMENT_PROROGATION_PAR_CODE,
  FONDEMENT_REGIME_PAR_CODE,
  LIBELLE_REGIME,
} from './index'
import { egales } from './index'
import type {
  CivilDate,
  CodeDelai,
  EntreeDelai,
  KindDelai,
  LectureNommee,
  Locale,
  Resultat,
} from './index'
import { CODES, lireSupplement } from './depuis-base'
import { entreeLectureStricte, prorogationFrancPur, restreindreAuFrancPur } from './franc-pur'
import { mentionsJour, reportPublic } from './mention-jour'
import type { MentionJour, ReportPublic } from './mention-jour'
import {
  REPONSES_FRANC,
  SLUG_AUTRE,
  avecSignature,
  construirePermalien,
  lireKm,
  queryPermalien,
} from './permalien'
import type { ReponseFranc, SurfaceDelais } from './permalien'
import { signatureValide, signerQuery } from './permalien-signature'
import { phrases } from './phrases'
import { VERSION_REGLES_COURANTE, reglesLecture } from './regles-lecture'
import {
  chargerCalendrier,
  chargerEntree,
  chargerFenetres,
  estSchemaAbsent,
  versionCalendrierCourante,
  versionFenetresCourante,
} from './service-base'
import type { ContexteEntree, FenetreLue } from './service-base'
// Le type vit dans un fichier PUR : le presse-papiers le porte, et `affichage.ts` n'a pas le
// droit de dépendre de Prisma (§ 6.3 j).
import type { Bandeau } from './bandeau'
export type { Bandeau }

/** Un refus, dans la forme que la route transforme en `apiError` et que la page affiche. */
export type EchecPublic = { ok: false; code: string; statut: number }

/**
 * QUI DEMANDE — et c'est la seule chose que la requête ne dit PAS.
 *
 * ⚠️ **Ce paramètre ne se lit jamais dans l'URL.** `ParamsCalcul.base` porte bien la surface
 * (`/delais` ou `/outils/delais`), mais elle vient de la « query » : n'importe qui peut
 * écrire `&base=/outils/delais`. L'accès est donc un ARGUMENT de `calculPublic()`, posé par
 * l'appelant — la route publique le fixe à `'public'`, la page connectée à `'connecte'`
 * APRÈS son `requireUser`. La valeur par défaut est `'public'` : on échoue fermé.
 *
 * Ce que l'accès décide, et rien d'autre :
 *  - **`'public'` ne calcule que le genre « Autre » du § 4.12**, c'est-à-dire un nombre de
 *    jours saisi. Une entrée du répertoire demandée sans session est REFUSÉE, pas servie ;
 *  - **`'public'` ne calcule que du FRANC.** Les deux champs de la page publique sont la date
 *    de réception et un nombre de jours *francs* ; `f` y vaut donc « oui » et rien d'autre ;
 *  - **`'public'` n'exige pas la nature du délai** (`src`), qu'il ne demande pas : trois
 *    champs sur une page qui n'en offre que deux serait un refus permanent ;
 *  - **`'public'` calcule le délai franc PUIS LE REPORT de l'art. 991 al. 3** — départ + N + 1,
 *    puis la date est reportée, **EN CASCADE**, tant qu'elle tombe un dimanche ou l'une des
 *    16 entrées PERMANENT du calendrier (les 7 fêtes légales du décret du 23 mai 1989, les
 *    5 fêtes nationales de la Constitution, les 4 jours retenus par la rédaction). Il ne rend
 *    ni lecture nommée, ni « lecture la plus large », ni jour praticable, ni avertissement
 *    autre que A3 ; le report, lui, est DIT en petits caractères sous la date. Voir
 *    `franc-pur.ts`, qui porte la décision et ses deux mécaniques.
 *
 * ⚠️ **CET ALINÉA DISAIT L'INVERSE DU CODE LIVRÉ JUSQU'AU 20 AOÛT 2026 AU SOIR** : il annonçait
 * un calcul franc et NU — départ + N + 1, et rien d'autre, sans report d'aucune sorte. C'est la
 * décision du MATIN, reprise l'après-midi (`franc-pur.ts`, en-tête). Dans un dépôt où les
 * commentaires
 * tiennent lieu de spécification, une consigne périmée se rejoue : la prochaine session aurait
 * lu ici que le public ne proroge pas, et « rétabli » le franc pur — c'est-à-dire retiré la
 * prorogation que la cliente a demandée. `surfaces-delais.test.ts` garde désormais cet
 * alinéa-ci, comme il garde les trois autres en-têtes qui portaient la même phrase.
 */
export type AccesDelais = 'public' | 'connecte'

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * L'ENTRÉE SYNTHÉTIQUE « AUTRE », DANS LES TROIS LANGUES (§ 8.2)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **CE N'ÉTAIT PAS UN RÉSIDU : C'ÉTAIT LA SORTIE NORMALE DE `/en` ET DE `/ht`.** Ces
 * chaînes étaient écrites en dur, en français, parce que `entreeAutre()` était fabriquée sans
 * locale. Tant que la surface publique calculait aussi des entrées du RÉPERTOIRE — dont les
 * libellés sont traduits en base —, cela ne touchait qu'un cas de bord. Depuis le 20 août
 * 2026, la surface publique ne calcule PLUS QUE cette entrée-ci : sur `/en`, l'en-tête
 * affichait « Délai saisi (hors répertoire) », et l'étape 3 recopiait le fondement entier en
 * français — deux fois, l'étape 6 le reprenant entre parenthèses. Sur une plateforme
 * trilingue, ce n'est pas un reste : c'est le résultat.
 *
 * ⚠️ **Ce qui n'est PAS traduit, et ne doit pas l'être** : la « nature du délai » que
 * l'utilisatrice tape elle-même dans le portail (`src`), reproduite telle quelle — la
 * plateforme ne traduit pas ce qu'elle n'a pas écrit —, et les références d'articles.
 */
const TEXTES_AUTRE: Record<
  Locale,
  {
    codeLibelle: string
    nature: string
    duree: (jours: number) => string
    decompte: Record<ReponseFranc, string>
    provenance: string
    provenanceSource: (source: string) => string
    nonQualifie: string
    pointDepart: string
    pointDepartSource: string
    prorogationConnecte: string
  }
> = {
  fr: {
    codeLibelle: 'Délai saisi (hors répertoire)',
    nature: 'Délai indiqué dans l’acte',
    duree: (j) => `${j} jour${j > 1 ? 's' : ''} (saisis)`,
    decompte: {
      oui: 'Décompte demandé : jours FRANCS (départ + nombre de jours + 1). ',
      non: 'Décompte demandé : jours CALENDAIRES (départ + nombre de jours). ',
      // `ne-sais-pas` n'est plus proposé au formulaire (le commutateur a deux positions), mais
      // un permalien émis avant le 20 août 2026 le porte encore et doit se rejouer.
      'ne-sais-pas':
        'Décompte non tranché (ancienne réponse « je ne sais pas ») : la tête d’affiche compte ' +
        'en jours calendaires, la plus précoce, et le décompte en jours francs est nommé en ' +
        'lecture concurrente. ',
    },
    provenance: 'Nombre de jours saisi par l’utilisatrice, tel qu’il figure dans l’acte reçu. ',
    provenanceSource: (s) => `Délai saisi par l’utilisatrice — nature indiquée : « ${s} ». `,
    nonQualifie:
      'La plateforme ne qualifie pas ce délai : l’art. 987 ne rend francs que les délais prévus ' +
      'au Code de procédure civile, l’art. 511 C. trav. que les délais de procédure du Code du ' +
      'travail, et le Code civil ne rend franc que ce qu’il dit franc.',
    pointDepart: 'Date de réception de l’acte',
    pointDepartSource: 'Date de départ du délai',
    prorogationConnecte:
      'Aucun texte ne rattache ce délai à l’art. 991 C. pr. civ. : la tête d’affiche est ' +
      'calculée SANS prorogation, et la prorogation devient une lecture nommée.',
  },
  en: {
    codeLibelle: 'Period entered (outside the directory)',
    nature: 'Period stated in the document',
    duree: (j) => `${j} day${j > 1 ? 's' : ''} (entered)`,
    decompte: {
      oui: 'Counting requested: CLEAR days (start + number of days + 1). ',
      non: 'Counting requested: CALENDAR days (start + number of days). ',
      'ne-sais-pas':
        'Counting not settled (former answer “I don’t know”): the headline date counts in ' +
        'calendar days, the earliest one, and the clear-day count is named as a competing ' +
        'reading. ',
    },
    provenance: 'Number of days entered by the user, as it appears in the document received. ',
    provenanceSource: (s) => `Period entered by the user — nature stated: “${s}”. `,
    nonQualifie:
      'The platform does not characterise this period: art. 987 makes clear only the periods ' +
      'laid down by the Code of Civil Procedure, art. 511 of the Labour Code only the ' +
      'procedural periods of that Code, and the Civil Code makes clear only what it says is clear.',
    pointDepart: 'Date the document was received',
    pointDepartSource: 'Date the period starts',
    prorogationConnecte:
      'No text attaches this period to art. 991 C. pr. civ.: the headline date is computed ' +
      'WITHOUT extension, and the extension becomes a named reading.',
  },
  ht: {
    codeLibelle: 'Delè yo antre (deyò repètwa a)',
    nature: 'Delè dokiman an endike',
    duree: (j) => `${j} jou (yo antre)`,
    decompte: {
      oui: 'Jan yo mande pou konte a : jou FRAN (depa + kantite jou + 1). ',
      non: 'Jan yo mande pou konte a : jou KALANDRIYE (depa + kantite jou). ',
      'ne-sais-pas':
        'Jan pou konte a pa tranche (ansyen repons « mwen pa konnen ») : dat prensipal la konte ' +
        'an jou kalandriye, pi bonè a, epi konte an jou fran an nonmen kòm yon lekti konkiran. ',
    },
    provenance: 'Kantite jou itilizatè a antre, jan li parèt nan dokiman li resevwa a. ',
    provenanceSource: (s) => `Delè itilizatè a antre — nati yo endike : « ${s} ». `,
    nonQualifie:
      'Platfòm nan pa kalifye delè sa a : atik 987 rann fran sèlman delè Kòd pwosedi sivil la ' +
      'prevwa, atik 511 Kòd travay la sèlman delè pwosedi Kòd travay la, epi Kòd sivil la rann ' +
      'fran sèlman sa li di ki fran.',
    pointDepart: 'Dat yo resevwa dokiman an',
    pointDepartSource: 'Dat delè a kòmanse',
    prorogationConnecte:
      'Pa gen okenn tèks ki mare delè sa a ak atik 991 C. pr. civ. : dat prensipal la kalkile ' +
      'SAN pwolongasyon, epi pwolongasyon an vin yon lekti ki nonmen.',
  },
}

/**
 * La désignation du délai quand personne ne l'a caractérisé — c'est-à-dire sur la page
 * publique, qui ne demande que deux choses. On n'invente pas de fondement : le résultat écrit
 * que le nombre de jours vient de l'acte, et la plateforme ne le qualifie pas.
 *
 * ⚠️ La forme FRANÇAISE, gardée pour les appelants sans locale ; le calcul, lui, passe par
 * `TEXTES_AUTRE[locale].nature`.
 */
export const NATURE_PUBLIQUE = TEXTES_AUTRE.fr.nature

/**
 * § 6.2 — LA BORNE HAUTE, EN AVERTISSEMENT, JAMAIS EN REFUS. La borne BASSE (22 juin 1989)
 * est traitée par un refus motivé ; rien ne disait l'autre côté. `?d=2050-01-01` rendait
 * « Date limite mardi 1er février 2050 » avec la même assurance qu'un calcul juste, et
 * `9999-12-31` passait tout autant : une faute de frappe sur le millésime ressortait pour un
 * résultat.
 *
 * ⚠️ **L'ANNÉE EST FIGÉE, ET VERSIONNÉE ICI.** Le § 4.1 interdit `new Date()` dans le chemin
 * de calcul, et le bloc 12 exige qu'un permalien rechargé rende « un résultat identique au
 * caractère près » — une borne mobile ferait apparaître puis disparaître l'avertissement au
 * fil des années sous la MÊME adresse. Elle se relève à la main, comme le calendrier.
 */
export const ANNEE_DE_REFERENCE = 2026
export const HORIZON_ANNEES = 10

const echec = (code: string, statut: number): EchecPublic => ({ ok: false, code, statut })

// ---------------------------------------------------------------------------
// Le répertoire — le menu déroulant
// ---------------------------------------------------------------------------

/** La ligne de base, telle que le menu la consomme. Le typage vient du `select` de Prisma. */
type LigneMenu = {
  slug: string
  article: string
  articleContexte: string | null
  articleOccurrence: number
  tableau: number
  tableauTitreFr: string | null
  ordre: number
  objetFr: string
  objetEn: string
  objetHt: string
  traductionRelue: boolean
  dureeTexte: string
  dureeFondementFr: string | null
  kind: string
  jours: number | null
  nbDistances: number
  distanceAideFr: string | null
  distanceDoubleFr: string | null
  supplementJson: string | null
  avisDistance: string | null
  citationArticle: string | null
  regime: string
  regimeIncertain: boolean
  regimeFondement: string
  prorogation991: string
  prorogationFondement: string
  motifRefusFr: string | null
  motifRefusEn: string | null
  motifRefusHt: string | null
  pointDepartFr: string
  pointDepartEn: string
  pointDepartHt: string
  revision: number
}

export type EntreeMenu = ReturnType<typeof versEntreeMenu>
export type TableauMenu = { numero: number; titreFr: string | null; entrees: EntreeMenu[] }
export type CodeMenu = {
  code: string
  codeLibelle: string
  abrege: string
  fondementRegime: string
  fondementProrogation: string
  nbEntrees: number
  nbCalculables: number
  tableaux: TableauMenu[]
}
export type RepertoirePublic = {
  ok: true
  versionCalendrier: number | null
  versionFenetres: number | null
  total: number
  codes: CodeMenu[]
}

function versEntreeMenu(l: LigneMenu) {
  const supplement = lireSupplement(l.supplementJson)
  return {
    slug: l.slug,
    article: l.article,
    /** § 4.5 bis — les 8 homonymes du C. trav. : l'option porte AUSSI sa section. */
    articleContexte: l.articleContexte,
    articleOccurrence: l.articleOccurrence,
    tableau: l.tableau,
    ordre: l.ordre,
    objetFr: l.objetFr,
    objetEn: l.objetEn,
    objetHt: l.objetHt,
    /** false → l'interface retombe sur le français (§ 5.2). */
    traductionRelue: l.traductionRelue,
    dureeTexte: l.dureeTexte,
    dureeFondementFr: l.dureeFondementFr,
    kind: l.kind,
    /** Trois genres calculent, quatre refusent (§ 4.4). Écrit ici, pas déduit à l'écran. */
    calculable: kindCalcule(l.kind as KindDelai),
    jours: l.jours,
    nbDistances: l.nbDistances,
    distanceAideFr: l.distanceAideFr,
    distanceDoubleFr: l.distanceDoubleFr,
    // Une ligne dont le `supplementJson` est illisible ne fait pas tomber le menu : elle perd
    // sa question de suite, et le moteur refusera de calculer faute de la réponse obligatoire.
    supplement: supplement.ok ? supplement.valeur : null,
    supplementIllisible: supplement.ok ? null : supplement.motif,
    avisDistance: l.avisDistance,
    citationArticle: l.citationArticle,
    regime: l.regime,
    regimeIncertain: l.regimeIncertain,
    regimeFondement: l.regimeFondement,
    /** Le libellé prêt à afficher, dans la forme exacte du § 6.2 point 3. */
    regimeLibelle: l.regimeIncertain
      ? 'Régime incertain — voir la lecture nommée'
      : (LIBELLE_REGIME[l.regime as keyof typeof LIBELLE_REGIME] ?? l.regime),
    prorogation991: l.prorogation991,
    prorogationFondement: l.prorogationFondement,
    motifRefusFr: l.motifRefusFr,
    motifRefusEn: l.motifRefusEn,
    motifRefusHt: l.motifRefusHt,
    pointDepartFr: l.pointDepartFr,
    pointDepartEn: l.pointDepartEn,
    pointDepartHt: l.pointDepartHt,
    /** Le permalien doit la porter : sans elle, un lien copié changerait de sens (§ 7.3). */
    revision: l.revision,
  }
}

/**
 * Les colonnes que le menu consomme, et elles seules. Elles suivent `LigneMenu` : si le type
 * gagne un champ, la projection doit le gagner aussi — sinon le champ sort `undefined`.
 */
const SELECT_MENU = {
  slug: true,
  code: true,
  codeLibelle: true,
  article: true,
  articleContexte: true,
  articleOccurrence: true,
  tableau: true,
  tableauTitreFr: true,
  ordre: true,
  objetFr: true,
  objetEn: true,
  objetHt: true,
  traductionRelue: true,
  dureeTexte: true,
  dureeFondementFr: true,
  kind: true,
  jours: true,
  nbDistances: true,
  distanceAideFr: true,
  distanceDoubleFr: true,
  supplementJson: true,
  avisDistance: true,
  citationArticle: true,
  regime: true,
  regimeIncertain: true,
  regimeFondement: true,
  prorogation991: true,
  prorogationFondement: true,
  // Le refus MOTIVÉ des 270 entrées non calculables : c'est lui qui informe (§ 4.4).
  motifRefusFr: true,
  motifRefusEn: true,
  motifRefusHt: true,
  pointDepartFr: true,
  pointDepartEn: true,
  pointDepartHt: true,
  revision: true,
} as const

/**
 * Le menu déroulant : les entrées **visibles**, groupées par code puis par `tableau`, avec le
 * régime **et son fondement** — l'écran doit pouvoir écrire « Délai franc — C. pr. civ.,
 * art. 987 » dès la sélection, avant tout calcul. Un régime affiché sans son fondement est
 * une affirmation sans texte.
 *
 * ⚠️ Les entrées **non calculables sont RENDUES** — 270 sur 393. C'est le refus motivé qui
 * informe ; les cacher ferait croire que l'article n'existe pas.
 */
export async function chargerRepertoirePublic(
  code?: string | null,
): Promise<RepertoirePublic | EchecPublic> {
  try {
    const lignes = (await prisma.delaiEntry.findMany({
      // « Les entrées visibles » : masquée ou supprimée, une entrée quitte le menu et le
      // calculateur refuse tout NOUVEAU calcul avec elle (§ 7.2, § 7.3). Les calculs déjà
      // rendus, eux, restent lisibles — c'est `calculPublic` qui s'en charge.
      where: { statut: 'visible', ...(code ? { code } : {}) },
      // ⚠️ **Projection EXPLICITE.** Le menu n'a besoin ni des trois `motifRefus*` ni des
      // trois `sanction*` ni des colonnes d'administration : la page publique est en
      // `force-dynamic` et relit ces 393 lignes à CHAQUE requête (§ 09).
      select: SELECT_MENU,
      orderBy: [{ code: 'asc' }, { tableau: 'asc' }, { ordre: 'asc' }, { article: 'asc' }],
    })) as unknown as (LigneMenu & { code: string; codeLibelle: string })[]

    const [versionCalendrier, versionFenetres] = await Promise.all([
      versionCalendrierCourante(),
      versionFenetresCourante(),
    ])

    // Groupement par code, puis par tableau. L'INTITULÉ d'un tableau est `tableauTitreFr`
    // quand il existe (les 20 sections du Code civil, les 9 du Code du travail) et reste
    // **null** pour les 10 tableaux du C. pr. civ., qui n'ont pas de titre d'origine :
    // l'écran écrit alors « Tableau n » depuis ses propres clés i18n. On n'en invente pas.
    const codes = CODES.filter((c) => !code || c === code).map((c) => {
      const duCode = lignes.filter((l) => l.code === c)
      const numeros = [...new Set(duCode.map((l) => l.tableau))].sort((a, b) => a - b)
      const tableaux = numeros.map((numero) => {
        const dedans = duCode.filter((l) => l.tableau === numero)
        return {
          numero,
          titreFr: dedans[0]?.tableauTitreFr ?? null,
          entrees: dedans.map(versEntreeMenu),
        }
      })
      return {
        code: c,
        codeLibelle: duCode[0]?.codeLibelle ?? '',
        abrege: ABREGE_CODE[c as CodeDelai],
        /** Le régime PAR DÉFAUT du code, et sa citation — § 4.7. */
        fondementRegime: FONDEMENT_REGIME_PAR_CODE[c as CodeDelai],
        fondementProrogation: FONDEMENT_PROROGATION_PAR_CODE[c as CodeDelai],
        nbEntrees: duCode.length,
        nbCalculables: duCode.filter((l) => kindCalcule(l.kind as KindDelai)).length,
        tableaux,
      }
    })

    return { ok: true, versionCalendrier, versionFenetres, total: lignes.length, codes }
  } catch (e) {
    // La migration du § 5.1 est une décision humaine : tant qu'elle n'est pas passée, on le
    // DIT. « Internal Server Error » ferait chercher un bug là où il n'y a qu'une table qui
    // n'existe pas encore.
    if (estSchemaAbsent(e)) return echec('delaisSchemaAbsent', 503)
    throw e
  }
}

/**
 * L'ÉTAT DU CALCULATEUR, SANS LIRE LE RÉPERTOIRE — deux `findFirst` indexés au lieu des 393
 * lignes.
 *
 * La page publique n'affiche plus le menu : elle n'a donc plus aucune raison de charger les
 * entrées, leurs libellés et leurs fondements pour les jeter. Elle a en revanche encore
 * besoin de savoir si la base est prête, parce qu'un formulaire qui accepte la saisie puis
 * casse à la soumission se lit comme du travail perdu, pas comme une indisponibilité (§ 5.1).
 */
export async function etatPublicDelais(): Promise<VersionsCourantes | EchecPublic> {
  try {
    const [c, w] = await Promise.all([versionCalendrierCourante(), versionFenetresCourante()])
    if (c == null || w == null) return echec('delaisNonInitialises', 503)
    // ⚠️ **ON REND LES DEUX NUMÉROS, ON NE LES JETTE PLUS.** Ils étaient lus ici puis relus à
    // l'identique par `calculPublic`, deux requêtes plus loin : voir `VersionsCourantes`.
    return { ok: true, versionCalendrier: c, versionFenetres: w }
  } catch (e) {
    if (estSchemaAbsent(e)) return echec('delaisSchemaAbsent', 503)
    throw e
  }
}

/**
 * § 09 — **LES DEUX NUMÉROS DE VERSION, LUS UNE FOIS ET PASSÉS DE LA MAIN À LA MAIN.**
 *
 * La PAGE lit d'abord l'état du calculateur (`etatPublicDelais`, ou `chargerRepertoirePublic`
 * dans l'espace connecté) : elle doit savoir si la base est prête avant d'afficher un
 * formulaire. Ces deux lectures rendent déjà le calendrier courant et les fenêtres courantes.
 * `calculPublic` les relisait ensuite, à l'identique, sur la même requête HTTP — **deux
 * `findFirst` pour de purs doublons**, mesurés sur la base de production le 20 août 2026 :
 * 6 requêtes pour un calcul public, 9 pour un calcul du portail. Elles tombent à 4 et à 7.
 *
 * ⚠️ **CE N'EST PAS UN CACHE, ET SURTOUT PAS UN DÉFAUT.** Le paramètre ne sert QUE là où
 * `calculPublic` retombait sur « la version courante » — c'est-à-dire quand la requête n'en
 * nomme aucune. Un permalien qui porte `c=` ou `w=` continue de faire foi : `q.c ?? …` reste
 * en tête, et une version inconnue reste un 404 franc. Une route qui appelle `calculPublic`
 * sans avoir rien lu (l'API publique) n'a rien à passer, et lit la base comme avant.
 */
export type VersionsCourantes = { ok: true; versionCalendrier: number; versionFenetres: number }

// ---------------------------------------------------------------------------
// Le calcul
// ---------------------------------------------------------------------------

export const PARAMS_CALCUL = z.object({
  /** Date de départ, AAAA-MM-JJ. Jamais un `Date` : le fuseau décalerait la date d'un jour. */
  d: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'AAAA-MM-JJ'),
  /**
   * Le slug de l'entrée — **facultatif**, et par défaut le genre « Autre » du § 4.12. Les
   * surfaces publiques n'émettent plus `e` du tout : elles n'offrent que la date de réception
   * et un nombre de jours francs, et il n'y aurait rien à mettre dans ce paramètre qui ne
   * soit `autre`. Fourni, il reste validé comme avant — et refusé en accès public.
   */
  e: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug')
    .default(SLUG_AUTRE),
  r: z.coerce.number().int().min(1).max(100_000).optional(),
  c: z.coerce.number().int().min(1).max(100_000).optional(),
  w: z.coerce.number().int().min(1).max(100_000).optional(),
  /** § 4.6 — la version des RÈGLES DE LECTURE. Absente = celle du jour (`rl` du permalien). */
  rl: z.coerce.number().int().min(1).max(100_000).optional(),
  km: z.string().trim().max(24).optional(),
  sup: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .optional(),
  // Le genre « Autre » (§ 4.12) : trois choses, pas une.
  n: z.coerce.number().int().min(0).max(3650).optional(),
  f: z.enum(REPONSES_FRANC).optional(),
  src: z.string().trim().min(1).max(200).optional(),
  /** § 7.3 — la signature du permalien. Base64url, 16 caractères (96 bits). */
  sig: z
    .string()
    .trim()
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  locale: z.enum(['fr', 'en', 'ht']).default('fr'),
  /** § 6.4 — la surface qui rend le calcul ; elle décide de l'adresse du permalien. */
  base: z.enum(['/delais', '/outils/delais']).default('/delais'),
})

export type ParamsCalcul = z.infer<typeof PARAMS_CALCUL>

/**
 * Relit la requête. Les paramètres vides sont traités comme ABSENTS et non comme fautifs :
 * un formulaire `GET` sans JavaScript envoie `sup=` et `km=` vides sur les entrées qui n'en
 * ont pas, et refuser la requête pour cela ferait échouer le chemin sans script.
 */
export function lireParamsCalcul(
  sp: URLSearchParams,
): { ok: true; valeur: ParamsCalcul } | EchecPublic {
  const lire = (cle: string) => {
    const v = sp.get(cle)
    return v == null || v.trim() === '' ? undefined : v
  }
  const parsed = PARAMS_CALCUL.safeParse({
    d: sp.get('d') ?? '',
    // `e=` vide vaut ABSENT, comme les autres : la page publique n'émet pas ce champ, et un
    // formulaire qui l'émettrait vide ne doit pas faire échouer la lecture pour la forme.
    e: lire('e'),
    r: lire('r'),
    c: lire('c'),
    w: lire('w'),
    rl: lire('rl'),
    km: lire('km'),
    sup: lire('sup'),
    n: lire('n'),
    f: lire('f'),
    src: lire('src'),
    sig: lire('sig'),
    locale: lire('locale'),
    base: lire('base'),
  })
  return parsed.success ? { ok: true, valeur: parsed.data } : echec('invalidFields', 400)
}

/**
 * § 2 (Me Vaval, 20 août 2026) — **LA RÈGLE DE DÉCOMPTE APPLIQUÉE, EN TOUTES LETTRES.**
 *
 * Le commutateur ne pilote rien d'autre que `regime` : le moteur sait déjà compter des jours
 * francs et des jours calendaires (`franc: true | false`, § 4.7), et rien n'y a été touché.
 * Ce qui manquait, c'est que la fiche DISE laquelle des deux règles a joué — « Régime :
 * ordinaire » ne rappelle pas le libellé du commutateur qu'on a poussé six mois plus tôt.
 *
 * ⚠️ **TRADUIT DEPUIS LE 20 AOÛT 2026.** Ce texte était en français dans les trois langues,
 * comme tout `regimeFondement` du genre « Autre » : l'entrée synthétique était fabriquée sans
 * locale. Tant que la surface publique calculait une entrée du RÉPERTOIRE, c'était un cas de
 * bord ; depuis qu'elle ne calcule plus QUE cette entrée-ci, c'était la sortie normale de
 * `/en` et de `/ht` — un résultat anglais dont le raisonnement était en français. La locale
 * est donc portée jusqu'ici.
 */
function phraseDecompte(franc: ReponseFranc, locale: Locale): string {
  // ⚠️ **COURTE, ET EN TÊTE DU FONDEMENT.** `construireEtapes` réemploie `regimeFondement`
  // DEUX fois pour une entrée du genre « Autre » : à l'étape « Délai : … Régime : … — », et
  // dans la parenthèse de « Le jour de l'échéance ne se compte pas (…) » — `referenceDuFondement`
  // ne sait en extraire une référence courte que si le fondement porte un « — « … » », ce que
  // celui-ci n'a pas. Une phrase longue s'y recopierait donc en entier, deux fois. Celle-ci
  // nomme la règle et son calcul, et laisse l'étape 6 en dire la conséquence.
  return TEXTES_AUTRE[locale].decompte[franc]
}

/**
 * § 4.12 — l'entrée SYNTHÉTIQUE du genre « Autre ». Elle ne vient pas du répertoire :
 * l'utilisatrice a lu un nombre dans un document, et la plateforme n'a **aucun fondement**
 * pour le traiter comme franc. D'où les trois réponses, et d'où `prorogation991: INCERTAIN`.
 *
 * ⚠️ **`francPur` EST LE PARAMÈTRE DE CONFIGURATION DU CALCUL PUBLIC**, et c'est le seul.
 * `calculer()` se pilote par l'ENTRÉE : poser `prorogation991: 'OUI'` **et**
 * `prorogationTeteLarge: true` suffit à ce que le moteur proroge en cascade sur les 16 entrées
 * PERMANENT, n'ouvre plus qu'UNE lecture nommée et ne déclenche plus A4 — sans qu'un résultat
 * soit défait après coup. Voir `franc-pur.ts`.
 *
 * ⚠️ **CETTE NOTE DISAIT « n'ouvre plus AUCUNE lecture nommée » JUSQU'AU 20 AOÛT 2026 AU
 * SOIR.** Depuis le correctif du défaut 2, `DEMI_JOURNEE` s'ouvre sur les Lundis Gras — la
 * matinée y reste ouvrable, la tête d'affiche s'arrête donc sur le jour, et c'est la lecture
 * nommée qui porte la date tardive. Sur ces résultats-là, `lectureLaPlusLarge` est bien
 * DISTINCTE de la tête d'affiche. Compte mesuré : 40 des 7 304 calculs du balayage de
 * `franc-pur.test.ts`, § 0.
 *
 * ⚠️ Le nom `francPur` est HISTORIQUE : il ne veut plus dire « sans report » depuis la
 * seconde décision du 20 août 2026. Il veut dire « la configuration de la surface publique ».
 */
function entreeAutre(
  jours: number,
  franc: ReponseFranc,
  source: string | null,
  francPur: boolean,
  /**
   * ⚠️ **LA LANGUE DU RÉSULTAT, ET NON CELLE DE LA BASE.** Cette entrée n'a pas de ligne en
   * base : ses libellés ne peuvent venir que d'ici. Sans ce paramètre, `/en` et `/ht`
   * rendaient un raisonnement français — voir `TEXTES_AUTRE`.
   */
  locale: Locale,
): EntreeDelai {
  const x = TEXTES_AUTRE[locale]
  // Sur la page publique, la nature n'est PAS demandée : deux champs, pas trois. On écrit
  // alors d'où vient le nombre — l'acte reçu — au lieu de citer une caractérisation que
  // personne n'a donnée.
  const nature = source ?? x.nature
  const fondement =
    // ⚠️ **LE MODE DE DÉCOMPTE CHOISI OUVRE LE FONDEMENT** (Me Vaval, 20 août 2026 : « un
    // lecteur qui reprend la fiche six mois plus tard doit le savoir »). Le moteur reprend ce
    // fondement tel quel à l'étape « Délai : … Régime : … — » : la fiche imprimée, le
    // presse-papiers et le permalien portent donc tous la même phrase, en tête.
    //
    // ⚠️ Elle n'est posée QUE dans l'espace connecté. Publiquement il n'y a pas de commutateur
    // — le champ s'appelle « Nombre de jour(s) francs » et la page énonce déjà sa règle
    // (`francRule`) : y ajouter « décompte demandé » nommerait un choix que personne n'a eu à
    // faire, et défairait le résultat public vérifié le 20 août.
    (francPur ? '' : phraseDecompte(franc, locale)) +
    (source ? x.provenanceSource(source) : x.provenance) +
    x.nonQualifie
  return {
    slug: SLUG_AUTRE,
    // Le Code civil est le seul des trois dont le fondement par défaut soit « aucune règle
    // générale » : c'est l'attache la moins affirmative pour un délai que nul texte du
    // répertoire ne porte.
    code: 'CIVIL',
    codeLibelle: x.codeLibelle,
    /**
     * ⚠️ **LA NATURE N'EST PAS UN ARTICLE.** `article` portait `nature` : publiquement, où le
     * champ « nature du délai » n'existe plus, il valait donc la PHRASE `NATURE_PUBLIQUE`, et
     * tout gabarit « art. {numéro} » la recopiait entière — « Délai saisi (hors répertoire) ·
     * art. Délai indiqué dans l'acte » en tête de 100 % des résultats publics, dans les trois
     * langues, jusque dans la requête de recherche du corpus. Le genre « Autre » N'A PAS
     * d'article : la chaîne vide le dit, et `articleAffiche()` fait taire la ligne. La nature,
     * elle, reste portée par `objetFr` — la ligne d'intitulé, où la phrase est juste.
     */
    article: source ?? '',
    objetFr: nature,
    dureeTexte: x.duree(jours),
    kind: 'JOURS',
    jours,
    nbDistances: 0,
    supplement: null,
    // « Je ne sais pas » → régime FRANC marqué INCERTAIN : le moteur calcule alors la tête
    // d'affiche en ORDINAIRE (la plus précoce) et nomme le franc en lecture concurrente. Les
    // deux dates, la plus précoce en tête — exactement ce que demande le § 4.12.
    regime: franc === 'non' ? 'ORDINAIRE' : 'FRANC',
    regimeIncertain: franc === 'ne-sais-pas',
    regimeFondement: fondement,
    // Publiquement : `OUI` + lecture large et cascade — la date limite se proroge au prochain
    // jour qui n'est ni un dimanche ni une fête légale (art. 991 al. 3). Une seule lecture
    // nommée peut encore s'ouvrir, `DEMI_JOURNEE` (le Lundi Gras, § 4.10) ; les autres
    // rendraient cette même date, et le moteur les écarte de lui-même. Dans l'espace connecté,
    // où la nature du délai est saisie : `INCERTAIN`, et la prorogation reste une lecture
    // nommée — le régime y est douteux, et la tête d'affiche doit rester la plus précoce.
    ...(francPur
      ? prorogationFrancPur(locale)
      : { prorogation991: 'INCERTAIN' as const, prorogationFondement: x.prorogationConnecte }),
    // Le point de départ SUIT la surface : publiquement, on ne calcule que sur un acte reçu,
    // et l'écrire « date de départ » ferait perdre ce que l'utilisatrice vient de saisir.
    /**
     * ⚠️ Le suffixe `Fr` est HISTORIQUE : sur cette entrée synthétique, le champ porte la
     * langue DEMANDÉE. `entreeAutrePublique()` laisse `pointDepartEn`/`pointDepartHt` à
     * `null`, et `champEntree()` retombe alors sur celui-ci — qui est déjà dans la bonne
     * langue. Une entrée du répertoire, elle, garde ses trois colonnes de base.
     */
    pointDepartFr: source ? x.pointDepartSource : x.pointDepart,
    motifRefusFr: null,
    avisDistance: null,
    citationArticle: null,
  }
}

/**
 * § 4.12 — la lecture nommée « REGIME_FRANC » se fonde sur le CODE de la fiche. Le genre
 * « Autre » n'en a pas de vrai : son nombre de jours est lu dans un acte, une circulaire, un
 * document douanier, et aucun article du corpus ne le qualifie. On substitue donc le fondement
 * honnête — celui qui renvoie l'utilisatrice à SON texte.
 *
 * ⚠️ **LA DÉCISION EN SUSPENS A ÉTÉ PRISE LE 20 AOÛT 2026 (SOIR).** Cette note demandait « à
 * faire trancher : l'alternative propre serait de paramétrer les libellés de
 * `phrases(locale).lectures` dans le moteur ». C'est fait : `lectureRegimeFranc(code)` rend
 * désormais le fondement du code de la fiche (`FONDEMENT_REGIME_PAR_CODE`), et cette
 * substitution-ci ne couvre plus que le cas où il n'y a PAS de code — le nombre saisi à la
 * main. (La table `LECTURES_NOMMEES` que la note citait a été supprimée le même jour : elle
 * doublait `phrases.lectures` en français seul, sans consommateur.)
 *
 * ⚠️ **ET ELLE EST TRADUITE.** Ses deux phrases étaient EN DUR EN FRANÇAIS et sortaient telles
 * quelles sur `/en` et `/ht` — la même faute d'un cran plus bas que celle qu'elle corrigeait.
 * Elles vivent maintenant dans `phrases(locale).lectureRegimeFrancAutre`, avec le reste.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚠️ **CETTE FONCTION A ÉTÉ INERTE, ET LE TYPECHECK NE L'A PAS VUE.**
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Elle écrivait `libelleFr` et `fondementFr` — deux clés qui n'existent pas sur
 * `LectureNommee` (`calcul.ts`), laquelle porte `libelle` et `fondement`. L'écran
 * (`DelaiResult.tsx`) lit ces derniers : la substitution n'arrivait donc jamais, et un délai
 * lu dans une circulaire DGI se voyait opposer « C. trav., art. 511 », que l'art. 511 ne
 * régit pas. Les deux champs morts partaient en plus dans le JSON de la route.
 *
 * `tsc --noEmit` ne l'a PAS attrapé : le contrôle des propriétés excédentaires ne joue pas
 * sur l'objet littéral d'un `.map` dont le type de retour est inféré. **Le retour du rappel
 * est donc annoté `LectureNommee`** — c'est cette annotation, et non le renommage, qui
 * empêchera la faute de revenir.
 *
 * ⚠️ Un permalien `f=ne-sais-pas` déjà émis change de TEXTE affiché — jamais de date. Ce
 * qu'il rendait était une citation fausse, et la stabilité d'un permalien ne protège pas une
 * erreur de texte (§ 6.3).
 */
function corrigerFondementAutre(resultat: Resultat, locale: Locale): Resultat {
  if (resultat.statut !== 'CALCUL') return resultat
  const substitut = phrases(locale).lectureRegimeFrancAutre
  return {
    ...resultat,
    lectures: resultat.lectures.map((l): LectureNommee =>
      l.cle === 'REGIME_FRANC' ? { ...l, ...substitut } : l,
    ),
  }
}

export type FenetrePublique = Omit<FenetreLue, never>

function fenetresPubliques(f: FenetreLue[]): FenetrePublique[] {
  return f.map((x) => ({
    matiere: x.matiere,
    heureDebut: x.heureDebut,
    heureFin: x.heureFin,
    source: x.source,
    sourceDocId: x.sourceDocId,
    nullite: x.nullite,
    nulliteTexteFr: x.nulliteTexteFr,
  }))
}

export type EntreePublique = ReturnType<typeof entreePublique>

/** Ce que l'écran affiche de l'entrée, au-delà de ce que le moteur consomme. */
function entreePublique(ctx: ContexteEntree) {
  const l = ctx.ligne
  return {
    slug: l.slug,
    code: l.code,
    codeLibelle: l.codeLibelle,
    article: l.article,
    articleContexte: l.articleContexte ?? null,
    tableau: l.tableau ?? null,
    tableauTitreFr: l.tableauTitreFr ?? null,
    objetFr: l.objetFr,
    objetEn: l.objetEn ?? null,
    objetHt: l.objetHt ?? null,
    traductionRelue: l.traductionRelue ?? false,
    dureeTexte: l.dureeTexte,
    dureeFondementFr: l.dureeFondementFr ?? null,
    /**
     * § 6.3 g — LE TEXTE DE L'ARTICLE, CITÉ SUR PLACE. `EntreeMenu` le portait déjà,
     * `textesAppliques` sait le préférer à `dureeTexte` et bascule alors sa ligne de source
     * sur « Texte de l'article, tel que lu au corpus » — mais `EntreePublique` ne le
     * reprenait pas, si bien qu'un visiteur public lisait « le texte intégral de l'article se
     * lit au corpus » et se faisait renvoyer derrière le mur de connexion, sur un article
     * dont la plateforme détient pourtant le texte mot pour mot.
     */
    citationArticle: l.citationArticle ?? null,
    pointDepartFr: l.pointDepartFr,
    pointDepartEn: l.pointDepartEn ?? null,
    pointDepartHt: l.pointDepartHt ?? null,
    sanctionFr: l.sanctionFr ?? null,
    sanctionEn: l.sanctionEn ?? null,
    sanctionHt: l.sanctionHt ?? null,
    distanceAideFr: l.distanceAideFr ?? null,
    distanceDoubleFr: l.distanceDoubleFr ?? null,
    statut: ctx.statutEntree,
    revision: ctx.revisionDemandee,
    revisionCourante: ctx.revisionCourante,
  } as {
    slug: string
    code: string
    codeLibelle: string
    article: string
    articleContexte: string | null
    tableau: number | null
    tableauTitreFr: string | null
    objetFr: string
    objetEn: string | null
    objetHt: string | null
    traductionRelue: boolean
    dureeTexte: string
    dureeFondementFr: string | null
    citationArticle: string | null
    pointDepartFr: string
    pointDepartEn: string | null
    pointDepartHt: string | null
    sanctionFr: string | null
    sanctionEn: string | null
    sanctionHt: string | null
    distanceAideFr: string | null
    distanceDoubleFr: string | null
    statut: string
    revision: number | null
    revisionCourante: number | null
  }
}

/** Le genre « Autre » n'a pas de ligne en base : ce qu'on rend de lui vient de la saisie. */
function entreeAutrePublique(entree: EntreeDelai): EntreePublique {
  return {
    slug: entree.slug,
    code: entree.code,
    codeLibelle: entree.codeLibelle,
    article: entree.article,
    articleContexte: null,
    tableau: null,
    tableauTitreFr: null,
    objetFr: entree.objetFr,
    objetEn: null,
    objetHt: null,
    traductionRelue: false,
    dureeTexte: entree.dureeTexte,
    dureeFondementFr: null,
    citationArticle: null,
    pointDepartFr: entree.pointDepartFr,
    pointDepartEn: null,
    pointDepartHt: null,
    sanctionFr: null,
    sanctionEn: null,
    sanctionHt: null,
    distanceAideFr: null,
    distanceDoubleFr: null,
    statut: 'visible',
    revision: null,
    revisionCourante: null,
  }
}

/**
 * § 7.3 — trois situations, trois bandeaux, et un seul interdit commun : **aucune action
 * d'administration ne modifie, ne recalcule ni n'efface un résultat déjà rendu.**
 */
function bandeauDeRevision(
  ctx: ContexteEntree,
  locale: string,
  d: string,
  c: number,
  w: number,
  /** § 4.6 — la version des règles de lecture : le second permalien la porte, comme `c` et `w`. */
  rl: number,
  km: readonly number[],
  /** § 6.4 — la surface d'où part le calcul : le second permalien y RESTE. */
  base: SurfaceDelais,
  sup?: string,
): Bandeau {
  if (ctx.statutEntree !== 'visible') {
    // Le résultat d'origine reste affiché, reconstruit depuis la copie gelée. AUCUN bouton de
    // recalcul : la plateforme ne propose plus cette entrée.
    return {
      type: 'ENTREE_RETIREE',
      statutEntree: ctx.statutEntree,
      motif: ctx.masqueMotif,
      retireeLe: ctx.masqueLe,
    }
  }
  if (ctx.revisionDemandee !== ctx.revisionCourante) {
    // Le lien « refaire le calcul avec la règle actuelle » produit UN SECOND permalien, à
    // côté, jamais à la place.
    return {
      type: 'REGLE_CHANGEE',
      revisionDemandee: ctx.revisionDemandee,
      revisionCourante: ctx.revisionCourante,
      changeeLe: ctx.revisionCouranteLe,
      // Le second permalien est SIGNÉ lui aussi : le jour où l'entrée sera retirée, il devra
      // pouvoir se rouvrir comme celui-ci (§ 7.3).
      hrefActuelle: (() => {
        const p = { d, e: ctx.ligne.slug, r: ctx.revisionCourante, c, w, rl, km, sup: sup ?? null }
        return avecSignature(construirePermalien(locale, p, base), signerQuery(queryPermalien(p)))
      })(),
    }
  }
  return null
}

export type SuccesCalcul = {
  ok: true
  permalien: string
  /**
   * § 6.2 — les avertissements de SAISIE (à distinguer des A1…A6 du moteur, qui portent sur
   * le droit). Aujourd'hui : la date de départ à plus de dix ans.
   */
  avertissementsSaisie: string[]
  entree: EntreePublique
  resultat: Resultat
  versionCalendrier: number
  versionFenetres: number
  /**
   * § 4.6 — la version des RÈGLES DE LECTURE sous laquelle la date a été rendue. Le pied de
   * page la nomme et le permalien la porte : un calcul cité doit dire sous quelle règle il a
   * été fait, sans quoi la même adresse rendrait une autre date le jour où la règle change.
   */
  versionRegles: number
  fenetres: FenetrePublique[]
  bandeau: Bandeau
  /**
   * § 6.1 / § 6.2 — **LA SEULE MENTION QUE LA SURFACE PUBLIQUE GARDE À CÔTÉ DE LA DATE**
   * (Me Vaval, 20 août 2026). Vide sur la surface connectée : le portail dit la même chose en
   * plus fort — jours écartés, lectures nommées, jour praticable, avertissements —, et une
   * ligne de plus y répéterait ce que quatre blocs disent déjà.
   *
   * Elle est calculée ICI parce que c'est ici que le calendrier de la version demandée est
   * chargé. La poser dans un écran obligerait à relire le calendrier une seconde fois, et
   * l'API et la page ne diraient plus la même chose du même jour.
   */
  mentionsJour: MentionJour[]
  /**
   * § 6.1 / § 6.2 — **LE REPORT DE L'ART. 991, QUAND IL A EU LIEU** (Me Vaval, 20 août 2026,
   * seconde décision du jour). Les jours franchis et la date d'arrivée, pour la ligne en
   * petits caractères qui explique pourquoi la date n'est pas celle qu'on compte sur ses
   * doigts. `null` quand rien n'a bougé, et sur la surface connectée, où le raisonnement pas
   * à pas et la table des jours écartés le disent déjà.
   */
  report: ReportPublic | null
  /**
   * § 0 — **LA DATE QUE L'AUTRE SURFACE DONNERAIT**, quand elle diffère de celle qui est
   * affichée. `null` le reste du temps, et `null` sur la surface connectée, qui n'a rien à
   * comparer.
   *
   * ⚠️ **ELLE EXISTAIT PARCE QUE LES DEUX SURFACES RENDAIENT DEUX DATES** — 56 divergences sur
   * les 1 826 départs de 2025 à 2029 au MATIN du 20 août 2026, la publique toujours la plus
   * tardive (le compte d'aujourd'hui est mesuré par `franc-pur.test.ts`, § 0). **Me Vaval a
   * tranché le 20 août 2026 (soir)** : les fêtes nationales prorogent, la prorogation cascade,
   * et les deux têtes d'affiche appliquent désormais la même version de règles. Sous le
   * calendrier courant, l'écart est de ZÉRO et ce champ vaut toujours `null`.
   *
   * ⚠️ **IL RESTE POUR UN CAS, ET IL EST RÉEL** : un permalien `c=1` rejoue le calendrier de la
   * version 1, dont quatre jours n'étaient institués par aucun texte du corpus. Le portail les
   * refuse en tête d'affiche, la page publique les proroge : la publique redevient la plus
   * tardive, et une date de forclusion trop tardive fait manquer le recours. La page NOMME donc
   * la date étroite au lieu de la taire — « une date juste, sans ses réserves, est plus
   * dangereuse qu'une absence de calculateur » (§ 0).
   */
  lectureStricte: CivilDate | null
  /** L'entrée est masquée ou supprimée : rien de ce résultat ne doit être mis en cache. */
  retiree: boolean
}

/**
 * LE CALCUL. Pas d'écriture, pas de quota, pas de journal : c'est un outil, pas une
 * recherche (§ 4).
 */
export async function calculPublic(
  q: ParamsCalcul,
  /** ⚠️ Jamais lu dans l'URL — voir `AccesDelais`. Par défaut on échoue fermé. */
  acces: AccesDelais = 'public',
  /**
   * § 09 — les versions courantes que l'appelant vient de lire, s'il en a lu. Voir
   * `VersionsCourantes` : elles ne servent qu'à ne PAS relire ce qui vient de l'être, jamais à
   * écraser un `c=` ou un `w=` porté par la requête.
   */
  dejaLues?: VersionsCourantes | null,
): Promise<SuccesCalcul | EchecPublic> {
  const estAutre = q.e === SLUG_AUTRE
  const estPublic = acces === 'public'

  /**
   * LE PÉRIMÈTRE PUBLIC, AVANT TOUTE AUTRE LECTURE — et avant même la date : c'est une règle
   * d'accès, pas une règle de saisie, et elle ne doit pas dépendre de la validité du reste.
   *
   * ⚠️ **Le répertoire ne sort pas de l'espace connecté.** Ni son menu, ni une entrée à
   * l'unité : `?e=cpc-354-…` sur la surface publique rendait le libellé de l'entrée, sa durée,
   * son régime, son fondement et le texte de l'article — c'est-à-dire le répertoire, une
   * ligne à la fois, pour qui itère les slugs. On refuse, on ne sert pas.
   */
  if (estPublic && !estAutre) return echec('repertoireReserve', 401)
  /**
   * ⚠️ **Publiquement, on ne calcule que du FRANC**, et c'est une conséquence de droit, pas
   * un choix d'écran : la page ne demande qu'« un nombre de jour(s) francs ». Un `f=non`
   * fabriqué à la main calculerait un délai ORDINAIRE — le régime de droit commun du Code
   * civil — sous une page qui annonce l'inverse. Refus explicite plutôt qu'un paramètre
   * écrasé en silence.
   */
  if (estPublic && q.f != null && q.f !== 'oui') return echec('francSeulement', 400)
  /**
   * ⚠️ **`src` est un TEXTE LIBRE reproduit dans le résultat et à l'impression** — la « nature
   * du délai » du § 4.12. La page publique ne le demande pas (deux champs), et la plateforme
   * ne l'émet jamais dans un permalien public. Le laisser passer offrirait à qui fabrique une
   * adresse une phrase de son choix, affichée sur une page de Lam comme si l'outil l'avait
   * qualifiée. Refus, plutôt qu'un paramètre accepté puis ignoré.
   */
  if (estPublic && q.src != null) return echec('invalidFields', 400)
  /**
   * § 2 (Me Vaval, 20 août 2026) — ⚠️ **LE MODE DE DÉCOMPTE NE S'APPLIQUE JAMAIS À UNE ENTRÉE
   * DU RÉPERTOIRE, ET C'EST UN REFUS, PAS UN OUBLI.**
   *
   * « Rends-le impossible, pas seulement caché. » Le formulaire ne rend le commutateur que sur
   * la saisie manuelle — mais `?e=cpc-354-…&f=non` était ACCEPTÉ : `f` n'est lu que par
   * `entreeAutre()`, il était donc abandonné en silence, et le permalien réémis le remplaçait
   * par `null`. L'adresse portait un mode de décompte que le calcul n'avait pas appliqué, sur
   * une entrée dont le régime vient du TEXTE (art. 987 C. pr. civ., art. 511 C. trav., ou
   * droit commun) et que l'utilisatrice n'a pas à choisir.
   *
   * ⚠️ Le refus vaut aussi pour un formulaire sans JavaScript qui aurait gardé les champs de
   * la saisie manuelle en changeant d'entrée : la faute est ÉCRITE, l'entrée choisie reste au
   * menu, et la soumission suivante — le bloc « Autre » n'étant plus rendu — passe.
   */
  if (!estAutre && q.f != null) return echec('regimeImpose', 400)

  // La date se lit STRICTEMENT : « 2026-02-31 » n'est pas une date, et ne se rattrape pas au
  // 1er mars. Le moteur le refuserait aussi, mais il faut d'abord pouvoir lui donner une date.
  const depart = parseIso(q.d)
  if (!depart) return echec('dateImpossible', 400)

  // Le kilométrage ne s'arrondit jamais et ne se devine pas : mal formé, on refuse.
  const km = lireKm(q.km)
  if (km === null) return echec('kilometrageInvalide', 400)

  // § 4.12 — `src` est le SEUL texte libre de l'utilisatrice que la réponse reproduise, et
  // elle DOIT le reproduire : « nature du délai, champ libre, obligatoire, reproduit dans le
  // résultat et à l'impression ». On le rend donc lisible, jamais brut : les caractères de
  // contrôle sont retirés et les espaces réduits. ⚠️ La page qui l'affiche doit le rendre
  // comme du TEXTE (JSX l'échappe) — jamais par `dangerouslySetInnerHTML`.
  const src = q.src
    ? q.src.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
    : undefined
  /**
   * « Ce délai est-il franc ? » n'est posée QUE dans l'espace connecté, où l'on peut saisir un
   * délai lu n'importe où. Publiquement, le champ s'appelle « Nombre de jour(s) francs » : la
   * réponse est dans le libellé, et la reposer n'apprendrait rien.
   */
  const franc: ReponseFranc | undefined = q.f ?? (estPublic ? 'oui' : undefined)
  if (estAutre && (q.n == null || !franc || (!estPublic && !src))) {
    // Les TROIS choses du § 4.12 : le nombre, la nature (obligatoire, reproduite au résultat)
    // et la réponse « ce délai est-il franc ? ». Publiquement il n'en reste qu'une : le nombre.
    return echec('autreIncomplet', 400)
  }

  try {
    const versionC = q.c ?? dejaLues?.versionCalendrier ?? (await versionCalendrierCourante())
    const versionW = q.w ?? dejaLues?.versionFenetres ?? (await versionFenetresCourante())
    if (versionC == null || versionW == null) return echec('delaisNonInitialises', 503)

    /**
     * § 4.6 — **LA VERSION DES RÈGLES DE LECTURE, REFUSÉE PLUTÔT QUE RABATTUE.** Comme pour le
     * calendrier : une version inconnue est un 404 franc, jamais un calcul rendu sous les
     * règles du jour. Rendre la date d'aujourd'hui sous une adresse qui en promet une autre,
     * c'est le seul défaut que la coordonnée existe pour empêcher. Elle n'est PAS lue en base —
     * les règles sont du CODE, relu et testé, et non une donnée qu'un écran d'administration
     * pourrait déplacer sans revue (voir `regles-lecture.ts`).
     */
    const versionR = q.rl ?? VERSION_REGLES_COURANTE
    const regles = reglesLecture(versionR)
    if (regles === null) return echec('versionReglesInconnue', 404)
    /**
     * § 4.10 — la matinée du Lundi Gras reste-t-elle ouvrable sous CES règles ? C'est
     * l'inverse exact du drapeau qui le fait proroger : version 1, il proroge et le jour est
     * plein ; version 2, il ne proroge plus et la mention en petits caractères doit dire à
     * quelle heure la fenêtre se ferme (Me Vaval, 20 août 2026).
     */
    const matineeOuvrable = !regles.demiJournee

    const cal = await chargerCalendrier(versionC)
    if (cal === null) return echec('versionCalendrierInconnue', 404)
    if (!cal.ok) return echec('calendrierIllisible', 500)

    const fenetres = await chargerFenetres(versionW)
    if (fenetres === null) return echec('versionFenetresInconnue', 404)

    let entree: EntreeDelai
    let contexte: ContexteEntree | null = null
    if (estAutre) {
      entree = entreeAutre(q.n as number, franc as ReponseFranc, src ?? null, estPublic, q.locale)
    } else {
      const charge = await chargerEntree(q.e, q.r)
      if (charge.statut === 'INTROUVABLE') return echec('entreeInconnue', 404)
      if (charge.statut === 'REVISION_INTROUVABLE') return echec('revisionInconnue', 404)
      if (charge.statut === 'LIGNE_ILLISIBLE') return echec('entreeIllisible', 500)
      contexte = charge.contexte
      entree = charge.contexte.entree

      /**
       * § 7.3 — LES DEUX FACES DE LA MÊME RÈGLE, et c'est la SIGNATURE qui les sépare.
       *
       * Un permalien ANCIEN — celui que l'utilisatrice a copié quand l'entrée était encore au
       * menu — porte sa signature : il continue de rendre le calcul tel qu'il a été rendu,
       * avec son bandeau. Un calcul NEUF avec une entrée retirée est refusé : elle a quitté le
       * menu, la plateforme ne la propose plus. 410 « Gone » et non 404 : l'entrée a existé,
       * et le dire est utile.
       *
       * ⚠️ Le discriminant ÉTAIT la présence de `r` — un petit entier que tout permalien
       * porte et que n'importe qui devine, `d` restant libre. La voie fabriquée passait donc,
       * pendant que la voie honnête était refusée.
       */
      if (contexte.statutEntree !== 'visible') {
        const attendue = queryPermalien({
          d: q.d,
          e: q.e,
          r: contexte.revisionDemandee,
          c: versionC,
          w: versionW,
          rl: versionR,
          km,
          sup: q.sup ?? null,
        })
        if (!signatureValide(attendue, q.sig)) return echec('entreeRetiree', 410)
      }
    }

    /**
     * § 6.2 — UN KILOMÉTRAGE SURNUMÉRAIRE EST REFUSÉ, JAMAIS IGNORÉ. `?e=cpc-105&km=12,5`
     * (une seule distance prévue) rendait une date sans un mot, la valeur `5` abandonnée en
     * silence — alors que `km=12.5`, `km=abc` et `km=99999` étaient correctement refusés.
     * Sur un permalien recopié ou tronqué, une distance disparaissait sans que l'écran le dise.
     */
    const nbAttendu = entree.nbDistances ?? (entree.kind === 'JOURS_PLUS_DISTANCE_KM' ? 1 : 0)
    // Le plafond n'est jamais inférieur à 1 : `km=0` fait partie de la forme canonique du
    // permalien documentée au § 6.3, même sur une entrée qui ne mesure aucune distance.
    if (km.length > Math.max(nbAttendu, 1)) return echec('kilometrageInvalide', 400)

    const brut = calculer({
      depart,
      entree,
      km,
      supplementCle: q.sup ?? null,
      versionCalendrier: versionC,
      versionRegles: versionR,
      entreesCalendrier: cal.entrees,
      locale: q.locale,
    })
    /**
     * ⚠️ **LA RESTRICTION FRANC PUR EST APPLIQUÉE ICI, ET NULLE PART AILLEURS.** `calculPublic`
     * est le seul point par lequel la route `/api/public/delais/calculer` ET la page
     * `/{locale}/delais` obtiennent leur résultat : le poser ici, c'est le poser une fois pour
     * les deux — et pour le presse-papiers, l'impression et le permalien, qui en descendent.
     * Le remonter dans la route ou dans un écran rouvrirait la seconde vérité que ce découpage
     * existe pour empêcher.
     *
     * Elle ne retire que les productions inconditionnelles du moteur (le bloc praticable, les
     * avertissements hors A3, le renvoi terminal) : les lectures nommées et la « lecture la
     * plus large » ont déjà disparu par la CONFIGURATION de l'entrée, en amont du calcul.
     * **La date, elle, n'est jamais retouchée** — le report de l'art. 991 est fait par le
     * moteur, pas ici. Voir `franc-pur.ts`.
     */
    const calcule = estAutre ? corrigerFondementAutre(brut, q.locale) : brut
    const resultat = estPublic ? restreindreAuFrancPur(calcule, q.locale) : calcule

    /**
     * § 0 — **LA DATE DE L'AUTRE SURFACE, QUAND ELLE N'EST PAS LA MÊME.**
     *
     * ⚠️ **DEPUIS LE 20 AOÛT 2026 (SOIR), LES DEUX SURFACES ONT LA MÊME TÊTE D'AFFICHE** : les
     * fêtes nationales prorogent et la prorogation cascade des deux côtés (version 2 des règles
     * de lecture). Sur les 1 826 départs de 2025 à 2029, l'écart est **de ZÉRO** sous le
     * calendrier courant, pour 8, 15, 30 et 31 jours — mesuré par `franc-pur.test.ts`, § 0, et
     * non supposé. (Il valait 16 sur le calendrier de la version 1 sous les mêmes règles, et 18
     * sous les règles de la version 1 ; le chiffre de 53 que cette note portait était celui du
     * matin, mesuré quand le portail gardait encore une tête étroite.) Ce
     * bloc ne rend donc plus rien — SAUF sous un permalien `c=1`, où le calendrier de la
     * version 1 porte quatre jours sans texte instituant que le portail refuse en tête
     * d'affiche et que la surface publique proroge. Un écran qui rend la date la plus tardive
     * **sans nommer la plus précoce** fait porter le risque de forclusion au lecteur qui n'a
     * que cet écran-là.
     *
     * ⚠️ **Le même moteur, une seconde configuration** — jamais un second calcul : on repose
     * l'entrée avec `prorogationTeteLarge: false` (voir `entreeLectureStricte`, `franc-pur.ts`)
     * et on relit la tête d'affiche. Aucune date n'est construite ici.
     *
     * ⚠️ Publiquement ET sur le genre « Autre » seulement : le portail rend déjà la lecture
     * étroite en tête d'affiche, il n'a rien à comparer.
     */
    const lectureStricte: CivilDate | null = (() => {
      if (!estPublic || !estAutre || resultat.statut !== 'CALCUL') return null
      if (entree.prorogationTeteLarge !== true) return null
      const strict = calculer({
        depart,
        entree: entreeLectureStricte(entree),
        km,
        supplementCle: q.sup ?? null,
        versionCalendrier: versionC,
        versionRegles: versionR,
        entreesCalendrier: cal.entrees,
        locale: q.locale,
      })
      if (strict.statut !== 'CALCUL') return null
      return egales(strict.teteAffiche, resultat.teteAffiche) ? null : strict.teteAffiche
    })()

    // § 7.3 — les trois comportements d'un permalien rouvert. Le bandeau DIT ce qui s'est
    // passé ; il ne remplace jamais le résultat, qui reste celui de la règle demandée.
    const bandeau = contexte
      ? bandeauDeRevision(contexte, q.locale, q.d, versionC, versionW, versionR, km, q.base as SurfaceDelais, q.sup)
      : null

    const params = {
      d: q.d,
      e: q.e,
      r: contexte?.revisionDemandee ?? null,
      c: versionC,
      w: versionW,
      rl: versionR,
      km,
      sup: q.sup ?? null,
      n: estAutre ? (q.n as number) : null,
      // Le permalien porte le `f` EFFECTIF — celui du calcul —, y compris quand il vient du
      // défaut public : rechargeable à l'identique, il doit dire sous quel régime on a compté.
      f: estAutre ? (franc as ReponseFranc) : null,
      src: estAutre ? (src ?? null) : null,
    }
    // § 7.3 — TOUT permalien émis est signé, y compris sur une entrée visible : c'est cette
    // signature-là que l'utilisatrice copie aujourd'hui et qui, le jour où la rédaction
    // retirera l'entrée, prouvera que son lien est authentique.
    const permalien = avecSignature(
      construirePermalien(q.locale, params, q.base as SurfaceDelais),
      signerQuery(queryPermalien(params)),
    )

    return {
      ok: true,
      permalien,
      avertissementsSaisie: depart.y > ANNEE_DE_REFERENCE + HORIZON_ANNEES ? ['farFuture'] : [],
      entree: contexte ? entreePublique(contexte) : entreeAutrePublique(entree),
      resultat,
      versionCalendrier: versionC,
      versionFenetres: versionW,
      versionRegles: versionR,
      /**
       * ⚠️ **LES FENÊTRES DE SIGNIFICATION SORTENT DE LA SURFACE PUBLIQUE, AU MÊME MOTIF QUE
       * LE JOUR PRATICABLE.** « De 6 h à 18 h · C. pr. civ., art. 991 » suppose que l'acte
       * EST une signification — exactement la qualification invoquée pour retirer le bloc
       * praticable (« il suppose une qualification — signification, exécution — que la surface
       * publique ne demande plus », `franc-pur.ts`). Le même motif a emporté un bloc et
       * épargnait l'autre, sur le même écran ; et il nommait l'art. 991 quatre lignes après
       * que la page a écrit « sans y appliquer aucun report ».
       *
       * ⚠️ **Coupé ICI, et pas seulement dans l'écran.** La route `/api/public/delais/calculer`
       * les rendait aussi : les masquer côté rendu aurait laissé l'API les servir. `versionW`
       * reste calculée et portée par le permalien — c'est elle qui rejoue un lien à
       * l'identique —, et le portail (`'connecte'`) n'a rien perdu.
       */
      fenetres: estPublic ? [] : fenetresPubliques(fenetres),
      bandeau,
      /**
       * ⚠️ **On regarde la date CALCULÉE, et elle seule.** Pas les jours traversés par le
       * délai : le délai court, il ne s'interrompt pas, et un férié traversé n'a rien à
       * annoncer (Me Vaval, 20 août 2026 : c'est bien le cas où « la date calculée tombe »
       * un jour férié). Un REFUS ou une saisie INCOMPLÈTE n'ont pas de tête d'affiche : la
       * liste est alors vide.
       *
       * ⚠️ Depuis le report de l'art. 991 (seconde décision du 20 août), cette liste ne porte
       * plus que DEUX sortes de jours : un jour À SURVEILLER, et — depuis le correctif de la
       * demi-journée (20 août, au vu du décret) — le LUNDI GRAS, sur lequel la date s'arrête
       * puisque sa matinée reste ouvrable. Un dimanche et les quinze autres entrées PERMANENT
       * sont exactement les jours dont le report fait sortir la date. Les jours FRANCHIS, eux,
       * sont décrits par `report` ci-dessous.
       */
      mentionsJour:
        estPublic && resultat.statut === 'CALCUL'
          ? mentionsJour(resultat.teteAffiche, cal.entrees, q.locale, matineeOuvrable)
          : [],
      /**
       * ⚠️ **LA LIGNE QUI DIT POURQUOI LA DATE A BOUGÉ**, et rien de plus (Me Vaval, 20 août
       * 2026 : « il faut la proroger au prochain jour ouvrable »). Sans elle, la personne qui
       * a saisi 31 jours francs compte sur ses doigts et trouve un jour de moins que l'écran.
       *
       * `null` quand rien n'a été reporté — c'est le cas le plus fréquent —, et sur le
       * PORTAIL, où le raisonnement pas à pas, la table des jours écartés et les lectures
       * nommées disent déjà tout cela, en plus fort.
       */
      report:
        estPublic && resultat.statut === 'CALCUL'
          ? reportPublic(resultat, cal.entrees, q.locale, matineeOuvrable)
          : null,
      lectureStricte,
      retiree: contexte != null && contexte.statutEntree !== 'visible',
    }
  } catch (e) {
    if (estSchemaAbsent(e)) return echec('delaisSchemaAbsent', 503)
    throw e
  }
}
