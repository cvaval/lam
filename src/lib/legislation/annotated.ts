/**
 * Texte annoté (Code du travail, annoté par J.-F. Salès) — structure d'AFFICHAGE stockée
 * dans Document.annotationsJson. bodyOriginal reste le texte officiel canonique (§02) ;
 * jurisprudence, table des matières et index n'en font pas partie et ne sont JAMAIS fondus
 * dedans. Cf. scripts/_import-code-travail.ts (parser parse_ct.py).
 */
import { anchorFromDesignation, articleAnchorFromHeading } from '../doc/anchors'

export interface JurisCase {
  ref: string // « Arrêt du 5 avril 1966, 2ᵉ section, X c. Y »
  excerpt: string // extrait du considérant
}
export interface NavItem {
  label: string
  anchor: string // sec-N
  children?: NavItem[] // sous-niveau (chapitres d'un livre, divisions d'une annexe)
  /**
   * Plage d'articles de la division (« art. 13 à 31 », « art. 15 et 16 », « art. 13 ») et
   * l'ancre de son premier article. FACULTATIFS : CALCULÉS sur le corps versé par l'import,
   * jamais saisis — et une fiche qui ne les porte pas s'affiche comme avant. Consigne de
   * Me Vaval (13 oct. 2026, Code fiscal) : le sommaire HTML indique des ARTICLES, jamais des
   * pages. ⚠️ Jamais dans `toc.label`, qui doit s'apparier au corps.
   */
  articles?: string
  articlesAnchor?: string
}
export interface NavGroup {
  label: string
  anchor: string
  children: NavItem[]
  articles?: string
  articlesAnchor?: string
}
export interface TocEntry {
  level: number
  label: string
  anchor: string // sec-N
  kind: string // "code" | "connexe"
}
// ctRefs : numéro d'article (Code du travail → entiers) OU désignation d'ancre (Constitution →
// « 12-1 », « 190-ter-5 »). Dans les deux cas, le lien se construit `#art-${ref}`.
export type ArtRef = number | string
export interface IndexEntry {
  subject: string
  ctRefs: ArtRef[]
  /** Renvois du même sujet vers d'AUTRES documents (index multi-textes de
   *  l'édition Vandal) : « D. 28 août 1960, art 6 » → /doc/{id}#art-6. */
  docRefs?: { label: string; id: string; anchor?: string }[]
}

/** Affichage joli d'une référence d'article : « 12-1 » → « 12.1 » (numérotation
 *  constitutionnelle), « 190-ter-5 » → « 190ter.5 ». Les numérotations à 4 chiffres
 *  (réforme du Code de commerce « 1111-2 », décrets du Code civil « 1774-1 ») gardent
 *  leur TRAIT D'UNION officiel (constat d'audit : « 1111.2 » n'existe pas au Moniteur). */
export function prettyRef(r: ArtRef): string {
  const s = String(r)
  if (/^\d{4}/.test(s)) return s
  return s.replace(/-(bis|ter|quater)/g, '$1').replace(/-/g, '.')
}
/**
 * Nettoie un sujet d'index : retire la mention « définition(s) » en préfixe (« Définitions — X »)
 * ou en suffixe (« X — définition ») pour ne garder que le terme, première lettre en capitale.
 */
export function cleanIndexSubject(s: string): string {
  if (/^d[ée]finitions?\s*$/i.test(s.trim())) return '' // entrée « Définition » nue (sans terme) → ignorée
  const t = s
    .replace(/^d[ée]finitions?\s*[—–-]\s*/i, '')
    .replace(/\s*[—–-]\s*d[ée]finitions?\s*$/i, '')
    .trim()
  const r = t || s
  return r.charAt(0).toUpperCase() + r.slice(1)
}

