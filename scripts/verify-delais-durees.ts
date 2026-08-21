/**
 * § 4.5 — LE RECOUPEMENT DES 123 DURÉES CONTRE LE TEXTE EN BASE. **LECTURE SEULE.**
 *
 *   npx tsx scripts/verify-delais-durees.ts
 *   npx tsx scripts/verify-delais-durees.ts --sortie /chemin/controle.tsv
 *
 * ⚠️ CORRECTIF (défaut 3 du cahier de recette). Ce fichier était ABSENT, alors que le § 4.5
 * l'impose en toutes lettres : « Avant la graine, tu produis scripts/verify-delais-durees.ts
 * … pour chacune des 123 entrées calculables ». C'est le SEUL contrôle qui garde la donnée
 * contre le défaut du § 0 côté durées — c'est précisément l'absence de ce recoupement qui
 * avait fait manquer les art. 296 et 417.
 *
 * Ce qu'il fait, et rien d'autre :
 *  1. il résout chaque entrée vers un BLOC de texte en base — par `articleAnchorFromHeading`,
 *     par OCCURRENCE pour le Code du travail (207 numéros en double), et par une TABLE
 *     EXPLICITE pour les 12 entrées à numérotation non simple et pour les articles des
 *     décrets annexés au Code civil (le piège des homonymes : `art-6` et `art-28` tombent
 *     sinon sur les articles du Code civil qui portent le même numéro) ;
 *  2. il écrit le fichier de contrôle exigé par le § 4.5 — `article | dureeTexte | phrase du
 *     Code` — puis il le RELIT ;
 *  3. il remonte les divergences. **Il ne corrige RIEN** : un écart est un signal humain.
 *
 * Il contrôle aussi le garde-fou A5 du § 4.9 : une entrée `JOURS_DISTANCE_NON_CHIFFREE` qui
 * porte A5 doit avoir, DANS LE TEXTE LU EN BASE, le mot « lieue ».
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { prisma } from '../src/lib/db'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { kindCalcule } from '../src/lib/delais/calcul'
import { REPERTOIRE, construireEntrees } from '../src/lib/delais/repertoire'
import type { EntreeGrainee } from '../src/lib/delais/repertoire'
import { DOC_CCIV, DOC_CPC, DOC_CTRAV } from '../src/lib/delais/textes'

/** Les décrets annexés, vérifiés en base le 19 août 2026 (cf. `CITATIONS_CIVIL_FRANC`). */
const DOC_D1983_ALIMENTS = 'cms8dwuuy0026qt1vtjgzjuxr'
const DOC_D1974_ADOPTION = 'cms8dwvkj0027qt1vrfyplivq'
const DOC_D1968_DIVORCE = 'cms8dwred0021qt1v7m35suhu'
const DOC_D1977_DECES = 'cms8dww9t0028qt1v9yx8on92'

type Resolution = {
  docId?: string
  /** Ancre `art-N` à chercher dans le corps. */
  ancre?: string
  /** Rang de l'en-tête portant cette ancre (1 = le premier). Code du travail : 207 doublons. */
  occurrence?: number
  /** Repli : le bloc est délimité par cette sous-chaîne, quand aucun en-tête ne le porte. */
  sousChaine?: string
  /** Le répertoire ne DÉSIGNE aucun article : rien à recouper. À trancher par la rédaction. */
  nonResoluble?: boolean
  /** Pourquoi cette résolution-là. Imprimée dans le fichier de contrôle. */
  note: string
}

/**
 * § 4.5 — LA TABLE EXPLICITE. Elle couvre les 12 entrées à numérotation non simple ET les
 * articles des décrets annexés au Code civil, dont l'ancre `art-N` tomberait sinon sur
 * l'article HOMONYME du Code civil lui-même. Chaque ligne dit d'où vient le texte.
 */
