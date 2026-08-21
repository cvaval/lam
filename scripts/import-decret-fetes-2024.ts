/**
 * Décret du 11 décembre 2024 déterminant les Fêtes Légales (Le Moniteur, 179ᵉ année,
 * Spécial n° 66-A, mercredi 11 décembre 2024) — Conseil Présidentiel de Transition.
 *
 * Quatre articles : l'objet, la liste des ONZE fêtes légales, le chômage de
 * l'Administration Publique, du Commerce, de l'Industrie et des Écoles, et une clause
 * d'abrogation GÉNÉRALE. Format « lecteur annoté » (Code civil, Code du travail, loi
 * UCREF, décret IMF) : sommaire latéral, index, renvois vers les textes visés.
 *
 * CE QUI N'EST PAS VERSÉ — et pourquoi. Le fac-similé compte 111 blocs ; 57 vont au
 * corps (75 lignes, les deux tableaux de signatures étant dépliés) et 54 sont écartés,
 * chacun avec son motif dans `source.json` :
 *   · l'avis de la Direction Générale des Presses Nationales sur le tarif de
 *     l'abonnement annuel 2025 et ses DEUX coupons (blocs 62 à 102) — publicité de
 *     l'éditeur du journal, sans rapport avec le décret ;
 *   · l'ours de l'imprimeur (blocs 103 à 110 : achevé d'imprimer, ISSN, dépôt légal,
 *     adresse, tirage) — mention obligatoire du FASCICULE, pas du texte qu'il porte ;
 *   · les TROIS titres courants de page (blocs 29, 59, 61). Celui de la page 2 tombe
 *     entre le cinquième et le sixième visa : le laisser couperait le préambule en deux ;
 *   · deux paragraphes vides.
 * Tout le reste est versé, manchette et sommaire du numéro compris — c'est le choix
 * qu'avait fait l'arrêté du 30 avril 2018 sur la protection des données personnelles.
 *
 * L'ORACLE, en trois chaînons — tous ancrés au FICHIER, aucun ne relit sa propre source
 * (la leçon du Décret sûretés : une vérification circulaire est aveugle) :
 *   · le .docx est OUVERT et HACHÉ à chaque exécution ; son sha256 doit tomber sur celui
 *     que `source.json` déclare. Imprimer une empreinte qu'on ne calcule pas revient à
 *     certifier une provenance qu'on n'a jamais contrôlée ;
 *   · le corps ENTIER — les soixante-quinze lignes, non plus les seules fêtes, visas et
 *     têtes d'article — est confronté à une empreinte par ligne, gelée ci-dessous. La
 *     relecture adverse du 20 août 2026 avait falsifié quatre lignes hors couverture
 *     (visas de 2005 et de 2024, considérants, signataires) : les quatre passaient.
 *     Les empreintes ont été calculées sur un `source.json` REFAIT du .docx par
 *     parse_fetes.py, puis diffé au fichier du dépôt (20 août 2026 : identique) ;
 *   · les onze fêtes restent RETRANSCRITES À LA MAIN (FETES). Une empreinte dit qu'une
 *     ligne a bougé, elle ne dit jamais que le texte imprimé est bien celui-là.
 *
 * Invariants vérifiés AVANT toute écriture — chacun refuse l'écriture :
 *   · le fac-similé est présent, de la bonne taille, et son sha256 est celui déclaré ;
 *   · les 75 lignes du corps répondent, une à une, aux empreintes gelées ici ;
 *   · le registre du fac-similé est complet : versés + écartés = 111 blocs ;
 *   · les quatre articles reçoivent leur ancre, dans l'ordre, et rien d'autre ;
 *   · les ONZE fêtes figurent au caractère près dans le corps, avec la mention
 *     « à partir de midi » sur le seul Lundi Gras (une occurrence, pas deux) ;
 *   · la segmentation ne perd aucune ligne, et le menu latéral n'a pas d'ancre morte ;
 *   · l'index ne renvoie qu'à des articles existants, le commentaire éditorial de
 *     l'article 4 tombe sur un bloc d'article, les renvois du lecteur sur une section ;
 *   · chaque texte visé est résolu par sa DÉSIGNATION (`source`, ou type+numéro+catégorie)
 *     et jamais par son titre, et la ligne de visa qui le justifie est dans le corps ;
 *   · le décret abrogé est antérieur au décret abrogeant (garde chronologique) ;
 *   · le fascicule scanné du même Moniteur existe ET porte un PDF servable : sans lui,
 *     la fiche n'offrirait aucun chemin vers le Journal officiel ;
 *   · le thème existe.
 *
 * Idempotent : la clé est `source`. Relancé, il met à jour le document, ajoute le thème
 * s'il manque et REFAIT ses renvois sortants (tous lui appartiennent).
 *
 *     npx tsx scripts/import-decret-fetes-2024.ts            (simulation — n'écrit rien)
 *     npx tsx scripts/import-decret-fetes-2024.ts --apply    (écrit)
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { isBlobUrl } from '../src/lib/storage/blob'
import { segmentAnnotated, type IndexEntry, type NavGroup, type TocEntry, type CrossRefEntry } from '../src/lib/legislation/annotated'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const APPLY = process.argv.includes('--apply')

const DIR = 'scripts/data/decret-fetes-2024'
const SOURCE = 'DECRET_FETES_LEGALES_2024'
const TITRE = 'Décret du 11 décembre 2024 déterminant les Fêtes Légales'
/** Désignation du TEXTE, comme les décrets du 25 novembre 2020 et du 30 avril 2023.
 *  Pas « LM2024-SP66A » : ce numéro est déjà celui du fascicule scanné du même Moniteur
 *  (MONITEUR_PDF_2024) et deux fiches LEGISLATION de même numéro rendraient toute
 *  résolution par désignation ambiguë. Le numéro du journal reste cherchable par
 *  `moniteurRef` et par les mots-clés. */
