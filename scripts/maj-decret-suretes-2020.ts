/**
 * DÉCRET DU 9 AVRIL 2020 RÉFORMANT LE DROIT DES SÛRETÉS — MISE À JOUR DE LA FICHE.
 *
 *     npx tsx scripts/maj-decret-suretes-2020.ts                    # simulation, n'écrit rien
 *     npx tsx scripts/maj-decret-suretes-2020.ts --apply            # lancé par Me Vaval, elle seule
 *     npx tsx scripts/maj-decret-suretes-2020.ts --visas --apply    # + table des visas (§ 7.6, FACULTATIF)
 *     npx tsx scripts/maj-decret-suretes-2020.ts --cec --apply      # + le CITE vers LOI_CEC_2002 (§ 13.12a)
 *
 * ─── LES CINQ VOLETS (feuille de route du 26 août 2026, §§ 7.1, 7.3, 7.4, 7.5, 7.7) ─────────
 *  1. `adoptionDate` NULL → 2020-04-09 — la formule de promulgation du corps la porte
 *     (« Donné au Palais National, à Port-au-Prince, le 9 avril 2020 »), relue en séance.
 *  2. La tête « Article 600.- » redevient « Article 600 alinéas 3, 4 et 5.- » (J.O., ligne 340
 *     du .docx — SANS le guillemet ouvrant, convention de l'état courant du corps). SOUS GARDE
 *     § 6.5 : si la segmentation simulée ne rend pas l'IDENTITÉ PARFAITE des ancres, la tête
 *     n'est PAS écrite — repli documenté, remonté à Me Vaval (§ 13.10).
 *  3. Les renvois décret→Code civil (§ 7.4, patron Loi Filiation) : le MIROIR EXACT des blocs
 *     connexe CC→décret, LUS du Code civil à l'exécution — jamais retapés. Bijection
 *     machine-vérifiée dans les deux sens, 0 lien mort.
 *  4. Les CrossRef fiche-à-fiche (§ 7.5, patron IR 2005) : MODIFIE vers le Code civil et le
 *     Code de commerce ; ABROGE vers la Loi du 27 novembre 2008 (l'article 20 la NOMME — le
 *     kind affirme à bon droit, § 6.4) ; CITE vers les textes seulement VISÉS. Résolution PAR
 *     SOURCE, jamais par titre ni par date (DEUX décrets du 9 avril 2020 au corpus, § 6.1) ;
 *     entrées INDEX par number+type PUIS discrimination sur le titre, unicité exigée.
 *  5. L'index passe de 80/104 à 104/104 : 19 sujets AJOUTÉS (les 22 existants restent
 *     INTACTS, comparaison profonde § 11.7), chaque renvoi ajouté prouvé par l'oracle du
 *     radical (§ 8.3, méthode IR) — un renvoi qui échoue fait échouer le script.
 *
 * ─── CE QUE CE SCRIPT NE FAIT PAS ───────────────────────────────────────────────────────────
 *  · AUCUNE écriture sur le Code civil (§ 3.3) — byte-identité vérifiée après --apply (§ 11.2).
 *  · AUCUNE écriture sur le Code de commerce — c'est scripts/porter-titre-ii-code-commerce.ts
 *    (§ 7.8-7.9). Les blocs connexe décret→C.com viennent de LÀ, pas d'ici.
 *  · Le CITE vers LOI_CEC_2002 n'est PAS écrit par défaut : le visa dit « Loi du 26 juin
 *    2002 », la fiche s'intitule « Loi du 10 juillet 2002 » — correspondance NON prouvée
 *    (§ 13.12a). --cec l'inclut, sur décision de Me Vaval.
 *  · Les visas sans fiche LEGISLATION (Loi blanchiment du 14 février 2001, Décret BNDA du
 *    2 août 1989, les deux Pactes et la Convention américaine) sont CONSIGNÉS au rapport,
 *    sans ligne (§ 13.12b).
 *  · `effectiveDate` (2020-05-14) reste une HYPOTHÈSE ÉDITORIALE inchangée et signalée (§ 13.1).
 *  · La question des guillemets de citation (§ 13.2) n'est pas tranchée.
 *
 * ─── COORDINATION ───────────────────────────────────────────────────────────────────────────
 * Ce script et porter-titre-ii-code-commerce.ts écrivent tous deux l'annotationsJson du décret
 * (clés `connexe` disjointes par docId, mais lecture-modification-écriture globale) :
 * les lancer SÉQUENTIELLEMENT, jamais en parallèle. Ordre recommandé : A (celui-ci) → B → C.
 */
