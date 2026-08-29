/**
 * C · LE GRAPHE DES MARCHÉS PUBLICS — pastilles, replis, ArticleVersion, CrossRef, Index.
 * (Feuille de route « Lam — Prompt marchés publics (corpus) », 27 août 2026, § 6, § 7, § 8.5, § 8.6.)
 *
 *     npx tsx scripts/graphe-marches-publics.ts             # simulation — n'écrit rien
 *     npx tsx scripts/graphe-marches-publics.ts --apply     # écriture — Me Vaval, elle seule
 *
 * TROISIÈME des trois scripts : A (thème) → B (les 25 textes) → **C**.
 * Il EXIGE que B ait été appliqué : chaque `source` doit résoudre exactement UN document,
 * dont le corps porte l'empreinte du corps préparé. Sinon, il refuse.
 *
 * La consigne de la cliente, verbatim : « certains amendent d'autres textes. il faut prévoir
 * les pastilles et les replis. » C'est ce script.
 *
 * ─── CE QU'IL POSE ──────────────────────────────────────────────────────────────────────
 *  1. STATUTS DE DOCUMENT — les deux ABROGE d'emblée, avec la clause qui les fonde :
 *     · le Décret du 3 décembre 2004, par l'ARTICLE 99 de la Loi du 10 juin 2009, qui le
 *       NOMME. ⚠️ Pas l'article 97 : celui-là MAINTIENT le décret pour les marchés et
 *       avenants déjà approuvés — c'est une clause de TRANSITION, et la note le dit ;
 *     · l'Arrêté du 9 janvier 2019, par l'article 15 de l'Arrêté du 12 février 2020.
 *     Les deux statuts sont posés dès B ; C écrit la NOTE et le renvoi qui les fondent, et
 *     REFUSE si le statut lu en base n'est pas celui-là.
 *  2. ARTICLES AMENDÉS — articles 227 et 227-1 de l'arrêté modalités 2009 :
 *     pastille `status = « modifié »`, ancienne rédaction repliée (`oldVersions`), renvoi
 *     cliquable vers le modificateur (`connexe`), et DEUX `ArticleVersion` par article
 *     (seq 0 MODIFIE = rédaction 2009 · seq 1 EN_VIGUEUR = rédaction 2020). La version
 *     AFFICHÉE est la version en vigueur ; l'ancienne se replie, jamais l'inverse.
 *     ⚠️ MESURE QUI COMMANDE LE PAYLOAD : la rédaction nouvelle est CITÉE ENTRE GUILLEMETS
 *     par le modificateur. Portée telle quelle dans `ArticleVersion.body`, elle produit une
 *     TÊTE EN DOUBLE au lecteur — `applyAmendments` (segment.ts l. 74) ne reconnaît pas une
 *     tête d'article derrière un guillemet et rajoute la sienne : « Article 227.- « Article
 *     227.- Le Comité… ». Le payload est donc le verbatim DÉGUILLEMETÉ DE BORD, et c'est
 *     PROUVÉ réversible ici : hors guillemets et blancs, les deux états sont le même texte.
 *     Le corps du modificateur, lui, n'est pas touché — la citation reste intacte.
 *  3. ARTICLE 2 DE L'ARRÊTÉ DÉFENSE 2020 — pastille + note exposant la clause,
 *     **SANS substitution du corps** : l'étendue n'est pas tranchée (§ 13.4, interdit n° 7).
 *     Ni `oldVersions`, ni `ArticleVersion` tant que Me Vaval n'a pas répondu.
 *     ⚠️ La liste de cet article compte DOUZE catégories, pas onze : la rédaction de 2019 en
 *     portait onze, celle de 2020 a inséré « Les marchés publics de l'électricité ».
 *  4. LES RENVOIS — le graphe des § 6-7, arête par arête, chaque `kind` justifié par SA
 *     clause, extraite du corps et RE-VÉRIFIÉE ici sur le corps EN BASE. Un considérant ne
 *     fonde jamais un MODIFIE ni un ABROGE (§ 6, interdit n° 9) — et cela se MESURE : la
 *     frontière du dispositif est la ligne « ARRÊTE » / « DÉCRÈTE » seule sur sa ligne, et
 *     une clause située avant elle ne peut fonder qu'un CITE. Le champ `fondement` ne fait
 *     plus foi : jusqu'au 28 août, réétiqueter un considérant « dispositif (…) » suffisait à
 *     en faire un MODIFIE sans qu'aucune garde ne parle. Toute cible absente du
 *     corpus est un renvoi EN CLAIR : `toId`, `toType`, `toNumber` tous nuls, la désignation
 *     dans `toLabel` (interdit n° 5).
 *  5. LES RATTACHEMENTS D'INDEX — résolution en DEUX temps (§ 8.6) : `number` + `type INDEX`
 *     restreint au FASCICULE, puis l'entrée désignée par son `id`, contrôlée en relisant son
 *     `titleFr`. Le titre DÉPARTE, il n'est jamais la clé ; la `source` seule est un
 *     discriminant NUL. Les chaînes d'erratum sont rattachées DES DEUX CÔTÉS. Les deux faux
 *     amis (LM1974-79, LM1996-15) sont exclus nommément.
 *
 * ─── CE QU'IL NE FAIT PAS ───────────────────────────────────────────────────────────────
 *  · Aucun ABROGE sur les arrêtés de seuils 2012 et 2021 (interdit n° 6) : ils sont remplacés
 *    EN FAIT depuis le 1er octobre 2022, jamais nommément. EN_VIGUEUR + note d'édition citant
 *    l'article 7-1, comme le § 11.8 l'impose à défaut de décision.
 *  · Aucune substitution du corps de l'article 2 du défense 2020 (§ 13.4).
 *  · Aucun rattachement d'Index fabriqué pour les textes que le miroir ne porte pas
 *    (six Spéciaux 2017, LM2019-221, LM2021-SP52, LM2022-SP15, Circulaire 010).
 *  · Aucune citation normalisée (interdit n° 8). Aucun nombre fixe dans une assertion.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../src/lib/db'
import { parseAnnotations, type Annotations } from '../src/lib/legislation/annotated'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'
import {
  DIR,
  FICHES,
  assertionEmpreintes,
  construireAnnotations,
  deriverCorps,
  lirePrep,
  md5,
  plier,
  rapportEmpreintes,
  VERSER_NOMINATION_2019,
} from './data/marches-publics/fiches-marches-publics'

const APPLY = process.argv.includes('--apply')

// ════════════════════════════════════════════════════════════════════════════════════════
// LES FONDATIONS PRÉPARÉES — données, jamais vérité. Tout y est reconfronté aux corps.
// ════════════════════════════════════════════════════════════════════════════════════════
interface Clause {
  texte: string
  fichier: string
  ligne: number
  lignes: number
  sentinelle: string
  md5: string
}
interface Arete {
  id: string
  de: { texte: string; source: string; libelle: string }
  kind: 'CITE' | 'MODIFIE' | 'ABROGE'
  fondement: string
  clause_citee: Clause
  ancre_de_la_clause_chez_la_source: string | null
  justification_du_kind: string
  crossRef: {
    fromSource: string
    toSource: string | null
    toType: string | null
    toNumber: string | null
    toAnchor: string | null
    toLabel: string | null
    kind: string
    source: string
    position: number
    note: string
  }
  vers: { texte?: string; source: string | null; libelle: string; presence: 'CORPUS' | 'ABSENT' }
}
interface GrapheCrossRefs {
  meta: { genere_le: string; empreintes_des_corps_lus: Record<string, string> }
  textes: Record<string, { source: string; corps: string; libelle: string }>
  absents: Record<string, { designation: string; index_moniteur: string | null; note: string }>
  conditionnalite: Record<string, string>
  aretes: Arete[]
}
interface StatutDoc {
  texte: string
  source: string
  status: string
  abroge_par: { texte: string; source: string; clause: string }
  clause_citee: Clause
  note_de_fiche: string
}
interface ArticleAmende {
  texte: string
  source: string
  anchor: string
  label: string
  pastille: string
  SUBSTITUTION_DU_CORPS: boolean
  version_en_vigueur?: {
    texte_cite_verbatim: string
    md5_verbatim: string
    payload_ArticleVersion_body: string
    md5_payload: string
  }
  repli_oldVersions?: {
    texte_verbatim: string
    md5_verbatim: string
    payload_oldVersions: string
    md5_payload: string
  }
  ArticleVersion?: { seq: number; status: string; label: string; note: string; amendedBySource?: string; amendedByNumber?: string }[]
  note_dediee?: string
  clause_citee?: Clause
  definition_de_remplacement?: Clause
  crossRef: string
}
interface GraphePastilles {
  pastilles: {
    statuts_de_document: StatutDoc[]
    articles_amendes: ArticleAmende[]
    /** ⚠️ `decision_de_me_vaval` — présent quand la question N'EST PLUS ouverte. C le LIT et
     *  cesse alors d'annoncer un défaut d'attente : une question tranchée n'est pas un défaut. */
    statuts_a_trancher_par_l_editeur: {
      textes: string[]
      question: string
      defaut_si_pas_de_decision: string
      note_proposee?: string
      decision_de_me_vaval?: string
    }[]
    loi_mere_00: { status: string; note_de_tete: string; decision_de_me_vaval: string }
  }
}
interface EntreeIndex {
  number: string
  id: string
  titleFr_attendu_debute_par: string
  role: string
}
interface GrapheIndex {
  index: {
    rattachements: { texte: string; source: string; chaine_erratum?: boolean; appariement?: string; entrees: EntreeIndex[]; preuve?: string; reserve?: string }[]
    faux_amis_exclus: { number: string; id: string; motif: string }[]
    sans_entree_INDEX: { textes: string[]; numeros: string; constat: string }[]
    reserve_sur_les_tomes_2011: string
  }
}