const RESOLUTION: Record<string, Resolution> = {
  // --- C. pr. civ. : numérotations non simples -----------------------------
  'cpc-10-2-citation-ile-adjacente-tribunal-meme': {
    ancre: 'art-10',
    note: 'Art. 10, 2° — le répertoire écrit « 10-2° » ; l’en-tête en base est « Article 10 ».',
  },
  'cpc-10-2-citation-ile-adjacente-tribunal-autre': {
    ancre: 'art-10',
    note: 'Art. 10, 2° (seconde hypothèse) — même bloc que la précédente.',
  },
  'cpc-10-4': {
    ancre: 'art-10',
    note: 'Art. 10, 4° — base 0 jour : la durée EST celle de l’art. 74 (surcharge § 4.5).',
  },
  'cpc-361-362': {
    ancre: 'art-361',
    note: 'Le répertoire couvre DEUX articles (361 et 362) sous une seule ligne ; on lit le 361.',
  },
  'cpc-970-1': {
    ancre: 'art-970-1',
    note: 'Article 970-1 (arbitrage) — ancre décimale, résolue par `anchorFromDesignation`.',
  },
  'cpc-978-1': {
    ancre: 'art-978-1',
    note: 'Article 978-1 (arbitrage international) — ancre décimale.',
  },

  // --- Code civil : les articles des DÉCRETS ANNEXÉS -----------------------
  // ⚠️ LE PIÈGE DES HOMONYMES. `art-6`, `art-28` et `art-30` existent AUSSI dans le Code
  // civil lui-même : une résolution par ancre simple sur `DOC_CCIV` lit l'article du Code
  // civil et rend un faux positif. Ces lignes viennent de décrets annexés, qui sont des
  // DOCUMENTS DISTINCTS en base.
  'civ-2-loi-annexee': {
    docId: DOC_D1983_ALIMENTS,
    ancre: 'art-2',
    note: 'Décret du 14 sept. 1983 (créances d’aliments, garde d’enfants), art. 2, al. 4. Le répertoire écrit « Art. 2 (loi annexée) » : c’est un DÉCRET, appendice IV.8 du C. pr. civ.',
  },
  'civ-6': {
    docId: DOC_D1983_ALIMENTS,
    ancre: 'art-6',
    note: 'Décret du 14 sept. 1983, art. 6 — PAS l’art. 6 du Code civil (piège des homonymes).',
  },
  'civ-28': {
    docId: DOC_D1974_ADOPTION,
    ancre: 'art-28',
    note: 'Décret du 4 avril 1974 (adoption), art. 28 — PAS l’art. 28 du Code civil.',
  },
  'civ-30': {
    docId: DOC_D1974_ADOPTION,
    ancre: 'art-30',
    note: 'Décret du 4 avril 1974 (adoption), art. 30 — PAS l’art. 30 du Code civil.',
  },
  'civ-loi-art-10-transcription-dispositif-jugement-arret': {
    docId: DOC_D1968_DIVORCE,
    ancre: 'art-10',
    note: 'Décret du 6 juin 1968 (procédure du divorce), art. 10. ⚠️ Le texte en base NE PORTE NI « trois jours » NI « francs » (constat du § 4.7, garde-fou 1) : l’entrée est `regimeIncertain`.',
  },
  'civ-229-l-5-mai-1949': {
    docId: DOC_CCIV,
    ancre: 'art-229',
    note: 'C. civ., art. 229, dans sa rédaction de la Loi du 5 mai 1949.',
  },
  'civ-loi-jugement-declaratif-de-deces-art-4': {
    docId: DOC_D1977_DECES,
    ancre: 'art-4',
    note: 'Décret du 24 nov. 1977 (décès de tout Haïtien disparu), art. 4 — « transcrit, dans la huitaine du prononcé ». Le répertoire écrit « Loi (jugement déclaratif de décès), art. 4 » : l’ancre par défaut ne s’en déduit pas.',
  },

  // --- C. trav. : deux désignations qui ne portent aucun numéro exploitable ---
  'trav-loi-assurance-art-168': {
    ancre: 'art-168',
    occurrence: 2,
    note: 'C. trav., art. 168 SECONDE occurrence (loi sur l’assurance, ch. XXVII) — « dans un délai de trente jours après l’accident ». La PREMIÈRE occurrence traite du délai de grâce accordé à la partie débitrice : lire la mauvaise serait exactement le piège des 207 numéros en double.',
  },
  'trav-assurance-maternite': {
    nonResoluble: true,
    note:
      'À TRANCHER PAR LA RÉDACTION. Le répertoire n’écrit AUCUN numéro d’article (« Assurance ' +
      'maternité ») et le Code du travail en base ne porte aucune règle d’avis de grossesse ' +
      'en huit jours : recherché le 19 août 2026 sur « grossesse », « enceinte », « gestante », ' +
      '« huit jours » et sur le chapitre VII (décret d’assurance maladie-maternité, art. 1 à ' +
      '66) — les seuls « huit jours » voisins sont l’art. 150, 2e occ. (retour du formulaire ' +
      'de déclaration d’entreprise par l’EMPLOYEUR) et l’art. 391 (même déclaration, ' +
      'Direction du Travail), qui ne sont ni l’un ni l’autre un avis de grossesse. Cette ' +
      'entrée est déjà `regimeIncertain` (§ 4.7, garde-fou 2) ; elle reste CALCULABLE et ' +
      'affiche donc une date sur une durée que le corpus ne montre pas.',
  },
}