export interface CrossRefEntry {
  anchor: string // ancre de section (sec-N) où afficher le renvoi
  articles: number[] // articles du Code visés (liens #art-N)
  note?: string
  /** Renvois vers d'AUTRES documents de la plateforme (ex. loi modificatrice) — liens /doc/{id}. */
  docs?: { label: string; id: string }[]
  /** Dispositions générales d'une loi modificatrice à AFFICHER sous l'en-tête de section
   *  (ex. principes posés par la loi de filiation sous la LOI Nº 8 du Code civil). */
  insertedArticles?: { label: string; body: string }[]
  /** Nature du bandeau (registre des situations, 17 oct. 2026) : `renvoi` · `sic` · `consolidation` ·
   *  `provenance` · `annexe` · `rectification` · `modification`. Absent → `natureDuBandeau()`. */
  kind?: string
}
/** Bloc de législation connexe (décret intégré, loi liée, citation) replié sous un article. */
export interface ConnexeBlock {
  label: string // intitulé (« Décret du 14 novembre 1988 modifiant… ») — '' pour une citation nue
  text: string // contenu (articles internes du décret, extraits)
  /** Si présent, l'intitulé devient un lien cliquable vers ce document (/doc/{docId}) —
   *  ex. décret modificateur téléversé séparément. */
  docId?: string
  /** Ancre optionnelle dans le document cible (#art-N) — ex. renvoyer l'intitulé
   *  « Constitution de 1987 » directement à l'article 35 de la Constitution téléversée. */
  anchor?: string
  /** Nature du bloc (registre des situations, 17 oct. 2026) : `modificatif` · `abrogatif` ·
   *  `derogation` · `texte_a_jour` · `ancienne_redaction` · `source` · `sic`. Absent → `natureDuConnexe()`. */
  kind?: string
}
export interface Annotations {
  title: string
  annotationAuthor: string
  navToc: NavGroup[]
  toc: TocEntry[]
  connexes: { title: string; anchor: string }[]
  jurisprudence: Record<string, JurisCase[]> // clé = ancre d'article (art-N)
  indexEntries: IndexEntry[]
  crossRefs?: CrossRefEntry[] // renvois croisés éditoriaux (section → articles du Code)
  /**
   * RÉSERVE DE COUVERTURE — bandeau toujours visible en tête du texte officiel.
   *
   * Les transcriptions des lois de finances sont des EXTRAITS : elles couvrent la partie fiscale
   * et s'arrêtent où commencent les tableaux budgétaires. Le Budget général 2025-2026 en compte
   * 120 articles ; l'extrait s'arrête au 58ᵉ. Publier cela sans le dire tromperait le lecteur.
   *
   * ⚠️ POURQUOI UN CHAMP PROPRE plutôt qu'un canal existant. Les trois candidats mentent tous sur
   * ce qu'ils affichent : `crossRefs` s'annonce « ↪ Renvoi : » (une réserve n'est pas un renvoi,
   * et le libellé est en dur) ; `commentaires` est rendu dans un pliable FERMÉ par défaut et
   * intitulé « Annotations » — une réserve qu'il faut déplier n'avertit personne ; `meansFr` dit
   * « Sa sa vle di / What it means » et n'est utilisé par aucun document.
   */
  reserve?: string
  // Constitution : ancienne version (1987) par article, statut d'amendement, libellé d'article.
  oldVersions?: Record<string, string> // ancre → texte de l'ancienne version (repliable)
  /** Titre des replis d'ancienne rédaction, s'il diffère du registre (« Ancienne rédaction ») :
   *  la Constitution porte « Ancienne version (1987) ». Ce libellé était écrit EN DUR dans
   *  OldVersion et s'affichait sur cinq autres textes (17 oct. 2026). */
  oldVersionsLabel?: string
  status?: Record<string, string | null> // ancre → « modifié » | « nouveau » | « abrogé »
  labels?: Record<string, string> // ancre → « Article 12.1 » (numérotation complexe)
  /**
   * Note de CONCORDANCE de l'éditeur — ancre → « Nouveau », « Anc. art. 42 fr. ».
   *
   * ⚠️ CE N'EST PAS UN STATUT D'AMENDEMENT, et les deux se contredisent sur ce corpus.
   * L'édition Vandal du Code de commerce imprime en marge la correspondance avec l'ancienne
   * numérotation FRANÇAISE : « Nouveau » y signifie « sans antécédent français », pas
   * « inséré par tel acte ». Aplaties dans le corps par l'import, ces notes se lisaient comme
   * du texte de loi — et 17 d'entre elles surmontaient un article que `status` donne pour
   * MODIFIÉ ou ABROGÉ (arts 93, 94, 95…). Elles vivent donc ici, et se rendent à part.
   */
  concordance?: Record<string, string>
  /**
   * Acte auquel un article doit son ÉTAT — ancre → { label, href }.
   *
   * ⚠️ « Nouveau » NE DIT PAS DE QUI. Le Code de commerce porte 100 articles marqués
   * « nouveau » venus du bail professionnel et des sûretés, et 297 de plus venus du Décret
   * régissant l'insolvabilité : sans le nom de l'acte, la pastille range trois réformes
   * distinctes sous un même mot. Le libellé est court, le lien mène à la fiche de l'acte.
   */
  statusActe?: Record<string, { label: string; href: string }>
  /**
   * Actes NOMMÉS dans le texte et ses annotations, liés à leur fiche — désignation → id du
   * document cible (le texte de l'acte, ou à défaut le fascicule du Moniteur qui le publie).
   * « Décret du 8 octobre 1982 » → Le Moniteur n° 75. Le lecteur lie chaque occurrence de la
   * désignation (src/lib/doc/acterefs.ts) ; un acte absent de la base n'y figure pas.
   */
  actesLies?: Record<string, string>
  // Circulaires BRH : désignations des divisions numérotées « 1.- » / « 4.2.1 » qui tiennent
  // lieu d'articles (liste blanche, ordre du corps). Active l'ancrage art-… sur ces têtes et
  // les renvois internes « la section 7 ». Absent = comportement historique inchangé.
  pointAnchors?: string[]
  /**
   * Tête d'article IMPRIMÉE PLUSIEURS FOIS par le Journal officiel, à conserver telle quelle —
   * ancre de la 1ʳᵉ occurrence → ancres TECHNIQUES des suivantes, dans l'ordre du corps.
   * Code fiscal 2026 : « Article 406.- » deux fois (Spécial N° 48-A, p. 123-124) →
   * `{ "art-406": ["art-406-2"] }`. Le texte n'est pas touché ; `labels` affiche « Article 406 »
   * sur les deux. Absent = comportement historique : la répétition perd son ancre.
   */
  repeatedHeads?: Record<string, string[]>
  /**
   * Libellé d'AFFICHAGE d'un renvoi d'index dont l'ancre ne dit pas le numéro imprimé — renvoi
   * (tel qu'écrit dans `ctRefs`) → libellé. Code fiscal 2026 : `{ "406-2": "406 (2ᵉ)" }`, le
   * second « Article 406 » du J.O. Absent : `prettyRef`, comme avant.
   */
  refDisplay?: Record<string, string>
  // Code civil : législation connexe (ancre art-N) + commentaires doctrinaux (clé sec-K|art-N).
  connexe?: Record<string, ConnexeBlock[]>
  commentaires?: Record<string, string[]>
}