/**
 * Le DÉGUILLEMETAGE DE BORD, seule opération admise entre la rédaction CITÉE par le
 * modificateur et le `body` d'`ArticleVersion` : sur chaque ligne, le « ouvrant en tête et le
 * » fermant en fin (avant une éventuelle ponctuation finale) sont retirés, rien d'autre.
 *
 * ⚠️ Ce n'est PAS une normalisation de citation (interdit n° 8) : le corps du modificateur
 * reste intact, guillemets compris. C'est le seul moyen d'éviter la TÊTE EN DOUBLE que
 * `applyAmendments` produirait sinon (segment.ts l. 74 : le préfixe n'est omis que si le
 * texte commence par « Article », ce qu'un guillemet ouvrant empêche de reconnaître).
 */
function deguillemeterDeBord(s: string): string {
  return s
    .split('\n')
    .map((l) => {
      let t = l
      if (t.startsWith('«')) t = t.slice(1).replace(/^\s+/, '')
      const m = /^([\s\S]*?)\s*»(\s*[.;:,]?)$/.exec(t)
      if (m) t = m[1] + (m[2] ?? '')
      return t
    })
    .join('\n')
}

/** § 8.5 — la pastille des seuils : EN_VIGUEUR + note, JAMAIS ABROGE sans décision (§ 13.3). */
const SENTINELLE_NOTE_STATUT = '— NOTE D’ÉDITION —'

/**
 * LA FRONTIÈRE DU DISPOSITIF — la ligne d'exécutoire, seule sur sa ligne. Tout ce qui la
 * précède est visa ou considérant ; tout ce qui la suit est dispositif.
 *
 * ⚠️ Elle sert à MESURER ce que le champ `fondement` se contentait d'AFFIRMER. Contrôle
 * adverse du 28 août : l'arête A09 (considérant nominatif de l'arrêté de 2022) passée en
 * MODIFIE **et** son `fondement` réétiqueté « dispositif (…) » — aucune garde ne parlait, le
 * graphe passait à MODIFIE 5 · CITE 63. `prouverClause` n'y peut rien : la clause EST au
 * corps, elle est seulement au mauvais endroit.
 *
 * La graphie est volontairement ÉTROITE (« ARRÊTE », « DÉCRÈTE », la formule de vote des
 * lois). Elle n'accepte pas « ARRÊTÉ » à l'accent aigu, qui est l'intitulé de l'acte et se lit
 * en tête de presque tous les corps : l'accepter placerait la frontière avant les visas et
 * ferait passer n'importe quel considérant pour du dispositif. Conséquence mesurée : deux
 * textes n'ont pas de frontière lisible (n° 15, dont la ligne d'exécutoire est imprimée
 * « ARRÊTÉ » — sic ; n° 24, circulaire en prose, sans dispositif). Aucune arête AFFIRMANTE
 * n'en part — les neuf qui en partent sont toutes des CITE — et si l'une venait à en partir,
 * l'absence de frontière est BLOQUANTE : on ne présume pas du dispositif, on le mesure.
 */
const FRONTIERE_DISPOSITIF =
  /^\s*(ARR[ÊE]TE|ARR[ÊE]TONS|D[ÉE]CR[ÈE]TE|D[ÉE]CR[ÈE]TONS|Le Pouvoir Ex[ée]cutif a propos[ée] et le Corps L[ée]gislatif a vot[ée].*)\s*:?\s*$/i

/** Ligne (1-based) de la frontière du dispositif, ou -1 si le corps n'en porte pas. */
function ligneFrontiere(corps: string): number {
  const i = corps.split('\n').findIndex((x) => FRONTIERE_DISPOSITIF.test(x))
  return i < 0 ? -1 : i + 1
}