/** Nombres écrits en toutes lettres, tels que les Codes les écrivent. */
const NOMBRES: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100,
  'dix-huit': 18, 'dix-sept': 17, 'dix-neuf': 19, 'vingt-quatre': 24, 'vingt-cinq': 25,
  'quarante-cinq': 45, 'quarante-huit': 48, 'soixante-douze': 72,
}

/** « huitaine » = 8 jours, « quinzaine » = 15 : les deux formes du Code (§ 4.4). */
const COLLECTIFS: Record<string, number> = { huitaine: 8, quinzaine: 15, dizaine: 10 }

/** Toutes les durées EN JOURS que la phrase du Code énonce, dans l'ordre d'apparition. */
function dureesDuTexte(bloc: string): { valeur: number; extrait: string }[] {
  const out: { valeur: number; extrait: string }[] = []
  const plat = bloc.replace(/\s+/g, ' ')
  // « trente jours », « 30 jours », « trois (3) jours », « quarante-cinq jours francs »
  const motsNombres = Object.keys(NOMBRES).sort((a, b) => b.length - a.length).join('|')
  const re = new RegExp(
    `\\b(?:(\\d{1,3})|(${motsNombres}))\\b(?:\\s*\\(\\d{1,3}\\))?\\s+(?:jours?|mois|ans?|années?|heures?)`,
    'gi',
  )
  for (const m of plat.matchAll(re)) {
    const unite = m[0].toLowerCase()
    if (!/jours?/.test(unite)) continue
    const valeur = m[1] ? Number(m[1]) : NOMBRES[m[2].toLowerCase()]
    if (Number.isFinite(valeur)) out.push({ valeur, extrait: extraitAutour(plat, m.index ?? 0) })
  }
  for (const [mot, valeur] of Object.entries(COLLECTIFS)) {
    const m = new RegExp(`\\b${mot}\\b`, 'i').exec(plat)
    if (m) out.push({ valeur, extrait: extraitAutour(plat, m.index) })
  }
  return out
}

function extraitAutour(plat: string, index: number): string {
  return plat.slice(Math.max(0, index - 90), index + 110).trim()
}

/** Découpe un corps en blocs d'articles : de chaque en-tête au suivant. */
function blocsParAncre(corps: string): Map<string, string[]> {
  const parAncre = new Map<string, string[]>()
  const lignes = corps.split('\n')
  let ancre: string | null = null
  let buf: string[] = []
  const pousser = () => {
    if (!ancre) return
    parAncre.set(ancre, [...(parAncre.get(ancre) ?? []), buf.join('\n').trimEnd()])
  }
  for (const l of lignes) {
    const a = articleAnchorFromHeading(l.trim())
    if (a) {
      pousser()
      ancre = a
      buf = [l]
      continue
    }
    if (ancre) buf.push(l)
  }
  pousser()
  return parAncre
}

const DOC_PAR_CODE: Record<string, string> = {
  CPC: DOC_CPC,
  TRAVAIL: DOC_CTRAV,
  CIVIL: DOC_CCIV,
}

/** L'ancre par défaut d'une entrée : le numéro de l'article, préfixe « Art. » retiré. */
function ancreParDefaut(article: string): string | null {
  const nu = article.trim().replace(/^\s*(?:arts?\.|articles?)\s+/i, '')
  const a = articleAnchorFromHeading(`Article ${nu}`)
  return a ?? null
}

