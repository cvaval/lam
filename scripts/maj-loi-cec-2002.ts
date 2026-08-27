/**
 * LOI DU 10 JUILLET 2002 SUR LES COOPÉRATIVES D'ÉPARGNE ET DE CRÉDIT — MISE À JOUR DE LA FICHE.
 * (Feuille de route du 27 août 2026 « Lam — Prompt loi CEC 2002 (sommaire et index) », § 7.)
 *
 *     npx tsx scripts/maj-loi-cec-2002.ts                        # simulation, n'écrit rien
 *     npx tsx scripts/maj-loi-cec-2002.ts --apply                # écriture — Me Vaval, elle seule
 *     npx tsx scripts/maj-loi-cec-2002.ts --facsimile            # + étape 7.3 en simulation (§ 13.3)
 *     npx tsx scripts/maj-loi-cec-2002.ts --facsimile --apply    # + attache le fac-similé (Me Vaval)
 *
 * ─── LES ÉTAPES, DANS L'ORDRE DU § 7 ────────────────────────────────────────────────────────
 *  § 7.1  Pré-vol : empreinte md5 du corps de départ en PREMIÈRE assertion ; segmentation par
 *         le MÊME segmentAnnotated que le rendu ; baseline de l'oracle (§ 8) revérifiée sur le
 *         corps AVANT toute modification.
 *  § 7.2  `adoptionDate` NULL → 2002-07-09 — DÉCISION DE ME VAVAL DU 27 AOÛT 2026 (§ 13.4,
 *         règle GÉNÉRALE) : « la date est la dernière des entités qui l'a adoptée ; si c'est
 *         la présidence, c'est celle de la présidence. » Sénat 20 juin → Chambre 26 juin →
 *         présidence 9 juillet 2002. La règle est citée dans le meta de l'audit.
 *  § 7.4  Les 3 libellés de TITRES tronqués (sec-4, sec-27, sec-43) recollés EN LETTRE DU
 *         J.O. telle que le corps la porte (fusion des deux lignes du corps, \n → espace,
 *         0 caractère perdu ; toc ET navToc ; ancres intactes ; orphelines 3 → 0).
 *  § 7.5  Index : + « Épargne » et « Supervision » (les 2 seuls apports prouvés de l'index
 *         cliente), au format de la base (ctRefs en chaînes), position de collation française
 *         calculée à l'exécution ; chaque renvoi RE-vérifié au corps (radical à frontière de
 *         mot, accents pliés) — compte asserté en PRODUIT (avant + ajouts.length), jamais en dur.
 *  § 7.6  Les 48 plages d'articles (maj2026-base-ranges.json) en assertions BLOQUANTES,
 *         jointes par ORDRE et ANCRE, jamais par libellé — avant ET après la fusion.
 *  § 7.8  Les 3 CrossRef CITE du lot ferme des visas (Constitution 1987 ; loi du 17 août 1979
 *         ORGANIQUE de la BRH — identification sur pièces, maj2026-identification-loi-1979.md,
 *         re-vérifiée ici au corps des cibles ; décret du 17 mai 1995). Résolution PAR SOURCE ;
 *         le CrossRef ENTRANT du décret sûretés est photographié avant et comparé après.
 *  § 7.3  Le fac-similé lacunaire : REFUSÉ sans le drapeau --facsimile (la question § 13.3
 *         est OUVERTE) ; s'il est consenti, la mention de lacune est OBLIGATOIRE, écrite dans
 *         la MÊME transaction que sourcePdfUrl (interdit n° 19).
 *  § 8    L'oracle des 600 renvois de l'index cliente : baseline avant / rejeu après par le
 *         MÊME module — AUCUNE régression (échec nouveau = bloquant, disparu = à investiguer).
 *  § 10   État antérieur horodaté AVANT la transaction (scripts/data/cec/) · $transaction +
 *         audit(…, tx) + AuditLog RECOMPTÉ après (audit() avale ses erreurs) · relecture des
 *         contenus écrits · reindexDocument HORS transaction.
 *
 * ─── CE QUE CE SCRIPT NE FAIT PAS ───────────────────────────────────────────────────────────
 *  · AUCUNE création de document (§ 12.1) — updates ciblés sur la fiche résolue par `source`.
 *  · titleFr/En/Ht, number, publicationDate, effectiveDate : INTOUCHÉS et assertés (§ 13.1).
 *  · Aucun sic du J.O. « corrigé » (sentinelles § 9.6 bloquantes) ; le renvoi interne de
 *    l'article 144 n'est PAS résolu (§ 12.6) ; CHAPITRE II/III du TITRE II non tranché (§ 13.2).
 *  · Les visas sans cible (31 mars 1981, 2 avril 1981, 27 mars 1985) : consignés au rapport,
 *    aucune ligne (§ 13.7). Rien depuis l'UCREF (§ 12.11). Les renvois ENTRANTS : consignés
 *    sans écriture dans maj2026-renvois-entrants-proposes.json (§ 13.9).
 *  · L'index cliente n'est ni versé ni fusionné — il reste l'oracle (§ 12.3).
 *
 * ─── COMPOSITION ────────────────────────────────────────────────────────────────────────────
 * Ce script SUBSUME les trois lots préparés dans scripts/data/cec/ (maj2026-lot-corps.ts,
 * maj2026-renvois-visas.ts, maj2026-attacher-facsimile.ts) et y ajoute le § 7.2. Chaque volet
 * est idempotent et détecte l'état déjà appliqué — par lui-même ou par les scripts de lot :
 * exécuter CE script suffit ; relancé après application, il constate et n'écrit rien.
 */