async function main() {
  const p = (s = '') => console.log(s)

  p('══════════════════════════════════════════════════════════════════════════════════')
  p('  C · GRAPHE DES MARCHÉS PUBLICS — pastilles, replis, renvois, Index (§ 6 à § 8.6)')
  p(`  drapeaux : --apply=${APPLY}`)
  p('══════════════════════════════════════════════════════════════════════════════════')
  p()

  // ══ 1. PREMIÈRE ASSERTION — les empreintes des pièces sources ═══════════════════════
  const e = assertionEmpreintes(APPLY)
  rapportEmpreintes(e, p)
  p()

  // ══ 2. LES 25 FICHES DOIVENT EXISTER, ET PORTER LE CORPS ATTENDU ════════════════════
  const docs = new Map<string, { id: string; titleFr: string; status: string; bodyOriginal: string; annotationsJson: string | null; summaryFr: string | null }>()
  const manquants: string[] = []
  for (const f of FICHES) {
    const lus = await prisma.document.findMany({
      where: { source: f.source },
      select: { id: true, titleFr: true, status: true, bodyOriginal: true, annotationsJson: true, summaryFr: true },
    })
    if (lus.length === 0) {
      manquants.push(f.source)
      continue
    }
    if (lus.length > 1) throw new Error(`${lus.length} documents pour la source ${f.source} — 1 attendu, STOP`)
    docs.set(f.source, lus[0])
  }

  // ⚠️ PRÉ-VOL : en SIMULATION, si B n'a pas encore été appliqué, on ne s'arrête pas là — on
  // rejoue tout le contrôle sur les corps QUE B VERSERA (re-dérivés des pièces, à l'octet).
  // Le rapport est alors complet et le graphe entièrement vérifié AVANT la première écriture.
  // À `--apply`, les fiches sont EXIGÉES : l'ordre A → B → C ne se contourne pas.
  const prevol = docs.size === 0
  if (prevol) {
    if (APPLY)
      throw new Error(
        `AUCUNE des ${FICHES.length} fiches n'est en base — lancer d'abord :\n` +
          '      npx tsx scripts/creer-theme-marches-publics.ts --apply\n' +
          '      npx tsx scripts/importer-marches-publics.ts --apply',
      )
    for (const f of FICHES) {
      // ⚠️ LE PRÉ-VOL DOIT SIMULER CE QUE B VERSERA, PAS AUTRE CHOSE. Il calculait le graphe
      // AVEC la nomination de 2019 quand B, drapeau baissé, ne la verse pas : C annonçait
      // alors une arête que la livraison ne poserait jamais. Les deux lisent désormais la
      // MÊME constante (§ 13.2, fondation partagée).
      if (f.id === '17' && !VERSER_NOMINATION_2019) continue
      const prep = lirePrep(f)
      docs.set(f.source, {
        id: `(créé par B — ${f.source})`,
        titleFr: f.titre.fr,
        status: f.status,
        bodyOriginal: deriverCorps(prep, f.titre.fr).corps,
        annotationsJson: JSON.stringify(construireAnnotations(f, prep)),
        summaryFr: f.note,
      })
    }
  } else {
    if (manquants.length && manquants.length !== 1)
      throw new Error(`${manquants.length} fiches manquent en base (${manquants.join(', ')}) — état MIXTE, investiguer avant tout`)
    if (manquants.length === 1 && manquants[0] !== 'MARCHES_ARR_NOMINATION_CNMP_2019')
      throw new Error(`la fiche ${manquants[0]} manque en base — état inattendu, STOP`)
    // L'empreinte du corps de chaque fiche EN BASE == le corps re-dérivé de la pièce.
    for (const f of FICHES) {
      const d = docs.get(f.source)
      if (!d) continue
      const derive = deriverCorps(lirePrep(f), f.titre.fr)
      if (md5(d.bodyOriginal) !== md5(derive.corps))
        throw new Error(
          `${f.source} — le corps EN BASE (md5 ${md5(d.bodyOriginal).slice(0, 12)}) n'est pas celui re-dérivé de la pièce ` +
            `(${md5(derive.corps).slice(0, 12)}). Quelqu'un est passé depuis B : STOP.`,
        )
      if (d.titleFr !== f.titre.fr) throw new Error(`${f.source} — l'intitulé en base n'est pas celui de la fiche — STOP`)
      if (d.status !== f.status) throw new Error(`${f.source} — statut en base « ${d.status} », attendu « ${f.status} » — STOP`)
    }
  }
  const nominationEcartee = prevol ? !VERSER_NOMINATION_2019 : manquants.length === 1

  p(prevol ? 'LES FICHES — PRÉ-VOL (B n’a pas encore été appliqué)' : 'LES FICHES EN BASE')
  p(
    prevol
      ? `  ${docs.size} corps re-dérivés des pièces, à l'octet : tout le graphe est vérifié SUR CE QUE B VERSERA. --apply refuserait.`
      : `  ${docs.size} documents résolus, un par source · corps à l'empreinte des pièces · intitulés et statuts conformes`,
  )
  if (nominationEcartee)
    p(
      `  n° 17 (nomination CNMP 2019) ${prevol ? 'HORS PRÉ-VOL' : 'ABSENT de la base'} — VERSER_NOMINATION_2019=false : ` +
        '⚠️ CONTRAIRE À LA DÉCISION DU 28 AOÛT 2026 (« à verser »), à vérifier · l’arête F17 tombe avec lui',
    )
  else if (!prevol || VERSER_NOMINATION_2019)
    p(
      `  n° 17 (nomination CNMP 2019) ${prevol ? 'DANS LE PRÉ-VOL' : 'en base'} — VERSER_NOMINATION_2019=true, ` +
        'conformément à la décision de Me Vaval du 28 août 2026 (« à verser ») : l’arête F17 est du lot',
    )
  p()

  const parTexte = new Map<string, string>() // id de texte (« 02 ») → source
  for (const f of FICHES) parTexte.set(f.id, f.source)
  const docParTexte = (t: string) => docs.get(parTexte.get(t) ?? '')

  // ══ 3. LES FONDATIONS, RECONFRONTÉES AUX CORPS EN BASE ══════════════════════════════
  const gx = JSON.parse(readFileSync(join(DIR, 'graphe-crossrefs.json'), 'utf8')) as GrapheCrossRefs
  const gp = JSON.parse(readFileSync(join(DIR, 'graphe-pastilles.json'), 'utf8')) as GraphePastilles
  const gi = JSON.parse(readFileSync(join(DIR, 'graphe-index.json'), 'utf8')) as GrapheIndex

  /** Une clause ne se recopie pas : elle se relit, verbatim, au corps de son texte EN BASE. */
  const prouverClause = (idArete: string, texteSource: string, c: Clause) => {
    const d = docParTexte(texteSource)
    if (!d) throw new Error(`${idArete} — le texte source n° ${texteSource} n'est pas en base`)
    const n = d.bodyOriginal.split(c.texte).length - 1
    if (n !== 1)
      throw new Error(
        `${idArete} — la clause citée apparaît ${n} fois au corps du texte n° ${texteSource} (1 attendue) : ` +
          `« ${c.texte.slice(0, 90)}… » — la clause ne se recopie pas, elle se lit`,
      )
    if (d.bodyOriginal.split(c.sentinelle).length - 1 === 0)
      throw new Error(`${idArete} — la sentinelle « ${c.sentinelle} » est absente du corps du texte n° ${texteSource}`)
  }

  // ── 3a. Les arêtes ────────────────────────────────────────────────────────────────────
  const aretes = gx.aretes.filter((a) => {
    // § 13.2 — si la nomination n'est pas versée, l'arête qui en part tombe avec elle.
    if (nominationEcartee && a.crossRef.fromSource === 'MARCHES_ARR_NOMINATION_CNMP_2019') return false
    return true
  })
  const areteTombee = gx.aretes.length - aretes.length

  /** Pour le rapport : ce que la frontière a MESURÉ, arête affirmante par arête affirmante. */
  const mesuresFrontiere: { id: string; texte: string; ligneClause: number; ligneFront: number }[] = []
  for (const a of aretes) {
    // le kind AFFIRME : un considérant ne fonde ni MODIFIE ni ABROGE (§ 6, interdit n° 9)
    if (a.kind !== 'CITE' && !a.fondement.startsWith('dispositif'))
      throw new Error(`${a.id} — kind ${a.kind} fondé sur « ${a.fondement} » : seul le dispositif peut le fonder — STOP`)
    if (a.crossRef.kind !== a.kind) throw new Error(`${a.id} — kind incohérent entre l'arête (${a.kind}) et son crossRef (${a.crossRef.kind})`)
    // la note PORTE la clause
    if (!a.crossRef.note.includes(a.clause_citee.texte))
      throw new Error(`${a.id} — la note du renvoi ne cite pas sa clause verbatim — STOP`)
    prouverClause(a.id, a.de.texte, a.clause_citee)

    // ⚠️ ET MAINTENANT ON MESURE. L'étiquette `fondement` est une chaîne : elle n'engage rien.
    // La frontière du dispositif, elle, se lit au corps — et `prouverClause` vient de garantir
    // que la clause s'y trouve exactement une fois, donc sa ligne est déterminée.
    if (a.kind !== 'CITE') {
      const src = docParTexte(a.de.texte)!
      const front = ligneFrontiere(src.bodyOriginal)
      if (front < 0)
        throw new Error(
          `${a.id} — aucune frontière de dispositif mesurable au texte n° ${a.de.texte} ` +
            `(aucune ligne « ARRÊTE » / « DÉCRÈTE » seule) : un ${a.kind} ne peut pas s'y fonder — STOP`,
        )
      const ligneClause = src.bodyOriginal.slice(0, src.bodyOriginal.indexOf(a.clause_citee.texte)).split('\n').length
      if (ligneClause <= front)
        throw new Error(
          `${a.id} — kind ${a.kind} : la clause citée est ligne ${ligneClause}, AVANT la frontière du dispositif ` +
            `(ligne ${front}) — c'est un visa ou un considérant, il ne peut fonder qu'un CITE (§ 6, interdit n° 9) — STOP`,
        )
      mesuresFrontiere.push({ id: a.id, texte: a.de.texte, ligneClause, ligneFront: front })
    }
    // jamais de désignation par numéro de fascicule (§ 8.6, interdit n° 12)
    if (a.crossRef.toType || a.crossRef.toNumber)
      throw new Error(`${a.id} — toType/toNumber renseignés : un numéro du Moniteur désigne un FASCICULE, pas un acte — interdit`)
    // cible
    if (a.vers.presence === 'CORPUS') {
      if (!a.crossRef.toSource) throw new Error(`${a.id} — cible au corpus sans toSource`)
      const cible = docs.get(a.crossRef.toSource)
      // Une seule branche : les deux qui se distinguaient ici levaient le même refus (scorie
      // mesurée le 28 août). Aucune arête du lot ne VISE la nomination — elle n'en est que la
      // source — donc son éventuel écartement ne peut pas produire ce cas.
      if (!cible) throw new Error(`${a.id} — cible ${a.crossRef.toSource} absente de la base — lien mort, STOP`)
      if (a.crossRef.toAnchor) {
        // ⚠️ toAnchor désigne un article de la CIBLE, jamais l'article où la clause est écrite.
        const ann = parseAnnotations(cible.annotationsJson)
        if (!ann?.labels?.[a.crossRef.toAnchor])
          throw new Error(`${a.id} — l'ancre ${a.crossRef.toAnchor} n'existe pas dans le document cible ${a.crossRef.toSource} — lien mort, STOP`)
      }
      if (a.crossRef.toLabel) throw new Error(`${a.id} — cible résolue ET toLabel renseigné : le renvoi en clair est réservé aux absents`)
    } else {
      if (a.crossRef.toSource) throw new Error(`${a.id} — cible ABSENTE mais toSource renseigné`)
      if (!a.crossRef.toLabel) throw new Error(`${a.id} — cible ABSENTE sans désignation en clair (toLabel) — interdit n° 5`)
    }
  }
  // Unicité : la clé est (source, cible|désignation, kind, ancre).
  const cles = aretes.map((a) => `${a.crossRef.fromSource}→${a.crossRef.toSource ?? a.crossRef.toLabel}|${a.kind}|${a.crossRef.toAnchor ?? ''}`)
  const doubles = cles.filter((c, i) => cles.indexOf(c) !== i)
  if (doubles.length) throw new Error(`renvoi(s) en double : ${[...new Set(doubles)].join(' ; ')} — STOP`)
  // D6 (contrôle du 28 août) : `F02` et `F03` servaient DEUX FOIS chacun dans le fichier de
  // fondation — l'arête du texte n° 01 et celle du n° 02 portaient l'id d'un autre texte.
  // Renumérotées `F01b` et `F02d` selon la convention mesurée (F<n° du texte source> + b/c/d).
  // L'id est désormais une clé : une collision est bloquante, plus un simple avertissement.
  const idsDoubles = [...new Set(aretes.map((a) => a.id).filter((x, i, arr) => arr.indexOf(x) !== i))]
  if (idsDoubles.length)
    throw new Error(
      `identifiant(s) d'arête en double dans graphe-crossrefs.json : ${idsDoubles.join(', ')} — ` +
        `un id désigne une arête et une seule (convention F<n° du texte source> + b/c/d) — STOP`,
    )

  // Positions : le fichier de fondation en porte des COLLISIONS (mesurées) ; on renumérote
  // de façon déterministe par source, en respectant l'ordre déclaré puis l'id.
  const parSource = new Map<string, Arete[]>()
  for (const a of aretes) {
    const k = a.crossRef.fromSource
    if (!parSource.has(k)) parSource.set(k, [])
    parSource.get(k)!.push(a)
  }
  const positions = new Map<Arete, number>()
  const renumerotes: string[] = []
  for (const [src, lot] of parSource) {
    const trie = [...lot].sort((x, y) => x.crossRef.position - y.crossRef.position || x.id.localeCompare(y.id))
    const collision = new Set(lot.map((a) => a.crossRef.position)).size !== lot.length
    if (collision) renumerotes.push(`${src} (${lot.map((a) => `${a.id}:${a.crossRef.position}`).join(', ')})`)
    trie.forEach((a, i) => positions.set(a, i))
  }

  // ── 3b. Les statuts de document ───────────────────────────────────────────────────────
  for (const s of gp.pastilles.statuts_de_document) {
    const d = docParTexte(s.texte)
    if (!d) throw new Error(`statut : le texte n° ${s.texte} n'est pas en base`)
    if (d.status !== s.status) throw new Error(`statut : ${s.source} est « ${d.status} » en base, attendu « ${s.status} » — STOP`)
    prouverClause(`statut n° ${s.texte}`, s.abroge_par.texte, s.clause_citee)
  }

  // ── 3c. Les articles amendés ──────────────────────────────────────────────────────────
  const modificateur = docParTexte('19')!
  const decret2021 = docParTexte('21')!
  for (const am of gp.pastilles.articles_amendes) {
    const d = docParTexte(am.texte)
    if (!d) throw new Error(`article amendé : le texte n° ${am.texte} n'est pas en base`)
    const ann = parseAnnotations(d.annotationsJson)
    if (!ann?.labels?.[am.anchor]) throw new Error(`article amendé : l'ancre ${am.anchor} n'existe pas au texte n° ${am.texte} — STOP`)

    if (am.SUBSTITUTION_DU_CORPS) {
      const v = am.version_en_vigueur!
      const r = am.repli_oldVersions!
      // la rédaction NOUVELLE se lit, entre guillemets, au corps du modificateur
      if (modificateur.bodyOriginal.split(v.texte_cite_verbatim).length - 1 !== 1)
        throw new Error(`${am.anchor} — la rédaction nouvelle ne se lit pas EXACTEMENT une fois au corps du modificateur — STOP`)
      // Le payload N'EST PAS RECOPIÉ : il est RECALCULÉ du verbatim par l'opération déclarée
      // — retrait du « ouvrant et du » fermant DE BORD, ligne à ligne, rien d'autre — et doit
      // retomber sur la fondation À L'OCTET. Puis une seconde preuve, orthogonale : hors
      // guillemets et hors blancs, les deux états sont le même texte, caractère pour caractère.
      const recalcule = deguillemeterDeBord(v.texte_cite_verbatim)
      if (recalcule !== v.payload_ArticleVersion_body)
        throw new Error(
          `${am.anchor} — le payload d'ArticleVersion n'est pas le verbatim déguillemeté de bord : ` +
            `le recalcul donne md5 ${md5(recalcule).slice(0, 10)}, le payload de la fondation vaut ` +
            `${md5(v.payload_ArticleVersion_body).slice(0, 10)} (elle en déclare ${v.md5_payload}) — STOP`,
        )
      const nu = (s: string) => s.split('«').join('').split('»').join('').replace(/\s+/g, '')
      if (nu(v.texte_cite_verbatim) !== nu(v.payload_ArticleVersion_body))
        throw new Error(`${am.anchor} — hors guillemets et blancs, payload et verbatim DIFFÈRENT : ce n'est pas un déguillemetage — STOP`)
      if (md5(v.texte_cite_verbatim).slice(0, 10) !== v.md5_verbatim || md5(v.payload_ArticleVersion_body).slice(0, 10) !== v.md5_payload)
        throw new Error(`${am.anchor} — empreintes du couple verbatim/payload non conformes à la fondation — STOP`)
      // l'ANCIENNE rédaction se lit au corps du texte de base, et le repli en est le SUFFIXE
      if (d.bodyOriginal.split(r.texte_verbatim).length - 1 !== 1)
        throw new Error(`${am.anchor} — l'ancienne rédaction ne se lit pas EXACTEMENT une fois au corps du texte de base — STOP`)
      if (!r.texte_verbatim.endsWith(r.payload_oldVersions))
        throw new Error(`${am.anchor} — le repli n'est pas un suffixe exact de l'ancienne rédaction (retrait de tête non réversible) — STOP`)
      const tete = r.texte_verbatim.slice(0, r.texte_verbatim.length - r.payload_oldVersions.length)
      if (!/^Articles?\s/.test(tete)) throw new Error(`${am.anchor} — le préfixe retiré du repli (« ${tete} ») n'est pas une tête d'article — STOP`)
    } else {
      // § 13.4 — l'article 2 du défense 2020 : pastille + note, SANS substitution.
      if (am.ArticleVersion) throw new Error(`${am.anchor} — SUBSTITUTION_DU_CORPS=false mais des ArticleVersion sont proposées — interdit n° 7`)
      prouverClause(`pastille ${am.anchor}`, '21', am.clause_citee!)
      prouverClause(`définition ${am.anchor}`, '21', am.definition_de_remplacement!)
      if (!am.note_dediee!.includes('n’est pas précisée') && !am.note_dediee!.includes("n'est pas précisée"))
        throw new Error(`${am.anchor} — la note ne dit pas que l'étendue n'est pas précisée : elle trancherait § 13.4 — STOP`)
    }
  }
  void decret2021

  // ── 3d. Les rattachements d'Index, résolus en DEUX temps (§ 8.6) ──────────────────────
  interface Rattachement {
    texteId: string
    source: string
    docId: string
    entree: EntreeIndex
    fascicule: number
    role: string
    erratum: boolean
  }
  const rattachements: Rattachement[] = []
  for (const r of gi.index.rattachements) {
    const d = docParTexte(r.texte)
    // La branche qui sautait ici le rattachement de la nomination était MORTE : la fondation
    // ne porte aucun rattachement pour le texte n° 17 (mesuré — le miroir de l'Index n'a
    // aucune entrée pour LM2019-221). Écartée le 28 août : un `continue` qui ne s'exécute
    // jamais est une garde imaginaire.
    if (!d) throw new Error(`Index : le texte n° ${r.texte} n'est pas en base`)
    for (const en of r.entrees) {
      // (1) restreindre au FASCICULE — le couple number+type n'est PAS unique
      const duFascicule = await prisma.document.findMany({ where: { number: en.number, type: 'INDEX' }, select: { id: true, titleFr: true } })
      if (duFascicule.length === 0) throw new Error(`Index : aucune entrée ${en.number} de type INDEX — STOP`)
      // (2) désigner PAR ID, et contrôler en relisant le titre
      const choisies = duFascicule.filter((x) => x.id === en.id)
      if (choisies.length !== 1)
        throw new Error(`Index : la résolution finale de ${en.number} désigne ${choisies.length} ligne(s), 1 attendue (id ${en.id}) — STOP`)
      const t = choisies[0]
      if (!plier(t.titleFr).startsWith(plier(en.titleFr_attendu_debute_par)))
        throw new Error(
          `Index ${en.number} / ${en.id} : le titre en base ne commence pas par le contrôle attendu.\n` +
            `      base    : « ${t.titleFr.slice(0, 110)} »\n      attendu : « ${en.titleFr_attendu_debute_par} »`,
        )
      rattachements.push({
        texteId: r.texte,
        source: r.source,
        docId: d.id,
        entree: en,
        fascicule: duFascicule.length,
        role: en.role,
        erratum: !!r.chaine_erratum,
      })
    }
  }
  // Les deux faux amis : mesurés, et jamais rattachés (§ 3, interdit n° 13).
  const fauxAmis = new Set(gi.index.faux_amis_exclus.map((x) => x.id))
  for (const r of rattachements) if (fauxAmis.has(r.entree.id)) throw new Error(`Index : rattachement vers un FAUX AMI (${r.entree.number}) — interdit n° 13`)

  // ══ 4. CE QUI SERAIT ÉCRIT — construction, puis diff ════════════════════════════════
  interface AEcrire {
    docId: string
    source: string
    annotationsJson: string
    summaryFr: string | null
    changeAnnotations: boolean
    changeSummary: boolean
  }
  const majDocs = new Map<string, AEcrire>()
  const prendre = (source: string): AEcrire => {
    let x = majDocs.get(source)
    if (!x) {
      const d = docs.get(source)!
      x = { docId: d.id, source, annotationsJson: d.annotationsJson ?? '', summaryFr: d.summaryFr, changeAnnotations: false, changeSummary: false }
      majDocs.set(source, x)
    }
    return x
  }
  const annotationsDe = (x: AEcrire) => JSON.parse(x.annotationsJson) as Annotations & Record<string, never>

  // 4a. notes de statut (ABROGE) et notes d'édition (seuils) — appendues à summaryFr
  const notesStatut: { source: string; note: string }[] = []
  for (const s of gp.pastilles.statuts_de_document) notesStatut.push({ source: s.source, note: s.note_de_fiche })
  const aTrancher = gp.pastilles.statuts_a_trancher_par_l_editeur.find((x) => x.textes.includes('08'))
  if (!aTrancher?.note_proposee) throw new Error('§ 13.3 — la note d’édition des arrêtés de seuils manque à la fondation — STOP')
  // La note doit DIRE le remplacement en fait et NIER l'abrogation nommée. Si elle affirmait
  // l'abrogation, elle trancherait le § 13.3 à la place de Me Vaval (interdit n° 6).
  if (!/Aucun texte ne l['’]abroge nommément/.test(aTrancher.note_proposee))
    throw new Error('§ 13.3 — la note d’édition des seuils ne dit plus « Aucun texte ne l’abroge nommément » : elle trancherait — STOP')
  if (/\best (?:abrogé|abrogée)\b/i.test(aTrancher.note_proposee))
    throw new Error('§ 13.3 — la note d’édition des seuils AFFIRME une abrogation : interdit n° 6 — STOP')
  for (const t of aTrancher.textes) notesStatut.push({ source: parTexte.get(t)!, note: aTrancher.note_proposee })

  for (const n of notesStatut) {
    const x = prendre(n.source)
    const bloc = `${SENTINELLE_NOTE_STATUT}\n${n.note}`
    if ((x.summaryFr ?? '').includes(n.note)) continue
    x.summaryFr = x.summaryFr ? `${x.summaryFr}\n\n${bloc}` : bloc
    x.changeSummary = true
  }

  // 4b. pastilles d'article : status + oldVersions + connexe
  const versions: { docId: string; source: string; anchor: string; label: string; seq: number; status: string; body: string; note: string; amendedByDocId: string | null; amendedByNumber: string | null }[] = []
  for (const am of gp.pastilles.articles_amendes) {
    const source = parTexte.get(am.texte)!
    const x = prendre(source)
    const ann = annotationsDe(x)
    const st = (ann.status ??= {}) as Record<string, string>
    const old = (ann.oldVersions ??= {}) as Record<string, string>
    const con = (ann.connexe ??= {}) as Record<string, { label: string; text: string; docId?: string; anchor?: string }[]>

    st[am.anchor] = 'modifié'
    if (am.SUBSTITUTION_DU_CORPS) {
      old[am.anchor] = am.repli_oldVersions!.payload_oldVersions
      const liste = (con[am.anchor] ??= [])
      const label = am.pastille
      if (!liste.some((b) => b.label === label)) liste.push({ label, text: '', docId: modificateur.id })
      for (const v of am.ArticleVersion!) {
        versions.push({
          docId: docs.get(source)!.id,
          source,
          anchor: am.anchor,
          label: v.label,
          seq: v.seq,
          status: v.status,
          body: v.status === 'EN_VIGUEUR' ? am.version_en_vigueur!.payload_ArticleVersion_body : am.repli_oldVersions!.payload_oldVersions,
          note: v.note,
          amendedByDocId: v.status === 'EN_VIGUEUR' ? modificateur.id : null,
          amendedByNumber: v.status === 'EN_VIGUEUR' ? (v.amendedByNumber ?? null) : null,
        })
      }
    } else {
      // note SANS substitution : la clause et la définition de remplacement, verbatim, en connexe
      const liste = (con[am.anchor] ??= [])
      const label = am.pastille
      const texte = `${am.note_dediee}\n\nRédaction de remplacement, article 16.1 du Décret du 21 octobre 2021 :\n${am.definition_de_remplacement!.texte}`
      const i = liste.findIndex((b) => b.label === label)
      if (i >= 0) liste[i] = { label, text: texte, docId: decret2021.id, anchor: 'art-16-1' }
      else liste.push({ label, text: texte, docId: decret2021.id, anchor: 'art-16-1' })
    }
    const neuf = JSON.stringify(ann)
    if (neuf !== x.annotationsJson) {
      x.annotationsJson = neuf
      x.changeAnnotations = true
    }
  }
  // Les annotations produites doivent se relire sans perte.
  for (const x of majDocs.values())
    if (x.changeAnnotations && !parseAnnotations(x.annotationsJson)) throw new Error(`${x.source} — annotationsJson produit non relisible — STOP`)

  // 4c. dédoublonnage des CrossRefs déjà posés
  const ids = prevol ? [] : [...docs.values()].map((d) => d.id)
  const dejaSortants = ids.length
    ? await prisma.crossRef.findMany({
        where: { fromId: { in: ids } },
        select: { id: true, fromId: true, toId: true, toLabel: true, kind: true, toAnchor: true },
      })
    : []
  const cleExistante = new Set(dejaSortants.map((c) => `${c.fromId}|${c.toId ?? c.toLabel}|${c.kind}|${c.toAnchor ?? ''}`))
  const aCreerAretes = aretes.filter(
    (a) =>
      !cleExistante.has(
        `${docs.get(a.crossRef.fromSource)!.id}|${a.crossRef.toSource ? docs.get(a.crossRef.toSource)!.id : a.crossRef.toLabel}|${a.kind}|${a.crossRef.toAnchor ?? ''}`,
      ),
  )
  const aCreerIndex = rattachements.filter((r) => !cleExistante.has(`${r.docId}|${r.entree.id}|VOIR|`))
  const dejaVersions = ids.length
    ? await prisma.articleVersion.findMany({ where: { documentId: { in: ids } }, select: { documentId: true, anchor: true, seq: true } })
    : []
  const aCreerVersions = versions.filter((v) => !dejaVersions.some((x) => x.documentId === v.docId && x.anchor === v.anchor && x.seq === v.seq))
  const majAEcrire = [...majDocs.values()].filter((x) => x.changeAnnotations || x.changeSummary)

  // ══ 5. RAPPORT CHIFFRÉ (§ 10.3) ═════════════════════════════════════════════════════
  p('LES STATUTS DE DOCUMENT — ABROGE d’emblée, chacun avec SA clause (§ 7)')
  for (const s of gp.pastilles.statuts_de_document) {
    p(`  n° ${s.texte}  ${s.source}  →  ${s.status}, par ${s.abroge_par.source} (${s.abroge_par.clause})`)
    p(`        clause : « ${s.clause_citee.texte.slice(0, 150)}… »`)
    p(`        note   : ${s.note_de_fiche.slice(0, 190)}…`)
  }
  p(`  ⚠️ L'article 97 de la Loi n'abroge PAS : il MAINTIENT le décret de 2004 pour les marchés déjà approuvés — clause de transition, dite en note.`)
  p()

  p('LES ARTICLES AMENDÉS — pastille, repli, ArticleVersion (§ 7)')
  for (const am of gp.pastilles.articles_amendes) {
    p(`  n° ${am.texte} · ${am.anchor} (« ${am.label} ») — ${am.pastille}`)
    if (am.SUBSTITUTION_DU_CORPS) {
      p(`        version AFFICHÉE (2020) : ${am.version_en_vigueur!.payload_ArticleVersion_body.split('\n').length} ligne(s), md5 ${am.version_en_vigueur!.md5_payload}`)
      p(`        repli (rédaction 2009)  : ${am.repli_oldVersions!.payload_oldVersions.split('\n').length} ligne(s), md5 ${am.repli_oldVersions!.md5_payload}`)
      p(`        ArticleVersion : ${am.ArticleVersion!.map((v) => `seq ${v.seq} ${v.status}`).join(' · ')}`)
      p(`        déguillemetage de bord PROUVÉ réversible (hors « » et blancs, les deux états sont le même texte)`)
    } else {
      p(`        SANS SUBSTITUTION DU CORPS (§ 13.4, interdit n° 7) — pastille + note seulement`)
      p(`        ⚠️ la liste de cet article compte DOUZE catégories, pas onze : « Les marchés publics de l'électricité » a été insérée en 2020`)
      p(`        clause : « ${am.clause_citee!.texte.slice(0, 140)}… »`)
    }
  }
  p()

  p(`LES RENVOIS — ${aretes.length} arêtes${areteTombee ? ` (${areteTombee} tombée avec la nomination écartée)` : ''}`)
  const parKind: Record<string, number> = {}
  for (const a of aretes) parKind[a.kind] = (parKind[a.kind] ?? 0) + 1
  p(`  par kind : ${Object.entries(parKind).map(([k, n]) => `${k} ${n}`).join(' · ')}`)
  p(`  cibles résolues : ${aretes.filter((a) => a.vers.presence === 'CORPUS').length} · renvois EN CLAIR : ${aretes.filter((a) => a.vers.presence === 'ABSENT').length} (toId/toType/toNumber nuls)`)
  p(`  chaque clause relue au corps EN BASE, exactement une fois · chaque note porte sa clause · 0 renvoi en double`)
  p('  les arêtes qui AFFIRMENT (kind ≠ CITE) — leur fondement n’est pas cru, il est MESURÉ :')
  for (const a of aretes.filter((x) => x.kind !== 'CITE')) {
    const m = mesuresFrontiere.find((x) => x.id === a.id)!
    p(
      `    ${a.id.padEnd(5)} n° ${a.de.texte} → ${a.vers.texte ? `n° ${a.vers.texte}` : 'EN CLAIR'}  ${a.kind.padEnd(8)} ` +
        `clause l.${String(m.ligneClause).padStart(4)} > frontière l.${String(m.ligneFront).padStart(3)} (« ${docParTexte(a.de.texte)!.bodyOriginal.split('\n')[m.ligneFront - 1].trim()} »)` +
        `${a.crossRef.toAnchor ? ` · #${a.crossRef.toAnchor}` : ''}`,
    )
  }
  const sansFrontiere = FICHES.filter((f) => docs.has(f.source) && ligneFrontiere(docs.get(f.source)!.bodyOriginal) < 0)
  const affirmantesSansFrontiere = aretes.filter((a) => a.kind !== 'CITE' && sansFrontiere.some((f) => f.id === a.de.texte))
  p(
    `    frontière du dispositif introuvable pour ${sansFrontiere.length} texte(s) : ` +
      `${sansFrontiere.map((f) => `n° ${f.id}`).join(', ')} — le n° 15 imprime sa ligne d’exécutoire « ARRÊTÉ » (accent aigu, sic), ` +
      `le n° 24 est une circulaire en prose, sans dispositif. ` +
      `${affirmantesSansFrontiere.length} arête affirmante en part (${aretes.filter((a) => sansFrontiere.some((f) => f.id === a.de.texte)).length} CITE) : ` +
      `la garde ne les concerne pas, et si l’une venait à en partir elle REFUSERAIT.`,
  )
  p(
    `  ${aretes.length} identifiants d'arête, tous DISTINCTS (D6 corrigé le 28 août : F02 et F03 servaient chacun deux fois, ` +
      `renumérotés F01b et F02d ; la collision est désormais bloquante).`,
  )
  if (renumerotes.length) {
    p(`  ⚠️ DÉFAUT MESURÉ : positions en COLLISION chez ${renumerotes.length} source(s) — renumérotées 0..n-1 de façon déterministe :`)
    for (const r of renumerotes) p(`      ${r}`)
  }
  p('  renvois EN CLAIR (textes cités et absents du corpus) :')
  for (const [k, v] of Object.entries(gx.absents)) p(`    ${k.padEnd(28)} ${v.designation.slice(0, 92)}${v.index_moniteur ? `  [${v.index_moniteur}]` : ''}`)

  // ⚠️ CE QUI MANQUE AU GRAPHE DOIT S'EXPLIQUER AUTANT QUE CE QUI Y EST. Le renvoi de visa
  // vers la loi-mère est la figure la plus régulière du lot ; les textes qui n'en portent pas
  // sont MESURÉS ici, jamais présumés. Scorie relevée le 28 août : l'arête F07 manquait sans
  // un mot, là où toutes ses voisines étaient présentes.
  const sourceLoiMere = parTexte.get('00')!
  const versLaLoi = new Set(aretes.filter((a) => a.crossRef.toSource === sourceLoiMere).map((a) => a.de.texte))
  const VISA_LOI_MERE = /^\s*Vu\s+la\s+Loi\s+du\s+10\s+juin\s+2009/i
  const applicables = FICHES.filter((f) => f.id !== '00' && docs.has(f.source))
  p(`  renvoi de visa vers la loi-mère : ${versLaLoi.size} texte(s) sur ${applicables.length} — les absences, MESURÉES :`)
  for (const f of applicables.filter((x) => !versLaLoi.has(x.id))) {
    const porteLeVisa = docs.get(f.source)!.bodyOriginal.split('\n').some((l) => VISA_LOI_MERE.test(l))
    p(
      `    n° ${f.id} · visa « Vu la Loi du 10 juin 2009 » ` +
        `${porteLeVisa ? '⚠️ PRÉSENT AU CORPS — arête manquante, À INVESTIGUER' : 'ABSENT du corps'}` +
        `${gx.conditionnalite[f.id] ? ` · ${gx.conditionnalite[f.id]}` : ''}`,
    )
  }
  p('  conditionnalité et sortants zéro, déclarés par la fondation et relus ici :')
  for (const [k, v] of Object.entries(gx.conditionnalite)) p(`    n° ${k.padEnd(3)} ${v}`)
  p()

  p(`LES RATTACHEMENTS D’INDEX — ${rattachements.length} entrées pour ${new Set(rattachements.map((r) => r.source)).size} textes (§ 8.6)`)
  for (const r of rattachements)
    p(
      `  n° ${r.texteId}  ${r.entree.number.padEnd(12)} ${r.entree.id}  (${r.fascicule} ligne(s) au fascicule → 1 désignée par id)` +
        `${r.erratum ? '  ⛓ chaîne d’erratum' : ''}  — ${r.role}`,
    )
  p(`  faux amis exclus : ${gi.index.faux_amis_exclus.map((x) => x.number).join(', ')}`)
  p(`  sans entrée INDEX, aucun rattachement fabriqué : ${gi.index.sans_entree_INDEX.map((x) => x.numeros).join(' · ')}`)
  p(`  réserve : ${gi.index.reserve_sur_les_tomes_2011.slice(0, 210)}…`)
  p()

  // ⚠️ ON SÉPARE CE QUI EST OUVERT DE CE QUI EST TRANCHÉ. Le rapport annonçait le § 13.2 comme
  // un « défaut d'attente » alors même que la décision existe : une contradiction résolue qu'on
  // continue d'annoncer est une fausse alerte, et une fausse alerte use les vraies.
  const ouverts = gp.pastilles.statuts_a_trancher_par_l_editeur.filter((x) => !x.decision_de_me_vaval)
  const tranches = gp.pastilles.statuts_a_trancher_par_l_editeur.filter((x) => x.decision_de_me_vaval)
  p('CE QUI RESTE OUVERT — posé, jamais tranché')
  for (const s of ouverts) p(`  ${s.question} · textes n° ${s.textes.join(', ')} — proposé par la fondation : ${s.defaut_si_pas_de_decision}`)
  if (tranches.length) {
    p('  ─ TRANCHÉ, plus une question ouverte :')
    for (const s of tranches)
      p(`    ${s.question} · textes n° ${s.textes.join(', ')} — ${s.decision_de_me_vaval!.split('.')[0]}.`)
  }
  // La cohérence des DEUX fondations est MESURÉE ici, pas affirmée : la constante partagée
  // d'un côté, la décision écrite dans graphe-pastilles.json de l'autre.
  const fond17 = gp.pastilles.statuts_a_trancher_par_l_editeur.find((x) => x.textes.includes('17'))
  const decide17 = !!fond17?.decision_de_me_vaval
  if (decide17 !== VERSER_NOMINATION_2019)
    throw new Error(
      `§ 13.2 — les deux fondations DIVERGENT de nouveau : VERSER_NOMINATION_2019=${VERSER_NOMINATION_2019} ` +
        `dans fiches-marches-publics.ts, et graphe-pastilles.json ${decide17 ? 'porte' : 'ne porte pas'} de décision pour le texte n° 17. ` +
        `C'est exactement le défaut du 28 août au matin : un --apply trancherait à la place de Me Vaval — STOP`,
    )
  p(
    `  § 13.2 · LA NOMINATION DU 26 DÉC. 2019 — TRANCHÉE le 28 août 2026 : « à verser ». Les DEUX fondations le disent, et ` +
      `la cohérence est VÉRIFIÉE ici, pas supposée : VERSER_NOMINATION_2019=${VERSER_NOMINATION_2019} (fiches-marches-publics.ts, ` +
      `lu par B et par C) et « decision_de_me_vaval » renseignée dans graphe-pastilles.json. Une divergence est BLOQUANTE.`,
  )
  p(
    `        ÉTAT ICI : ${nominationEcartee ? (prevol ? 'la fiche est HORS du pré-vol — le graphe est calculé SANS elle, comme B la versera' : 'la fiche est ABSENTE de la base') : prevol ? 'le graphe est calculé AVEC elle, comme B la versera' : 'la fiche est en base : elle a été versée'}` +
      `${areteTombee ? ` · ${areteTombee} arête tombée avec elle` : ' · l’arête F17 est comptée'}.`,
  )
  p('  § 13.4 · étendue de la modification de l’article 2 du défense 2020 — pastille + note, corps INTACT')
  p('  § 13.5 · appariement Tome ↔ fichier de la série 2011 : I → n° 5, III → n° 6, IV → n° 7 (mesuré sur les dispositifs), Tome II sans fichier')
  p('  § 13.7 · la publicationDate de l’entrée INDEX LM2012-104 vaut 2012-06-28 en base ; le fac-similé porte le 29 juin. AUCUNE correction n’est écrite ici.')
  p('  § 13.10 · l’écart d’intitulé de l’article 7-1 de l’arrêté de 2022 — citation conservée verbatim, note posée, rien affirmé')
  p()

  // ══ 6. ÉCRITURE ═════════════════════════════════════════════════════════════════════
  const totalAEcrire = majAEcrire.length + aCreerAretes.length + aCreerIndex.length + aCreerVersions.length
  if (totalAEcrire === 0) {
    p('ÉTAT POST-GRAPHE DÉTECTÉ — pastilles, replis, renvois et rattachements déjà en place :')
    p(`  ${majDocs.size} fiches à jour · ${aretes.length} renvois · ${rattachements.length} rattachements d’Index · ${versions.length} ArticleVersion`)
    p('  RIEN À ÉCRIRE. Toutes les vérifications ci-dessus ont été refaites sur les corps en base.')
    return
  }

  const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
  const fichierEtat = join(DIR, `graphe-etat-avant-${horodatage}.json`)

  if (!APPLY) {
    p('CE QUI SERAIT ÉCRIT (--apply, lancé par Me Vaval, et par elle seule — § 10.2)')
    p(`  état antérieur         : ${fichierEtat}`)
    p(`  Document.update        : ${majAEcrire.length}  (${majAEcrire.filter((x) => x.changeAnnotations).length} annotationsJson + ${majAEcrire.filter((x) => x.changeSummary).length} summaryFr + searchText)`)
    for (const x of majAEcrire)
      p(`      ${x.source.padEnd(36)} ${[x.changeAnnotations ? 'annotations' : null, x.changeSummary ? 'note de fiche' : null].filter(Boolean).join(' + ')}`)
    p(`  ArticleVersion.create  : ${aCreerVersions.length}`)
    for (const v of aCreerVersions) p(`      ${v.source} ${v.anchor} seq ${v.seq} ${v.status.padEnd(11)} ${v.body.split('\n').length} l. · md5 ${md5(v.body).slice(0, 10)}`)
    p(`  CrossRef.create        : ${aCreerAretes.length} renvois + ${aCreerIndex.length} rattachements d’Index = ${aCreerAretes.length + aCreerIndex.length}`)
    p(`  AuditLog               : ${majAEcrire.length} ARTICLE_AMENDED/DOC_PUBLISHED + ${aCreerAretes.length + aCreerIndex.length} CROSSREF_ADDED — RECOMPTÉS après la transaction`)
    const aReindexerSim = new Set<string>([
      ...majAEcrire.map((x) => x.docId),
      ...aCreerAretes.map((a) => docs.get(a.crossRef.fromSource)!.id),
      ...aCreerIndex.map((r) => r.docId),
    ])
    p(`  reindexDocument        : ${aReindexerSim.size}, HORS transaction`)
    p()
    p('SIMULATION — rien n’a été écrit. --apply est réservé à Me Vaval (§ 10.2).')
    return
  }

  // État antérieur AVANT la transaction (§ 10.5).
  writeFileSync(
    fichierEtat,
    JSON.stringify(
      {
        _lisezMoi: 'État AVANT scripts/graphe-marches-publics.ts --apply : annotations, notes et renvois sortants des 25 fiches.',
        ecritLe: new Date().toISOString(),
        fiches: [...docs.entries()].map(([source, d]) => ({
          source,
          id: d.id,
          status: d.status,
          md5Body: md5(d.bodyOriginal),
          md5Annotations: md5(d.annotationsJson ?? ''),
          summaryFr: d.summaryFr,
          annotationsJson: d.annotationsJson,
        })),
        crossRefsSortants: dejaSortants,
        articleVersions: dejaVersions,
      },
      null,
      1,
    ) + '\n',
    'utf8',
  )
  p(`état antérieur sauvegardé : ${fichierEtat}`)

  const auditAvant = await prisma.auditLog.count({ where: { action: { in: ['CROSSREF_ADDED', 'ARTICLE_AMENDED'] } } })
  const xrefAvant = await prisma.crossRef.count()
  const avAvant = await prisma.articleVersion.count()
  const aAuditer = majAEcrire.length + aCreerAretes.length + aCreerIndex.length

  await prisma.$transaction(
    async (tx) => {
      // 1) les fiches : annotations (pastilles, replis, connexes) + notes de statut
      for (const x of majAEcrire) {
        const d = docs.get(x.source)!
        await tx.document.update({
          where: { id: x.docId },
          data: {
            annotationsJson: x.annotationsJson,
            summaryFr: x.summaryFr,
            searchText: buildSearchText({ ...d, annotationsJson: x.annotationsJson, summaryFr: x.summaryFr } as never),
          },
        })
        await audit(
          {
            action: 'ARTICLE_AMENDED',
            targetType: 'Document',
            targetId: x.docId,
            meta: {
              op: 'graphe-marches-publics',
              feuilleDeRoute: 'Lam — Prompt marchés publics (corpus), 27 août 2026, § 7 et § 8.5',
              source: x.source,
              annotations: x.changeAnnotations,
              noteDeFiche: x.changeSummary,
              md5AnnotationsAvant: md5(d.annotationsJson ?? ''),
              md5AnnotationsApres: md5(x.annotationsJson),
              etatAnterieur: fichierEtat,
            },
          },
          tx,
        )
      }

      // 2) les ArticleVersion — seq 0 MODIFIE (2009), seq 1 EN_VIGUEUR (2020)
      for (const v of aCreerVersions)
        await tx.articleVersion.create({
          data: {
            documentId: v.docId,
            anchor: v.anchor,
            label: v.label,
            body: v.body,
            status: v.status,
            seq: v.seq,
            origin: 'MANUAL',
            note: v.note,
            amendedByDocId: v.amendedByDocId,
            amendedByNumber: v.amendedByNumber,
          },
        })

      // 3) les renvois du graphe
      for (const a of aCreerAretes) {
        const from = docs.get(a.crossRef.fromSource)!
        const cible = a.crossRef.toSource ? docs.get(a.crossRef.toSource)! : null
        await tx.crossRef.create({
          data: {
            fromId: from.id,
            toId: cible?.id ?? null,
            toType: null, // jamais de désignation par numéro de fascicule (§ 8.6)
            toNumber: null,
            toAnchor: a.crossRef.toAnchor,
            toLabel: cible ? null : a.crossRef.toLabel,
            kind: a.kind,
            note: a.crossRef.note,
            position: positions.get(a)!,
            source: 'EDITORIAL',
          },
        })
        await audit(
          {
            action: 'CROSSREF_ADDED',
            targetType: 'Document',
            targetId: from.id,
            meta: {
              op: 'graphe-marches-publics',
              arete: a.id,
              kind: a.kind,
              fondement: a.fondement,
              justification: a.justification_du_kind,
              vers: cible?.id ?? `EN CLAIR — ${a.crossRef.toLabel}`,
              clause: a.clause_citee.texte,
              md5Clause: a.clause_citee.md5,
            },
          },
          tx,
        )
      }

      // 4) les rattachements d'Index du Moniteur
      // ⚠️ La position ne peut PAS être une constante : les deux chaînes d'erratum (loi 2009,
      // seuils 2012) posent DEUX renvois depuis le même document. Mesuré le 28 août : aucune
      // source de la base ne porte aujourd'hui deux renvois de même position — ce lot aurait
      // introduit les premiers, à l'ordre d'affichage indéterminé. On numérote par document.
      const rangIndex = new Map<string, number>()
      for (const r of aCreerIndex) {
        const rang = rangIndex.get(r.docId) ?? 0
        rangIndex.set(r.docId, rang + 1)
        await tx.crossRef.create({
          data: {
            fromId: r.docId,
            toId: r.entree.id,
            toType: null,
            toNumber: null,
            toLabel: null,
            kind: 'VOIR',
            note: `Publication au Journal officiel — Index du Moniteur, ${r.entree.number} (${r.role})${r.erratum ? '. Chaîne d’erratum : les DEUX entrées sont rattachées, la reproduction étant la référence affichée.' : ''}`,
            position: 100 + rang,
            source: 'EDITORIAL',
          },
        })
        await audit(
          {
            action: 'CROSSREF_ADDED',
            targetType: 'Document',
            targetId: r.docId,
            meta: {
              op: 'graphe-marches-publics',
              rattachementIndex: r.entree.number,
              entreeId: r.entree.id,
              lignesDuFascicule: r.fascicule,
              role: r.role,
              resolution: 'number + type INDEX (restriction au fascicule), puis désignation PAR ID, contrôlée sur titleFr',
            },
          },
          tx,
        )
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  )

  // ⚠️ audit() avale ses erreurs : on RECOMPTE après la transaction (§ 10.4).
  const auditApres = await prisma.auditLog.count({ where: { action: { in: ['CROSSREF_ADDED', 'ARTICLE_AMENDED'] } } })
  if (auditApres < auditAvant + aAuditer)
    throw new Error(`écriture NON ENTIÈREMENT AUDITÉE : AuditLog ${auditAvant} → ${auditApres} (attendu ≥ ${auditAvant + aAuditer}) — défaut à corriger`)
  if (auditApres > auditAvant + aAuditer)
    console.warn(`  ⚠ AuditLog ${auditAvant} → ${auditApres} : plus d'entrées que ce lot n'en écrit (écriture concurrente ?)`)

  // RELECTURE
  const xrefApres = await prisma.crossRef.count()
  if (xrefApres !== xrefAvant + aCreerAretes.length + aCreerIndex.length)
    throw new Error(`CrossRef recomptés : ${xrefApres} ≠ ${xrefAvant} + ${aCreerAretes.length + aCreerIndex.length} — la table vit, vérifier qui a écrit`)
  const avApres = await prisma.articleVersion.count()
  if (avApres !== avAvant + aCreerVersions.length) throw new Error(`ArticleVersion recomptées : ${avApres} ≠ ${avAvant} + ${aCreerVersions.length}`)
  for (const x of majAEcrire) {
    const relu = await prisma.document.findUniqueOrThrow({ where: { id: x.docId } })
    if (md5(relu.annotationsJson ?? '') !== md5(x.annotationsJson)) throw new Error(`relecture : ${x.source} — annotationsJson n'a pas l'empreinte attendue`)
    if (md5(relu.bodyOriginal) !== md5(docs.get(x.source)!.bodyOriginal)) throw new Error(`relecture : ${x.source} — le CORPS a bougé, il ne devait pas`)
  }
  // la version AFFICHÉE est bien la version en vigueur, une seule par ancre
  for (const v of versions.filter((z) => z.status === 'EN_VIGUEUR')) {
    const n = await prisma.articleVersion.count({ where: { documentId: v.docId, anchor: v.anchor, status: 'EN_VIGUEUR' } })
    if (n !== 1) throw new Error(`relecture : ${v.source} ${v.anchor} — ${n} version(s) EN_VIGUEUR, 1 attendue`)
  }

  // ⚠️ HORS transaction : reindexDocument, par document touché.
  const aReindexer = new Set<string>([...majAEcrire.map((x) => x.docId), ...aCreerAretes.map((a) => docs.get(a.crossRef.fromSource)!.id), ...aCreerIndex.map((r) => r.docId)])
  for (const id of aReindexer) await reindexDocument(id)

  p()
  p('✓ Graphe posé.')
  p(`  ${majAEcrire.length} fiches mises à jour (pastilles, replis, notes) · ${aCreerVersions.length} ArticleVersion · ${aCreerAretes.length} renvois · ${aCreerIndex.length} rattachements d’Index`)
  p(`  journal d'audit ${auditAvant} → ${auditApres} (+${auditApres - auditAvant}, attendu ${aAuditer} — recompté)`)
  p(`  ${aReindexer.size} documents réindexés, hors transaction`)
}

main()
  .catch((e) => {
    console.error('\nÉCHEC :', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