const NUMERO = 'Décret du 11 décembre 2024'
const MONITEUR = 'Le Moniteur · Spécial n° 66-A · Mercredi 11 Décembre 2024'
const THEME = 'droit-du-travail'
/** Fascicule scanné du même numéro, déjà à la plateforme — le lecteur y trouve le PDF. */
const FASCICULE = { type: 'LEGISLATION', number: 'LM2024-SP66A', source: 'MONITEUR_PDF_2024' }

/**
 * OÙ EST LE FAC-SIMILÉ. Le .docx n'est pas au dépôt (13 ko de binaire) : on le cherche,
 * dans l'ordre, au chemin donné en environnement, à côté de `source.json`, puis là où il
 * a été reçu. Introuvable, le script s'arrête : sans le fichier, l'empreinte imprimée ne
 * serait qu'une chaîne recopiée de `source.json`, et la provenance ne serait pas contrôlée.
 */
const FACSIMILE_CHEMINS = (fichier: string) =>
  [process.env.FACSIMILE, `${DIR}/${fichier}`, `${process.env.HOME}/Downloads/${fichier}`].filter(Boolean) as string[]

/**
 * EMPREINTE DU CORPS — les 75 lignes, une à une (sha256 tronqué à 8 hexadécimaux, dans
 * l'ordre du fac-similé) et l'ensemble. Gelées le 20 août 2026 sur un `source.json` refait
 * du .docx (parse_fetes.py) et diffé au fichier du dépôt : identique. Toute ligne du corps
 * qui bouge — un visa, un considérant, un signataire — fait échouer l'import en la nommant.
 */
const LIGNES_CORPS = 75
const CORPS_SHA256 = '4ae671dbe689452e8935cafa183fba8daffd5e7700a048dbdb496bdba78da7b5'
const CORPS_EMPREINTES = (
  'f623efce 49dc0efe 51181572 cd7a84ee 3ff9174f 192344b4 4ffb8b79 267f468e 381f2e22 a93214c5 ' +
  '4153bd10 4ffb8b79 267f468e 3edb28ac 9efb444e c1472e25 b101334f 01dd4b5d a01929a0 ba66130a ' +
  '1e7fad2c c8be16b5 e708fb37 b6945d77 819ded7e 23e02a76 81e86384 a6fa5563 370849b5 82cb1bf4 ' +
  '318e8c22 f1037f7d 7ed832f7 f8a93f52 9fbc6301 1ea8a34c fc251354 8ddecdf5 e9256f1c f7f53a46 ' +
  '94999a9a 47a84971 dc47729e 094c3014 e5343db8 7f3b958c 84bbf38f 9fe9b0e9 61451550 e062c4ce ' +
  'eeaab68b 1f0e2ca8 2b6d8336 0bc6411f 14f6fb69 509528d4 670dac40 0cc0d7c5 70f7ad34 df52a2f7 ' +
  '47431809 f553a8c5 829326bb 88574bb3 62da41c7 d70efa86 fd1c19df 81b48841 994f1811 dd18a0f9 ' +
  'e2a28ed4 75eaabf2 4ea21555 a4826937 82b48631'
).split(' ')

const sha256 = (x: Buffer | string) => createHash('sha256').update(x).digest('hex')

/**
 * LES ONZE FÊTES LÉGALES — transcription indépendante du fac-similé (page 2, article 2).
 * `fin` reproduit la ponctuation imprimée : les neuf premières s'achèvent par « ; », la
 * dixième par « ; et », la onzième par « . ». `sujet` est le libellé d'index (éditorial).
 */
const FETES: { rang: number; designation: string; fin: string; sujet: string }[] = [
  { rang: 1, designation: 'le Lundi Gras, à partir de midi', fin: ' ;', sujet: 'Lundi Gras (chômé à partir de midi seulement)' },
  { rang: 2, designation: 'le Mardi Gras', fin: ' ;', sujet: 'Mardi Gras' },
  { rang: 3, designation: 'le Vendredi Saint', fin: ' ;', sujet: 'Vendredi Saint' },
  { rang: 4, designation: 'la Fête Dieu', fin: ' ;', sujet: 'Fête Dieu' },
  { rang: 5, designation: 'le 14 Août, Jour du Bois-Caïman et de l’Union pour la Liberté', fin: ' ;', sujet: 'Bois-Caïman — Jour du Bois-Caïman et de l’Union pour la Liberté (14 août)' },
  { rang: 6, designation: 'le 15 Août, Fête de l’Assomption', fin: ' ;', sujet: 'Assomption (15 août)' },
  { rang: 7, designation: 'le 20 Septembre, Jour de DESSALINES', fin: ' ;', sujet: 'Dessalines — Jour de Dessalines (20 septembre)' },
  { rang: 8, designation: 'le 17 Octobre, Commémoration de la Mort de DESSALINES', fin: ' ;', sujet: 'Dessalines — Commémoration de la Mort de Dessalines (17 octobre)' },
  { rang: 9, designation: 'le 1er Novembre, la Toussaint', fin: ' ;', sujet: 'Toussaint (1er novembre)' },
  { rang: 10, designation: 'le 2 Novembre, Fête des Morts', fin: ' ; et', sujet: 'Morts — Fête des Morts (2 novembre)' },
  { rang: 11, designation: 'le 25 Décembre, Jour de Noël', fin: '.', sujet: 'Noël — Jour de Noël (25 décembre)' },
]
/** Mention propre à UNE seule fête : le contrôle exige qu'elle n'apparaisse qu'une fois. */
const MIDI = 'à partir de midi'