export interface Backlink {
  subject: string
  refs: ArtRef[] // AUTRES articles du même sujet (l'article courant exclu) — cibles cliquables
}

/**
 * Renvoi inverse de l'index : numéro d'article du Code (ancre art-N) → entrées d'index qui le
 * citent, chacune avec les AUTRES articles du même sujet. Affiché sous chaque article ; chaque
 * sujet renvoie (cliquable) vers un article connexe traitant du même thème.
 */
export function indexBacklinks(entries: IndexEntry[]): Map<string, Backlink[]> {
  const m = new Map<string, Backlink[]>()
  for (const e of entries) {
    for (const n of e.ctRefs) {
      const k = `art-${n}`
      const refs = e.ctRefs.filter((r) => r !== n)
      const arr = m.get(k)
      if (arr) {
        if (!arr.some((x) => x.subject === e.subject)) arr.push({ subject: e.subject, refs })
      } else m.set(k, [{ subject: e.subject, refs }])
    }
  }
  return m
}

export function parseAnnotations(json: string | null | undefined): Annotations | null {
  if (!json) return null
  try {
    const a = JSON.parse(json) as Partial<Annotations>
    if (!a || !Array.isArray(a.toc)) return null
    // Coercition défensive : une régression du parser sur un champ ne doit pas faire planter
    // la page (rendu serveur). Chaque tableau/objet est ramené à une valeur sûre.
    return {
      title: typeof a.title === 'string' ? a.title : '',
      annotationAuthor: typeof a.annotationAuthor === 'string' ? a.annotationAuthor : '',
      navToc: Array.isArray(a.navToc) ? a.navToc : [],
      toc: a.toc,
      connexes: Array.isArray(a.connexes) ? a.connexes : [],
      jurisprudence: a.jurisprudence && typeof a.jurisprudence === 'object' ? a.jurisprudence : {},
      indexEntries: Array.isArray(a.indexEntries) ? a.indexEntries : [],
      crossRefs: Array.isArray(a.crossRefs) ? a.crossRefs : [],
      reserve: typeof a.reserve === 'string' && a.reserve.trim() ? a.reserve : undefined,
      oldVersions: a.oldVersions && typeof a.oldVersions === 'object' ? a.oldVersions : {},
      oldVersionsLabel: typeof a.oldVersionsLabel === 'string' && a.oldVersionsLabel.trim() ? a.oldVersionsLabel : undefined,
      status: a.status && typeof a.status === 'object' ? a.status : {},
      labels: a.labels && typeof a.labels === 'object' ? a.labels : {},
      concordance: a.concordance && typeof a.concordance === 'object' ? a.concordance : {},
      statusActe: a.statusActe && typeof a.statusActe === 'object' ? a.statusActe : {},
      actesLies:
        a.actesLies && typeof a.actesLies === 'object'
          ? Object.fromEntries(Object.entries(a.actesLies).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].length > 0))
          : undefined,
      connexe: a.connexe && typeof a.connexe === 'object' ? a.connexe : {},
      commentaires: a.commentaires && typeof a.commentaires === 'object' ? a.commentaires : {},
      // Circulaires BRH : sans ce champ, la liste blanche n'atteint pas segmentAnnotated et
      // le lecteur annoté est INERTE (aucune ancre, aucune carte, aucun renvoi) — la
      // coercition est une liste blanche, tout champ oublié ici disparaît silencieusement.
      pointAnchors: Array.isArray(a.pointAnchors) ? a.pointAnchors.filter((x): x is string => typeof x === 'string') : undefined,
      repeatedHeads:
        a.repeatedHeads && typeof a.repeatedHeads === 'object'
          ? Object.fromEntries(
              Object.entries(a.repeatedHeads)
                .filter((e): e is [string, string[]] => Array.isArray(e[1]))
                .map(([k, v]) => [k, v.filter((x): x is string => typeof x === 'string')]),
            )
          : undefined,
      refDisplay:
        a.refDisplay && typeof a.refDisplay === 'object'
          ? Object.fromEntries(Object.entries(a.refDisplay).filter((e): e is [string, string] => typeof e[1] === 'string'))
          : undefined,
    }
  } catch {
    return null
  }
}