type Verdict = {
  entree: EntreeGrainee
  docId: string
  ancre: string | null
  occurrence: number
  note: string
  bloc: string | null
  durees: number[]
  phrase: string
  statut:
    | 'CONCORDE'
    | 'DIVERGE'
    | 'INTROUVABLE'
    | 'SANS_DUREE'
    | 'BASE_ZERO'
    /** La rédaction a NOMMÉ l'article qui énonce la durée : l'écran le dit (défaut 3, art. 356). */
    | 'DUREE_AILLEURS'
    /** Le répertoire ne désigne aucun article : il n'y a rien à recouper. Signal humain. */
    | 'NON_RESOLUBLE'
}

/** Les statuts qui ARRÊTENT : une durée que le texte lu en base ne montre pas. */
const BLOQUANTS = ['DIVERGE', 'INTROUVABLE', 'SANS_DUREE', 'NON_RESOLUBLE'] as const

/** Ceux qui se montrent sans arrêter : la rédaction s'est déjà prononcée. */
const A_MONTRER = [...BLOQUANTS, 'BASE_ZERO', 'DUREE_AILLEURS'] as const

async function main() {
  console.log('\n● LECTURE SEULE — aucun écrit en base, aucune correction automatique.\n')
  const sortieArg = process.argv.indexOf('--sortie')
  const sortie =
    sortieArg > 0 ? process.argv[sortieArg + 1] : join(tmpdir(), 'verify-delais-durees.tsv')

  const entrees = construireEntrees(REPERTOIRE).filter((e) => kindCalcule(e.kind))
  console.log(`${entrees.length} entrées calculables (attendu 123).`)

  const corps = new Map<string, string>()
  const charger = async (docId: string) => {
    if (corps.has(docId)) return corps.get(docId)!
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: { bodyOriginal: true },
    })
    corps.set(docId, doc?.bodyOriginal ?? '')
    return corps.get(docId)!
  }
  const blocs = new Map<string, Map<string, string[]>>()
  const decouper = async (docId: string) => {
    if (blocs.has(docId)) return blocs.get(docId)!
    blocs.set(docId, blocsParAncre(await charger(docId)))
    return blocs.get(docId)!
  }

  const verdicts: Verdict[] = []
  for (const e of entrees) {
    const r = RESOLUTION[e.slug] ?? {
      note:
        e.code === 'TRAVAIL'
          ? `Résolu par OCCURRENCE ${e.articleOccurrence} (le Code du travail porte 207 numéros en double).`
          : 'Résolu par ancre simple.',
    }
    const docId = r.docId ?? DOC_PAR_CODE[e.code]
    const ancre = r.ancre ?? ancreParDefaut(e.article)
    const occurrence = r.occurrence ?? (e.code === 'TRAVAIL' ? e.articleOccurrence : 1)
    let bloc: string | null = null
    if (r.nonResoluble) {
      // Rien à lire : le répertoire ne désigne aucun article. On le DIT, on ne devine pas.
    } else if (ancre) {
      const tous = (await decouper(docId)).get(ancre) ?? []
      bloc = tous[occurrence - 1] ?? null
    } else if (r.sousChaine) {
      const body = await charger(docId)
      const i = body.indexOf(r.sousChaine)
      bloc = i >= 0 ? body.slice(i, i + 1200) : null
    }
    const trouvees = bloc ? dureesDuTexte(bloc) : []
    const concorde = trouvees.find((t) => t.valeur === e.jours)
    const statut: Verdict['statut'] = r.nonResoluble
      ? 'NON_RESOLUBLE'
      : bloc == null
        ? 'INTROUVABLE'
        : e.jours === 0
          ? 'BASE_ZERO'
          : concorde
            ? 'CONCORDE'
            : // § 4.5, défaut 3 — l'art. 356 ne chiffre pas sa durée : elle est à l'art. 354.
              // La rédaction l'a nommé dans `dureeFondementFr`, et l'écran l'imprime : ce
              // n'est plus une durée sans texte, c'est un renvoi assumé.
              e.dureeFondementFr
              ? 'DUREE_AILLEURS'
              : trouvees.length === 0
                ? 'SANS_DUREE'
                : 'DIVERGE'
    verdicts.push({
      entree: e,
      docId,
      ancre,
      occurrence,
      note: r.note,
      bloc,
      durees: trouvees.map((t) => t.valeur),
      phrase: concorde?.extrait ?? trouvees[0]?.extrait ?? (bloc ? bloc.replace(/\s+/g, ' ').slice(0, 200) : ''),
      statut,
    })
  }

  // ---- Le fichier de contrôle du § 4.5 : article | dureeTexte | phrase du Code ----
  const entete = [
    '# § 4.5 — CONTRÔLE DES DURÉES. Lecture seule, produit par scripts/verify-delais-durees.ts',
    '# colonnes : statut | code | article | occ | jours | dureeTexte | phrase du Code | note de résolution',
    '',
  ].join('\n')
  const corpsFichier = verdicts
    .map((v) =>
      [
        v.statut,
        v.entree.code,
        v.entree.article,
        String(v.occurrence),
        String(v.entree.jours),
        v.entree.dureeTexte,
        v.phrase.replace(/\t/g, ' '),
        v.note.replace(/\t/g, ' '),
      ].join('\t'),
    )
    .join('\n')
  writeFileSync(sortie, `${entete}${corpsFichier}\n`, 'utf8')
  console.log(`Fichier de contrôle écrit : ${sortie}`)

  // ---- … et RELU, comme le § 4.5 l'exige : on ne rend compte que de ce qui est écrit ----
  const relu = readFileSync(sortie, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('\t'))
  console.log(`Relu : ${relu.length} lignes.\n`)

  const parStatut = new Map<string, string[][]>()
  for (const l of relu) parStatut.set(l[0], [...(parStatut.get(l[0]) ?? []), l])
  for (const s of ['CONCORDE', ...A_MONTRER]) {
    console.log(`  ${s.padEnd(14)} ${String(parStatut.get(s)?.length ?? 0).padStart(3)}`)
  }

  const aSignaler = A_MONTRER.flatMap((s) => parStatut.get(s) ?? [])
  if (aSignaler.length > 0) {
    console.log(`\n─── ${aSignaler.length} entrée(s) à REMONTER — aucune n’est corrigée ici ` + '─'.repeat(8))
    for (const l of aSignaler) {
      console.log(`\n  [${l[0]}] ${l[1]} ${l[2]} (occ ${l[3]}) — catalogue : ${l[4]} j, « ${l[5]} »`)
      console.log(`      texte en base : ${l[6].slice(0, 200) || '(bloc introuvable)'}`)
      console.log(`      résolution    : ${l[7]}`)
    }
  }

  // ---- § 4.9 — le garde-fou A5, sur le texte LU EN BASE ----
  console.log('\n─── § 4.9 — A5 : le mot « lieue » est-il dans le texte en base ? ' + '─'.repeat(11))
  let ecartsA5 = 0
  for (const v of verdicts) {
    if (v.entree.kind !== 'JOURS_DISTANCE_NON_CHIFFREE') continue
    const dansLeTexte = v.bloc ? /lieue/i.test(v.bloc) : false
    const porteA5 = v.entree.avisDistance === 'A5'
    const marque = dansLeTexte === porteA5 ? '✓' : '✗'
    if (dansLeTexte !== porteA5) ecartsA5++
    console.log(
      `  ${marque} ${v.entree.article.padEnd(26)} avis ${String(v.entree.avisDistance).padEnd(7)} ` +
        `· « lieue » en base : ${dansLeTexte ? 'oui' : 'non'} · citation portée : ` +
        `${v.entree.citationArticle ? 'oui' : 'NON'}`,
    )
    if (porteA5 && (!v.entree.citationArticle || !/lieue/i.test(v.entree.citationArticle))) {
      ecartsA5++
      console.log('      ✗ A5 sans citation d’article contenant « lieue » — § 4.9, gabarit')
    }
  }

  const bloquants =
    BLOQUANTS.reduce((s, cle) => s + (parStatut.get(cle)?.length ?? 0), 0) + ecartsA5
  console.log(
    bloquants === 0
      ? '\n✓ Les 123 durées concordent avec le texte lu en base.\n'
      : `\n✗ ${bloquants} point(s) à trancher. C’est un signal HUMAIN : ne corrige rien tout seul.\n`,
  )
  if (bloquants > 0) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
