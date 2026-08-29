/**
 * B · LES 25 TEXTES DES MARCHÉS PUBLICS, AU FORMAT LECTEUR ANNOTÉ.
 * (Feuille de route « Lam — Prompt marchés publics (corpus) », 27 août 2026, § 8.2 à § 8.4.)
 *
 *     npx tsx scripts/importer-marches-publics.ts             # simulation — n'écrit rien
 *     npx tsx scripts/importer-marches-publics.ts --apply     # écriture — Me Vaval, elle seule
 *
 * DEUXIÈME des trois scripts : A (thème) → **B** → C (pastilles, renvois, Index).
 * A doit avoir été appliqué : le thème `marches-publics` est exigé, il n'est pas créé ici.
 *
 * ─── LA GARDE D'UNICITÉ EST INVERSÉE (§ 10.6) ───────────────────────────────────────────
 * Ici on CRÉE, dans une section mesurée VIERGE. Donc :
 *   · AVANT création : il faut **exactement 0** candidat — par `source`, par `titleFr` en
 *     LEGISLATION, et 0 document dont la `source` commence par `MARCHES`. Si une fiche existe
 *     déjà, quelqu'un est passé : **STOP**, on ne « complète » pas, on ne réécrit pas.
 *   · APRÈS livraison : chaque `source` doit résoudre **exactement 1** document.
 *   · IDEMPOTENCE (§ 9.7) : relancé sur une base déjà livrée, il CONSTATE (les 25 sources
 *     résolvent à 1) et n'écrit rien. Un état MIXTE (certaines présentes, d'autres non) est
 *     une anomalie bloquante — jamais un rattrapage silencieux. Aucune logique purge+réimport.
 *
 * ─── CE QUI SE PROUVE, PLUTÔT QUE DE SE RECOPIER ────────────────────────────────────────
 *  1. PREMIÈRE ASSERTION : les empreintes des pièces sources, deux séries étiquetées
 *     (md5 des `.docx` d'origine ET des extractions) — `assertionEmpreintes`, partagée avec A.
 *  2. § 11.2 — aucun des SIX écartés dans le jeu versé : par md5 `.docx` pour les cinq à
 *     contenu propre, et **par NOM** pour le doublon à l'octet `…_3` (l'exclure par md5
 *     exclurait la gagnante, dont il est l'exact jumeau). Le md5 `a85cae5e01` doit apparaître
 *     EXACTEMENT une fois dans le jeu retenu.
 *  3. Le CORPS versé est RE-DÉRIVÉ de la pièce canonique en rejouant la découpe déclarée
 *     (segments − retraits + jointures) et doit retomber sur le corps préparé À L'OCTET ;
 *     les jointures d'en-tête sont prouvées SANS PERTE (leçon CEC : le champ « fusion » ne
 *     se recopie pas, il se prouve — une coquille de même longueur passait tout au vert).
 *     ⚠️ Et la SOMME des morceaux égale la pièce : toute ligne non vide qui n'est pas versée
 *     est DÉCLARÉE hors-corpus avec son motif (`decoupe.hors_segments`). Sans cela, amputer
 *     un segment ne faisait tomber aucune assertion — le md5 du corps se recalcule avec la
 *     découpe (contrôle adverse du 28 août : 5 180 lignes amputables en silence).
 *     Et chaque acte porte EXACTEMENT UN bloc « Donné » — deux exceptions, fondées sur la
 *     pièce : la loi-mère en porte trois (Sénat, Chambre, promulgation), la Circulaire 010
 *     n'en porte aucun. C'est ce qui juge la découpe des trois fascicules multi-actes.
 *  4. Le TITRE, l'ADOPTION, la PUBLICATION et le numéro de FASCICULE se lisent à la PIÈCE
 *     (`prouverTitre`, `prouverDate`, `prouverFascicule`), et le rapport DIT lequel se lit
 *     dans l'acte versé et lequel ne se lit plus qu'au fascicule. Les seuls mots d'intitulé
 *     qui ne viennent pas de la pièce sont les LIANTS d'une liste FERMÉE, comptés et affichés.
 *     ⚠️ DÉCOUPE DU 28 AOÛT (décision de Me Vaval) : le bandeau et le sommaire du fascicule
 *     ont quitté les 25 corps. Les appuis qui s'y lisaient — les 24 dates de parution et les
 *     24 numéros de fascicule — se prouvent désormais sur la PIÈCE, dont le md5 est asserté
 *     avant toute lecture. Rien n'est recopié ; la référence du fascicule et sa date vivent de
 *     toute façon dans les CHAMPS `moniteurRef` et `publicationDate`.
 *     ⚠️ SECONDE DÉCISION DU MÊME JOUR — « ajouter les titres au début ». Six actes n'avaient
 *     plus leur intitulé qu'au sommaire (n° 01, 05, 08, 16, 18, 23), et trois autres corps
 *     n'ouvraient pas non plus sur leur objet (n° 07, fragment ; n° 09, la Charte d'éthique,
 *     tranchée « oui » le soir même ; n° 17, la nomination, qui entre au corpus le même jour).
 *     Leur intitulé est RESTITUÉ au corps, mot pour mot, de la ligne de sommaire de leur propre
 *     pièce, et DÉCLARÉ dans `decoupe.insertions` avec son origine et son motif — `deriverCorps`
 *     refuse une insertion dont le `texte_source` ne se lit pas verbatim à la ligne déclarée,
 *     et refuse une insertion sans motif. Un intitulé ne s'invente pas.
 *     ⚠️ TROISIÈME DÉCISION, LE MÊME SOIR — LA CASSE : « ayez les majuscules comme pour le
 *     traitement des autres et non en all caps ». Quatre des dix lignes restituées étaient
 *     composées en CAPITALES par le J.O. ; elles entrent au corps en casse de phrase, la casse
 *     étant DÉRIVÉE du `titleFr` de leur fiche, lettre par lettre. La garde n'a pas été
 *     contournée : une insertion déclare désormais DEUX chaînes (`texte_source`, prouvée à la
 *     pièce comme avant, et `texte`, ce qui entre au corps) plus la `transformation` qui les
 *     sépare — et l'écart admis ne peut être QUE de casse.
 *  4bis. LES INSERTIONS SONT ÉNUMÉRÉES au rapport, une par une, avec LEURS DEUX CHAÎNES, comme
 *     les retraits et les plages hors-segment : ce qui ENTRE dans un corps publié se dit,
 *     autant que ce qui en sort — et l'écart entre la pièce et le corps se dit aussi.
 *  5. Les GARDES DU LECTEUR sont rejouées avec les fonctions RÉELLES du rendu
 *     (`segmentAnnotated`, `articleAnchorFromHeading`, `parseAnnotations`) : `secs === toc`
 *     dans l'ordre, `join === corps`, ancres émises === `labels`, 0 ancre dupliquée,
 *     `navToc` sans ancre morte.
 *  6. HORS-CORPUS (§ 11.3) : quinze désignations des actes découpés, 0 occurrence attendue.
 *     SICS (§ 11.11) : « Articles 30.- », « 227.1 » à point, l'intitulé approximatif de
 *     l'article 7-1 — présents. Exposants Unicode hostiles au parsing : interdits, sauf le
 *     seul « 177ᵉ Année » du bandeau du texte n° 23, déclaré.
 *  Aucun nombre fixe n'est asserté : tous les comptes sont des PRODUITS recalculés.
 *
 * ─── CE QUE CE SCRIPT NE FAIT PAS ───────────────────────────────────────────────────────
 *  · Aucun CrossRef, aucune pastille d'article, aucun `ArticleVersion`, aucun rattachement
 *    d'Index : c'est l'étape C.
 *  · `number` reste NULL — la feuille de route ne le demande pas (§ 8.4) et les désignations
 *    d'usage COLLIDENT (trois arrêtés du 26 octobre 2009, six du 30 août 2017, deux du
 *    9 décembre 2020, deux du 21 octobre 2021) : un `toType`+`toNumber` y choisirait « le
 *    meilleur » candidat au hasard (refs.ts, pickBest). La référence est le TITRE COMPLET.
 *  · `titleEn`/`titleHt`, `keywords`, `effectiveDate`, `matiere`, `abrogatedByNumber` :
 *    laissés nuls. Aucun n'est demandé, aucun ne se mesure sur pièces.
 *  · Aucun appareil fabriqué (interdit n° 16) : la Circulaire 010 n'a ni sommaire ni article.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../src/lib/db'
import { parseAnnotations, segmentAnnotated, type Annotations, type NavGroup, type TocEntry } from '../src/lib/legislation/annotated'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'
import {
  DIR,
  ECARTES,
  FICHES,
  SENTINELLES_HORS_CORPUS,
  VERSER_NOMINATION_2019,
  construireAnnotations,
  deriverCorps,
  lireCorps,
  lirePrep,
  md5,
  occurrencesPliees,
  prouverDate,
  prouverFascicule,
  prouverTitre,
  assertionEmpreintes,
  rapportEmpreintes,
  type Fiche,
} from './data/marches-publics/fiches-marches-publics'

const APPLY = process.argv.includes('--apply')
const THEME_SLUG = 'marches-publics'
/** Préfixe de `Document.source` du lot — mesuré LIBRE le 27 août. Une seule déclaration :
 *  la requête de garde et le message qui l'annonce ne peuvent plus diverger. */