export type AnnBlock =
  | { kind: 'section'; anchor: string; level: number; tocKind: string; text: string }
  | { kind: 'body'; anchor: string | null; jurisKey: string | null; noAnchors: boolean; text: string }

/** Clé de jurisprudence qualifiée par section (anti-collision Code ↔ annexes). */
function jurisKeyFor(sectionAnchor: string | null, artAnchor: string): string {
  return `${sectionAnchor ?? 'sec-0'}|${artAnchor}`
}

/** Normalise pour comparer une ligne du corps à un libellé TOC (espaces, NBSP, marges). */
function normLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * Tête de division NUMÉROTÉE — « 1.- Dans le cadre… », « 9.1. Retard de transmission »,
 * « 4.2.1 Composition… ». Forme propre aux CIRCULAIRES BRH, qui ne numérotent pas en
 * « Article N » : `articleAnchorFromHeading` ne les voit donc pas.
 */
const POINT_HEAD_RE = /^(\d{1,2}(?:\.\d{1,2})*)\s*\.?\s*-?\s+\S/

/**
 * Ancre d'une tête numérotée, restreinte à une LISTE BLANCHE de désignations.
 *
 * La liste blanche est indispensable : dans les annexes d'une circulaire, des lignes comme
 * « 2 segments par enregistrement : » ou « 1. INTRODUCTION » ont la même forme que les
 * points du corps. Seules les désignations déclarées par le document (`pointAnchors`)
 * deviennent des ancres — tout le reste demeure du texte courant.
 */
export function pointAnchorFromHeading(line: string, allow: ReadonlySet<string>): string | undefined {
  const m = POINT_HEAD_RE.exec(line)
  if (!m || !allow.has(m[1])) return undefined
  return anchorFromDesignation(m[1])
}