/** Sommaire du dispositif (menu latéral). Libellés éditoriaux : le décret ne porte
 *  aucun intitulé d'article, et « Article 1er / 2 / 3 / 4 » ne renseigne personne. */
const SOMMAIRE: { anchor: string; label: string }[] = [
  { anchor: 'art-1', label: 'Article 1er — Objet : la détermination des Fêtes Légales' },
  { anchor: 'art-2', label: 'Article 2 — Les onze Fêtes Légales' },
  { anchor: 'art-3', label: 'Article 3 — Chômage de l’Administration, du Commerce, de l’Industrie et des Écoles' },
  { anchor: 'art-4', label: 'Article 4 — Abrogation des dispositions contraires, publication et exécution' },
]

/**
 * TEXTES VISÉS AU PRÉAMBULE ET DÉJÀ AU CORPUS.
 *
 * ⚠ Résolus par `source`, JAMAIS par le titre — la leçon de l'arrêté du 30 avril 2018 :
 * « signature électronique » ramenait cinq documents, dont deux fiches d'Index du
 * Moniteur qui ne portent que le titre, et le renvoi avait atterri sur l'une d'elles.
 * ⚠ Et SANS filtrer sur le type : le Code du travail annoté est de type DOCTRINE, pas
 * LEGISLATION — un `where: { source, type: 'LEGISLATION' }` ne le trouverait pas.
 * `visa` est la ligne du préambule que le renvoi sert : si elle disparaît du corps, la
 * table est périmée et le script s'arrête.
 */
const VISAS_LIES = [
  { visa: 'Vu la Constitution de la République ;', source: 'CONSTITUTION_1987', label: 'Constitution de 1987' },
  { visa: 'Vu le Décret du 24 février 1984 actualisant le Code du Travail ;', source: 'CODE_TRAVAIL_ANNOTE', label: 'Code du travail — Décret du 24 février 1984' },
]

/**
 * LE DÉCRET ABROGÉ. Visé au préambule, puis emporté par la clause générale de l'article 4.
 *
 * Il n'est pas au corpus comme TEXTE : la plateforme n'en a que la fiche d'Index du
 * Moniteur. Celle-ci se résout par une DÉSIGNATION — type + numéro de journal + catégorie —
 * et non par son titre : deux fiches portent le numéro LM1989-47A (l'autre est un extrait
 * du registre des marques de fabrique), c'est la catégorie qui les sépare.
 */
const ABROGE = {
  visa: 'Vu le Décret du 23 mai 1989 déterminant, en dehors des fêtes nationales, de façon plus précise les fêtes légales ;',
  designation: { type: 'INDEX', number: 'LM1989-47A', category: 'DECRET' },
  label: 'Décret du 23 mai 1989 déterminant, en dehors des Fêtes Nationales, de façon plus précise les Fêtes Légales',
  note:
    'Emporté par la clause d’abrogation générale de l’article 4 du présent décret : le décret ' +
    'du 23 mai 1989, visé au préambule, déterminait les mêmes fêtes légales et lui est donc ' +
    'contraire. L’article 4 ne le nomme pas — la qualification est éditoriale.',
  /**
   * LA MÊME RÉSERVE, LÀ OÙ LE LECTEUR VOIT L'AFFIRMATION. Le panneau « Citations &
   * renvois » de la fiche publique n'affiche que « ABROGE → libellé » : la `note`
   * ci-dessus ne sort jamais de /admin/document/[id]. Sans cette mention au libellé,
   * la fiche affirmerait d'elle-même ce que l'article 4 n'écrit pas.
   */
  labelRenvoi:
    'Décret du 23 mai 1989 déterminant, en dehors des Fêtes Nationales, de façon plus précise les ' +
    'Fêtes Légales — emporté par l’abrogation générale de l’article 4 (rattachement éditorial)',
  /** Et dans le LECTEUR, replié sous l'article 4 lui-même (clé `sec-1|art-4`). */
  commentaire:
    'Abrogation GÉNÉRALE : l’article 4 n’énumère aucun texte — il abroge « toutes Lois ou ' +
    'dispositions de Lois […] qui lui sont contraires ». La rédaction en déduit que le Décret du ' +
    '23 mai 1989, visé au préambule et déterminant les mêmes fêtes légales, est emporté ; le ' +
    'présent décret ne le nomme pas, et cette qualification est une lecture éditoriale, non une ' +
    'mention du texte.',
}
/** Fragment de l'article 4 dont dépend la qualification ci-dessus : contrôlé dans le corps. */
const CLAUSE_ABROGATION = 'abroge toutes Lois ou dispositions de Lois'

/** Le fac-similé porte DEUX tableaux de signatures — un par page (2 et 3). */
const TABLEAUX = 2

interface Source {
  facsimile: { fichier: string; sha256: string; octets: number; blocs: number; tableaux: number }
  corps: string[]
  ecartes: { i: number; kind: string; motif: string; texte: string }[]
  signatures: string[]
  fetes: { rang: number; ligne: string; designation: string }[]
}