import { createHash } from 'node:crypto'
import { accessSync, constants, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../src/lib/db'
import { parseAnnotations, type TocEntry, type NavGroup, type CrossRefEntry } from '../src/lib/legislation/annotated'
import { uploadToBlob, isBlobUrl } from '../src/lib/storage/blob'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'
import { jouerOracle, cleEchec, comparerALaBaseline, textesParArticle, plier, radicalPresent, type EchecOracle, pairesCliente } from './data/cec/maj2026-oracle-index'
import { verifierSegmentation, mesurerPlages, comparerPlages, verifierIndex, verifierSentinelles, type Plage } from './data/cec/maj2026-mesures'

const APPLY = process.argv.includes('--apply')
const FACSIMILE = process.argv.includes('--facsimile') // § 13.3 — consentement de Me Vaval
const md5 = (s: string | Buffer) => createHash('md5').update(s as never).digest('hex')

const DIR = join(process.cwd(), 'scripts/data/cec')
const SOURCE = 'LOI_CEC_2002'
const DOC_ID = 'cms8jhhz700004szrkm41yahg'

/** Corps mesuré les 27 août 2026 (relevé + pré-vol) : 504 lignes / 73 703 c. PREMIÈRE assertion. */
const MD5_DEPART = '67a109181877e5e2b06c13c583992c9d'
/** Corps après la fusion § 7.4 (501 lignes, même compte de caractères) — état de relance admis. */
const MD5_APRES_FUSION = '5d781360044ab6db9eee8ba49f369261'

/** § 7.2 / § 13.4 — décision de Me Vaval du 27 août 2026, règle générale, citée à l'audit. */
const ADOPTION_ISO = '2002-07-09'
const REGLE_13_4 =
  '« la date est la dernière des entités qui l’a adoptée ; si c’est la présidence, c’est celle ' +
  'de la présidence. » — règle générale de Me Vaval, 27 août 2026 (§ 13.4). Pour la présente ' +
  'loi : Sénat 20 juin 2002 → Chambre des Députés 26 juin 2002 → présidence 9 juillet 2002.'

// ════════════════════════════════════════════════════════════════════════════════════════════
// § 7.8 — LE LOT FERME DES VISAS. Visas EN LETTRE DU CORPS (apostrophes U+2019, lues du corps
// en base le 27 août — jamais retapées d'un prompt) ; cibles résolues PAR SOURCE, id attendu
// vérifié, identité PROUVÉE au corps de chaque cible. Notes neutres vis-à-vis du § 13.1.
// ════════════════════════════════════════════════════════════════════════════════════════════
const VISA_CONSTITUTION = 'Vu les articles 1, 111-1, 144, 245, 246 de la Constitution,'
const VISA_1979 = 'Vu la loi du 17 août 1979 créant la Banque de la République d’Haïti,'
const VISA_1985 = 'Vu le décret du 27 mars 1985 modifiant les articles 9 et 17 de la Loi du 17 août 1979 créant la Banque de la République d’Haïti,'
const VISA_1995 = 'Vu le décret du 17 mai 1995 sur la libéralisation des taux d’intérêt ;'

interface Renvoi {
  visa: string
  sourceCible: string
  idCibleAttendu: string
  /** Chaînes qui DOIVENT se lire au corps de la cible — l'identité, pas l'homonyme. */
  preuvesCible: string[]
  note: string
}
const RENVOIS: Renvoi[] = [
  {
    visa: VISA_CONSTITUTION,
    sourceCible: 'CONSTITUTION_1987',
    idCibleAttendu: 'cmr1it23a0000b4r0l6r1xp5l',
    preuvesCible: ['Article 245', 'Article 246'],
    note:
      'Visé au préambule de la loi : « Vu les articles 1, 111-1, 144, 245, 246 de la ' +
      'Constitution, ». La fiche cible présente la Constitution du 29 mars 1987 dans sa ' +
      'rédaction consolidée, intégrant les amendements de la Loi constitutionnelle du ' +
      '9 mai 2011 ; en 2002, le visa s’entendait de la rédaction alors en vigueur.',
  },
  {
    visa: VISA_1979,
    sourceCible: 'CC_VANDAL_II-B-1',
    idCibleAttendu: 'cmrtiw94r0001ue7edw6au9ca',
    preuvesCible: [
      'Il est créé, par la présente, un organisme public autonome',
      'BANQUE DE LA RÉPUBLIQUE D’HAÏTI',
    ],
    note:
      'Visé au préambule : « Vu la loi du 17 août 1979 créant la Banque de la République ' +
      'd’Haïti, ». Trois lois du 17 août 1979 coexistent (Le Moniteur n° 72 du 11 septembre ' +
      '1979) : l’une remplace la Banque Nationale de la République d’Haïti par la BRH et la ' +
      'BNC, la deuxième organise la BRH, la troisième la Banque Nationale de Crédit. Le visa ' +
      'désigne la deuxième — la loi organique de la BRH, fiche cible de ce renvoi : c’est ' +
      'elle qui crée l’institution (article 1er : « Il est créé, par la présente, un ' +
      'organisme public autonome… dénommé : « BANQUE DE LA RÉPUBLIQUE D’HAÏTI » »), et le ' +
      'préambule de la même loi de 2002 vise aussi « le décret du 27 mars 1985 modifiant ' +
      'les articles 9 et 17 de la Loi du 17 août 1979 créant la Banque de la République ' +
      'd’Haïti » — articles que seule la loi organique comporte, la loi de remplacement ' +
      's’arrêtant à l’article 3.',
  },
  {
    visa: VISA_1995,
    sourceCible: 'CC_VANDAL_II-M',
    idCibleAttendu: 'cmrtiwna3000hue7eew1lauci',
    preuvesCible: ['établissant un plafond pour les taux', 'Moniteur No 50 du 29 juin 1995'],
    note:
      'Visé au préambule : « Vu le décret du 17 mai 1995 sur la libéralisation des taux ' +
      'd’intérêt ; ». La fiche cible porte le même décret sous son intitulé développé, ' +
      // L'intitulé est cité À LA LETTRE de la fiche (apostrophe droite du titre Vandal
      // comprise) — l'assertion « la note contient titleFr » de l'étape § 7.8 le garantit.
      "« Décret du 17 mai 1995 supprimant le plafond des taux d'intérêt conventionnel et " +
      'abrogeant les décrets des 1er décembre 1976, 8 avril 1980 et 2 avril 1981 » ' +
      '(Le Moniteur n° 50 du 29 juin 1995) : même date, même objet, seul texte du corpus ' +
      'daté du 17 mai 1995.',
  },
]
/** Visas SANS cible au corpus — consignés au rapport, JAMAIS écrits (§ 13.7). */
const VISAS_SANS_CIBLE = [
  'Vu le décret du 31 mars 1981 créant un organisme autonome dénommé Conseil National des Coopératives (CNC);',
  'Vu le décret du 2 avril 1981 réglementant l’organisation des coopératives et les différentes formes d’association, ayant la société coopérative pour base;',
  VISA_1985,
]

// ════════════════════════════════════════════════════════════════════════════════════════════
// § 7.3 — LE FAC-SIMILÉ (sous --facsimile SEULEMENT ; dossier : maj2026-facsimile-dossier.md)
// ════════════════════════════════════════════════════════════════════════════════════════════
const PDF = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/Loi sur les cooperatives Epargne et credit.pdf'
const CHEMIN_BLOB = `source-pdf/legislation/${DOC_ID}.pdf`
const PDF_MD5 = '0fef82932aca681a2137201e97010020'
const PDF_OCTETS = 600_029
const PDF_PAGES = 15
const NOTE_LACUNE =
  'Le fac-similé du Journal officiel joint à cette fiche — Le Moniteur, 157ᵉ année, n° 54, ' +
  'mercredi 10 juillet 2002, numéro extraordinaire — est PARTIEL. La numérisation conservée ' +
  '(exemplaire au tampon de la Bibliothèque de l’Université Quisqueya) ne comporte que 15 des ' +
  '32 pages du fascicule : les pages 1 à 11, 14, 15, 31 et 32 ; les pages 12, 13 et 16 à 30 ' +
  'manquent. Les pages présentes portent le préambule, les articles 1 à 44 et 55 à 64 — un ' +
  'article en frontière de page pouvant y être tronqué —, les articles 147 à 151, ainsi que ' +
  'les dates du Sénat (20 juin 2002), de la Chambre des Députés (26 juin 2002) et de la ' +
  'promulgation (9 juillet 2002). Les articles 45 à 54 et 65 à 146 sont sur les pages ' +
  'manquantes : pour eux, cette pièce ne fait pas foi.'
/** Reconnaître notre entrée si elle est déjà en place (idempotence). */
const SENTINELLE_NOTE = 'les pages 12, 13 et 16 à 30'

interface LibelleTitre {
  anchor: string
  ligne1: string
  ligne2: string
  fusion: string
}
interface Ajout {
  subject: string
  ctRefs: string[]
  radical: string
}
interface AnnBrutes {
  toc: TocEntry[]
  labels: Record<string, string>
  commentaires?: Record<string, string[]>
  indexEntries: { subject: string; ctRefs: string[] }[]
  navToc: NavGroup[]
  crossRefs?: CrossRefEntry[]
  [cle: string]: unknown
}

async function main() {
  const p = (s = '') => console.log(s)

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // § 7.1 — PRÉ-VOL. Garde d'unicité (§ 10.7), empreinte du corps en PREMIÈRE assertion,
  // segmentation, plages, index, sentinelles, baseline de l'oracle sur le corps INTACT.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const n = await prisma.document.count({ where: { source: SOURCE } })
  if (n !== 1) throw new Error(`§ 10.7 — ${n} fiches ${SOURCE} : il en faut exactement 1`)
  const doc = await prisma.document.findFirstOrThrow({ where: { source: SOURCE } })
  if (doc.id !== DOC_ID) throw new Error(`§ 10.7 — la fiche ${SOURCE} est ${doc.id}, attendu ${DOC_ID}`)
  const body = doc.bodyOriginal
  const annStr = doc.annotationsJson ?? ''
  if (!body || !annStr) throw new Error('bodyOriginal ou annotationsJson vide — fiche inattendue, STOP')
  if (doc.bodyClean !== null)
    throw new Error('bodyClean non NULL — le lecteur n’afficherait pas bodyOriginal, la fusion § 7.4 serait invisible : STOP')

  // PREMIÈRE ASSERTION : l'empreinte du corps de départ. Deux états admis (départ / relance
  // après fusion § 7.4) ; toute TROISIÈME empreinte est un inconnu → STOP, on investigue.
  const md5Depart = md5(body)
  const corpsIntact = md5Depart === MD5_DEPART
  const corpsFusionne = md5Depart === MD5_APRES_FUSION
  if (!corpsIntact && !corpsFusionne)
    throw new Error(
      `corps : md5 ${md5Depart} — ni l'état de départ (${MD5_DEPART}, 504 l.), ni l'état après ` +
        `fusion § 7.4 (${MD5_APRES_FUSION}, 501 l.). Quelqu'un est passé : re-mesurer avant d'écrire ` +
        '(re-passer maj2026-prevol.ts).',
    )

  const ann = JSON.parse(annStr) as AnnBrutes
  if (!parseAnnotations(annStr)) throw new Error('annotationsJson illisible par parseAnnotations — STOP')
  if (!ann.labels || !Array.isArray(ann.indexEntries) || !Array.isArray(ann.toc) || !Array.isArray(ann.navToc))
    throw new Error('annotationsJson sans labels/indexEntries/toc/navToc — structure inattendue, STOP')
  // La réécriture doit être un diff EXACT : le sérialiseur doit restituer l'existant au byte.
  if (JSON.stringify(ann) !== annStr)
    throw new Error('annotationsJson ne survit pas au roundtrip JSON — la réécriture dépasserait le diff voulu, STOP')

  // Les fondations écrites par le pré-vol (jamais retapées — § 7.4/7.5/7.6/8).
  const baseline = JSON.parse(readFileSync(join(DIR, 'maj2026-oracle-baseline.json'), 'utf8')) as {
    md5BodyOriginal: string
    echecs: EchecOracle[]
  }
  if (baseline.md5BodyOriginal !== MD5_DEPART)
    throw new Error(`la baseline de l'oracle (${baseline.md5BodyOriginal}) n'a pas été mesurée sur le corps de départ (${MD5_DEPART}) — STOP`)
  const libelles = JSON.parse(readFileSync(join(DIR, 'maj2026-libelles-titres.json'), 'utf8')) as LibelleTitre[]
  const ajouts = (JSON.parse(readFileSync(join(DIR, 'maj2026-index-ajouts.json'), 'utf8')) as { ajouts: Ajout[] }).ajouts
  // ⚠️ Même doctrine que le champ `fusion` du § 7.4 : la lettre des sujets ajoutés ne se
  // recopie pas de confiance depuis un fichier — elle se PROUVE contre l'oracle indépendant.
  // Les deux ajouts sont des termes de l'index de la cliente : chaque `subject` doit y exister
  // à l'identique (accents compris), sinon la fondation est corrompue.
  {
    const termesCliente = new Set(pairesCliente().map((p) => p.term))
    for (const a of ajouts)
      if (!termesCliente.has(a.subject))
        throw new Error(`§ 7.5 — sujet « ${a.subject} » absent de l'index de la cliente — fondation corrompue, STOP`)
  }
  const reference = (JSON.parse(readFileSync(join(DIR, 'maj2026-base-ranges.json'), 'utf8')) as { plages: Plage[] }).plages

  // L'état de départ passe TOUTES les vérifications § 11 avant qu'on touche à quoi que ce soit.
  const segAvant = verifierSegmentation(body, ann.toc, ann.labels, ann.commentaires)
  comparerPlages(mesurerPlages(segAvant.blocks, ann.toc), reference)
  verifierIndex(ann.indexEntries, ann.labels)
  verifierSentinelles(body)
  const ancresAvant = new Set(segAvant.blocks.filter((b) => b.kind === 'body' && b.anchor).map((b) => (b.kind === 'body' ? b.anchor! : '')))

  // § 8 — l'oracle sur le corps de DÉPART : les échecs bruts == la baseline enregistrée.
  const oracleAvant = jouerOracle(body, ann.toc)
  {
    const { nouveaux, disparus } = comparerALaBaseline(oracleAvant, baseline.echecs)
    if (nouveaux.length || disparus.length)
      throw new Error(
        `§ 8 — l'oracle sur le corps de départ ne rend plus la baseline (nouveaux : ${nouveaux.map(cleEchec).join(' ; ') || '∅'} ; ` +
          `disparus : ${disparus.map(cleEchec).join(' ; ') || '∅'}) — quelque chose a bougé, STOP`,
      )
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // § 7.2 — ADOPTIONDATE (décision § 13.4). L'appui est LU du corps, jamais retapé.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const lignePromulgation = body.split('\n').find((l) => l.startsWith('Donné au Palais National'))
  if (!lignePromulgation || !lignePromulgation.includes('le 9 juillet 2002'))
    throw new Error('§ 7.2 — la formule « Donné au Palais National …, le 9 juillet 2002 » ne se lit pas au corps — STOP')
  const adoptionDejaFaite = doc.adoptionDate !== null
  if (adoptionDejaFaite && doc.adoptionDate!.toISOString().slice(0, 10) !== ADOPTION_ISO)
    throw new Error(`§ 7.2 — adoptionDate vaut déjà ${doc.adoptionDate!.toISOString()} — ne pas écraser sans lire`)
  const ADOPTION = new Date(`${ADOPTION_ISO}T00:00:00Z`)

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // § 7.4 — LES 3 LIBELLÉS DE TITRES, EN LETTRE DU J.O. (fusion des deux lignes du corps).
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const dejaFusionnes = libelles.every((l) => ann.toc.find((t) => t.anchor === l.anchor)?.label === l.fusion)
  const dejaIndexes = ajouts.every((a) => ann.indexEntries.some((e) => e.subject === a.subject))
  if (dejaFusionnes !== dejaIndexes)
    throw new Error(`état MIXTE (fusion § 7.4 : ${dejaFusionnes} ; index § 7.5 : ${dejaIndexes}) — investiguer avant tout`)
  if (dejaFusionnes && !corpsFusionne)
    throw new Error('toc fusionné mais corps à l’empreinte de départ — état incohérent, STOP')
  if (!dejaFusionnes && !corpsIntact)
    throw new Error('corps à l’empreinte post-fusion mais toc non fusionné — état incohérent, STOP')

  let newBody = body
  const lignesDepart = body.split('\n')
  const fusionsFaites: string[] = []
  if (!dejaFusionnes) {
    // Localisation sur le corps INTACT (numéros 1-indexés du corps de départ), exécution de la
    // dernière fusion à la première. Les lignes se COMPARENT au corps — refus si divergence.
    const lignes = [...lignesDepart]
    const plan = libelles.map((l) => {
      const entree = ann.toc.find((t) => t.anchor === l.anchor)
      if (!entree) throw new Error(`§ 7.4 — ${l.anchor} absent du toc`)
      if (entree.label !== l.ligne1)
        throw new Error(`§ 7.4 — ${l.anchor} : label du toc « ${entree.label} » ≠ ligne 1 mesurée « ${l.ligne1} »`)
      const indices = lignes.flatMap((x, i) => (x === l.ligne1 ? [i] : []))
      if (indices.length !== 1)
        throw new Error(`§ 7.4 — ${l.anchor} : ${indices.length} occurrence(s) de la ligne 1 dans le corps, 1 attendue`)
      const i = indices[0]
      if (lignes[i + 1] !== l.ligne2)
        throw new Error(`§ 7.4 — ${l.anchor} : la ligne suivante « ${lignes[i + 1]} » ≠ ligne 2 mesurée « ${l.ligne2} »`)
      // ⚠️ Le champ `fusion` de la fondation n'est PAS une donnée de confiance : le contrôle
      // adverse a montré qu'une coquille injectée dedans (« ORAGNES », même longueur) passait
      // toute la simulation en vert et serait entrée au dispositif d'une loi en production.
      // La fusion se PROUVE : ligne1 + une espace + ligne2, rien d'autre.
      if (l.fusion !== `${l.ligne1} ${l.ligne2}`)
        throw new Error(`§ 7.4 — ${l.anchor} : le champ fusion ne vaut pas « ligne1 + espace + ligne2 » — fondation corrompue, STOP`)
      return { l, entree, i }
    })
    for (const { l, i } of plan)
      fusionsFaites.push(
        `${l.anchor} — lignes ${i + 1}-${i + 2} fusionnées :\n` +
          `      avant l.${i + 1} : « ${l.ligne1} »\n` +
          `      avant l.${i + 2} : « ${l.ligne2} »\n` +
          `      après        : « ${l.fusion} »`,
      )
    for (const { l, entree, i } of [...plan].sort((a, b) => b.i - a.i)) {
      lignes.splice(i, 2, l.fusion)
      entree.label = l.fusion
    }
    newBody = lignes.join('\n')
    if (newBody.length !== body.length)
      throw new Error(`§ 7.4 — la fusion a changé le compte de caractères (${body.length} → ${newBody.length}) : chaque \\n devait devenir UNE espace`)
    // ⚠️ Le corps PRODUIT doit tomber sur l'empreinte déclarée en tête de script — pas
    // seulement le corps de départ. Sans cette ligne, « toute 3ᵉ empreinte → STOP » ne valait
    // qu'au démarrage : le script pouvait fabriquer lui-même un état inédit sans le voir.
    if (corpsIntact && md5(newBody) !== MD5_APRES_FUSION)
      throw new Error(`§ 7.4 — corps fusionné à l'empreinte ${md5(newBody)}, attendu ${MD5_APRES_FUSION} — troisième état interdit, STOP`)
    // navToc : les MÊMES 3 libellés, aux mêmes ancres — et rien d'autre.
    let navChanges = 0
    const marcher = (items: { label: string; anchor: string; children?: unknown[] }[]): void => {
      for (const it of items) {
        const l = libelles.find((x) => x.anchor === it.anchor && it.label === x.ligne1)
        if (l) {
          it.label = l.fusion
          navChanges++
        }
        if (Array.isArray(it.children)) marcher(it.children as typeof items)
      }
    }
    marcher(ann.navToc as unknown as { label: string; anchor: string; children?: unknown[] }[])
    if (navChanges !== libelles.length)
      throw new Error(`§ 7.4 — navToc : ${navChanges} libellé(s) recomplété(s) pour ${libelles.length} attendus`)
  }
  const corpsChange = newBody !== body

  // Segmentation APRÈS — celle qui fait foi pour tout le reste. Gardes § 7.4 : appariement
  // complet, join === corps, orphelines RÉSORBÉES, ensemble d'ancres IDENTIQUE, la 2ᵉ ligne
  // se lit dans chaque libellé affiché.
  const segApres = verifierSegmentation(newBody, ann.toc, ann.labels, ann.commentaires)
  if (segApres.orphelins.length)
    throw new Error(`§ 7.4 — lignes orphelines restantes : ${segApres.orphelins.map((o) => `${o.apresSection} « ${o.texte} »`).join(' ; ')}`)
  const ancresApres = new Set(segApres.blocks.filter((b) => b.kind === 'body' && b.anchor).map((b) => (b.kind === 'body' ? b.anchor! : '')))
  if (ancresApres.size !== ancresAvant.size || [...ancresAvant].some((a) => !ancresApres.has(a)))
    throw new Error('§ 7.4 — l’ensemble des ancres d’articles a changé')
  for (const l of libelles) {
    const sec = segApres.blocks.find((b) => b.kind === 'section' && b.anchor === l.anchor)
    if (!sec || !sec.text.includes(l.ligne2))
      throw new Error(`§ 7.4 — ${l.anchor} : le libellé affiché ne contient pas la 2ᵉ ligne`)
  }
  verifierSentinelles(newBody)

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // § 7.5 — L'INDEX : les 2 sujets, RE-vérifiés au corps puis insérés à leur place de collation.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const avantIndex = ann.indexEntries.map((e) => e.subject)
  const insertions: string[] = []
  if (!dejaIndexes) {
    const textesApres = textesParArticle(newBody, ann.toc)
    for (const a of ajouts) {
      if (ann.indexEntries.some((e) => e.subject === a.subject))
        throw new Error(`§ 7.5 — « ${a.subject} » déjà à l'index — état inattendu, STOP`)
      for (const ref of a.ctRefs) {
        const texte = textesApres.get(Number(ref))
        if (texte === undefined) throw new Error(`§ 7.5 — « ${a.subject} » → ${ref} : article introuvable à la segmentation`)
        if (!radicalPresent(a.radical, plier(texte)))
          throw new Error(`§ 7.5 — « ${a.subject} » → ${ref} : radical « ${a.radical} » absent à frontière de mot (accents pliés) — renvoi NON vérifié, refus`)
      }
    }
    const collator = new Intl.Collator('fr')
    for (const a of [...ajouts].sort((x, y) => collator.compare(x.subject, y.subject))) {
      let pos = ann.indexEntries.length
      for (let i = 0; i < ann.indexEntries.length; i++)
        if (collator.compare(ann.indexEntries[i].subject, a.subject) > 0) {
          pos = i
          break
        }
      ann.indexEntries.splice(pos, 0, { subject: a.subject, ctRefs: [...a.ctRefs] })
      insertions.push(
        `« ${a.subject} » → arts ${a.ctRefs.join(', ')} — position ${pos + 1} (entre « ${ann.indexEntries[pos - 1]?.subject ?? '(début)'} » et « ${ann.indexEntries[pos + 1]?.subject ?? '(fin)'} »)`,
      )
    }
    // Compte en PRODUIT (« 250 + 2 »), ordre relatif des existants inchangé, zéro inversion.
    if (ann.indexEntries.length !== avantIndex.length + ajouts.length)
      throw new Error(`§ 7.5 — index : ${ann.indexEntries.length} sujets pour ${avantIndex.length} + ${ajouts.length} attendus`)
    const restants = ann.indexEntries.filter((e) => !ajouts.some((a) => a.subject === e.subject)).map((e) => e.subject)
    if (JSON.stringify(restants) !== JSON.stringify(avantIndex))
      throw new Error('§ 7.5 — les sujets existants ne sont plus dans leur ordre d’origine')
    for (let i = 0; i < ann.indexEntries.length - 1; i++)
      if (collator.compare(ann.indexEntries[i].subject, ann.indexEntries[i + 1].subject) > 0)
        throw new Error(`§ 7.5 — inversion de collation créée : « ${ann.indexEntries[i].subject} » > « ${ann.indexEntries[i + 1].subject} »`)
  }
  verifierIndex(ann.indexEntries, ann.labels) // § 11.6 — couverture intégrale, 0 renvoi mort, ctRefs en chaînes
  const annChange = !dejaFusionnes || !dejaIndexes

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // § 7.6 — LES 48 PLAGES : assertions bloquantes, jointes par ORDRE et ANCRE, sur l'état final.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const plagesApres = mesurerPlages(segApres.blocks, ann.toc)
  comparerPlages(plagesApres, reference)

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // § 7.8 — LES CROSSREF DES VISAS. Chaque visa verbatim EXACTEMENT une fois, dans le préambule.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const finPreambule = newBody.indexOf('\nTITRE I')
  if (finPreambule < 0) throw new Error('§ 7.8 — « TITRE I » introuvable au corps — segmentation inattendue, STOP')
  for (const v of [VISA_CONSTITUTION, VISA_1979, VISA_1985, VISA_1995, ...VISAS_SANS_CIBLE]) {
    const occurrences = newBody.split(v).length - 1
    if (occurrences !== 1) throw new Error(`§ 7.8 — visa présent ${occurrences} fois (attendu 1) : « ${v.slice(0, 60)}… »`)
    if (newBody.indexOf(v) > finPreambule) throw new Error(`§ 7.8 — visa hors du préambule : « ${v.slice(0, 60)}… »`)
  }
  type Cible = { id: string; type: string; number: string | null; titleFr: string; bodyOriginal: string }
  const cibles = new Map<string, Cible>()
  for (const r of RENVOIS) {
    const lignes = await prisma.document.findMany({
      where: { source: r.sourceCible },
      select: { id: true, type: true, number: true, titleFr: true, bodyOriginal: true },
    })
    if (lignes.length !== 1) throw new Error(`§ 7.8 — résolution ${r.sourceCible} : ${lignes.length} ligne(s), il en faut exactement 1`)
    const c = lignes[0]
    if (c.id !== r.idCibleAttendu)
      throw new Error(`§ 7.8 — résolution ${r.sourceCible} : id ${c.id}, attendu ${r.idCibleAttendu} (relevé du 27 août)`)
    for (const preuve of r.preuvesCible)
      if (!c.bodyOriginal.includes(preuve))
        throw new Error(`§ 7.8 — cible ${r.sourceCible} : la preuve d'identité « ${preuve.slice(0, 60)} » ne se lit pas à son corps — NE PAS poser le renvoi`)
    // Une note qui cite l'intitulé de la cible doit le citer À LA LETTRE (apostrophes comprises).
    if (r.note.includes('intitulé développé') && !r.note.includes(c.titleFr))
      throw new Error(`§ 7.8 — la note vers ${r.sourceCible} cite un intitulé qui n'est pas, à la lettre, le titre de la fiche — la relire`)
    cibles.set(r.sourceCible, c)
  }
  // L'identification de 1979 (maj2026-identification-loi-1979.md), RE-vérifiée au corps en base :
  // la loi visée comporte les articles 9 et 17 (5ᵉ visa) — seule II-B-1 les a, II-A s'arrête à 3.
  {
    const iiA = await prisma.document.findMany({ where: { source: 'CC_VANDAL_II-A' }, select: { id: true, bodyOriginal: true } })
    if (iiA.length !== 1) throw new Error(`§ 7.8 — résolution CC_VANDAL_II-A : ${iiA.length} ligne(s), il en faut exactement 1`)
    const tetes = (corps: string) => {
      const s = new Set<string>()
      for (const m of corps.matchAll(/^Article\s+(\d+)/gm)) s.add(m[1])
      return s
    }
    const tetesA = tetes(iiA[0].bodyOriginal)
    const tetesB1 = tetes(cibles.get('CC_VANDAL_II-B-1')!.bodyOriginal)
    if (!tetesB1.has('9') || !tetesB1.has('17'))
      throw new Error('§ 7.8 — CC_VANDAL_II-B-1 : articles 9 et 17 introuvables — l’identification du dossier ne tient plus, STOP')
    if (tetesA.has('9') || tetesA.has('17'))
      throw new Error('§ 7.8 — CC_VANDAL_II-A comporte un article 9 ou 17 — le discriminant du dossier ne discrimine plus, STOP')
    if (!VISA_1985.includes('les articles 9 et 17')) throw new Error('§ 7.8 — le 5ᵉ visa ne cite plus les articles 9 et 17 — incohérence interne')
  }
  // L'ENTRANT du décret sûretés — photographié avant, comparé après (§ 11.9).
  const entrantsAvant = await prisma.crossRef.findMany({
    where: { toId: doc.id },
    orderBy: { id: 'asc' },
    select: { id: true, fromId: true, kind: true, toLabel: true, note: true, position: true },
  })
  const photoEntrants = JSON.stringify(entrantsAvant)
  // Dédoublonnage par toId et positions à la suite de l'existant.
  const sortantsExistants = await prisma.crossRef.findMany({ where: { fromId: doc.id }, select: { id: true, toId: true, kind: true } })
  const aCreer = RENVOIS.filter((r) => !sortantsExistants.some((e) => e.toId === r.idCibleAttendu))
  const dejaPoses = RENVOIS.filter((r) => sortantsExistants.some((e) => e.toId === r.idCibleAttendu))
  const posMax = await prisma.crossRef.aggregate({ where: { fromId: doc.id }, _max: { position: true } })
  const positionDepart = (posMax._max.position ?? -1) + 1

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // § 7.3 — LE FAC-SIMILÉ. REFUSÉ sans --facsimile (§ 13.3 OUVERTE) ; sinon, pièce vérifiée à
  // l'octet et mention de lacune OBLIGATOIRE dans la même écriture (interdit n° 19).
  // ══════════════════════════════════════════════════════════════════════════════════════════
  let facsimile: { buf: Buffer; pages: number; dejaAttache: boolean; noteDejaFaite: boolean } | null = null
  if (FACSIMILE) {
    let stat
    try {
      stat = statSync(PDF)
    } catch {
      throw new Error(`§ 7.3 — fac-similé introuvable : ${PDF}`)
    }
    void stat
    const buf = readFileSync(PDF)
    if (!buf.subarray(0, 5).toString('latin1').startsWith('%PDF-')) throw new Error(`§ 7.3 — ${PDF} n'est pas un PDF (en-tête absent)`)
    if (buf.length !== PDF_OCTETS) throw new Error(`§ 7.3 — fac-similé : ${buf.length} octets, attendu ${PDF_OCTETS}`)
    const pdfMd5 = md5(buf)
    if (pdfMd5 !== PDF_MD5)
      throw new Error(
        `§ 7.3 — fac-similé : md5 ${pdfMd5}, attendu ${PDF_MD5}. Ce n'est pas le fichier vérifié à ` +
          "l'octet le 27 août : la mention de lacune écrite par ce script ne le décrirait pas.",
      )
    const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
    if (pages !== PDF_PAGES) throw new Error(`§ 7.3 — fac-similé : ${pages} pages comptées, attendu ${PDF_PAGES}`)
    if (doc.sourcePdfUrl && !isBlobUrl(doc.sourcePdfUrl))
      throw new Error(`§ 7.3 — sourcePdfUrl vaut « ${doc.sourcePdfUrl} », qui n'est pas une URL Blob : ne pas l'écraser sans la lire`)
    if (ann.toc[0]?.anchor !== 'sec-1')
      throw new Error(`§ 7.3 — toc[0] a l'ancre « ${ann.toc[0]?.anchor} », attendu sec-1 — le canal de la note n'est plus celui mesuré`)
    const crossRefsAvant: CrossRefEntry[] = Array.isArray(ann.crossRefs) ? ann.crossRefs : []
    const autreSec1 = crossRefsAvant.find((c) => c.anchor === 'sec-1' && !(c.note ?? '').includes(SENTINELLE_NOTE))
    if (autreSec1)
      throw new Error('§ 7.3 — une entrée crossRefs ancrée sec-1 existe déjà et n’est pas la mention de lacune — la lire avant d’en ajouter une seconde')
    const noteDejaFaite = crossRefsAvant.some((c) => c.anchor === 'sec-1' && (c.note ?? '').includes(SENTINELLE_NOTE))
    if (!noteDejaFaite) ann.crossRefs = [...crossRefsAvant, { anchor: 'sec-1', articles: [], note: NOTE_LACUNE } satisfies CrossRefEntry]
    facsimile = { buf, pages, dejaAttache: isBlobUrl(doc.sourcePdfUrl), noteDejaFaite }
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // § 8 — L'ORACLE, REJOUÉ APRÈS le lot par le MÊME module : AUCUNE régression.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const rejeu = jouerOracle(newBody, ann.toc)
  const { nouveaux, disparus } = comparerALaBaseline(rejeu, baseline.echecs)
  if (nouveaux.length)
    throw new Error(`§ 8 — oracle : échec(s) NOUVEAU(X) — régression bloquante : ${nouveaux.map(cleEchec).join(' ; ')}`)
  if (disparus.length)
    throw new Error(`§ 8 — oracle : échec(s) DISPARU(S) alors qu'aucune réparation n'est attendue dans ce lot : ${disparus.map(cleEchec).join(' ; ')} — investiguer`)

  // Le JSON produit se RELIT, et n'a bougé que là où le lot l'a voulu.
  const newAnnStr = JSON.stringify(ann)
  if (!parseAnnotations(newAnnStr)) throw new Error('le JSON d’annotations produit n’est pas relisible par parseAnnotations')

  const adoptionAEcrire = !adoptionDejaFaite
  const facsimileAEcrire = facsimile !== null && (!facsimile.dejaAttache || !facsimile.noteDejaFaite)
  const annAEcrire = newAnnStr !== annStr
  const docUpdate = adoptionAEcrire || corpsChange || annAEcrire || facsimileAEcrire

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // RAPPORT CHIFFRÉ — avant toute écriture (§ 10.3)
  // ══════════════════════════════════════════════════════════════════════════════════════════
  p('══════════════════════════════════════════════════════════════════════════════════')
  p('  MISE À JOUR — Loi du 10 juillet 2002 sur les coopératives d’épargne et de crédit')
  p(`  ${doc.id} · source ${SOURCE} · statut ${doc.status} · drapeaux : --facsimile=${FACSIMILE} --apply=${APPLY}`)
  p('══════════════════════════════════════════════════════════════════════════════════')
  p()
  p('CORPS')
  p(`  avant : ${lignesDepart.length} lignes · ${body.length} caractères · md5 ${md5Depart}${corpsFusionne ? ' (relance : fusion § 7.4 déjà appliquée)' : ' (état de départ du 27 août)'}`)
  p(`  après : ${newBody.split('\n').length} lignes · ${newBody.length} caractères · md5 ${md5(newBody)}`)
  p(`  ancres d'articles : ${ancresApres.size} — ensemble IDENTIQUE à l'avant · toc ${ann.toc.length}/${ann.toc.length} apparié · join === corps · 0 orpheline`)
  p()
  p('─── § 7.1 — PRÉ-VOL ───────────────────────────────────────────────────────────────')
  p(`  garde d'unicité : 1 fiche ${SOURCE} · bodyClean NULL (le lecteur affiche bodyOriginal) ✓`)
  p(`  segmentation du rendu rejouée : ${ann.toc.length} en-têtes appariés dans l'ordre · ${ancresAvant.size} articles ancrés`)
  p(`  labels ↔ blocs ancrés : ensembles égaux (${Object.keys(ann.labels).length} clés) · commentaires ${Object.keys(ann.commentaires ?? {}).length} clé(s), toutes atteintes`)
  p(`  plages de référence : ${reference.length}/${reference.length} conformes (jointure ordre/ancre) · sentinelles § 9.6 intactes`)
  p(`  oracle § 8 sur le corps de départ : ${oracleAvant.totalPaires} renvois (${oracleAvant.totalTermes} sujets cliente), échecs bruts == baseline (${baseline.echecs.length}) ✓`)
  p()
  p('─── § 7.2 — ADOPTIONDATE (décision § 13.4 de Me Vaval, 27 août 2026) ──────────────')
  p(`  ${doc.adoptionDate?.toISOString().slice(0, 10) ?? 'NULL'} → ${ADOPTION_ISO}${adoptionDejaFaite ? '  (déjà faite — rien à écrire)' : ''}`)
  p(`  règle appliquée : ${REGLE_13_4}`)
  p(`  appui, LU du corps : « ${lignePromulgation} »`)
  p(`  publicationDate ${doc.publicationDate?.toISOString().slice(0, 10)} INCHANGÉE · effectiveDate reste NULL (l'article 146 raisonne en délais relatifs, § 5)`)
  p()
  p('─── § 7.4 — LES 3 LIBELLÉS DE TITRES (sec-4, sec-27, sec-43), EN LETTRE DU J.O. ───')
  if (dejaFusionnes) p('  déjà fusionnés (relance) — aucune ligne du corps ne change')
  else {
    p('  delta du corps, ligne par ligne (numéros du corps AVANT lot, 1-indexés) :')
    for (const f of fusionsFaites) p(`    ${f}`)
    p(`  corps : ${lignesDepart.length} → ${newBody.split('\n').length} lignes · ${newBody.length} c. (compte inchangé : chaque \\n → une espace)`)
    p(`  toc + navToc : ${libelles.length} libellés recomplétés chacun (mêmes ancres) · lignes orphelines : ${segAvant.orphelins.length} → ${segApres.orphelins.length}`)
    p('  lettre du corps CONSERVÉE (capitales non accentuées, « CONTROLE » sans accent) — jamais la version normalisée de la cliente (§ 4.1)')
  }
  p()
  p('─── § 7.5 — L’INDEX : + « Épargne », + « Supervision » ────────────────────────────')
  if (dejaIndexes) p('  déjà à l’index (relance) — rien à écrire')
  else {
    for (const i of insertions) p(`  + ${i}`)
    p(`  compte : ${avantIndex.length} + ${ajouts.length} = ${ann.indexEntries.length} sujets (compté en produit, jamais en dur)`)
    p('  chaque renvoi RE-vérifié au corps à l’exécution (radical à frontière de mot, accents pliés) ✓')
    p('  ordre relatif des sujets existants inchangé · zéro inversion sous Intl.Collator(\'fr\')')
  }
  p(`  couverture : intégrale (chaque article de labels cité) · 0 renvoi mort · ctRefs en chaînes ✓`)
  p('  l’index cliente (68 sujets, 98,7 %) n’est NI versé NI fusionné — il reste l’oracle (§ 12.3)')
  p()
  p('─── § 7.6 — LES 48 PLAGES D’ARTICLES, ASSERTIONS BLOQUANTES ───────────────────────')
  p(`  ${plagesApres.length}/${reference.length} conformes sur l'état final — jointure par ORDRE et ANCRE, jamais par libellé`)
  p('  (l’affichage public « Articles N à M » n’est PAS posé : option d’éditeur, § 13.6, non tranchée)')
  p()
  p('─── § 7.8 — LES CROSSREF DES VISAS (lot ferme, kind CITE, source EDITORIAL) ───────')
  p(`  sortants existants : ${sortantsExistants.length} · entrants : ${entrantsAvant.length} (photographiés — le renvoi sûretés doit ressortir INTACT)`)
  for (const r of RENVOIS) {
    const c = cibles.get(r.sourceCible)!
    const etat = dejaPoses.includes(r) ? 'DÉJÀ POSÉ — rien à écrire' : 'À CRÉER'
    p(`  ■ ${r.sourceCible} → ${c.id} — ${etat}`)
    p(`    visa  : ${r.visa}`)
    p(`    cible : « ${c.titleFr.slice(0, 96)} »`)
    p(`    note  : ${r.note}`)
  }
  p('  CONSIGNÉS SANS LIGNE (§ 13.7 — sans cible au corpus ; le choix appartient à Me Vaval) :')
  for (const v of VISAS_SANS_CIBLE) p(`    · ${v.slice(0, 100)}${v.length > 100 ? '…' : ''}`)
  p('  · rien depuis l’UCREF 2017 (elle ne cite pas la loi — mesuré, § 12.11)')
  p('  · renvois ENTRANTS (19 corps citants) : consignés sans écriture — maj2026-renvois-entrants-proposes.json (§ 13.9)')
  p()
  p('─── § 7.3 — LE FAC-SIMILÉ DU MONITEUR N° 54 ───────────────────────────────────────')
  if (!FACSIMILE) {
    p('  ⛔ REFUSÉ SANS LE DRAPEAU --facsimile : la question § 13.3 est OUVERTE (17 des 32 pages')
    p('     manquent). La pièce est prête et vérifiée à l’octet (dossier complet :')
    p('     scripts/data/cec/maj2026-facsimile-dossier.md) ; sourcePdfUrl et l’appareil de la')
    p('     fiche ne bougent pas. Pour l’inclure : relancer avec --facsimile (décision de Me Vaval).')
  } else {
    p(`  pièce : ${PDF}`)
    p(`  ${facsimile!.buf.length} octets · ${facsimile!.pages} pages · md5 ${PDF_MD5} — vérifiée à l'octet (planches Tardieu 644-658)`)
    p(`  destination : Blob PRIVÉ « lam-pdfs » · ${CHEMIN_BLOB} · lecture par /api/doc/${DOC_ID}/pdf`)
    p(`  sourcePdfUrl aujourd'hui : ${doc.sourcePdfUrl ?? 'NULL'}${facsimile!.dejaAttache ? ' (déjà attaché — chemin déterministe, même objet)' : ''}`)
    p(`  MENTION DE LACUNE (obligatoire, MÊME transaction — interdit n° 19)${facsimile!.noteDejaFaite ? ' — DÉJÀ en place, non dupliquée' : ''} :`)
    p(`  « ${NOTE_LACUNE} »`)
  }
  p()
  p('─── § 8 — L’ORACLE DE L’INDEX CLIENTE, REJOUÉ APRÈS LE LOT ────────────────────────')
  p(`  ${rejeu.totalPaires} renvois rejoués par le MÊME module que la baseline · échecs bruts == baseline (${rejeu.echecs.length})`)
  p('  aucun échec nouveau, aucun disparu — AUCUNE régression ✓')
  p('  hors oracle, dit et non compensé (§ 8) : l’article 151 (absent de l’index cliente) ;')
  p('  la lettre des articles 45-54 et 65-146 (mesure du dossier fac-similé — les arts 44 et 64 sont en frontière de page) (pages absentes du scan) — 77 écarts présumés pro-base non arbitrés.')
  p()
  p('CHAMPS NON TOUCHÉS (assertés à la relecture) : titleFr/En/Ht, number, publicationDate, effectiveDate.')
  p()

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // § 10 — ÉCRITURE (ou simulation)
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
  const fichierEtat = join(DIR, `maj2026-etat-avant-maj-loi-cec-2002-${horodatage}.json`)
  const aAuditer = (docUpdate ? 1 : 0) + aCreer.length

  if (!docUpdate && aCreer.length === 0) {
    p('ÉTAT POST-LOT DÉTECTÉ — adoptionDate posée, libellés fusionnés, index complété, renvois posés')
    p(`${FACSIMILE ? 'et fac-similé en place ' : ''}: RIEN À ÉCRIRE. Les invariants § 11 ont tous été revérifiés ci-dessus.`)
    return
  }

  if (!APPLY) {
    accessSync(DIR, constants.W_OK)
    p('CE QUI SERAIT ÉCRIT (--apply, lancé par Me Vaval, et par elle seule — § 10.2)')
    p(`  état antérieur : ${fichierEtat}`)
    if (FACSIMILE && facsimileAEcrire) p(`  Blob (AVANT la transaction) : ${CHEMIN_BLOB} (${(facsimile!.buf.length / 1024).toFixed(0)} Ko, privé)`)
    p(
      `  Document ${doc.id} : ${[
        adoptionAEcrire ? `adoptionDate ${ADOPTION_ISO}` : null,
        corpsChange ? `bodyOriginal (${newBody.split('\n').length} l., md5 ${md5(newBody)})` : null,
        annAEcrire ? `annotationsJson (${newAnnStr.length} c., md5 ${md5(newAnnStr)})` : null,
        facsimileAEcrire ? 'sourcePdfUrl' : null,
        'searchText',
      ]
        .filter(Boolean)
        .join(', ')}`,
    )
    p(`  CrossRef : ${aCreer.length} création(s)${dejaPoses.length ? ` · ${dejaPoses.length} déjà posé(s)` : ''} — positions ${aCreer.map((_, i) => positionDepart + i).join(', ') || '∅'}`)
    p(`  AuditLog : ${docUpdate ? '1 DOC_PUBLISHED + ' : ''}${aCreer.length} CROSSREF_ADDED — RECOMPTÉS après la transaction (audit() avale ses erreurs)`)
    p('  reindexDocument : 1 document, HORS transaction')
    p()
    p('SIMULATION — rien n’a été écrit. --apply est réservé à Me Vaval (§ 10.2).')
    return
  }

  // L'état antérieur AVANT la transaction : si ce fichier ne s'écrit pas, rien n'a bougé (§ 10.6).
  writeFileSync(
    fichierEtat,
    JSON.stringify(
      {
        _lisezMoi:
          'État de la fiche LOI_CEC_2002 AVANT scripts/maj-loi-cec-2002.ts --apply. ' +
          'Empreintes + contenus complets ; les CrossRef entrants photographiés doivent ressortir intacts.',
        ecritLe: new Date().toISOString(),
        drapeaux: { facsimile: FACSIMILE },
        id: doc.id,
        source: SOURCE,
        adoptionDate: doc.adoptionDate,
        sourcePdfUrl: doc.sourcePdfUrl,
        md5BodyOriginal: md5Depart,
        md5AnnotationsJson: md5(annStr),
        bodyOriginal: body,
        annotationsJson: annStr,
        crossRefsSortants: sortantsExistants,
        crossRefsEntrants: entrantsAvant,
      },
      null,
      1,
    ) + '\n',
    'utf8',
  )
  p(`état antérieur sauvegardé : ${fichierEtat}`)

  // § 7.3 — le téléversement est une requête réseau : HORS transaction, jeton EXPLICITE (piège OIDC).
  let urlFacsimile: string | null = null
  if (FACSIMILE && facsimileAEcrire) {
    const env = Object.fromEntries(
      readFileSync(join(process.cwd(), '.env'), 'utf8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
        }),
    ) as Record<string, string>
    if (env.BLOB_READ_WRITE_TOKEN) process.env.BLOB_READ_WRITE_TOKEN = env.BLOB_READ_WRITE_TOKEN
    if (!process.env.BLOB_READ_WRITE_TOKEN)
      throw new Error('BLOB_READ_WRITE_TOKEN absent de .env — sans jeton explicite, le SDK retombe sur le jeton OIDC et le put échoue')
    p(`téléversement de ${(facsimile!.buf.length / 1024).toFixed(0)} Ko vers ${CHEMIN_BLOB}…`)
    urlFacsimile = await uploadToBlob(CHEMIN_BLOB, facsimile!.buf, 'application/pdf', { multipart: true })
    if (!isBlobUrl(urlFacsimile)) throw new Error(`l'URL rendue par le Blob n'en est pas une : ${urlFacsimile}`)
  }

  const searchText = buildSearchText({ ...doc, bodyOriginal: newBody, annotationsJson: newAnnStr } as never)
  const auditAvant = await prisma.auditLog.count({ where: { targetType: 'Document', targetId: doc.id } })
  const xrefTotalAvant = await prisma.crossRef.count()

  await prisma.$transaction(
    async (tx) => {
      if (docUpdate)
        await tx.document.update({
          where: { id: doc.id },
          data: {
            adoptionDate: ADOPTION,
            bodyOriginal: newBody,
            annotationsJson: newAnnStr,
            searchText,
            ...(urlFacsimile ? { sourcePdfUrl: urlFacsimile } : {}),
          },
        })
      let pos = positionDepart
      for (const r of aCreer) {
        const c = cibles.get(r.sourceCible)!
        await tx.crossRef.create({
          data: {
            fromId: doc.id,
            toId: c.id,
            toType: c.type,
            toNumber: c.number,
            toLabel: c.titleFr,
            kind: 'CITE',
            note: r.note,
            position: pos++,
            source: 'EDITORIAL',
          },
        })
        await audit(
          {
            action: 'CROSSREF_ADDED',
            targetType: 'Document',
            targetId: doc.id,
            meta: {
              motif:
                `Visa du préambule de la loi CEC 2002 matérialisé en CrossRef CITE vers ${r.sourceCible} ` +
                '(§ 7.8 de la feuille de route du 27 août 2026 ; résolution par source ; identification ' +
                'de la loi de 1979 : scripts/data/cec/maj2026-identification-loi-1979.md).',
              visa: r.visa,
              toId: c.id,
              sourceCible: r.sourceCible,
              md5BodyOriginal: md5(newBody),
            },
          },
          tx,
        )
      }
      if (docUpdate)
        await audit(
          {
            action: 'DOC_PUBLISHED',
            targetType: 'Document',
            targetId: doc.id,
            meta: {
              op: 'maj-loi-cec-2002',
              feuilleDeRoute: 'Lam — Prompt loi CEC 2002 (sommaire et index), 27 août 2026, § 7',
              decisionAdoptionDate: `adoptionDate = ${ADOPTION_ISO} en application de la décision § 13.4 : ${REGLE_13_4}`,
              // Des EMPREINTES, jamais le corps entier (§ 10.6).
              avant: {
                md5Body: md5Depart,
                md5Annotations: md5(annStr),
                lignes: lignesDepart.length,
                sujetsIndex: avantIndex.length,
                adoptionDate: doc.adoptionDate?.toISOString() ?? null,
                sourcePdfUrl: doc.sourcePdfUrl,
              },
              apres: {
                md5Body: md5(newBody),
                md5Annotations: md5(newAnnStr),
                lignes: newBody.split('\n').length,
                sujetsIndex: ann.indexEntries.length,
                adoptionDate: ADOPTION_ISO,
                sourcePdfUrl: urlFacsimile ?? doc.sourcePdfUrl,
              },
              fusions: libelles,
              indexAjouts: ajouts.map((a) => ({ subject: a.subject, ctRefs: a.ctRefs })),
              facsimile: FACSIMILE
                ? { octets: facsimile!.buf.length, pages: facsimile!.pages, md5: PDF_MD5, chemin: CHEMIN_BLOB, lacune: 'pages 12-13 et 16-30 manquantes — mention à l’appareil (crossRefs/sec-1)' }
                : 'non demandé (--facsimile absent, § 13.3 ouverte)',
              etatAnterieur: fichierEtat,
            },
          },
          tx,
        )
    },
    { timeout: 120_000, maxWait: 30_000 },
  )

  // ⚠️ audit() avale ses erreurs : on RECOMPTE après la transaction (§ 10.4).
  const auditApres = await prisma.auditLog.count({ where: { targetType: 'Document', targetId: doc.id } })
  if (auditApres < auditAvant + aAuditer)
    throw new Error(`écriture NON ENTIÈREMENT AUDITÉE : AuditLog ${auditAvant} → ${auditApres} (attendu ≥ ${auditAvant + aAuditer}) — défaut à corriger`)
  if (auditApres > auditAvant + aAuditer)
    console.warn(`  ⚠ AuditLog ${auditAvant} → ${auditApres} : plus d'entrées que ce lot n'en écrit (écriture concurrente ?) — à vérifier au journal`)

  // RELECTURE : contenus écrits, champs intouchés, entrants INTACTS, renvois posés, plages.
  const relu = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } })
  if (md5(relu.bodyOriginal) !== md5(newBody)) throw new Error('relecture : le corps n’a pas l’empreinte attendue')
  if (md5(relu.annotationsJson ?? '') !== md5(newAnnStr)) throw new Error('relecture : annotationsJson n’a pas l’empreinte attendue')
  if (relu.adoptionDate?.toISOString().slice(0, 10) !== ADOPTION_ISO) throw new Error('relecture : adoptionDate n’a pas la valeur attendue')
  if (relu.publicationDate?.toISOString() !== doc.publicationDate?.toISOString()) throw new Error('relecture : publicationDate a bougé')
  if (relu.titleFr !== doc.titleFr || relu.titleEn !== doc.titleEn || relu.titleHt !== doc.titleHt || relu.number !== doc.number)
    throw new Error('relecture : un titre ou le number a bougé — ce lot ne devait pas y toucher')
  if (relu.effectiveDate !== null) throw new Error('relecture : effectiveDate n’est plus NULL — elle ne devait pas bouger (§ 5)')
  if (FACSIMILE && facsimileAEcrire && relu.sourcePdfUrl !== urlFacsimile)
    throw new Error('relecture : sourcePdfUrl ne vaut pas l’URL téléversée')
  if (!FACSIMILE && (relu.sourcePdfUrl ?? null) !== (doc.sourcePdfUrl ?? null))
    throw new Error('relecture : sourcePdfUrl a bougé sans --facsimile — il ne devait pas')
  const entrantsApres = await prisma.crossRef.findMany({
    where: { toId: doc.id },
    orderBy: { id: 'asc' },
    select: { id: true, fromId: true, kind: true, toLabel: true, note: true, position: true },
  })
  if (JSON.stringify(entrantsApres) !== photoEntrants)
    throw new Error('relecture : les CrossRef ENTRANTS ont changé pendant le lot — le renvoi sûretés devait rester intact')
  for (const r of RENVOIS) {
    const lus = await prisma.crossRef.findMany({ where: { fromId: doc.id, toId: r.idCibleAttendu } })
    if (lus.length !== 1) throw new Error(`relecture : ${lus.length} renvoi(s) vers ${r.sourceCible}, attendu 1`)
    if (lus[0].kind !== 'CITE') throw new Error(`relecture : kind ${lus[0].kind} vers ${r.sourceCible}, attendu CITE`)
  }
  const xrefTotalApres = await prisma.crossRef.count()
  if (xrefTotalApres !== xrefTotalAvant + aCreer.length)
    throw new Error(`CrossRef recomptées : ${xrefTotalApres} ≠ ${xrefTotalAvant} + ${aCreer.length} (la table vit — vérifier qui a écrit)`)
  // La segmentation de l'état ÉCRIT repasse toutes les gardes, plages comprises.
  const annRelu = JSON.parse(relu.annotationsJson!) as AnnBrutes
  const segRelu = verifierSegmentation(relu.bodyOriginal, annRelu.toc, annRelu.labels, annRelu.commentaires)
  comparerPlages(mesurerPlages(segRelu.blocks, annRelu.toc), reference)
  verifierIndex(annRelu.indexEntries, annRelu.labels)
  verifierSentinelles(relu.bodyOriginal)
  if (FACSIMILE) {
    const annParse = parseAnnotations(relu.annotationsJson)
    if (!annParse?.crossRefs?.some((c) => c.anchor === 'sec-1' && (c.note ?? '').includes(SENTINELLE_NOTE)))
      throw new Error('relecture : la mention de lacune ne se relit pas — le fac-similé ne doit pas rester attaché sans elle')
  }

  // ⚠️ HORS transaction : reindexDocument (singleton Prisma + vidage du cache de recherche).
  await reindexDocument(doc.id)

  p()
  p(`✓ Fiche mise à jour : ${doc.id}`)
  p(
    `  adoptionDate ${ADOPTION_ISO} · corps ${newBody.split('\n').length} l. (md5 ${md5(newBody)}) · index ${ann.indexEntries.length} sujets · ` +
      `${aCreer.length} CrossRef créé(s) · entrants intacts${FACSIMILE && facsimileAEcrire ? ' · fac-similé attaché avec sa mention de lacune' : ''}`,
  )
  p(`  journal d'audit ${auditAvant} → ${auditApres} (+${auditApres - auditAvant}, attendu ${aAuditer} — recompté, audit() avale ses erreurs)`)
  p('  réindexé, cache de recherche vidé (hors transaction)')
}

main()
  .catch((e) => {
    console.error('\nÉCHEC :', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