/**
 * Découpe le corps officiel en blocs alternant sections (en-têtes) et corps d'articles.
 *
 * Ancres de section (sec-N) : on apparie chaque ligne au libellé TOC attendu, DANS L'ORDRE.
 * La TOC et le corps proviennent du même parseur (les lignes d'en-tête du corps SONT les
 * libellés TOC, dans le même ordre) — l'égalité ligne↔libellé est donc fiable, sans
 * dépendre d'une heuristique d'en-tête.
 *
 * Jurisprudence : clé `sec-K|art-N`. Les annexes (Code de procédure civile, Code pénal…)
 * ont leur PROPRE numérotation d'articles ; sans la section, l'« Article 5 » d'une annexe
 * récupérerait à tort la jurisprudence de l'article 5 du Code. Le parseur (parse_ct.py)
 * produit la même clé en parcourant le corps dans le même ordre.
 */
export function segmentAnnotated(
  body: string,
  toc: TocEntry[],
  pointAnchors?: readonly string[],
  repeatedHeads?: Readonly<Record<string, readonly string[]>>,
): AnnBlock[] {
  // Circulaires BRH : divisions numérotées « N.- » / « N.M.P » au lieu de « Article N ».
  // Sans liste blanche, la fonction est STRICTEMENT inchangée (les documents existants ne
  // passent pas ce 3ᵉ argument).
  const points = pointAnchors?.length ? new Set(pointAnchors) : null
  const blocks: AnnBlock[] = []
  let tocPtr = 0
  let cur: string[] = []
  let curAnchor: string | null = null
  let curSection: string | null = null
  // Suppression des ancres #art-N en double : les annexes (Code de procédure civile, Code
  // pénal…) ET certains décrets internes (récusation…) renumérotent depuis l'article 1. On
  // n'émet l'ancre que sur la 1ʳᵉ occurrence d'un numéro (le Code principal, cible de l'index
  // et des renvois) ; les suivantes sont des id dupliqués invalides → supprimées.
  let inAnnexe = false
  let curNoAnchors = false
  const seenArt = new Set<string>()
  // Occurrences suivantes d'une tête répétée par le J.O. : leurs ancres techniques, consommées
  // dans l'ordre du corps (copie locale — la fonction reste pure).
  const repeats = new Map(Object.entries(repeatedHeads ?? {}).map(([k, v]) => [k, [...v]]))
  const flush = () => {
    if (cur.length)
      blocks.push({
        kind: 'body',
        anchor: curAnchor,
        jurisKey: curAnchor ? jurisKeyFor(curSection, curAnchor) : null,
        noAnchors: curNoAnchors,
        text: cur.join('\n'),
      })
    cur = []
  }
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (tocPtr < toc.length && normLine(line) === normLine(toc[tocPtr].label)) {
      flush()
      blocks.push({ kind: 'section', anchor: toc[tocPtr].anchor, level: toc[tocPtr].level, tocKind: toc[tocPtr].kind, text: line })
      curSection = toc[tocPtr].anchor
      if (toc[tocPtr].kind === 'connexe') inAnnexe = true
      tocPtr++
      curAnchor = null
      curNoAnchors = inAnnexe
      continue
    }
    if (points) {
      const pt = pointAnchorFromHeading(line, points)
      // 2ᵉ occurrence d'une désignation (en-tête courant d'annexe, « 2 segments par
      // enregistrement : ») → simple texte : ni ancre dupliquée, ni faux bloc d'article.
      if (pt && !seenArt.has(pt)) {
        flush()
        curAnchor = pt
        curNoAnchors = false
        seenArt.add(pt)
        cur = [raw]
        continue
      }
    }
    const art = articleAnchorFromHeading(line)
    if (art) {
      flush()
      const alias = !inAnnexe && seenArt.has(art) ? repeats.get(art)?.shift() : undefined
      if (alias) {
        curAnchor = alias
        curNoAnchors = seenArt.has(alias)
        seenArt.add(alias)
      } else {
        curAnchor = art
        curNoAnchors = inAnnexe || seenArt.has(art) // 2ᵉ occurrence → pas d'ancre (déjà émise)
      }
      seenArt.add(art)
      cur = [raw]
      continue
    }
    cur.push(raw)
  }
  flush()
  return blocks
}