const PREFIXE_SOURCE = 'MARCHES'

// § 13.2 — le drapeau de la nomination du 26 décembre 2019 n'est PAS déclaré ici : il vit dans
// la fondation partagée (`fiches-marches-publics.ts`), que B et C lisent tous deux. Il valait
// `true` ici quand `graphe-pastilles.json` déclarait « ne pas verser sans décision » : deux
// fondations, deux valeurs contraires, et un `--apply` qui aurait tranché à la place de
// Me Vaval. TRANCHÉ LE 28 AOÛT 2026 — « à verser » : la constante vaut `true`, la fondation du
// graphe porte la même décision, et le lot compte 25 textes.

/**
 * § 11.11 — sentinelles verbatim, sics compris. Chacune est cherchée dans SON texte.
 *
 * ⚠️ `ou: 'piece'` — une seule sentinelle porte ce drapeau, et il est MESURÉ, pas commode :
 * « (Reproduction pour erreurs matérielles) » ne se lit qu'à la ligne 7 de `piece-00`, c'est-
 * à-dire au SOMMAIRE du fascicule, que la découpe du 28 août sort du corps. La sentinelle dit
 * ce qu'elle a toujours dit — que la PIÈCE transcrite est la reproduction du n° 78 — et elle
 * le dit maintenant de la pièce, où la mention est ; le corps de la loi, lui, ne l'a jamais
 * portée ailleurs. La mention elle-même n'est pas perdue : `moniteurRef` et la note de fiche
 * du texte n° 00 la portent verbatim, avec le renvoi au n° 60 (décision de Me Vaval : laissée
 * telle quelle, sa place au corps n'est PAS tranchée ici).
 */
const SENTINELLES: { id: string; frag: string; quoi: string; ou?: 'corps' | 'piece' }[] = [
  { id: '04', frag: 'Articles 30.-', quoi: 'pluriel sic du J.O. (§ 9.1) — ancré art-30' },
  { id: '01', frag: 'Article 19.1-', quoi: 'décimale à POINT du décret de 2004' },
  { id: '04', frag: 'Article 15.1', quoi: 'décimale à POINT, seule de l’arrêté org/fonct' },
  { id: '09', frag: 'Article 5.1', quoi: 'décimale à POINT de la Charte annexée' },
  { id: '21', frag: 'Article 16.1.-', quoi: 'décimale à POINT du décret de 2021' },
  { id: '19', frag: '227.1', quoi: 'graphie à POINT du modificatif (§ 9.3)' },
  { id: '02', frag: '227-1', quoi: 'graphie à TRAIT D’UNION du texte de base (§ 9.3)' },
  {
    id: '23',
    frag: 'l’Arrêté du 21 octobre 2021 fixant les seuils de passation des marchés publics et les seuils d’intervention de la Commission Nationale des Marchés Publics',
    quoi: 'article 7-1 : intitulé DIVERGENT, coquille non tranchée (§ 13.10) — jamais normalisé',
  },
  {
    id: '00',
    frag: "notamment la Loi du 16 septembre 1953 sur l'adjudication, le Décret du 3 décembre 2004 fixant la réglementation des Marchés Publics",
    quoi: 'article 99 : la clause d’abrogation NOMMÉE — fondement du graphe de C',
  },
  { id: '00', frag: '(Reproduction pour erreurs matérielles)', quoi: 'la pièce est la reproduction n° 78 (§ 5)', ou: 'piece' },
]

/**
 * § 8.3 / § 11.3 — LE BLOC « DONNÉ », un par acte. Ce contrôle est écrit dans la feuille de
 * route et n'était implémenté nulle part : un segment qui déborderait sur l'acte suivant du
 * même fascicule porterait DEUX blocs, et rien ne le disait. La découpe des trois fascicules
 * multi-actes se juge ici, sur le corps produit.
 *
 * ⚠️ La graphie est MESURÉE, pas devinée : la formule s'écrit « Donné au … » comme
 * « Donné à … » et, pour la loi, « Donnée au Sénat / à la Chambre / au Palais National ».
 * Un `\b` après « à » ne mordrait sur rien — « à » n'est pas un caractère de mot pour le
 * moteur d'expressions régulières — et la garde manquerait alors les textes n° 17, 21 et 22
 * et le vote de la Chambre du n° 00 (mesuré le 28 août avant d'écrire cette ligne).
 */
const BLOC_DONNE = /^\s*Donn[ée]e?\s+(?:au|aux|à)\s/
/** Les DEUX exceptions, chacune fondée sur la pièce (§ 5, § 9.6). */
const DONNES_ATTENDUS = (id: string): number => (id === '24' ? 0 : id === '00' ? 3 : 1)
const DONNES_MOTIF: Record<string, string> = {
  '00': 'la loi porte TROIS blocs : vote du Sénat (4 juin), vote de la Chambre (10 juin), promulgation au Palais National (12 juin)',
  '24': 'la Circulaire 010 est un papier de la Primature : elle se clôt sur « Port-au-Prince, le 4 décembre 2023 », sans formule d’exécutoire',
}

/** Exposants Unicode hostiles au parsing (§ 9.3) — interdits, sauf celui-ci, mesuré. */
const EXPOSANTS_INTERDITS = ['ʳ', 'º', 'ᵉ']
const EXPOSANT_TOLERE = { id: '23', frag: '177ᵉ Année', motif: 'bandeau de fascicule, hors dispositif' }

interface Mesure {
  fiche: Fiche
  corps: string
  toc: TocEntry[]
  navToc: NavGroup[]
  labels: Record<string, string>
  annotationsJson: string
  lignes: number
  ancres: number
  tetesSansAncre: number
  donnes: number
  derivation: ReturnType<typeof deriverCorps>
  titre: ReturnType<typeof prouverTitre>
  adoption: ReturnType<typeof prouverDate>
  publication: ReturnType<typeof prouverDate>
  fascicule: ReturnType<typeof prouverFascicule>
  aVerser: boolean
}

