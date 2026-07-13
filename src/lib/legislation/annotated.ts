/**
 * Texte annoté (Code du travail, annoté par J.-F. Salès) — structure d'AFFICHAGE stockée
 * dans Document.annotationsJson. bodyOriginal reste le texte officiel canonique (§02) ;
 * jurisprudence, table des matières et index n'en font pas partie et ne sont JAMAIS fondus
 * dedans. Cf. scripts/_import-code-travail.ts (parser parse_ct.py).
 */
import { articleAnchorFromHeading } from '../doc/anchors'

export interface JurisCase {
  ref: string // « Arrêt du 5 avril 1966, 2ᵉ section, X c. Y »
  excerpt: string // extrait du considérant
}
export interface NavItem {
  label: string
  anchor: string // sec-N
  children?: NavItem[] // sous-niveau (chapitres d'un livre, divisions d'une annexe)
}
export interface NavGroup {
  label: string
  anchor: string
  children: NavItem[]
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
}

/** Affichage joli d'une référence d'article : « 12-1 » → « 12.1 », « 190-ter-5 » → « 190ter.5 ». */
export function prettyRef(r: ArtRef): string {
  return String(r).replace(/-(bis|ter|quater)/g, '$1').replace(/-/g, '.')
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
  // Constitution : ancienne version (1987) par article, statut d'amendement, libellé d'article.
  oldVersions?: Record<string, string> // ancre → texte de l'ancienne version (repliable)
  status?: Record<string, string | null> // ancre → « modifié » | « nouveau » | « abrogé »
  labels?: Record<string, string> // ancre → « Article 12.1 » (numérotation complexe)
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
      oldVersions: a.oldVersions && typeof a.oldVersions === 'object' ? a.oldVersions : {},
      status: a.status && typeof a.status === 'object' ? a.status : {},
      labels: a.labels && typeof a.labels === 'object' ? a.labels : {},
      connexe: a.connexe && typeof a.connexe === 'object' ? a.connexe : {},
      commentaires: a.commentaires && typeof a.commentaires === 'object' ? a.commentaires : {},
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
export function segmentAnnotated(body: string, toc: TocEntry[]): AnnBlock[] {
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
    const art = articleAnchorFromHeading(line)
    if (art) {
      flush()
      curAnchor = art
      curNoAnchors = inAnnexe || seenArt.has(art) // 2ᵉ occurrence → pas d'ancre (déjà émise)
      seenArt.add(art)
      cur = [raw]
      continue
    }
    cur.push(raw)
  }
  flush()
  return blocks
}