import { createHash } from 'node:crypto'
import { accessSync, constants, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../src/lib/db'
import {
  parseAnnotations,
  segmentAnnotated,
  prettyRef,
  type Annotations,
  type TocEntry,
  type AnnBlock,
  type IndexEntry,
  type ConnexeBlock,
  type CrossRefEntry,
  type ArtRef,
} from '../src/lib/legislation/annotated'
import { articleAnchorFromNum } from '../src/lib/doc/anchors'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

type BodyBlock = Extract<AnnBlock, { kind: 'body' }>
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex')
const plat = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const APPLY = process.argv.includes('--apply')
const VISAS = process.argv.includes('--visas') // § 7.6 — facultatif, proposé non prouvé
const CEC = process.argv.includes('--cec') // § 13.12a — décision de Me Vaval

const DIR = join(process.cwd(), 'scripts/data/decret-suretes')
const SOURCE = 'DECRET_SURETES'
const DOC_ID = 'cmrspgd9h0000yn8emki3dtw6'
/** Corps mesuré le 26 août 2026 (334 lignes, 49 758 c.). PREMIÈRE assertion de toutes. */
const MD5_DEPART = 'b5e6522caea217ca891dd1316079ef2d'
const TETE_600_AVANT = 'Article 600.-'
const TETE_600_APRES = 'Article 600 alinéas 3, 4 et 5.-' // J.O. l. 340, SANS le guillemet ouvrant (§ 7.3)

// ════════════════════════════════════════════════════════════════════════════════════════════
// § 7.5 — LA TABLE DES RENVOIS FICHE-À-FICHE. Chaque cible s'attrape par un discriminant
// unique ; le `vuRe` retrouve la ligne « Vu … » du corps (la note la cite VERBATIM, § 6.6).
// ════════════════════════════════════════════════════════════════════════════════════════════
type Cible = {
  n: number
  resolution: { source: string } | { number: string; type: 'INDEX'; titre: string }
  kind: 'MODIFIE' | 'ABROGE' | 'CITE'
  vuRe: RegExp | null // null = pas une ligne « Vu » (les deux MODIFIE et l'ABROGE ont leur propre note)
  note: (vu: string | null, art20Phrase: string | null) => string
  optionnel?: 'cec'
}
const CIBLES: Cible[] = [
  { n: 1, resolution: { source: 'CODE_CIVIL_ANNOTE' }, kind: 'MODIFIE', vuRe: /^Vu le Code Civil\b/,
    note: () => 'TITRE PREMIER du décret (articles 1er à 16) : dispositions modifiant le Code civil — Lois nº 28-1 (créée), 29, 32 et 33. Le kind MODIFIE affirme le dispositif (§ 6.4).' },
  { n: 2, resolution: { source: 'CODE_COMMERCE_ANNOTE' }, kind: 'MODIFIE', vuRe: /^Vu le Code du Commerce\b/,
    note: () => 'TITRE II du décret (articles 17 et 18) : dispositions modifiant le Code de commerce — articles 1611-1 et 1611-2 créés, article 92 abrogé, article 600 alinéas 3 à 5. Le kind MODIFIE affirme le dispositif (§ 6.4).' },
  { n: 3, resolution: { number: 'LM2009-14', type: 'INDEX', titre: 'gage sans dépossession' }, kind: 'ABROGE', vuRe: null,
    note: (_vu, a20) => `L’article 20 du décret la NOMME : « ${a20} » Le kind ABROGE affirme à bon droit (§ 6.4). La loi n’existe qu’en entrée d’Index du Moniteur, statut PUBLIE — ce renvoi SIGNALE l’abrogation, il ne crée pas de fiche (§ 13.4).` },
  { n: 4, resolution: { source: 'CC_VANDAL_II-G' }, kind: 'CITE', vuRe: /^Vu le Décret du 1er février 1965\b/,
    note: (vu) => `Visa du préambule : « ${vu} » — visa seulement, rien n’est affirmé sur le sort de ce texte (interdit nº 12).` },
  { n: 5, resolution: { source: 'CC_VANDAL_II-D' }, kind: 'CITE', vuRe: /^Vu la Loi du 13 septembre 1952\b/,
    note: (vu) => `Visa du préambule : « ${vu} » — visa seulement.` },
  { n: 6, resolution: { number: 'LM1995-50', type: 'INDEX', titre: 'étendant à toutes les banques' }, kind: 'CITE', vuRe: /^Vu le Décret du 19 mai 1995\b/,
    note: (vu) => `Visa du préambule : « ${vu} » — visa seulement (entrée d’Index du Moniteur).` },
  { n: 7, resolution: { source: 'LOI_BANQUES_2012' }, kind: 'CITE', vuRe: /^Vu la Loi du 14 mai 2012\b/,
    note: (vu) => `Visa du préambule : « ${vu} » — visa seulement.` },
  { n: 8, resolution: { source: 'LOI_CEC_2002' }, kind: 'CITE', vuRe: /^Vu la Loi du 26 juin 2002\b/, optionnel: 'cec',
    note: (vu) => `Visa du préambule : « ${vu} » — visa seulement. ⚠️ Le visa dit « Loi du 26 juin 2002 » ; la fiche liée s’intitule « Loi du 10 juillet 2002 » — même texte vraisemblable, correspondance non prouvée sur le J.O. (§ 13.12a).` },
  { n: 9, resolution: { source: 'CONSTITUTION_1987' }, kind: 'CITE', vuRe: /^Vu la Constitution\b/,
    note: (vu) => `Visa du préambule : « ${vu} » — visa seulement.` },
  { n: 10, resolution: { source: 'CODE_PENAL_ANNOTE' }, kind: 'CITE', vuRe: /^Vu le Code Pénal\b/,
    note: (vu) => `Visa du préambule : « ${vu} » — visa seulement.` },
  { n: 11, resolution: { source: 'CC_VANDAL_II-B-1' }, kind: 'CITE', vuRe: /^Vu la Loi du 17 août 1979\b/,
    note: (vu) => `Visa du préambule : « ${vu} » — visa seulement.` },
  { n: 12, resolution: { source: 'CC_VANDAL_II-H-1' }, kind: 'CITE', vuRe: /^Vu le Décret du 14 novembre 1980\b/,
    note: (vu) => `Visa du préambule : « ${vu} » — visa seulement.` },
  { n: 13, resolution: { source: 'CC_VANDAL_II-E' }, kind: 'CITE', vuRe: /^Vu le Décret du 20 mars 1981\b/,
    note: (vu) => `Visa du préambule : « ${vu} » — visa seulement.` },
  { n: 14, resolution: { source: 'CC_VANDAL_II-J' }, kind: 'CITE', vuRe: /^Vu la Loi du 30 août 1982\b/,
    note: (vu) => `Visa du préambule : « ${vu} » — visa seulement.` },
  { n: 15, resolution: { source: 'LOI_SIGNATURE_ELECTRONIQUE_2017' }, kind: 'CITE', vuRe: /^Vu la Loi du 14 février 2017\b/,
    note: (vu) => `Visa du préambule : « ${vu} » — visa seulement. ⚠️ TROIS fiches « signature électronique » au corpus : la source exacte, rien d’autre (§ 7.5).` },
]
/** Visas restés SANS fiche LEGISLATION — consignés, JAMAIS écrits (§ 13.12b). */
const VISAS_SANS_FICHE: [string, RegExp][] = [
  ['Convention américaine relative aux droits de l’homme (Loi du 18 août 1979)', /^Vu la Convention américaine\b/],
  ['Pacte international relatif aux droits civils et politiques (Décret du 23 novembre 1990)', /^Vu le Pacte International relatif aux droits civils\b/],
  ['Pacte international relatif aux droits économiques, sociaux et culturels (Décret du 31 janvier 2012)', /^Vu le Pacte International relatif aux droits économiques\b/],
  ['Loi du 14 février 2001 (blanchiment des avoirs)', /^Vu la Loi du 14 février 2001\b/],
  ['Décret du 2 août 1989 (Banque Nationale de Développement Agricole)', /^Vu le Décret du 2 août 1989\b/],
  ['Loi du 27 novembre 2008 (gage sans dépossession) — le visa existe AUSSI ; le renvoi nº 3 (ABROGE) repose sur l’article 20, pas sur ce visa', /^Vu la Loi du 27 novembre 2008\b/],
]

// ════════════════════════════════════════════════════════════════════════════════════════════
// § 7.7 — LES 19 SUJETS AJOUTÉS (couverture 80/104 → 104/104). Les 22 existants restent
// INTACTS. Chaque renvoi passe l'oracle du radical (§ 8.3) À L'EXÉCUTION — pas de confiance.
// Convention des ctRefs, MESURÉE sur l'existant : entiers pour les numéros simples, chaînes
// à TIRETS pour les numéros décimaux (jamais de point).
// ════════════════════════════════════════════════════════════════════════════════════════════
const SUJETS_AJOUTES: { subject: string; ctRefs: ArtRef[] }[] = [
  { subject: 'Abus de confiance (distraction du bien réservé)', ctRefs: ['1858-21'] },
  { subject: 'Accessoires de la créance nantie', ctRefs: ['1858-5'] },
  { subject: 'Chapitres du Code civil réorganisés par le décret (articles-vecteurs)', ctRefs: [2, 3, 10, 12, 13, 14, 15] },
  { subject: 'Compte bloqué (sommes payées au titre de la créance nantie)', ctRefs: ['1858-10'] },
  { subject: 'Consignation judiciaire (affectation spéciale, droit de préférence)', ctRefs: [1857] },
  { subject: 'Défaillance du débiteur (nantissement de créance)', ctRefs: ['1858-10', '1858-11'] },
  { subject: 'Dépenses de conservation du gage (remboursement au créancier)', ctRefs: [1850] },
  { subject: 'Dispositions contraires (abrogation générale) — clause balai', ctRefs: [21] },
  { subject: 'Fraction de créance (nantissement pour un temps déterminé)', ctRefs: ['1858-4'] },
  { subject: 'Fruits du bien gagé (imputation sur les intérêts, sur le capital)', ctRefs: [1852] },
  { subject: 'Gage et nantissement — équivalence des références législatives', ctRefs: [19] },
  { subject: 'Héritiers du débiteur et du créancier (indivisibilité du gage)', ctRefs: [1856] },
  { subject: 'Hypothèques (chapitres de la Loi nº 33 — structure)', ctRefs: [12] },
  { subject: 'Indemnité d’assurance (report de la réserve de propriété)', ctRefs: ['1858-18'] },
  { subject: 'Loi nº 28-1 « Sur les sûretés en général » (articles-vecteurs)', ctRefs: [2, 3] },
  { subject: 'Prêt sur gage (établissements autorisés) — règles commerciales réservées', ctRefs: [1858] },
  { subject: 'Produit et mélange du bien gagé (report du gage)', ctRefs: ['1849-1', '1849-2'] },
  { subject: 'Responsabilité civile et réserve de propriété (article 1170 alinéa 1)', ctRefs: ['1858-20'] },
  { subject: 'Somme supérieure à la dette garantie (différence due au constituant)', ctRefs: ['1858-12'] },
]

/** Radical d'un sujet (méthode IR § 8) : premier mot alphabétique aplati, amputé de ses deux
 *  dernières lettres au-delà de 5 caractères. */
function radical(sujet: string): string | null {
  const m = plat(sujet).match(/[a-z]{3,}/)
  if (!m) return null
  const w = m[0]
  return w.length > 5 ? w.slice(0, w.length - 2) : w
}

async function main() {
  const p = (s = '') => console.log(s)

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 0. GARDES D'UNICITÉ (§ 10.6) — résolution PAR SOURCE, jamais par titre ni par date
  // ══════════════════════════════════════════════════════════════════════════════════════════
  for (const src of [SOURCE, 'CODE_CIVIL_ANNOTE']) {
    const n = await prisma.document.count({ where: { source: src } })
    if (n !== 1) throw new Error(`§ 10.6 — ${n} documents pour source=${src}, il en faut exactement 1`)
  }
  const dec = await prisma.document.findFirstOrThrow({ where: { source: SOURCE } })
  if (dec.id !== DOC_ID) throw new Error(`§ 10.6 — la fiche de source ${SOURCE} est ${dec.id}, attendu ${DOC_ID}`)
  const cc = await prisma.document.findFirstOrThrow({
    where: { source: 'CODE_CIVIL_ANNOTE' },
    select: { id: true, titleFr: true, bodyOriginal: true, annotationsJson: true },
  })
  // § 11.2 — le Code civil n'est JAMAIS visé par ce script : empreintes capturées, re-vérifiées.
  const ccHash = { body: md5(cc.bodyOriginal), ann: md5(cc.annotationsJson!) }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 1. PREMIÈRE ASSERTION : l'empreinte du corps de départ — ou la relance PROUVÉE réversible
  // ══════════════════════════════════════════════════════════════════════════════════════════
  if (!dec.bodyOriginal || !dec.annotationsJson) throw new Error('fiche du décret sans corps ou sans annotations')
  const md5Corps = md5(dec.bodyOriginal)
  const lignes = dec.bodyOriginal.split('\n')
  const teteRestaureIdx = lignes.findIndex((l) => l.startsWith(TETE_600_APRES))
  const relance600 =
    teteRestaureIdx >= 0 &&
    md5(lignes.map((l, i) => (i === teteRestaureIdx ? TETE_600_AVANT + l.slice(TETE_600_APRES.length) : l)).join('\n')) === MD5_DEPART
  if (md5Corps !== MD5_DEPART && !relance600)
    throw new Error(
      `corps du décret : md5 ${md5Corps}, attendu ${MD5_DEPART} (état mesuré le 26 août 2026), ` +
        'et la substitution inverse de la tête de l’article 600 ne le retrouve pas non plus. ' +
        'Quelqu’un est passé : re-mesurer avant d’écrire.',
    )
  const ann = JSON.parse(dec.annotationsJson) as Annotations & Record<string, unknown>
  if (!parseAnnotations(dec.annotationsJson)) throw new Error('annotationsJson du décret illisible')
  if (ann.toc.length !== 22) throw new Error(`toc du décret : ${ann.toc.length} entrées, attendu 22 (§ 0 — complet, on n'y touche pas)`)
  const labels = (ann.labels ?? {}) as Record<string, string>

  // ── Segmentation AVANT (référence des ancres) ──
  const segAvant = segmentAnnotated(dec.bodyOriginal, ann.toc as TocEntry[])
  const bodyAvant = segAvant.filter((b): b is BodyBlock => b.kind === 'body' && !!b.anchor)
  const ancresAvant = bodyAvant.map((b) => b.anchor as string)
  const setAvant = new Set(ancresAvant)
  if (segAvant.filter((b) => b.kind === 'section').length !== ann.toc.length)
    throw new Error('état AVANT : la segmentation n’apparie pas toutes les entrées du toc')
  if (segAvant.map((b) => b.text).join('\n') !== dec.bodyOriginal) throw new Error('état AVANT : join ≠ corps')
  const labelsSansBloc = Object.keys(labels).filter((k) => !setAvant.has(k))
  if (labelsSansBloc.length) throw new Error(`labels sans bloc ancré : ${labelsSansBloc.join(', ')}`)
  const texteAvant = new Map<string, string>()
  for (const b of bodyAvant) if (!texteAvant.has(b.anchor!)) texteAvant.set(b.anchor!, b.text)

  // ── Sentinelles verbatim, LUES du corps (jamais retapées, § 6.6 / § 11.9) ──
  const lignePromulgation = lignes.find((l) => l.startsWith('Donné au Palais National'))
  if (!lignePromulgation || !lignePromulgation.includes('le 9 avril 2020'))
    throw new Error('formule de promulgation « Donné au Palais National …, le 9 avril 2020 » introuvable au corps')
  const SENTINELLES = [
    lignePromulgation,
    ...lignes.filter((l) => /MOÏSE|JOUTHE/.test(l)),
    lignes.find((l) => l.trim().startsWith('Vu la Constitution')) ?? '',
    lignes.find((l) => l.trim().startsWith('Article 19.-')) ?? '',
  ].filter(Boolean)
  if (SENTINELLES.length < 4) throw new Error(`sentinelles : ${SENTINELLES.length} seulement relevées du corps`)

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // VOLET 1 (§ 7.1) — adoptionDate
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const ADOPTION = new Date('2020-04-09T00:00:00Z')
  const adoptionDejaFaite = dec.adoptionDate !== null
  if (adoptionDejaFaite && dec.adoptionDate!.toISOString().slice(0, 10) !== '2020-04-09')
    throw new Error(`adoptionDate vaut déjà ${dec.adoptionDate!.toISOString()} — ne pas écraser sans lire`)

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // VOLET 2 (§ 7.3) — la tête de l'article 600, SOUS GARDE D'IDENTITÉ DES ANCRES (§ 6.5)
  // ══════════════════════════════════════════════════════════════════════════════════════════
  let corpsApres = dec.bodyOriginal
  let tete600Faite = relance600
  let tete600Refusee: string | null = null
  if (!relance600) {
    const tetes600 = lignes.filter((l) => l.startsWith(TETE_600_AVANT)).length
    if (tetes600 !== 1) throw new Error(`§ 7.3 — ${tetes600} lignes ouvrent par « ${TETE_600_AVANT} » (1 attendue)`)
    const i600 = lignes.findIndex((l) => l.startsWith(TETE_600_AVANT))
    const l2 = [...lignes]
    l2[i600] = TETE_600_APRES + l2[i600].slice(TETE_600_AVANT.length)
    const corpsCandidat = l2.join('\n')
    // Simulation : 104 têtes, ancres IDENTIQUES (art-600 compris), toc apparié, rien perdu.
    const segSim = segmentAnnotated(corpsCandidat, ann.toc as TocEntry[])
    const ancresSim = segSim.filter((b): b is BodyBlock => b.kind === 'body' && !!b.anchor).map((b) => b.anchor as string)
    const secsSim = segSim.filter((b) => b.kind === 'section').length
    const okAncres = JSON.stringify(ancresSim) === JSON.stringify(ancresAvant)
    const okSecs = secsSim === ann.toc.length
    const okJoin = segSim.map((b) => b.text).join('\n') === corpsCandidat
    if (okAncres && okSecs && okJoin) {
      corpsApres = corpsCandidat
      tete600Faite = true
    } else {
      // § 7.3 / § 13.10 — refus DOCUMENTÉ, le reste de la séance continue. Le chapeau de
      // l'article 18 conserve l'information ; l'issue de repli est à Me Vaval.
      tete600Refusee = `ancres identiques : ${okAncres} · en-têtes ${secsSim}/${ann.toc.length} · join : ${okJoin}`
    }
  }
  const lignesApres = corpsApres.split('\n')
  // § 11.4 — diff du corps : exactement la ligne du § 7.3, rien d'autre.
  {
    const base = relance600 ? corpsApres : dec.bodyOriginal
    const a = base.split('\n')
    const b = lignesApres
    if (a.length !== b.length) throw new Error('§ 11.4 — le nombre de lignes du corps a changé')
    const diffs = a.map((l, i) => (l === b[i] ? -1 : i)).filter((i) => i >= 0)
    const attendu = relance600 || !tete600Faite ? 0 : 1
    if (diffs.length !== attendu) throw new Error(`§ 11.4 — ${diffs.length} ligne(s) modifiée(s), attendu ${attendu}`)
  }
  for (const s of SENTINELLES) if (!corpsApres.includes(s)) throw new Error(`sentinelle disparue : « ${s.slice(0, 60)}… »`)

  // ── Segmentation APRÈS (celle qui fait foi pour tout le reste) ──
  const segApres = segmentAnnotated(corpsApres, ann.toc as TocEntry[])
  const bodyApres = segApres.filter((b): b is BodyBlock => b.kind === 'body' && !!b.anchor)
  const ancresApres = new Set(bodyApres.map((b) => b.anchor as string))
  if (bodyApres.length !== ancresApres.size) throw new Error('ancre émise deux fois après édition')
  for (const a of setAvant) if (!ancresApres.has(a)) throw new Error(`ancre ${a} perdue`)
  for (const a of ancresApres) if (!setAvant.has(a)) throw new Error(`ancre inattendue ${a}`)
  if (segApres.map((b) => b.text).join('\n') !== corpsApres) throw new Error('join ≠ corps après édition')
  const texteApres = new Map<string, string>()
  for (const b of bodyApres) if (!texteApres.has(b.anchor!)) texteApres.set(b.anchor!, b.text)

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // VOLET 3 (§ 7.4) — le MIROIR des connexes CC→décret, LU du Code civil
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const annCC = JSON.parse(cc.annotationsJson!) as Annotations & Record<string, unknown>
  const segCC = segmentAnnotated(cc.bodyOriginal, annCC.toc as TocEntry[])
  const ancresCC = new Set(segCC.filter((b): b is BodyBlock => b.kind === 'body' && !!b.anchor).map((b) => b.anchor as string))
  const paires: [string, string][] = [] // [ancre CC, ancre décret]
  if (Array.isArray(annCC.connexe)) throw new Error('connexe du Code civil est un TABLEAU — lecture de miroir impossible (D5)')
  for (const [aCC, blocs] of Object.entries((annCC.connexe ?? {}) as Record<string, ConnexeBlock[]>))
    for (const b of blocs)
      if (b.docId === dec.id) {
        if (!b.anchor) throw new Error(`§ 7.4 — bloc CC→décret sous ${aCC} sans ancre : miroir impossible`)
        paires.push([aCC, b.anchor])
      }
  if (!paires.length) throw new Error('§ 7.4 — aucun bloc connexe CC→décret lu du Code civil : rien à refléter')
  for (const [aCC, aDec] of paires) {
    if (!ancresCC.has(aCC)) throw new Error(`§ 7.4 — l'ancre CC ${aCC} n'est pas rendue par la segmentation du Code civil`)
    if (!ancresApres.has(aDec)) throw new Error(`§ 7.4 — l'ancre décret ${aDec} citée par le Code civil n'existe pas sur la fiche`)
    if (!(aDec in labels)) throw new Error(`§ 7.4 — l'ancre décret ${aDec} n'a pas de label`)
  }
  const LABEL_CC = `${cc.titleFr} (texte à jour)`
  const connexeDec = ((ann.connexe as Record<string, ConnexeBlock[]> | undefined) ?? {}) as Record<string, ConnexeBlock[]>
  ann.connexe = connexeDec
  // Idempotence : les blocs décret→CC de CE script se remplacent, jamais ne s'empilent —
  // et les blocs vers d'AUTRES documents (Code de commerce, § 7.9) ne sont pas touchés.
  for (const d of new Set(paires.map(([, aDec]) => aDec))) connexeDec[d] = (connexeDec[d] ?? []).filter((b) => b.docId !== cc.id)
  for (const [aCC, aDec] of paires)
    connexeDec[aDec].push({
      label: LABEL_CC,
      text: `Texte porté au Code civil : article ${prettyRef(aCC.slice(4))} (texte à jour).`,
      docId: cc.id,
      anchor: aCC,
    })
  // ── BIJECTION (§ 8.1), machine, les deux sens ──
  const pairesCC = new Set(paires.map(([aCC, aDec]) => `${aCC}|${aDec}`))
  const pairesDec = new Set<string>()
  for (const [aDec, blocs] of Object.entries(connexeDec)) for (const b of blocs) if (b.docId === cc.id) pairesDec.add(`${b.anchor}|${aDec}`)
  for (const x of pairesCC) if (!pairesDec.has(x)) throw new Error(`bijection rompue (CC→décret sans miroir) : ${x}`)
  for (const x of pairesDec) if (!pairesCC.has(x)) throw new Error(`bijection rompue (décret→CC sans original) : ${x}`)

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // VOLET 4 (§ 7.5) — les CrossRef fiche-à-fiche. La confrontation des 20 visas REFAITE.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const lignesVu = lignes.filter((l) => l.trim().startsWith('Vu '))
  if (lignesVu.length !== 20) throw new Error(`§ 7.5 — ${lignesVu.length} lignes « Vu … » au corps, attendu 20`)
  const vuDe = (re: RegExp | null): string | null => {
    if (!re) return null
    const hits = lignesVu.filter((l) => re.test(l.trim()))
    if (hits.length !== 1) throw new Error(`§ 7.5 — ${hits.length} lignes « Vu » pour ${re} (1 attendue)`)
    return hits[0].trim().replace(/\s*;\s*$/, '')
  }
  // La phrase de l'article 20 qui NOMME la loi de 2008 — LUE du corps (§ 6.6).
  const art20 = texteApres.get('art-20')
  if (!art20 || !art20.includes('27 novembre 2008')) throw new Error('l’article 20 ne nomme pas la Loi du 27 novembre 2008 — le kind ABROGE ne peut pas s’affirmer')
  const art20Phrase = art20
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.includes('27 novembre 2008'))!
    .replace(/^Article\s+20\s*\.\-\s*/, '') // la tête n'est pas la phrase — la citation reste verbatim
  // Partition des 20 visas : chaque ligne est soit appariée à une cible, soit consignée.
  const vusApparies = new Set<string>()
  const resolues: {
    n: number
    kind: string
    toId: string
    toType: string | null
    toNumber: string | null
    toLabel: string
    note: string
    ecarte: boolean
  }[] = []
  for (const c of CIBLES) {
    let cible: { id: string; titleFr: string } | null = null
    if ('source' in c.resolution) {
      const docs = await prisma.document.findMany({ where: { source: c.resolution.source }, select: { id: true, titleFr: true } })
      if (docs.length !== 1) throw new Error(`§ 10.6 — ${docs.length} documents pour source=${c.resolution.source}, il en faut exactement 1`)
      cible = docs[0]
    } else {
      // Entrée INDEX : number + type PUIS discrimination sur le titre — unicité exigée (§ 7.5).
      const docs = await prisma.document.findMany({
        where: { number: c.resolution.number, type: c.resolution.type },
        select: { id: true, titleFr: true },
      })
      const gardes = docs.filter((d) => plat(d.titleFr).includes(plat(('titre' in c.resolution && c.resolution.titre) || '')))
      if (gardes.length !== 1)
        throw new Error(
          `§ 7.5 — ${c.resolution.number} : ${docs.length} entrées d'index, ${gardes.length} après discrimination sur « ${'titre' in c.resolution ? c.resolution.titre : ''} » (1 exigée)`,
        )
      cible = gardes[0]
    }
    const vu = vuDe(c.vuRe)
    if (c.vuRe) vusApparies.add(vuDe(c.vuRe)!)
    resolues.push({
      n: c.n,
      kind: c.kind,
      toId: cible.id,
      toType: 'number' in c.resolution ? 'INDEX' : null,
      toNumber: 'number' in c.resolution ? c.resolution.number : null,
      toLabel: cible.titleFr,
      note: c.note(vu, art20Phrase),
      ecarte: c.optionnel === 'cec' && !CEC,
    })
  }
  const vusConsignes: string[] = []
  for (const [nom, re] of VISAS_SANS_FICHE) {
    const hit = lignesVu.find((l) => re.test(l.trim()))
    if (!hit) throw new Error(`§ 7.5 — visa attendu introuvable au corps : ${nom}`)
    vusApparies.add(hit.trim().replace(/\s*;\s*$/, ''))
    vusConsignes.push(nom)
  }
  // La ligne « Vu la Loi du 27 novembre 2008 » est déjà comptée côté consignés ; toute ligne
  // « Vu » ni appariée ni consignée est une lacune de la confrontation → refus.
  const vusOrphelins = lignesVu.map((l) => l.trim().replace(/\s*;\s*$/, '')).filter((l) => !vusApparies.has(l))
  if (vusOrphelins.length) throw new Error(`§ 7.5 — visas ni appariés ni consignés :\n  ${vusOrphelins.join('\n  ')}`)
  // Doublons & existants
  const aEcrire = resolues.filter((r) => !r.ecarte)
  if (new Set(aEcrire.map((r) => `${r.toId}|${r.kind}`)).size !== aEcrire.length) throw new Error('§ 7.5 — deux renvois partagent (toId, kind)')
  const xrefExistants = await prisma.crossRef.findMany({ where: { fromId: dec.id } })
  const dejaLa = aEcrire.filter((r) => xrefExistants.some((e) => e.toId === r.toId && e.kind === r.kind))
  const aCreer = aEcrire.filter((r) => !xrefExistants.some((e) => e.toId === r.toId && e.kind === r.kind))
  const posMax = xrefExistants.reduce((m, e) => Math.max(m, e.position), 0)

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // VOLET 5 (§ 7.7) — l'index : 80/104 → 104/104, les 22 sujets d'origine INTACTS
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const indexAvant = ann.indexEntries as IndexEntry[]
  const indexAvantJson = JSON.stringify(indexAvant)
  const sujetsAvant = new Set(indexAvant.map((e) => plat(e.subject)))
  for (const s of SUJETS_AJOUTES)
    if (sujetsAvant.has(plat(s.subject))) throw new Error(`§ 7.7 — le sujet « ${s.subject} » existe déjà : on n'étend pas un sujet existant`)
  // Oracle § 8.3 : le radical de chaque sujet ajouté DOIT se trouver dans chaque article cité.
  const oracleEchecs: string[] = []
  for (const s of SUJETS_AJOUTES) {
    const rad = radical(s.subject)
    if (!rad) throw new Error(`§ 7.7 — sujet sans radical : « ${s.subject} »`)
    for (const ref of s.ctRefs) {
      if (typeof ref === 'string' && ref.includes('.')) throw new Error(`§ 7.7 — ctRef « ${ref} » en points (tirets exigés)`)
      const ancre = articleAnchorFromNum(String(ref))
      const texte = texteApres.get(ancre)
      if (!texte) throw new Error(`§ 7.7 — renvoi mort : « ${s.subject} » → ${ancre}`)
      if (!plat(texte).includes(rad)) oracleEchecs.push(`« ${s.subject} » (radical « ${rad} ») → ${ancre}`)
    }
  }
  if (oracleEchecs.length)
    throw new Error(`§ 8.3 — ${oracleEchecs.length} renvoi(s) ajoutés dont le radical est absent de l'article cité :\n  ${oracleEchecs.join('\n  ')}`)
  // Insertion alphabétique SANS toucher aux entrées existantes ni à leur ordre relatif.
  // Idempotence : ne ré-ajoute pas un sujet déjà inséré par une exécution précédente.
  const indexApres: IndexEntry[] = indexAvant.map((e) => e)
  let sujetsInseres = 0
  for (const s of SUJETS_AJOUTES) {
    if (indexApres.some((e) => plat(e.subject) === plat(s.subject))) continue
    let i = indexApres.findIndex((e) => plat(e.subject).localeCompare(plat(s.subject)) > 0)
    if (i < 0) i = indexApres.length
    indexApres.splice(i, 0, { subject: s.subject, ctRefs: [...s.ctRefs] })
    sujetsInseres++
  }
  ann.indexEntries = indexApres
  // § 11.7 — couverture INTÉGRALE (comptée sur le produit, aucun nombre fixe), 0 renvoi mort,
  // les sujets préexistants INTACTS (comparaison profonde).
  const couverts = new Set<string>()
  for (const e of indexApres)
    for (const ref of e.ctRefs) {
      const ancre = articleAnchorFromNum(String(ref))
      if (!ancresApres.has(ancre)) throw new Error(`§ 11.7 — renvoi d'index mort : « ${e.subject} » → ${ancre}`)
      couverts.add(ancre)
    }
  const nonCouverts = [...ancresApres].filter((a) => !couverts.has(a))
  if (nonCouverts.length) throw new Error(`§ 11.7 — couverture ${couverts.size}/${ancresApres.size} : articles sans entrée ${nonCouverts.join(', ')}`)
  if (JSON.stringify(indexApres.filter((e) => sujetsAvant.has(plat(e.subject)))) !== indexAvantJson)
    throw new Error('§ 11.7 — les sujets préexistants ne ressortent pas INTACTS (comparaison profonde)')

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // § 7.6 (FACULTATIF, --visas) — la table des visas, patron IMF
  // ══════════════════════════════════════════════════════════════════════════════════════════
  let visasTable: CrossRefEntry | null = null
  if (VISAS) {
    const ANCRE_VISAS = 'sec-1' // « DÉCRÈTE » — comme le Décret IMF ; § 11.6 : l'ancre est au toc
    if (!(ann.toc as TocEntry[]).some((t) => t.anchor === ANCRE_VISAS)) throw new Error(`§ 11.6 — ancre ${ANCRE_VISAS} absente du toc`)
    visasTable = {
      anchor: ANCRE_VISAS,
      articles: [],
      note:
        'Décret donné au Palais National le 9 avril 2020, publié au Journal officiel « Le Moniteur », ' +
        'Spécial N° 7 du 14 mai 2020. Textes visés au préambule et déjà disponibles sur la plateforme :',
      docs: aEcrire.filter((r) => r.kind !== 'ABROGE').map((r) => ({ label: r.toLabel, id: r.toId })),
    }
    const exist = (ann.crossRefs as CrossRefEntry[] | undefined) ?? []
    ann.crossRefs = [...exist.filter((c) => c.anchor !== ANCRE_VISAS), visasTable]
  }

  const annotationsApres = JSON.stringify(ann)
  if (!parseAnnotations(annotationsApres)) throw new Error('le JSON d’annotations produit n’est pas relisible')

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // RAPPORT CHIFFRÉ — avant toute écriture (§ 10.3)
  // ══════════════════════════════════════════════════════════════════════════════════════════
  p('══════════════════════════════════════════════════════════════════════════════════')
  p('  MISE À JOUR — Décret du 9 avril 2020 réformant le Droit des Sûretés (fiche)')
  p(`  ${dec.id} · source ${SOURCE} · statut ${dec.status} · drapeaux : --visas=${VISAS} --cec=${CEC}`)
  p('══════════════════════════════════════════════════════════════════════════════════')
  p()
  p('CORPS')
  p(`  avant : ${lignes.length} lignes · ${dec.bodyOriginal.length} caractères · md5 ${md5Corps}${relance600 ? ' (relance : tête déjà restaurée, prouvé par substitution inverse)' : ''}`)
  p(`  après : ${lignesApres.length} lignes · ${corpsApres.length} caractères · md5 ${md5(corpsApres)}`)
  p(`  ancres : ${ancresApres.size} — IDENTIQUES à l'avant (ensemble comparé) · toc ${ann.toc.length}/${ann.toc.length} apparié · join OK`)
  p()
  p('─── VOLET 1 (§ 7.1) — adoptionDate ────────────────────────────────────────────────')
  p(`  ${dec.adoptionDate?.toISOString().slice(0, 10) ?? 'NULL'} → 2020-04-09${adoptionDejaFaite ? '  (déjà faite)' : ''}`)
  p(`  appui, LU du corps : « ${lignePromulgation.slice(0, 96)} »`)
  p(`  publicationDate ${dec.publicationDate?.toISOString().slice(0, 10)} et effectiveDate ${dec.effectiveDate?.toISOString().slice(0, 10)} INCHANGÉES`)
  p('  ⚠ effectiveDate = hypothèse éditoriale (aucune clause d’entrée en vigueur au texte) — § 13.1, non tranchée ici')
  p()
  p('─── VOLET 2 (§ 7.3) — la tête de l’article 600 ────────────────────────────────────')
  if (relance600) p('  déjà restaurée (relance) — aucune ligne ne change')
  else if (tete600Faite) {
    p(`  « ${TETE_600_AVANT} » → « ${TETE_600_APRES} » (1 ligne modifiée, 0 ajoutée, 0 supprimée)`)
    p('  garde § 6.5 : segmentation simulée — ancres STRICTEMENT identiques (art-600 compris), toc apparié, join OK ✓')
    p(`  label d'affichage : « ${labels['art-600'] ?? '∅'} » — déjà cohérent (dit « al. 3 à 5 »), non modifié`)
  } else {
    p(`  ⛔ REFUSÉE (garde § 6.5) : ${tete600Refusee}`)
    p('  → repli § 13.10 : la tête reste « Article 600.- », le chapeau de l’art. 18 conserve l’information.')
    p('    L’issue (note d’annotation plutôt que tête) appartient à Me Vaval.')
  }
  p()
  p('─── VOLET 3 (§ 7.4) — les renvois décret→Code civil, miroir des blocs CC→décret ───')
  p(`  ${paires.length} paires LUES du Code civil (${cc.id}) — jamais retapées`)
  p(`  ${paires.length} blocs miroir écrits sur la fiche du décret · label « ${LABEL_CC} »`)
  p(`  bijection machine (§ 8.1) : ${pairesCC.size}/${pairesDec.size} dans les deux sens ✓ · 0 ancre citée absente (labels + segmentation des deux cibles) ✓`)
  p(`  ancres du décret couvertes : ${new Set(paires.map(([, d]) => d)).size} distinctes`)
  p('  (le versant Code de commerce, § 7.9, appartient à scripts/porter-titre-ii-code-commerce.ts)')
  p()
  p('─── VOLET 4 (§ 7.5) — les CrossRef fiche-à-fiche ──────────────────────────────────')
  p(`  confrontation des 20 visas REFAITE en séance : ${lignesVu.length} lignes « Vu » · toutes appariées ou consignées ✓`)
  for (const r of resolues) {
    const etat = r.ecarte ? 'ÉCARTÉ (--cec absent, § 13.12a)' : dejaLa.some((d) => d.n === r.n) ? 'DÉJÀ EN BASE' : 'à créer'
    p(`  ${String(r.n).padStart(2)}. [${etat}] ${r.kind.padEnd(7)} → ${r.toId}  ${r.toLabel.slice(0, 76)}`)
  }
  p(`  appui de l'ABROGE, LU de l'article 20 : « ${art20Phrase.slice(0, 110)}… »`)
  p('  CONSIGNÉS SANS LIGNE (§ 13.12b — le choix appartient à Me Vaval) :')
  for (const v of vusConsignes) p(`    · ${v}`)
  p()
  p('─── VOLET 5 (§ 7.7) — l’index : 80/104 → 104/104 ──────────────────────────────────')
  p(`  sujets : ${indexAvant.length} → ${indexApres.length} (+${sujetsInseres} insérés alphabétiquement, 22 existants INTACTS — comparaison profonde ✓)`)
  p(`  couverture : ${couverts.size}/${ancresApres.size} articles · 0 renvoi mort · ctRefs en tirets ✓`)
  p(`  oracle § 8.3 : ${SUJETS_AJOUTES.reduce((n, s) => n + s.ctRefs.length, 0)} renvois ajoutés, radical trouvé dans CHAQUE article cité ✓`)
  for (const s of SUJETS_AJOUTES) p(`    + « ${s.subject.slice(0, 74)} » → ${s.ctRefs.join(', ')}`)
  p('  convention MESURÉE de l’existant : entiers pour les numéros simples, chaînes à tirets pour les décimaux — ajouts alignés')
  p('  ⚠ densité au-delà de la couverture : choix éditorial de Me Vaval (§ 13.9)')
  p()
  if (VISAS) {
    p('─── § 7.6 (--visas) — table des visas, patron IMF ─────────────────────────────────')
    p(`  bloc crossRefs sous ${visasTable!.anchor} (au toc ✓) · ${visasTable!.docs!.length} textes liés (l'ABROGE n'y figure pas : il a sa ligne CrossRef)`)
  } else p('─── § 7.6 — table des visas : NON demandée (--visas absent ; facultative, § 7.6) ──')
  p()

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // ÉCRITURE
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
  const fichierEtat = join(DIR, `etat-anterieur-maj-decret-${horodatage}.json`)
  const etatAnterieur = {
    _lisezMoi:
      'État de la fiche du décret AVANT scripts/maj-decret-suretes-2020.ts --apply. ' +
      'Le Code civil n’est pas touché (empreintes de référence ci-dessous).',
    ecritLe: new Date().toISOString(),
    drapeaux: { visas: VISAS, cec: CEC },
    decret: {
      id: dec.id,
      source: SOURCE,
      adoptionDate: dec.adoptionDate,
      md5BodyOriginal: md5Corps,
      bodyOriginal: dec.bodyOriginal,
      annotationsJson: dec.annotationsJson,
      crossRefsExistants: xrefExistants,
    },
    codeCivil: { id: cc.id, md5BodyOriginal: ccHash.body, md5AnnotationsJson: ccHash.ann },
  }

  if (!APPLY) {
    accessSync(DIR, constants.W_OK)
    p(`ÉTAT ANTÉRIEUR — serait écrit dans ${fichierEtat}`)
    p()
    p('CE QUI SERAIT ÉCRIT')
    p(`  Document ${dec.id} : adoptionDate${tete600Faite && !relance600 ? ', bodyOriginal (1 ligne)' : ''}, annotationsJson, searchText`)
    p(`  CrossRef : ${aCreer.length} créé(s)${dejaLa.length ? ` · ${dejaLa.length} déjà en base` : ''}${resolues.some((r) => r.ecarte) ? ' · 1 écarté (--cec)' : ''}`)
    p(`  AuditLog : 1 ARTICLE_AMENDED + ${aCreer.length} CROSSREF_ADDED`)
    p('  reindexDocument : 1 document, HORS transaction')
    p()
    p('SIMULATION — rien n’a été écrit. --apply est réservé à Me Vaval.')
    await prisma.$disconnect()
    return
  }

  // L'état antérieur AVANT la transaction : si le fichier ne s'écrit pas, rien n'a bougé (§ 10.7).
  writeFileSync(fichierEtat, JSON.stringify(etatAnterieur, null, 1) + '\n', 'utf8')
  p(`état antérieur sauvegardé : ${fichierEtat}`)

  const searchText = buildSearchText({ ...dec, bodyOriginal: corpsApres, annotationsJson: annotationsApres } as never)
  const auditAvant = await prisma.auditLog.count()
  const xrefTotalAvant = await prisma.crossRef.count()
  await prisma.$transaction(
    async (tx) => {
      await tx.document.update({
        where: { id: dec.id },
        data: { adoptionDate: ADOPTION, bodyOriginal: corpsApres, annotationsJson: annotationsApres, searchText },
      })
      let pos = posMax
      for (const r of aCreer) {
        const cree = await tx.crossRef.create({
          data: {
            fromId: dec.id,
            toId: r.toId,
            toType: r.toType,
            toNumber: r.toNumber,
            toLabel: r.toLabel,
            kind: r.kind,
            note: r.note,
            source: 'EDITORIAL',
            position: ++pos,
          },
        })
        await audit(
          { action: 'CROSSREF_ADDED', targetType: 'Document', targetId: dec.id,
            meta: { refId: cree.id, kind: r.kind, toId: r.toId, position: pos, motif: `§ 7.5 — renvoi nº ${r.n} (${r.toLabel.slice(0, 60)})` } },
          tx,
        )
      }
      await audit(
        {
          action: 'ARTICLE_AMENDED',
          targetType: 'Document',
          targetId: dec.id,
          meta: {
            source: SOURCE,
            motif:
              'Mise à jour § 7.1/7.3/7.4/7.7 : adoptionDate 2020-04-09 ; tête de l’article 600 ' +
              (tete600Faite ? 'restaurée (« alinéas 3, 4 et 5 », J.O. l. 340)' : 'REFUSÉE par la garde § 6.5 (repli § 13.10)') +
              ` ; ${paires.length} blocs connexe décret→Code civil (miroir) ; index ${indexAvant.length}→${indexApres.length} sujets, couverture ${couverts.size}/${ancresApres.size}` +
              (VISAS ? ' ; table des visas § 7.6' : ''),
            fichierEtatAnterieur: fichierEtat,
            // Des EMPREINTES, jamais le corps entier (§ 10.7).
            avant: { md5BodyOriginal: md5Corps, md5AnnotationsJson: md5(dec.annotationsJson!), adoptionDate: null, sujets: indexAvant.length },
            apres: { md5BodyOriginal: md5(corpsApres), md5AnnotationsJson: md5(annotationsApres), adoptionDate: '2020-04-09', sujets: indexApres.length },
            effectiveDateHypothese: '2020-05-14 — hypothèse éditoriale, aucune clause d’entrée en vigueur au texte (§ 13.1)',
            visasConsignesSansLigne: vusConsignes,
            cecEcarte: resolues.some((r) => r.ecarte),
          },
        },
        tx,
      )
    },
    { timeout: 120_000, maxWait: 30_000 },
  )

  // ⚠️ HORS transaction : reindexDocument (buildSearchText + clearSearchCache).
  await reindexDocument(dec.id)

  // ⚠️ audit() avale ses erreurs : tout se RELIT (§ 10.4).
  const auditApres = await prisma.auditLog.count()
  const xrefTotalApres = await prisma.crossRef.count()
  const xrefFrom = await prisma.crossRef.count({ where: { fromId: dec.id } })
  const relu = await prisma.document.findUniqueOrThrow({ where: { id: dec.id } })
  if (relu.adoptionDate?.toISOString().slice(0, 10) !== '2020-04-09') throw new Error('relecture : adoptionDate n’a pas la valeur attendue')
  if (relu.publicationDate?.toISOString() !== dec.publicationDate?.toISOString()) throw new Error('relecture : publicationDate a bougé')
  if (relu.effectiveDate?.toISOString() !== dec.effectiveDate?.toISOString()) throw new Error('relecture : effectiveDate a bougé')
  if (relu.titleFr !== dec.titleFr || relu.number !== dec.number) throw new Error('relecture : titleFr/number ont bougé')
  if (md5(relu.bodyOriginal) !== md5(corpsApres)) throw new Error('relecture : le corps n’a pas l’empreinte attendue')
  if (md5(relu.annotationsJson ?? '') !== md5(annotationsApres)) throw new Error('relecture : annotationsJson n’a pas l’empreinte attendue')
  const segRelu = segmentAnnotated(relu.bodyOriginal, (JSON.parse(relu.annotationsJson!) as Annotations).toc)
  if (segRelu.filter((b) => b.kind === 'section').length !== ann.toc.length) throw new Error('relecture : segmentation désappariée')
  if (segRelu.map((b) => b.text).join('\n') !== relu.bodyOriginal) throw new Error('relecture : join ≠ corps')
  if (xrefTotalApres !== xrefTotalAvant + aCreer.length)
    throw new Error(`CrossRef recomptées : ${xrefTotalApres} ≠ ${xrefTotalAvant} + ${aCreer.length} (la table vit — vérifier qui a écrit)`)
  // § 11.2 — le Code civil est BYTE-IDENTIQUE.
  const ccApres = await prisma.document.findFirstOrThrow({ where: { source: 'CODE_CIVIL_ANNOTE' }, select: { bodyOriginal: true, annotationsJson: true } })
  if (md5(ccApres.bodyOriginal) !== ccHash.body || md5(ccApres.annotationsJson!) !== ccHash.ann)
    throw new Error('§ 11.2 — LE CODE CIVIL A BOUGÉ PENDANT LA SÉANCE — vérifier immédiatement (aucune écriture de ce script ne le vise)')

  p()
  p(`✓ Fiche mise à jour : ${dec.id}`)
  p(`  adoptionDate 2020-04-09 · tête 600 ${tete600Faite ? 'fidèle au J.O.' : 'refusée (repli § 13.10)'} · ${paires.length} connexes miroir · index ${indexApres.length} sujets (${couverts.size}/${ancresApres.size})`)
  p(`  CrossRef sortants : ${xrefFrom} (${aCreer.length} créés) · journal d'audit ${auditAvant} → ${auditApres} (+${auditApres - auditAvant}, attendu ${1 + aCreer.length} — recompté, audit() avale ses erreurs)`)
  p(`  Code civil byte-identique (${ccHash.body}) ✓ · réindexé, cache de recherche vidé`)
  if (auditApres - auditAvant < 1 + aCreer.length) {
    p('⛔ L’ÉCRITURE EST FAITE MAIS PAS ENTIÈREMENT JOURNALISÉE — audit() avale ses erreurs.')
    p(`   État antérieur récupérable : ${fichierEtat}`)
    process.exitCode = 1
  }
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('\nÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