/** Les gardes du LECTEUR, rejouées avec les fonctions réelles du rendu (§ 8.4, § 11.4). */
function gardesLecteur(f: Fiche, corps: string, toc: TocEntry[], labels: Record<string, string>, navToc: NavGroup[]) {
  const blocks = segmentAnnotated(corps, toc)

  const secs = blocks.filter((b) => b.kind === 'section')
  if (secs.length !== toc.length || secs.some((b, i) => b.anchor !== toc[i].anchor))
    throw new Error(`${f.id} — sommaire : ${secs.length} en-têtes appariés pour ${toc.length} entrées, ou ordre rompu — STOP`)

  if (blocks.map((b) => b.text).join('\n') !== corps) throw new Error(`${f.id} — segmentAnnotated perd du texte (join ≠ corps) — STOP`)

  const emises = blocks
    .filter((b): b is Extract<typeof b, { kind: 'body' }> => b.kind === 'body')
    .filter((b) => b.anchor && !b.noAnchors)
    .map((b) => b.anchor as string)
  const uniques = new Set(emises)
  // ⚠️ GARDE INATTEIGNABLE, gardée par sécurité mais qui ne prouve RIEN : `segmentAnnotated`
  // DÉDUPLIQUE lui-même les ancres (annotated.ts, `seenArt` — les annexes renumérotent depuis
  // l'article 1). Contrôle adverse du 28 août : une tête d'article RÉELLEMENT dupliquée dans la
  // pièce passe toute la simulation au vert. Le vrai compte est celui des têtes que le lecteur
  // a AVALÉES, rendu ci-dessous ; il est rapporté, non asserté — les annexes en produisent
  // légitimement (textes n° 09 à 15).
  if (uniques.size !== emises.length) throw new Error(`${f.id} — ancre(s) d'article DUPLIQUÉE(S) : id HTML en double — STOP`)
  const cles = Object.keys(labels).sort()
  if (JSON.stringify([...uniques].sort()) !== JSON.stringify(cles))
    throw new Error(
      `${f.id} — ancres émises ≠ labels (émises ${uniques.size}, labels ${cles.length}) : ` +
        `${[...uniques].filter((a) => !labels[a]).join(', ') || '∅'} sans libellé / ` +
        `${cles.filter((a) => !uniques.has(a)).join(', ') || '∅'} sans bloc — STOP`,
    )

  const ancresToc = new Set(toc.map((e) => e.anchor))
  const nav: string[] = []
  const marcher = (g: { anchor: string; children?: { anchor: string; children?: unknown[] }[] }[]) => {
    for (const it of g) {
      nav.push(it.anchor)
      if (Array.isArray(it.children)) marcher(it.children as never)
    }
  }
  marcher(navToc as never)
  const morts = nav.filter((a) => !ancresToc.has(a))
  if (morts.length) throw new Error(`${f.id} — navToc : ancre(s) sans entrée au sommaire ${morts.join(', ')} — STOP`)

  // Les libellés du sommaire consommés par segmentAnnotated ne doivent pas produire d'ancre :
  // `articleAnchorFromHeading` reconnaît « Section 1 - … » comme une tête d'article, et sans
  // le toc pour l'absorber, l'arrêté modalités poserait des dizaines de fausses ancres art-N.
  let tetes = 0
  for (const l of corps.split('\n')) if (articleAnchorFromHeading(l.trim())) tetes++
  const tetesDeToc = toc.filter((e) => articleAnchorFromHeading(e.label)).length
  return { ancres: uniques.size, tetesSansAncre: tetes - tetesDeToc - uniques.size, tetesDeToc }
}

function mesurer(f: Fiche): Mesure {
  const prep = lirePrep(f)
  if (prep.id !== f.id || prep.slug !== f.slug) throw new Error(`${f.id} — la fiche de préparation ${f.prep}.json porte ${prep.id}/${prep.slug} — STOP`)

  // Le corps est RE-DÉRIVÉ, pas pris de confiance. ⚠️ Le `titleFr` est passé : c'est de lui que
  // `deriverCorps` DÉRIVE la casse des intitulés restitués en casse de phrase (décision de
  // Me Vaval du 28 août au soir) ; sans lui, une insertion transformée est refusée.
  const derivation = deriverCorps(prep, f.titre.fr)
  const corpsFichier = lireCorps(f)
  if (derivation.corps !== corpsFichier)
    throw new Error(`${f.id} — le corps re-dérivé de la pièce diffère du corps préparé sur disque — STOP`)
  const corps = derivation.corps

  const toc: TocEntry[] = prep.toc.map((e) => ({ level: e.level, label: e.label, anchor: e.anchor, kind: e.kind }))
  const labels = prep.labels
  const navToc = prep.navToc as unknown as NavGroup[]
  const g = gardesLecteur(f, corps, toc, labels, navToc)

  // § 8.3 / § 11.3 — un bloc « Donné » par acte : la découpe ne déborde pas sur le voisin.
  const donnes = corps.split('\n').filter((l) => BLOC_DONNE.test(l)).length
  const attendus = DONNES_ATTENDUS(f.id)
  if (donnes !== attendus)
    throw new Error(
      `${f.id} — ${donnes} bloc(s) « Donné » au corps, ${attendus} attendu(s)` +
        `${DONNES_MOTIF[f.id] ? ` (${DONNES_MOTIF[f.id]})` : ''} : ` +
        `le segment porte le dispositif de plus d'un acte, ou en a perdu la clôture (§ 8.3) — STOP`,
    )

  const annotationsJson = JSON.stringify(construireAnnotations(f, prep) as unknown as Annotations)
  const relu = parseAnnotations(annotationsJson)
  if (!relu || relu.toc.length !== toc.length || Object.keys(relu.labels ?? {}).length !== Object.keys(labels).length)
    throw new Error(`${f.id} — annotationsJson non relisible sans perte par parseAnnotations — STOP`)

  return {
    fiche: f,
    corps,
    toc,
    navToc,
    labels,
    annotationsJson,
    lignes: corps.split('\n').length,
    ancres: g.ancres,
    tetesSansAncre: g.tetesSansAncre,
    donnes,
    derivation,
    titre: prouverTitre(f, corps, derivation.piece),
    adoption: prouverDate(f, corps, derivation.piece, 'adoption'),
    publication: prouverDate(f, corps, derivation.piece, 'publication'),
    fascicule: prouverFascicule(f, corps, derivation.piece),
    aVerser: f.id !== '17' || VERSER_NOMINATION_2019,
  }
}