async function main() {
  const src = JSON.parse(readFileSync(`${DIR}/source.json`, 'utf8')) as Source
  const lignes = src.corps
  const corps = lignes.join('\n')

  // ── 0. Provenance : le fac-similé est OUVERT et haché, pas seulement cité ─────
  // `source.json` déclare une empreinte ; tant qu'on ne la recalcule pas sur le fichier,
  // l'imprimer ne prouve rien — c'est le défaut relevé le 20 août 2026.
  const chemin = FACSIMILE_CHEMINS(src.facsimile.fichier).find((p) => existsSync(p))
  if (!chemin)
    throw new Error(
      `fac-similé introuvable (${src.facsimile.fichier}) — cherché : ` +
        `${FACSIMILE_CHEMINS(src.facsimile.fichier).join(' · ')} — provenance invérifiable, annulé ` +
        `(donner le chemin dans FACSIMILE=… si le fichier est ailleurs)`,
    )
  const octets = readFileSync(chemin)
  if (octets.length !== src.facsimile.octets)
    throw new Error(`fac-similé ${chemin} : ${octets.length} octets, ${src.facsimile.octets} déclarés — annulé`)
  const empreinteFichier = sha256(octets)
  if (empreinteFichier !== src.facsimile.sha256)
    throw new Error(
      `sha256 du fac-similé : ${empreinteFichier} calculé ≠ ${src.facsimile.sha256} déclaré — ` +
        `ce n’est pas le fichier dont ce versement a été tiré — annulé`,
    )

  // ── 0 bis. L'ORACLE PORTE SUR TOUT LE CORPS, ligne à ligne ────────────────────
  // Les garde-fous d'origine ne couvraient que les fêtes, trois visas, « DÉCRÈTE », les
  // quatre têtes d'article et un fragment de l'article 4 : quatre lignes falsifiées hors
  // de ce périmètre passaient. Les empreintes gelées couvrent les 75.
  if (CORPS_EMPREINTES.length !== LIGNES_CORPS)
    throw new Error(`table d’empreintes : ${CORPS_EMPREINTES.length} entrées pour ${LIGNES_CORPS} lignes — annulé`)
  if (lignes.length !== LIGNES_CORPS)
    throw new Error(`corps : ${lignes.length} lignes, ${LIGNES_CORPS} attendues — annulé`)
  const divergentes = lignes.flatMap((l, i) => (sha256(l).slice(0, 8) === CORPS_EMPREINTES[i] ? [] : [i]))
  if (divergentes.length)
    throw new Error(
      `corps altéré : ${divergentes.length} ligne(s) hors empreinte (${divergentes.map((i) => i + 1).join(', ')}) — ` +
        `première divergence ligne ${divergentes[0] + 1}/${LIGNES_CORPS} : « ${lignes[divergentes[0]].slice(0, 90)} » — annulé`,
    )
  const empreinteCorps = sha256(corps)
  if (empreinteCorps !== CORPS_SHA256)
    throw new Error(`empreinte du corps : ${empreinteCorps} ≠ ${CORPS_SHA256} — annulé`)

  // ── 1. Registre du fac-similé : rien ne se perd en silence ────────────────────
  // Les deux TABLEAUX de signatures comptent pour un bloc chacun mais donnent vingt
  // lignes : on compte des BLOCS, pas des lignes, sinon le total ne tombe jamais juste.
  if (src.facsimile.tableaux !== TABLEAUX)
    throw new Error(`${src.facsimile.tableaux} tableau(x) dans le fac-similé, ${TABLEAUX} attendus — annulé`)
  const blocsVerses = lignes.length - src.signatures.length + TABLEAUX
  if (blocsVerses + src.ecartes.length !== src.facsimile.blocs)
    throw new Error(
      `registre incomplet : ${blocsVerses} blocs versés + ${src.ecartes.length} écartés ` +
        `≠ ${src.facsimile.blocs} blocs du fac-similé — annulé`,
    )
  if (src.ecartes.some((e) => !e.motif.trim())) throw new Error('un bloc est écarté sans motif — annulé')

  // ── 2. Articles ───────────────────────────────────────────────────────────────
  const ancres = lignes.map(articleAnchorFromHeading).filter(Boolean) as string[]
  if (ancres.join(',') !== 'art-1,art-2,art-3,art-4')
    throw new Error(`articles reconnus : ${ancres.join(', ') || 'aucun'} — attendu art-1..art-4 — annulé`)

  // ── 3. Les onze fêtes, au caractère près ──────────────────────────────────────
  const jeu = new Set(lignes)
  const absentes = FETES.filter((f) => !jeu.has(`${f.rang}°) ${f.designation}${f.fin}`))
  if (absentes.length)
    throw new Error(`fêtes introuvables dans le corps : ${absentes.map((f) => f.rang + '°) ' + f.designation).join(' · ')} — annulé`)
  if (FETES.length !== 11) throw new Error(`${FETES.length} fêtes déclarées, onze attendues — annulé`)
  // Confrontation à l'extraction : deux transcriptions indépendantes doivent coïncider.
  if (src.fetes.length !== 11) throw new Error(`l’extraction a relevé ${src.fetes.length} fêtes, onze attendues — annulé`)
  const ecart = FETES.filter((f, i) => src.fetes[i].rang !== f.rang || src.fetes[i].designation !== f.designation)
  if (ecart.length)
    throw new Error(`transcription ≠ extraction sur ${ecart.length} fête(s) : ${ecart.map((f) => f.rang + '°').join(', ')} — annulé`)
  // « à partir de midi » : le Lundi Gras et lui seul.
  const occMidi = lignes.filter((l) => l.includes(MIDI))
  if (occMidi.length !== 1 || !occMidi[0].startsWith('1°)'))
    throw new Error(`« ${MIDI} » : ${occMidi.length} occurrence(s), attendue sur le seul Lundi Gras — annulé`)
  if (!corps.includes(CLAUSE_ABROGATION)) throw new Error('la clause d’abrogation de l’article 4 est introuvable — annulé')

  // ── 4. Sommaire, table et index ───────────────────────────────────────────────
  const LIGNE_DISPOSITIF = 'DÉCRÈTE'
  if (!lignes.includes(LIGNE_DISPOSITIF)) throw new Error('la ligne « DÉCRÈTE » est introuvable dans le corps — annulé')
  if (lignes.filter((l) => l === LIGNE_DISPOSITIF).length !== 1)
    throw new Error('la ligne « DÉCRÈTE » apparaît plusieurs fois — la table s’ancrerait au hasard — annulé')
  const toc: TocEntry[] = [{ level: 1, label: LIGNE_DISPOSITIF, anchor: 'sec-1', kind: 'code' }]
  const navToc: NavGroup[] = [{ label: 'Dispositif', anchor: 'sec-1', children: SOMMAIRE.map((s) => ({ label: s.label, anchor: s.anchor })) }]
  // Onze entrées, toutes vers l'article 2 : c'est là que le décret énumère les fêtes.
  const indexEntries: IndexEntry[] = FETES.map((f) => ({ subject: f.sujet, ctRefs: [2] }))
  // « Article 1er » et non « Article 1 » : labelFromAnchor ne connaît pas l'ordinal.
  const labels: Record<string, string> = { 'art-1': 'Article 1er' }
  /**
   * COMMENTAIRE ÉDITORIAL sous l'article 4 — la réserve rendue au lecteur, à l'endroit
   * même où le décret abroge. Clé `sec-K|art-N` (Code civil) : sans jurisprudence, le
   * pliable s'intitule « Annotations » et non « Jurisprudence » (déduit par la fiche).
   */
  const commentaires: Record<string, string[]> = { 'sec-1|art-4': [ABROGE.commentaire] }

  // ── 5. Renvois du LECTEUR : textes visés + fac-similé — résolus par désignation ─
  const docsVises: { label: string; id: string }[] = []
  for (const v of VISAS_LIES) {
    if (!lignes.includes(v.visa)) throw new Error(`visa absent du corps : « ${v.visa} » — table périmée — annulé`)
    const cibles = await prisma.document.findMany({ where: { source: v.source }, select: { id: true, type: true, titleFr: true } })
    if (cibles.length !== 1)
      throw new Error(`source ${v.source} : ${cibles.length} document(s), un seul attendu — annulé`)
    docsVises.push({ label: v.label, id: cibles[0].id })
  }
  /**
   * LE FAC-SIMILÉ, EXIGÉ. Le fascicule scanné du même Moniteur est déjà à la plateforme :
   * sa fiche EST le PDF (source MONITEUR_PDF_… + URL Blob → lecteur PDF). Sans lui, la
   * fiche du décret n'offrirait aucun chemin vers le Journal officiel — c'est pourquoi
   * son absence, ou un PDF non servable, arrête l'import au lieu de passer en silence.
   */
  const fascicules = await prisma.document.findMany({ where: FASCICULE, select: { id: true, titleFr: true, sourcePdfUrl: true } })
  if (fascicules.length !== 1)
    throw new Error(
      `fascicule ${FASCICULE.number} : ${fascicules.length} fiche(s), une seule attendue — ` +
        `le lecteur n’aurait aucun chemin vers le fac-similé — annulé`,
    )
  const fascicule = fascicules[0]
  if (!isBlobUrl(fascicule.sourcePdfUrl))
    throw new Error(
      `fascicule ${FASCICULE.number} : PDF non servable (${fascicule.sourcePdfUrl ?? 'aucune URL'}) — ` +
        `seules les URL Blob passent par /api/doc/[id]/pdf — annulé`,
    )
  const crossRefs: CrossRefEntry[] = [
    {
      anchor: 'sec-1',
      articles: [],
      note:
        'Décret donné au Palais National, à Port-au-Prince, le 11 décembre 2024, An 221ᵉ de ' +
        'l’Indépendance, par le Conseil Présidentiel de Transition, et publié au Journal officiel ' +
        '« Le Moniteur », 179ᵉ année, Spécial n° 66-A du mercredi 11 décembre 2024. Textes visés au ' +
        'préambule, puis le fascicule du Journal officiel :',
      docs: [...docsVises, { label: `Fac-similé au Journal officiel — Spécial n° 66-A (PDF)`, id: fascicule.id }],
    },
  ]
  // AnnotatedText n'affiche un renvoi que sur un EN-TÊTE DE SECTION (kind === 'section') :
  // une ancre d'article ne rendrait rien, et deux entrées de même ancre s'écraseraient
  // dans la Map — dans les deux cas le renvoi disparaîtrait sans un mot.
  const xrefMort = crossRefs.map((c) => c.anchor).filter((a) => !toc.some((e) => e.anchor === a))
  if (xrefMort.length) throw new Error(`crossRefs : ancre(s) de section inconnue(s) — ${xrefMort.join(', ')} — annulé`)
  if (new Set(crossRefs.map((c) => c.anchor)).size !== crossRefs.length)
    throw new Error('crossRefs : deux renvois sur la même ancre — le lecteur n’en afficherait qu’un — annulé')

  // ── 6. Le décret de 1989 : cible unique + garde chronologique ─────────────────
  if (!lignes.includes(ABROGE.visa)) throw new Error(`visa du décret de 1989 absent du corps — annulé`)
  const candidats1989 = await prisma.document.findMany({
    where: ABROGE.designation,
    select: { id: true, titleFr: true, publicationDate: true },
  })
  if (candidats1989.length !== 1)
    throw new Error(`décret de 1989 : ${candidats1989.length} fiche(s) pour ${ABROGE.designation.number}/${ABROGE.designation.category}, une seule attendue — annulé`)
  const abroge = candidats1989[0]
  const PUBLICATION = new Date('2024-12-11T00:00:00Z')
  if (!abroge.publicationDate || abroge.publicationDate >= PUBLICATION)
    throw new Error(`garde chronologique : la cible (${abroge.publicationDate?.toISOString().slice(0, 10) ?? 'sans date'}) n’est pas antérieure au décret abrogeant — annulé`)

  // ── 7. Rendu : segmentation, ancres, menu ─────────────────────────────────────
  const blocs = segmentAnnotated(corps, toc)
  const rendues = new Set(blocs.flatMap((b) => (b.anchor ? [b.anchor] : [])))
  const menuMort = navToc.flatMap((g) => [g.anchor, ...g.children.map((c) => c.anchor)]).filter((a) => !rendues.has(a))
  if (menuMort.length) throw new Error(`menu latéral : ancre(s) sans cible ${menuMort.join(', ')} — annulé`)
  const labelMort = Object.keys(labels).filter((a) => !rendues.has(a))
  if (labelMort.length) throw new Error(`libellés d’article sans bloc : ${labelMort.join(', ')} — annulé`)
  const indexMort = [...new Set(indexEntries.flatMap((e) => e.ctRefs))].filter((n) => !rendues.has(`art-${n}`))
  if (indexMort.length) throw new Error(`index : renvois morts vers art-${indexMort.join(', art-')} — annulé`)
  // Un commentaire ne s'affiche que sur un bloc d'ARTICLE, par sa clé `sec-K|art-N` : posé
  // sur une clé qu'aucun bloc ne porte, il n'existe pour personne (leçon des circulaires BRH).
  const clesBlocs = new Set(blocs.flatMap((b) => (b.kind === 'body' && b.jurisKey ? [b.jurisKey] : [])))
  const commMort = Object.keys(commentaires).filter((k) => !clesBlocs.has(k))
  if (commMort.length) throw new Error(`commentaire éditorial sans bloc d’article : ${commMort.join(', ')} — annulé`)
  const lignesRendues = blocs.reduce((n, b) => n + b.text.split('\n').filter((l) => l.trim()).length, 0)
  if (lignesRendues !== lignes.length)
    throw new Error(`segmentation : ${lignesRendues} lignes rendues pour ${lignes.length} — du texte se perd — annulé`)

  // ── 8. Thème ──────────────────────────────────────────────────────────────────
  const theme = await prisma.theme.findFirst({ where: { slug: THEME }, select: { id: true, labelFr: true, labelEn: true, labelHt: true } })
  if (!theme) throw new Error(`thème ${THEME} introuvable — annulé`)

  // ── 9. Idempotence ────────────────────────────────────────────────────────────
  const existants = await prisma.document.findMany({ where: { source: SOURCE }, select: { id: true } })
  if (existants.length > 1) throw new Error(`${existants.length} documents portent déjà la source ${SOURCE} — annulé`)
  const existant = existants[0] ?? null

  const annotations = {
    title: TITRE,
    annotationAuthor: '',
    navToc,
    toc,
    connexes: [],
    jurisprudence: {},
    indexEntries,
    crossRefs,
    labels,
    connexe: {},
    commentaires,
  }
  const annotationsJson = JSON.stringify(annotations)
  const themeLabels = [theme.labelFr, theme.labelEn, theme.labelHt].filter(Boolean).join(' ')

  const donnees = {
    type: 'LEGISLATION' as const,
    status: 'EN_VIGUEUR' as const,
    titleFr: TITRE,
    titleEn: 'Decree of 11 December 2024 determining the legal holidays',
    titleHt: 'Dekrè 11 desanm 2024 ki detèmine Fèt Legal yo',
    bodyOriginal: corps,
    number: NUMERO,
    moniteurRef: MONITEUR,
    publicationDate: PUBLICATION,
    adoptionDate: PUBLICATION, // « Donné au Palais National … le 11 décembre 2024 »
    // effectiveDate laissée NULLE : le décret ne fixe aucune date d'entrée en vigueur.
    source: SOURCE,
    /**
     * LE CHEMIN VERS LE JOURNAL OFFICIEL. Sans ce champ, la fiche n'affiche aucun bouton
     * « source » et le fac-similé — que la plateforme détient pourtant — reste hors de
     * portée du lecteur. On pointe le MÊME objet Blob que la fiche du fascicule scanné :
     * c'est le fascicule de ce décret, aucun code ne supprime jamais un blob, deux fiches
     * peuvent donc le partager sans le dupliquer (le décret IMF, lui, avait dû téléverser
     * le sien — _attach-imf-pdf.ts). Le PDF reste servi par la route authentifiée
     * /api/doc/[id]/pdf, sous le contrôle d'accès du corpus (§03, canSeeSourcePdf).
     */
    sourcePdfUrl: fascicule.sourcePdfUrl,
    // matiere : même usage que « bancaire » (IMF, UCREF), « minier », « constitutionnel » —
    // court, sans accent. editionType reste NULL : c'est un attribut d'ÉDITION du journal,
    // que /admin/moniteur lit pour ranger les fascicules ; aucun texte curé n'en porte
    // (mesuré sur l'arrêté PDP, le décret IMF, la loi UCREF, le décret minier).
    matiere: 'travail',
    keywords:
      'fêtes légales; jours fériés; jours chômés; chômage; Lundi Gras; Mardi Gras; Vendredi Saint; Fête Dieu; ' +
      'Bois-Caïman; Assomption; Dessalines; Toussaint; Fête des Morts; Noël; Administration Publique; Commerce; ' +
      'Industrie; Écoles; Conseil Présidentiel de Transition; décret du 23 mai 1989; LM2024-SP66A; Spécial n° 66-A',
    /**
     * LE RÉSUMÉ DIT D'ABORD CE QUE LE TEXTE ÉCRIT, PUIS CE QUE LA RÉDACTION EN LIT — et il
     * le dit dans les TROIS LANGUES, parce que c'est là que le lecteur lit l'affirmation.
     * L'article 4 est une abrogation GÉNÉRALE : il n'énumère aucun texte. Écrire « ce qui
     * emporte le décret du 23 mai 1989 » sans plus, c'était donner une conclusion de
     * juriste — probablement juste, le décret de 1989 étant visé au préambule et de même
     * objet — pour une mention du Journal officiel. La réserve ne vivait que dans la note
     * d'un CrossRef, que seule /admin/document/[id] ouvre : elle revient ici, ainsi que
     * sous l'article 4 du lecteur (ABROGE.commentaire) et au libellé du renvoi public.
     */
    summaryFr:
      'Décret pris par le Conseil Présidentiel de Transition et publié le jour même de sa signature ' +
      '(Le Moniteur, 179ᵉ année, Spécial n° 66-A du mercredi 11 décembre 2024). Quatre articles : l’article 1er ' +
      'en fixe l’objet ; l’article 2 énumère les ONZE fêtes légales — Lundi Gras (à partir de midi seulement), ' +
      'Mardi Gras, Vendredi Saint, Fête Dieu, 14 août (Bois-Caïman), 15 août (Assomption), 20 septembre ' +
      '(Dessalines), 17 octobre (mort de Dessalines), 1er novembre (Toussaint), 2 novembre (Fête des Morts) et ' +
      '25 décembre (Noël) ; l’article 3 fait chômer l’Administration Publique, le Commerce, l’Industrie et les ' +
      'Écoles à l’occasion des fêtes nationales et légales ; l’article 4 abroge « toutes Lois ou dispositions de ' +
      'Lois […] qui lui sont contraires » — une abrogation GÉNÉRALE, qui ne nomme aucun texte. La rédaction en ' +
      'déduit que le décret du 23 mai 1989 sur les mêmes fêtes légales, visé au préambule, est emporté : c’est ' +
      'une lecture éditoriale, non une mention du décret.',
    summaryEn:
      'Decree issued by the Transitional Presidential Council and published on the day it was signed ' +
      '(Le Moniteur, 179th year, Special No. 66-A, Wednesday 11 December 2024). Four articles: article 1 states ' +
      'its purpose; article 2 lists the ELEVEN legal holidays — Lundi Gras (from noon only), Mardi Gras, Good ' +
      'Friday, Corpus Christi, 14 August (Bois-Caïman), 15 August (Assumption), 20 September (Dessalines), ' +
      '17 October (death of Dessalines), 1 November (All Saints), 2 November (All Souls) and 25 December ' +
      '(Christmas); article 3 closes the Public Administration, Commerce, Industry and Schools on national and ' +
      'legal holidays; article 4 repeals “all Laws or provisions of Laws […] contrary to it” — a GENERAL repeal, ' +
      'naming no text. In our editors’ reading, the Decree of 23 May 1989 on the same legal holidays, cited in ' +
      'the preamble, is thereby repealed: that is an editorial assessment, not something the decree says.',
    summaryHt:
      'Dekrè Konsèy Prezidansyèl Tranzisyon an pran, ki pibliye menm jou li siyen an (Le Moniteur, 179zyèm ane, ' +
      'Espesyal No 66-A, mèkredi 11 desanm 2024). Kat atik : atik 1ye a fikse objè a ; atik 2 a bay ONZ fèt legal ' +
      'yo — Lendi Gra (sèlman apati midi), Madi Gra, Vandredi Sen, Fèt Dye, 14 out (Bwa Kayiman), 15 out ' +
      '(Asonpsyon), 20 septanm (Desalin), 17 oktòb (lanmò Desalin), 1ye novanm (Latousen), 2 novanm (Fèt Lèmò) ak ' +
      '25 desanm (Nwèl) ; atik 3 la fè Administrasyon Piblik la, Komès la, Endistri a ak Lekòl yo chome pou fèt ' +
      'nasyonal ak fèt legal yo ; atik 4 la abwoje « tout Lwa oswa dispozisyon Lwa […] ki kontrè avè l » — se yon ' +
      'abwogasyon JENERAL, li pa nonmen okenn tèks. Dapre lekti redaksyon an, Dekrè 23 me 1989 la sou menm fèt ' +
      'legal yo, ki vize nan preyanbil la, tonbe anba kloz sa a : se yon apresyasyon editoryal, se pa dekrè a ki di sa.',
    annotationsJson,
    themeLabels,
  }

  // ── Rapport de simulation ─────────────────────────────────────────────────────
  const motifs = new Map<string, number>()
  for (const e of src.ecartes) motifs.set(e.motif, (motifs.get(e.motif) ?? 0) + 1)
  console.log(`« ${TITRE} »`)
  console.log(`  fac-similé : ${chemin}`)
  console.log(`    ${octets.length} octets lus · sha256 ${empreinteFichier.slice(0, 24)}… — CALCULÉ sur le fichier, conforme au déclaré ✓`)
  console.log(`  oracle du corps : ${lignes.length}/${LIGNES_CORPS} lignes conformes à leur empreinte · ensemble ${empreinteCorps.slice(0, 24)}… ✓`)
  console.log(`  registre : ${src.facsimile.blocs} blocs = ${blocsVerses} versés + ${src.ecartes.length} écartés`)
  for (const [m, n] of [...motifs].sort((a, b) => b[1] - a[1])) console.log(`    écartés ×${String(n).padStart(2)} — ${m}`)
  console.log(`  corps : ${lignes.length} lignes · ${corps.length} caractères · ${src.signatures.length} signataires`)
  console.log(`  articles : ${ancres.length} (${ancres.join(', ')}) · segmentation ${lignesRendues}/${lignes.length} lignes, 0 perdue`)
  console.log(`  fêtes : ${FETES.length}/11 retrouvées au caractère près · « ${MIDI} » : 1 occurrence (${occMidi[0].slice(0, 34)}…)`)
  FETES.forEach((f) => console.log(`    ${String(f.rang).padStart(2)}°) ${f.designation}${f.fin}`))
  console.log(`  sommaire : ${navToc[0].children.length} articles · table : ${toc.length} entrée (« ${LIGNE_DISPOSITIF} ») · 0 ancre morte`)
  console.log(`  index : ${indexEntries.length} entrées, toutes vers l’article 2 · 0 renvoi mort`)
  console.log(`  renvois du lecteur (crossRefs, sous « ${LIGNE_DISPOSITIF} ») : ${crossRefs[0].docs!.length}`)
  crossRefs[0].docs!.forEach((d) => console.log(`    → ${d.label} [${d.id}]`))
  console.log(`  abrogation : ${abroge.titleFr.slice(0, 76)}`)
  console.log(`    fiche ${ABROGE.designation.number} / ${ABROGE.designation.category} [${abroge.id}] · publiée le ${abroge.publicationDate!.toISOString().slice(0, 10)} — antérieure ✓`)
  console.log(`    réserve rendue visible : résumé FR/EN/HT · commentaire sous l’article 4 · libellé du renvoi public`)
  console.log(`  chemin vers le Journal officiel :`)
  console.log(`    fascicule ${FASCICULE.number} [${fascicule.id}] · PDF Blob ✓`)
  console.log(`    sourcePdfUrl du décret ← ${String(donnees.sourcePdfUrl).slice(0, 72)}…`)
  console.log(`  thème : ${THEME} (${theme.labelFr})`)
  console.log(`  document : ${existant ? `mise à jour de ${existant.id}` : 'création'} · n° « ${NUMERO} » · ${MONITEUR}`)

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }

  const doc = await prisma.$transaction(
    async (tx) => {
      const d = existant
        ? await tx.document.update({ where: { id: existant.id }, data: donnees })
        : await tx.document.create({ data: { ...donnees, originalLang: 'fr' } })

      if (!(await tx.documentTheme.findFirst({ where: { documentId: d.id, themeId: theme.id } })))
        await tx.documentTheme.create({ data: { documentId: d.id, themeId: theme.id, isPrimary: true, assignedBy: 'IMPORT' } })

      // Renvois sortants : tous nous appartiennent → on les refait à chaque passage.
      await tx.crossRef.deleteMany({ where: { fromId: d.id } })
      let position = 0
      for (const v of docsVises)
        await tx.crossRef.create({
          data: { fromId: d.id, toId: v.id, kind: 'CITE', source: 'EDITORIAL', toLabel: v.label, note: 'Texte visé au préambule', position: position++ },
        })
      // `toLabel` PORTE LA RÉSERVE : le panneau « Citations & renvois » de la fiche publique
      // n'affiche que « ABROGE → libellé » — la note reste à l'administration.
      await tx.crossRef.create({
        data: { fromId: d.id, toId: abroge.id, kind: 'ABROGE', source: 'EDITORIAL', toLabel: ABROGE.labelRenvoi, note: ABROGE.note, position: position++ },
      })
      await tx.crossRef.create({
        data: { fromId: d.id, toId: fascicule.id, kind: 'VOIR', source: 'EDITORIAL', toLabel: `Fac-similé — ${FASCICULE.number}`, note: 'Fascicule scanné du Journal officiel', position: position++ },
      })

      await tx.document.update({ where: { id: d.id }, data: { searchText: buildSearchText({ ...d, themeLabels } as never) } })
      await audit(
        {
          action: 'DOC_PUBLISHED',
          targetType: 'Document',
          targetId: d.id,
          meta: {
            source: SOURCE,
            mode: existant ? 'mise à jour' : 'création',
            motif: 'Décret du 11 décembre 2024 déterminant les Fêtes Légales (Le Moniteur, Spécial n° 66-A)',
            articles: ancres.length,
            fetes: FETES.length,
            index: indexEntries.length,
            renvois: position,
            abroge: abroge.id,
            // Provenance journalisée : l'empreinte du FICHIER, recalculée à cette exécution,
            // et celle du corps versé. Le journal dit de quel fac-similé ce texte est tiré.
            facsimileSha256: empreinteFichier,
            corpsSha256: empreinteCorps,
            fascicule: fascicule.id,
          },
        },
        tx,
      )
      return d
    },
    { timeout: 120_000, maxWait: 30_000 },
  )

  await reindexDocument(doc.id)
  console.log(`\n✓ Versé : ${doc.id} — thème ${THEME}, ${docsVises.length + 2} renvois, fac-similé joint, indexé, journalisé.`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