async function main() {
  const p = (s = '') => console.log(s)

  p('══════════════════════════════════════════════════════════════════════════════════')
  p('  B · CORPUS DES MARCHÉS PUBLICS — versement au lecteur annoté (§ 8.2 à § 8.4)')
  p(`  drapeaux : --apply=${APPLY} · VERSER_NOMINATION_2019=${VERSER_NOMINATION_2019} (§ 13.2)`)
  p('══════════════════════════════════════════════════════════════════════════════════')
  p()

  // ══ 1. PREMIÈRE ASSERTION — les empreintes ══════════════════════════════════════════
  const e = assertionEmpreintes(APPLY)
  rapportEmpreintes(e, p)
  p()

  // ══ 2. § 11.2 — AUCUN DES SIX ÉCARTÉS DANS LE JEU VERSÉ ═════════════════════════════
  const retenues = e.manifeste.pieces.filter((x) => x.groupe === 'retenues')
  const doublon = ECARTES.find((x) => x.motif.includes('doublon'))!
  const md5DoublonCourt = doublon.md5Docx
  for (const ec of ECARTES) {
    if (ec === doublon) continue
    const intrus = retenues.filter((x) => x.md5_docx_origine.startsWith(ec.md5Docx))
    if (intrus.length) throw new Error(`§ 11.2 — écarté « ${ec.motif} » (md5 ${ec.md5Docx}) présent dans le jeu retenu : ${intrus.map((i) => i.cible).join(', ')} — STOP`)
  }
  // Le doublon à l'octet s'exclut PAR NOM : son md5 est celui de la gagnante.
  const parNom = retenues.filter((x) => /_3[.-]|_3\.docx$/.test(x.docx_origine))
  if (parNom.length) throw new Error(`§ 11.2 — le doublon « …_3 » est dans le jeu retenu (${parNom.map((x) => x.docx_origine).join(', ')}) — STOP`)
  const occDoublon = retenues.filter((x) => x.md5_docx_origine.startsWith(md5DoublonCourt)).length
  if (occDoublon !== 1)
    throw new Error(`§ 11.2 — le md5 ${md5DoublonCourt} apparaît ${occDoublon} fois dans le jeu retenu, 1 attendue (c'est celui de la gagnante) — STOP`)
  p('§ 11.2 — LES SIX ÉCARTÉS')
  p(`  cinq exclus par md5 .docx : ${ECARTES.filter((x) => x !== doublon).map((x) => x.md5Docx).join(', ')} — 0 dans le jeu retenu`)
  p(`  le doublon à l'octet exclu par NOM (« …_3 ») ; son md5 ${md5DoublonCourt} apparaît ${occDoublon} fois dans le jeu retenu — c'est la gagnante`)
  p()

  // ══ 3. MESURE DES 25 TEXTES ═════════════════════════════════════════════════════════
  const mesures = FICHES.map(mesurer)

  // Sources et intitulés distincts — la référence est le titre complet (règle du 26 août).
  const sources = new Set(mesures.map((m) => m.fiche.source))
  if (sources.size !== mesures.length) throw new Error('deux fiches partagent la même `source` — STOP')
  const titres = new Set(mesures.map((m) => m.titre.fr))
  if (titres.size !== mesures.length)
    throw new Error(
      `deux fiches partagent le même intitulé — la référence doit être le TITRE COMPLET : ` +
        `${mesures.map((m) => m.titre.fr).filter((t, i, a) => a.indexOf(t) !== i).join(' | ')} — STOP`,
    )

  // § 11.3 — le hors-corpus n'apparaît dans AUCUN corps versé.
  const horsCorpus: string[] = []
  for (const s of SENTINELLES_HORS_CORPUS)
    for (const m of mesures) {
      const n = m.corps.split(s).length - 1
      if (n) horsCorpus.push(`« ${s} » ×${n} dans le texte n° ${m.fiche.id}`)
    }
  if (horsCorpus.length) throw new Error(`§ 11.3 — hors-corpus dans un corps versé :\n      ${horsCorpus.join('\n      ')}`)

  // § 11.11 — sentinelles verbatim (sics compris) et exposants interdits.
  const sentinelles: string[] = []
  for (const s of SENTINELLES) {
    const m = mesures.find((x) => x.fiche.id === s.id)
    if (!m) throw new Error(`sentinelle sur un texte inconnu : ${s.id}`)
    const meule = s.ou === 'piece' ? m.derivation.piece : m.corps
    const n = meule.split(s.frag).length - 1
    if (n === 0)
      throw new Error(
        `§ 11.11 — sentinelle ABSENTE ${s.ou === 'piece' ? 'de la PIÈCE' : 'du corps'} du texte n° ${s.id} : ` +
          `« ${s.frag.slice(0, 70)} » (${s.quoi}) — STOP`,
      )
    sentinelles.push(
      `n° ${s.id} ×${n}${s.ou === 'piece' ? ' (à la PIÈCE, hors corps)' : ''}  ` +
        `« ${s.frag.length > 62 ? s.frag.slice(0, 62) + '…' : s.frag} »  ${s.quoi}`,
    )
  }
  for (const m of mesures)
    for (const x of EXPOSANTS_INTERDITS) {
      const n = m.corps.split(x).length - 1
      if (!n) continue
      const tolere = m.fiche.id === EXPOSANT_TOLERE.id && x === 'ᵉ' && n === (m.corps.split(EXPOSANT_TOLERE.frag).length - 1)
      if (!tolere) throw new Error(`§ 9.3 — exposant Unicode U+${x.codePointAt(0)!.toString(16).toUpperCase()} ×${n} au texte n° ${m.fiche.id} — hostile au parsing, STOP`)
    }

  // ══ 4. GARDE D'UNICITÉ INVERSÉE (§ 10.6) ════════════════════════════════════════════
  const themeLu = await prisma.theme.findFirst({
    where: { slug: THEME_SLUG },
    select: { id: true, labelFr: true, labelEn: true, labelHt: true, position: true },
  })
  // En SIMULATION, le thème peut ne pas exister encore : A n'a pas été appliqué. On mesure
  // tout le reste et on le dit. À `--apply`, son absence est bloquante — l'ordre A → B → C.
  if (!themeLu && APPLY) throw new Error(`thème « ${THEME_SLUG} » introuvable — lancer d'abord scripts/creer-theme-marches-publics.ts --apply`)
  const theme = themeLu ?? { id: '(créé par A)', labelFr: 'Marchés publics', labelEn: null, labelHt: null, position: -1 }
  const themeLabels = [theme.labelFr, theme.labelEn, theme.labelHt].filter(Boolean).join(' ')

  const aVerser = mesures.filter((m) => m.aVerser)
  const existants = await prisma.document.findMany({
    where: { source: { in: aVerser.map((m) => m.fiche.source) } },
    select: { id: true, source: true, titleFr: true, status: true },
  })
  const prefixe = await prisma.document.count({ where: { source: { startsWith: PREFIXE_SOURCE } } })
  const homonymes = await prisma.document.findMany({
    where: { type: 'LEGISLATION', titleFr: { in: aVerser.map((m) => m.titre.fr) } },
    select: { id: true, titleFr: true, source: true },
  })

  // Une `source` du lot peut résoudre PLUSIEURS documents (le préfixe MARCHES est libre, mais
  // rien ne le garantit demain) : on compte les SOURCES distinctes, pas les lignes, et on borne
  // l'énumération — sans quoi le message qui doit alerter l'opérateur est un mur illisible.
  const sourcesExistantes = [...new Set(existants.map((x) => x.source ?? '(sans source)'))]
  const dejaLivre = sourcesExistantes.length === aVerser.length && existants.length === aVerser.length
  if (existants.length > 0 && !dejaLivre)
    throw new Error(
      `ÉTAT MIXTE : ${sourcesExistantes.length} source(s) du lot sur ${aVerser.length} résolvent déjà ` +
        `${existants.length} document(s) en base — ${sourcesExistantes.slice(0, 8).join(', ')}` +
        `${sourcesExistantes.length > 8 ? ` … (+${sourcesExistantes.length - 8})` : ''}. ` +
        `Quelqu'un est passé : investiguer avant tout, aucun rattrapage silencieux (§ 9.7)`,
    )
  if (!dejaLivre && homonymes.length)
    throw new Error(
      `${homonymes.length} document(s) LEGISLATION portent déjà un des intitulés à créer : ` +
        `${homonymes.map((h) => `${h.source ?? '(sans source)'} « ${h.titleFr.slice(0, 60)}… »`).join(' ; ')} — STOP`,
    )
  if (!dejaLivre && prefixe !== 0)
    throw new Error(`${prefixe} document(s) portent déjà une source commençant par ${PREFIXE_SOURCE} — la section n'est pas vierge, STOP`)

  // ══ 5. RAPPORT CHIFFRÉ (§ 10.3) ═════════════════════════════════════════════════════
  p('LES 25 TEXTES — ce qui serait créé')
  p('  n°  source                                statut      lignes  toc  art.  navG  têtes  adoption    publication')
  p('  ──  ────────────────────────────────────  ──────────  ──────  ───  ────  ────  ─────  ──────────  ───────────')
  for (const m of mesures) {
    const f = m.fiche
    p(
      `  ${f.id}  ${f.source.padEnd(36)}  ${(m.aVerser ? f.status : 'NON VERSÉ').padEnd(10)}  ` +
        `${String(m.lignes).padStart(6)}  ${String(m.toc.length).padStart(3)}  ${String(m.ancres).padStart(4)}  ` +
        `${String(m.navToc.length).padStart(4)}  ${String(m.tetesSansAncre).padStart(5)}  ` +
        `${(m.adoption?.iso ?? '—').padEnd(10)}  ${m.publication?.iso ?? '—'}`,
    )
  }
  const tot = (f: (m: Mesure) => number) => aVerser.reduce((n, m) => n + f(m), 0)
  p(
    `  TOTAL (${aVerser.length} versés) : ${tot((m) => m.lignes)} lignes de corps · ${tot((m) => m.toc.length)} entrées de sommaire · ` +
      `${tot((m) => m.ancres)} articles ancrés · ${tot((m) => m.tetesSansAncre)} têtes d'annexe sanctionnée sans ancre`,
  )
  p()

  p('LES INTITULÉS — chaque mot vient de la pièce, sauf les liants déclarés (§ 8.4)')
  for (const m of mesures) {
    const ed = m.titre.morceauxEditoriaux
    const hf = m.titre.morceauxAuFascicule
    p(`  n° ${m.fiche.id}  « ${m.titre.fr} »`)
    p(
      `        ${m.titre.morceauxCorps} morceau(x) lu(s) à la pièce (${m.titre.carsCorps} c.)` +
        (ed.length ? ` · ${ed.length} liant(s) d'éditeur : ${ed.map((x) => `« ${x} »`).join(', ')} (${m.titre.carsEditoriaux} c.)` : ' · 0 mot d’éditeur') +
        (hf.length ? ` · ⚠️ ${hf.length} morceau(x) LU(S) AU SEUL SOMMAIRE DU FASCICULE, plus au corps versé` : ''),
    )
  }
  const avecLiants = mesures.filter((m) => m.titre.morceauxEditoriaux.length)
  const auFascicule = mesures.filter((m) => m.titre.morceauxAuFascicule.length)
  p(`  → ${mesures.length - avecLiants.length} intitulés entièrement lus à la pièce · ${avecLiants.length} construits avec un liant de la liste FERMÉE`)
  p(
    `  → ${mesures.length - auFascicule.length} intitulés se lisent DANS L'ACTE VERSÉ · ` +
      `${auFascicule.length} ne se lisent QU'AU SOMMAIRE du fascicule` +
      (auFascicule.length ? ` (n° ${auFascicule.map((m) => m.fiche.id).join(', ')})` : ''),
  )
  if (auFascicule.length)
    p(
      `     ⚠️ MESURÉ, À DIRE À ME VAVAL : pour ces ${auFascicule.length} textes, le Journal officiel n'imprime l'intitulé de ` +
        `l'acte QUE dans le sommaire du fascicule, et le sommaire n'est pas au corps versé — leur intitulé de fiche se ` +
        `prouve donc sur la PIÈCE (md5 asserté), plus au corps. La RESTITUTION du 28 août a vidé cette liste ; si un texte ` +
        `y revient, c'est qu'il attend la sienne : il faut ajouter son intitulé à \`decoupe.insertions\`, jamais le recopier ici.`,
    )
  else
    p(
      `     ⚠️ CE COMPTE N'EST PAS UNE CONSTANTE, IL EST RECALCULÉ : la liste est vide parce que les huit intitulés qui ne se ` +
        `lisaient plus qu'au sommaire ont été RESTITUÉS au corps (décision de Me Vaval du 28 août, « ajouter les titres au ` +
        `début »), chacun prouvé verbatim à sa ligne de sommaire par \`decoupe.insertions\`. Le mécanisme reste en place : ` +
        `il nommera le prochain texte dans ce cas.`,
    )
  p()

  p('LES DATES — recalculées en toutes lettres et relues dans leur appui (§ 8.4, § 9.4)')
  for (const m of mesures) {
    if (m.adoption) p(`  n° ${m.fiche.id}  adoption ${m.adoption.iso} (« ${m.adoption.enLettres} ») ← « ${m.adoption.appui.slice(0, 78)} »`)
    // ⚠️ BRANCHE MORTE DEPUIS LA RÈGLE RÉVISÉE DU 28 AOÛT : les 25 fiches portent une date d'adoption,
    // la loi-mère comprise (10 juin 2009, dernier vote). Elle disait auparavant « la règle générale ne
    // s'applique pas à la loi-mère », ce qui n'est plus vrai ; si une fiche revient sans date, le rapport
    // le DIT sans en donner une raison qu'il ne mesure pas.
    else p(`  n° ${m.fiche.id}  ⚠️ adoption NON POSÉE — aucune date d'adoption en fiche : à motiver expressément avant tout --apply`)
  }
  p(`  publication : ${mesures.filter((m) => m.publication).length} datées du fascicule · ${mesures.filter((m) => !m.publication).length} sans (Circulaire 010, papier Primature)`)
  p(`  ⚠️ texte n° 8 : publicationDate ${mesures.find((m) => m.fiche.id === '08')!.publication!.iso} — la REPRODUCTION n° 104, date lue sur le fac-similé (§ 9.4, interdit n° 11)`)
  p()

  p('LA DÉCOUPE ET LA DÉRIVATION DU CORPS (§ 8.3) — le corps versé est un PRODUIT, pas un fichier de confiance')
  for (const m of mesures) {
    const d = m.derivation
    const seg = lirePrep(m.fiche).decoupe.segments
    p(
      `  n° ${m.fiche.id}  pièce ${d.lignesPiece} l. → ${seg.length} segment(s) ${seg.map(([a, b]) => `${a}-${b}`).join(', ')} ` +
        `− ${d.retraits} retrait(s) d'éditeur${d.retraitsInline ? ` (+ ${d.retraitsInline} inline)` : ''} + ${d.jointures} jointure(s) ` +
        `(${d.lignesAbsorbees} l. absorbées) = ${d.lignesCorps} l. · md5 ${md5(m.corps).slice(0, 12)}`,
    )
  }
  // § 8.3 — LA COUVERTURE : ce qui n'est pas versé est DÉCLARÉ, plage par plage, avec son motif.
  // Sans cette déclaration, amputer un segment ne faisait tomber aucune assertion (le md5 du
  // corps se recalcule avec la découpe) : 5 180 lignes du corpus étaient amputables en silence.
  const avecHors = mesures.filter((m) => m.derivation.horsSegmentsPlages.length)
  p(
    `  COUVERTURE (§ 8.3) : ${mesures.reduce((n, m) => n + m.derivation.horsSegments, 0)} lignes non vides écartées de la découpe, ` +
      `TOUTES déclarées dans ${avecHors.length} fiches de préparation ; 0 ligne non vide ni versée ni déclarée :`,
  )
  for (const m of avecHors)
    for (const h of m.derivation.horsSegmentsPlages)
      p(`      n° ${m.fiche.id}  l. ${String(h.plage[0]).padStart(3)}-${String(h.plage[1]).padEnd(3)}  ${h.motif}`)

  // § 8.3 / § 11.3 — un bloc « Donné » par acte (le contrôle de la feuille de route).
  const exceptionsDonne = mesures.filter((m) => m.donnes !== 1)
  p(
    `  blocs « Donné » : ${mesures.filter((m) => m.donnes === 1).length} textes en portent EXACTEMENT UN — la découpe ne déborde sur aucun acte voisin. ` +
      `${exceptionsDonne.length} exception(s) fondée(s) sur la pièce :`,
  )
  for (const m of exceptionsDonne) p(`      n° ${m.fiche.id}  ${m.donnes} bloc(s) — ${DONNES_MOTIF[m.fiche.id]}`)

  const jointures = mesures.reduce((n, m) => n + m.derivation.jointures, 0)
  const retraits = mesures.reduce((n, m) => n + m.derivation.retraits, 0)
  const retraitsSansEffet = mesures.reduce((n, m) => n + m.derivation.retraitsSansEffet, 0)
  const retraitsInline = mesures.reduce((n, m) => n + m.derivation.retraitsInline, 0)
  p(
    `  → ${jointures} jointures d'en-tête PROUVÉES sans perte · ${retraits - retraitsSansEffet} lignes de note de transcription d'éditeur ` +
      `RÉELLEMENT retirées du dispositif · ${retraitsInline} mention(s) d'éditeur ENCHÂSSÉE(S) retirée(s) sans toucher au reste de leur ligne (§ 11.11)`,
  )
  // ⚠️ MESURÉ PAR LE CONTRÔLE ADVERSE DU 28 AOÛT. `retraits` compte TOUTES les lignes déclarées
  // en retrait ; depuis que la découpe a sorti bandeaux, sommaires et notes de transcription du
  // corps, une partie de ces retraits porte sur des lignes qui n'entrent DÉJÀ dans aucun segment
  // — ils n'ôtent donc rien. Le rapport annonçait « 21 lignes retirées du dispositif » quand 13
  // seulement l'étaient. On ne supprime pas ces déclarations (elles restent vraies : ces lignes
  // sont bien de l'appareil d'éditeur, et une découpe future pourrait les ramener dans un
  // segment) — on les compte à part, et on le dit.
  if (retraitsSansEffet)
    p(
      `     ⚠️ ${retraits} retrait(s) déclaré(s) au total, dont ${retraitsSansEffet} SANS EFFET : la ligne visée n'entre dans aucun ` +
        `segment (une plage « hors_segments » la couvre déjà). Ces retraits-là n'ôtent aucune ligne du corps ; la déclaration est ` +
        `conservée, mais elle est REDONDANTE et le total ci-dessus ne la compte plus.`,
    )
  // ⚠️ ON ÉNUMÈRE LES RETRAITS, comme les plages hors-segment. Un compte ne se relit pas :
  // le contrôle adverse a fait passer un 22ᵉ retrait sans motif sur la ligne d'intitulé de la
  // loi-mère, et le seul signe était un total qui baissait d'une unité.
  p(`  LES RETRAITS, un par un — chacun doit se lire comme une mention d'éditeur :`)
  for (const m of mesures)
    for (const r of m.derivation.retraitsDetail)
      p(`      n° ${r.id}  l. ${String(r.ligne).padStart(4)}  ${r.motif}`)

  // ⚠️ CE QUI ENTRE SE DIT AUTANT QUE CE QUI SORT (§ 8.4, décision du 28 août). La couverture
  // énumère les plages écartées, les retraits sont énumérés un par un ; les INSERTIONS l'étaient
  // par personne, parce qu'elles n'existaient pas. Elles existent : on les nomme, avec la ligne
  // de la pièce d'où l'intitulé est LU et la chaîne exacte qui entre au corps.
  const avecIns = mesures.filter((m) => m.derivation.insertionsDetail.length)
  const totalIns = mesures.reduce((n, m) => n + m.derivation.insertions, 0)
  const toutesIns = avecIns.flatMap((m) => m.derivation.insertionsDetail)
  const transformees = toutesIns.filter((x) => x.texte !== x.texte_source)
  p()
  p(
    `  LES INSERTIONS (§ 8.4) : ${totalIns} ligne(s) RESTITUÉE(S) au corps dans ${avecIns.length} textes — chacune LUE, mot pour mot, ` +
      `à la ligne de SOMMAIRE déclarée de sa propre pièce, jamais retapée ni prise du titre de fiche. La garde de \`deriverCorps\` ` +
      `refuse toute chaîne dont le \`texte_source\` ne se lit pas VERBATIM à sa ligne (comparaison littérale, une occurrence ` +
      `exactement), toute insertion sans motif, et toute insertion dont le point d'entrée ou la ligne d'origine ne sont pas ` +
      `ceux qu'elle déclare. Elle exige en outre que la ligne d'origine soit prise dans une plage ÉCARTÉE — le sommaire, ` +
      `jamais le dispositif — et que la chaîne qui entre au corps se lise, À LA CASSE, dans le \`titleFr\` de SA fiche : ` +
      `un sommaire de fascicule annonce plusieurs actes, et la seule provenance ne dit pas lequel (contrôle adverse du ` +
      `28 août au soir : l'intitulé du voisin de sommaire passait toute la garde, seul \`md5_corps\` — qui se recalcule — ` +
      `le rattrapait).`,
  )
  // ⚠️ LE CONTRAT À DEUX CHAÎNES (décision de Me Vaval du 28 août au soir sur la CASSE). Ce
  // qui est LU à la pièce et ce qui ENTRE au corps sont désormais deux champs distincts. Les
  // afficher tous les deux n'est pas de l'ornement : c'est le seul endroit où un lecteur voit
  // l'écart que la garde a admis, et sur quel fondement. Aucun nombre n'est affirmé — ils sont
  // RECOMPTÉS sur les insertions dérivées.
  p(
    `  ${toutesIns.length - transformees.length} entre(nt) au corps À L'OCTET de la pièce · ` +
      `${transformees.length} porte(nt) une TRANSFORMATION déclarée. La seule transformation admise est un changement de ` +
      `CASSE : \`ecartHorsCasse()\` compare les deux chaînes caractère par caractère et refuse tout écart qui ne soit pas ` +
      `la variante de casse d'une même lettre — un mot changé, une ponctuation déplacée, une apostrophe redressée, un ` +
      `accent ôté (« É » → « E ») sont refusés, transformation déclarée ou non. Et une transformation déclarée qui ne ` +
      `transforme rien est refusée elle aussi.`,
  )
  for (const m of avecIns)
    for (const x of m.derivation.insertionsDetail) {
      p(
        `      n° ${x.id}  pièce l. ${String(x.ligne_source).padStart(3)} → au corps avant la l. ${String(x.position.avant_ligne_source).padStart(3)} de la pièce`,
      )
      if (x.texte === x.texte_source) p(`            pièce = corps : « ${x.texte} »`)
      else {
        p(`            pièce : « ${x.texte_source} »`)
        p(`            corps : « ${x.texte} »`)
        p(`            TRANSFORMATION : ${x.transformation ?? ''}`)
      }
      p(`            ${x.motif}`)
    }
  p(
    ``,
  )
  // ⚠️ « SANS PERTE » N'EST PAS « VERBATIM ». Une jointure recolle deux paragraphes distincts
  // du J.O. (« CHAPITRE II » / son intitulé) en UNE ligne, séparés par un tiret cadratin que
  // le Journal officiel n'imprime pas. Aucun mot n'est perdu — mais le corps versé porte des
  // caractères d'éditeur, contre la règle « le corps est VERBATIM » (§ 8.4).
  const separateurs = mesures.reduce(
    (n, m) => n + lirePrep(m.fiche).jointures_entetes.reduce((a, j) => a + (j.libelle.split(' — ').length - 1), 0),
    0,
  )
  const docsJoints = mesures.filter((m) => lirePrep(m.fiche).jointures_entetes.length).map((m) => m.fiche.id)
  p(
    `  ⚠️ ${separateurs} séparateurs « — » d'ÉDITEUR introduits au corps par ces jointures, dans ${docsJoints.length} textes ` +
      `(n° ${docsJoints.join(', ')}) : aucun mot ajouté ni perdu, mais ces caractères ne sont pas au J.O. — À TRANCHER par Me Vaval (règle du corps verbatim, § 8.4).`,
  )
  const avalees = mesures.filter((m) => m.tetesSansAncre > 0)
  p(
    `  têtes d'article AVALÉES par le lecteur (annexes qui renumérotent depuis 1, ou doublon) : ` +
      `${avalees.reduce((n, m) => n + m.tetesSansAncre, 0)} dans ${avalees.length} textes (n° ${avalees.map((m) => m.fiche.id).join(', ')}) — ` +
      `attendu pour les annexes sanctionnées ; hors de cette liste, ce serait un doublon à investiguer`,
  )
  p()

  p('SENTINELLES VERBATIM — les sics du J.O. sont intacts (§ 11.11, interdit n° 8)')
  for (const s of sentinelles) p(`  ${s}`)
  p(`  hors-corpus : ${SENTINELLES_HORS_CORPUS.length} désignations testées sur ${mesures.length} corps — 0 occurrence`)
  // ⚠️ Le seul exposant Unicode du lot vivait au BANDEAU du texte n° 23 (« 177ᵉ Année »). Le
  // bandeau ayant quitté les corps, on ne l'AFFIRME plus : on le RECOMPTE, au corps et à la pièce.
  const expCorps = mesures.reduce((n, m) => n + EXPOSANTS_INTERDITS.reduce((a, x) => a + (m.corps.split(x).length - 1), 0), 0)
  const expTolere = mesures.find((m) => m.fiche.id === EXPOSANT_TOLERE.id)!
  const expPiece = expTolere.derivation.piece.split(EXPOSANT_TOLERE.frag).length - 1
  p(
    `  exposants Unicode : ${expCorps} dans les ${mesures.length} corps versés. ` +
      `« ${EXPOSANT_TOLERE.frag} » (texte n° ${EXPOSANT_TOLERE.id}, ${EXPOSANT_TOLERE.motif}) se lit ${expPiece} fois à la PIÈCE ` +
      `et ${expTolere.corps.split(EXPOSANT_TOLERE.frag).length - 1} fois au corps : la découpe du 28 août a sorti le bandeau, ` +
      `donc l'exposant avec — la tolérance n'a plus rien à couvrir, elle est gardée sans être employée.`,
  )
  p()

  p('OÙ SE LISENT LES APPUIS DE FICHE, DEPUIS LA DÉCOUPE DU 28 AOÛT (§ 8.4)')
  const pubFasc = mesures.filter((m) => m.publication?.ou === 'fascicule')
  const fascFasc = mesures.filter((m) => m.fascicule?.ou === 'fascicule')
  const adoActe = mesures.filter((m) => m.adoption?.ou === 'acte')
  p(
    `  adoption   : ${adoActe.length}/${mesures.filter((m) => m.adoption).length} appuis lus DANS L'ACTE VERSÉ (bloc « Donné ») — ` +
      `la date d'adoption n'a jamais dépendu du bandeau`,
  )
  p(
    `  publication: ${pubFasc.length}/${mesures.filter((m) => m.publication).length} appuis lus au BANDEAU DU FASCICULE, hors du corps versé ` +
      `(n° ${pubFasc.map((m) => m.fiche.id).join(', ')})`,
  )
  p(
    `  fascicule  : ${fascFasc.length}/${mesures.filter((m) => m.fascicule).length} appuis lus au BANDEAU DU FASCICULE, hors du corps versé ` +
      `(n° ${fascFasc.map((m) => m.fiche.id).join(', ')})`,
  )
  p(
    `  ⚠️ RIEN N'EST PERDU : la date de parution et la référence du fascicule sont des CHAMPS de la fiche — ` +
      `« publicationDate » et « moniteurRef » — que B écrit depuis la fiche, jamais depuis le corps ; et chaque appui ` +
      `reste prouvé sur la PIÈCE, dont le md5 est asserté avant toute lecture. Ce qui a changé, c'est qu'on DIT où il se lit.`,
  )
  p()

  p('RÉSERVES DE COMPLÉTUDE ET NOTES DE FICHE (§ 4.3) — écrites en summaryFr')
  for (const m of mesures) if (m.fiche.note) p(`  n° ${m.fiche.id} · ${m.fiche.note}`)
  p()

  p('QUESTIONS OUVERTES ATTACHÉES À CES FICHES — posées, jamais tranchées (§ 13)')
  for (const m of mesures) if (m.fiche.question) p(`  n° ${m.fiche.id} · ${m.fiche.question}`)
  p(
    `  § 13.2 · LA NOMINATION DU 26 DÉCEMBRE 2019 — TRANCHÉE le 28 août 2026 par Me Vaval : « à verser ». ` +
      `Elle ne figure plus dans les questions ouvertes ci-dessus.`,
  )
  p(
    `        versé ? ${VERSER_NOMINATION_2019 ? 'OUI — statut PUBLIE, avec sa note de fiche' : '⚠️ NON : le drapeau VERSER_NOMINATION_2019 est à false alors que la décision est « à verser » — INCOHÉRENT, vérifier'}` +
      ` · le lot compte ${aVerser.length} textes sur ${mesures.length} fiches.`,
  )
  p(
    `        LES DEUX FONDATIONS DISENT LA MÊME CHOSE : VERSER_NOMINATION_2019=${VERSER_NOMINATION_2019} dans ` +
      `scripts/data/marches-publics/fiches-marches-publics.ts (lu par B ET par C, y compris en pré-vol) et, dans ` +
      `graphe-pastilles.json, la décision portée en toutes lettres. La contradiction du 28 août au matin — B versait quand la ` +
      `fondation proposait d'écarter — n'existe plus, et le rapport ne l'annonce plus.`,
  )
  p()

  p('THÈME')
  p(
    themeLu
      ? `  « ${theme.labelFr} » (${THEME_SLUG}, id ${theme.id}, position ${theme.position}) · libellés indexés : « ${themeLabels} »`
      : `  ⚠️ le thème « ${THEME_SLUG} » N'EXISTE PAS ENCORE — A n'a pas été appliqué. Simulation poursuivie ; --apply refuserait.`,
  )
  p(`  ${aVerser.length} rattachements, tous isPrimary:true — un seul primaire par document (index UNIQUE PARTIEL DocumentTheme_one_primary)`)
  p()

  // ══ 6. ÉCRITURE ═════════════════════════════════════════════════════════════════════
  if (dejaLivre) {
    p('ÉTAT POST-LIVRAISON DÉTECTÉ — les fiches existent déjà, à raison d’une par source :')
    for (const x of existants) p(`  ${(x.source ?? '(sans source)').padEnd(38)} ${x.id}  ${x.status}  « ${x.titleFr.slice(0, 58)}… »`)
    p('RIEN À ÉCRIRE (§ 9.7). Toutes les mesures ci-dessus ont été refaites sur les pièces.')
    p('ÉTAPE SUIVANTE : npx tsx scripts/graphe-marches-publics.ts')
    return
  }

  const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
  const manifesteLivraison = join(DIR, `livraison-etat-avant-${horodatage}.json`)

  if (!APPLY) {
    p('CE QUI SERAIT ÉCRIT (--apply, lancé par Me Vaval, et par elle seule — § 10.2)')
    p(`  manifeste d'état antérieur : ${manifesteLivraison}`)
    p(`  Document.create   : ${aVerser.length}  (type LEGISLATION · rubrique « Législation annotée » — DOC_TYPE_META intouché)`)
    p(`  DocumentTheme     : ${aVerser.length}  (themeId ${theme.id}, isPrimary true, assignedBy IMPORT)`)
    p(`  searchText        : ${aVerser.length}  (calculé à l'écriture, recalculé par reindexDocument)`)
    p(`  AuditLog          : ${aVerser.length} DOC_PUBLISHED — RECOMPTÉS après la transaction (audit() avale ses erreurs)`)
    p(`  reindexDocument   : ${aVerser.length}, HORS transaction, un par document`)
    p(`  champs laissés NULS : number, titleEn, titleHt, keywords, effectiveDate, matiere, abrogatedByNumber, sourcePdfUrl`)
    p()
    p('  ⚠️ B ne pose ni renvoi, ni pastille d’article, ni rattachement d’Index : ENCHAÎNER SUR C.')
    p('     Les textes n° 1 et n° 16 entrent déjà au statut ABROGE ; C écrira la clause qui le fonde.')
    p()
    p('SIMULATION — rien n’a été écrit. --apply est réservé à Me Vaval (§ 10.2).')
    return
  }

  // L'état antérieur AVANT la transaction : ici, la section est vierge — l'état antérieur
  // EST le manifeste de ce qui va entrer (§ 10.5). S'il ne s'écrit pas, rien ne bouge.
  writeFileSync(
    manifesteLivraison,
    JSON.stringify(
      {
        _lisezMoi:
          'État AVANT scripts/importer-marches-publics.ts --apply. La section était VIERGE : ce fichier ' +
          'est le manifeste de la livraison (empreintes des corps versés), pas une sauvegarde de contenu.',
        ecritLe: new Date().toISOString(),
        manifesteEmpreintes: e.manifeste.genere_le,
        theme: { slug: THEME_SLUG, id: theme.id },
        documentsAvant: { parSource: existants.length, prefixeMARCHES: prefixe },
        textes: mesures.map((m) => ({
          id: m.fiche.id,
          source: m.fiche.source,
          verse: m.aVerser,
          titleFr: m.titre.fr,
          status: m.fiche.status,
          adoptionDate: m.adoption?.iso ?? null,
          publicationDate: m.publication?.iso ?? null,
          moniteurRef: m.fiche.moniteurRef,
          md5Corps: md5(m.corps),
          md5Annotations: md5(m.annotationsJson),
          lignes: m.lignes,
          toc: m.toc.length,
          ancres: m.ancres,
        })),
      },
      null,
      1,
    ) + '\n',
    'utf8',
  )
  p(`manifeste d'état antérieur écrit : ${manifesteLivraison}`)

  const auditAvant = await prisma.auditLog.count({ where: { action: 'DOC_PUBLISHED' } })
  const totalAvant = await prisma.document.count()

  const crees = await prisma.$transaction(
    async (tx) => {
      const ids: { id: string; source: string }[] = []
      for (const m of aVerser) {
        const f = m.fiche
        const d = await tx.document.create({
          data: {
            type: 'LEGISLATION',
            status: f.status,
            titleFr: m.titre.fr,
            bodyOriginal: m.corps,
            originalLang: 'fr',
            moniteurRef: f.moniteurRef,
            publicationDate: m.publication ? new Date(`${m.publication.iso}T00:00:00Z`) : null,
            adoptionDate: m.adoption ? new Date(`${m.adoption.iso}T00:00:00Z`) : null,
            source: f.source,
            summaryFr: f.note,
            annotationsJson: m.annotationsJson,
            themeLabels,
          },
        })
        await tx.documentTheme.create({ data: { documentId: d.id, themeId: theme.id, isPrimary: true, assignedBy: 'IMPORT' } })
        await tx.document.update({
          where: { id: d.id },
          data: { searchText: buildSearchText({ ...d, themeLabels } as never) },
        })
        await audit(
          {
            action: 'DOC_PUBLISHED',
            targetType: 'Document',
            targetId: d.id,
            meta: {
              op: 'importer-marches-publics',
              feuilleDeRoute: 'Lam — Prompt marchés publics (corpus), 27 août 2026, § 8.4',
              texte: f.id,
              source: f.source,
              piece: lirePrep(f).source.fichier,
              md5Piece: lirePrep(f).source.md5_txt,
              md5Corps: md5(m.corps),
              md5Annotations: md5(m.annotationsJson),
              lignes: m.lignes,
              toc: m.toc.length,
              articlesAncres: m.ancres,
              tetesSansAncre: m.tetesSansAncre,
              status: f.status,
              adoptionDate: m.adoption?.iso ?? null,
              publicationDate: m.publication?.iso ?? null,
              liantsEditoriaux: m.titre.morceauxEditoriaux,
              manifeste: manifesteLivraison,
            },
          },
          tx,
        )
        ids.push({ id: d.id, source: f.source })
      }
      return ids
    },
    { timeout: 120_000, maxWait: 30_000 },
  )

  // ⚠️ audit() avale ses erreurs : on RECOMPTE après la transaction (§ 10.4).
  const auditApres = await prisma.auditLog.count({ where: { action: 'DOC_PUBLISHED' } })
  if (auditApres < auditAvant + aVerser.length)
    throw new Error(`écriture NON ENTIÈREMENT AUDITÉE : AuditLog DOC_PUBLISHED ${auditAvant} → ${auditApres} (attendu ≥ ${auditAvant + aVerser.length})`)
  if (auditApres > auditAvant + aVerser.length)
    console.warn(`  ⚠ AuditLog ${auditAvant} → ${auditApres} : plus d'entrées que ce lot n'en écrit (écriture concurrente ?) — à vérifier au journal`)

  // RELECTURE : exactement 1 document par source, contenus à l'empreinte attendue.
  for (const m of aVerser) {
    const lus = await prisma.document.findMany({ where: { source: m.fiche.source }, select: { id: true, bodyOriginal: true, annotationsJson: true, titleFr: true, status: true } })
    if (lus.length !== 1) throw new Error(`relecture : ${lus.length} document(s) pour la source ${m.fiche.source}, 1 attendu — STOP`)
    if (md5(lus[0].bodyOriginal) !== md5(m.corps)) throw new Error(`relecture : ${m.fiche.source} — le corps n'a pas l'empreinte attendue`)
    if (md5(lus[0].annotationsJson ?? '') !== md5(m.annotationsJson)) throw new Error(`relecture : ${m.fiche.source} — annotationsJson n'a pas l'empreinte attendue`)
    if (lus[0].titleFr !== m.titre.fr || lus[0].status !== m.fiche.status) throw new Error(`relecture : ${m.fiche.source} — titre ou statut inattendu`)
  }
  const totalApres = await prisma.document.count()
  if (totalApres !== totalAvant + aVerser.length)
    throw new Error(`documents recomptés : ${totalApres} ≠ ${totalAvant} + ${aVerser.length} (la table vit — vérifier qui a écrit)`)
  const primaires = await prisma.documentTheme.count({ where: { themeId: theme.id, isPrimary: true } })
  if (primaires !== aVerser.length) throw new Error(`relecture : ${primaires} rattachements primaires pour ${aVerser.length} documents — STOP`)

  // ⚠️ HORS transaction : reindexDocument, un par document (vidage du cache de recherche).
  for (const c of crees) await reindexDocument(c.id)

  p()
  p(`✓ ${crees.length} documents créés sous « ${theme.labelFr} » :`)
  for (const c of crees) p(`  ${c.source.padEnd(38)} ${c.id}`)
  p(`  journal d'audit DOC_PUBLISHED ${auditAvant} → ${auditApres} (+${auditApres - auditAvant}, attendu ${aVerser.length} — recompté)`)
  p(`  réindexés un par un, hors transaction — le thème « ${theme.labelFr} » apparaît désormais en navigation`)
  p('  ÉTAPE SUIVANTE : npx tsx scripts/graphe-marches-publics.ts --apply')
}

main()
  .catch((e) => {
    console.error('\nÉCHEC :', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
