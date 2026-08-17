'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { DocType, Locale } from '@/lib/types'
import { DOC_TYPE_META } from '@/lib/brand'
import { formatDate } from '@/lib/i18n/format'
import { StatusChip } from './StatusChip'

interface ThemeNode {
  id: string
  slug: string
  labelFr: string
  labelEn: string | null
  labelHt: string | null
  color: string | null
  active: boolean
  children: ThemeNode[]
}
interface DocRow {
  id: string
  type: string
  titleFr: string
  titleEn: string | null
  titleHt: string | null
  number: string | null
  status: string
  /** Ancre interne (ex. "sec-44") quand le thème pointe vers une section d'un document unique. */
  anchor?: string | null
}
/** Document à plat (vues A→Z / par type / chronologiques). */
interface FlatDoc {
  id: string
  type: string
  titleFr: string
  titleEn: string | null
  titleHt: string | null
  number: string | null
  status: string
  /** Date DU TEXTE (publication au Moniteur) — base du tri chronologique ; null si inconnue. */
  publicationDate: string | null
  updatedAt: string
}

/**
 * Mode d'affichage UNIQUE (demande cliente 20 juil.) : un seul menu « Tri » regroupe
 * le mode de présentation ET le sens — plus de sélecteur d'onglets séparé.
 */
type Mode = 'theme' | 'az' | 'za' | 'type' | 'recent' | 'oldest'
const MODES: Mode[] = ['theme', 'az', 'za', 'type', 'recent', 'oldest']

/**
 * Modes offerts par une rubrique. Une rubrique à type unique n'a rien à trier « par type » :
 * le mode rendrait un seul groupe portant le nom de la rubrique. Exporté parce que le menu
 * ne s'ouvre qu'au clic — sans cela, rien de ce choix ne serait vérifiable au rendu.
 */
export function modesPour(monoType: boolean | undefined): Mode[] {
  return monoType ? MODES.filter((m) => m !== 'type') : MODES
}
/** Présentation dérivée du mode. */
type View = 'tree' | 'az' | 'type' | 'recent'
type Dir = 'asc' | 'desc'

/**
 * IDENTITÉ DE LA RUBRIQUE QUI EMPLOIE CE NAVIGATEUR.
 *
 * ⚠️ Rien de tout cela n'était un paramètre : le titre « Législation annotée », le
 * vocabulaire (« textes »), l'adresse de l'API et les clés de stockage étaient écrits dans
 * le composant. Réemployé tel quel pour une autre rubrique, il aurait affiché le titre de
 * la voisine, compté des « textes » là où la BRH publie des circulaires, interrogé le
 * mauvais corpus, et restauré au montage le thème sélectionné dans l'autre rubrique.
 *
 * Une rubrique déclare donc ce qu'elle est. Le composant, lui, ne sait plus rien d'elle.
 */
export interface Rubrique {
  /** Slug de la rubrique : transmis à l'API (corpus) et préfixe des clés de stockage. */
  slug: string
  titre: string
  sousTitre: string
  /**
   * Vocabulaire propre à la rubrique, déjà traduit par la page. Les phrases entières —
   * plutôt qu'un nom qu'on accorderait ici — parce que « Aucun texte » et « Aucune
   * circulaire » ne diffèrent pas que par le nom, et qu'aucune règle de genre n'a à vivre
   * dans un composant d'affichage.
   */
  lexique: {
    unite: string
    unites: string
    sousTheme: string
    sousThemes: string
    vide: string
    videTheme: string
    videPlat: string
  }
  /** Libellés de statut traduits : un état ne paraît JAMAIS sans son mot (critère bloquant). */
  statuts: Record<string, string>
  /** 'position' respecte le classement éditorial saisi en base ; 'alpha' trie par libellé. */
  ordre?: 'alpha' | 'position'
  /** Rubrique à type unique : ni badge de type sur les lignes, ni tri « par type ». */
  monoType?: boolean
  /** Déplier les nœuds de tête au premier affichage (taxonomie large et peu profonde). */
  racinesOuvertes?: boolean
}

const L = {
  loading: { fr: 'Chargement…', en: 'Loading…', ht: 'N ap chaje…' },
  // Menu unique « Tri » : mode d'affichage + sens
  sort: { fr: 'Tri', en: 'Sort', ht: 'Triye' },
  modeTheme: { fr: 'Par thème', en: 'By theme', ht: 'Pa tèm' },
  modeType: { fr: 'Par type', en: 'By type', ht: 'Pa tip' },
  modeRecent: { fr: 'Plus récent au plus ancien', en: 'Newest to oldest', ht: 'Pi resan rive pi ansyen' },
  modeOldest: { fr: 'Plus ancien au plus récent', en: 'Oldest to newest', ht: 'Pi ansyen rive pi resan' },
  // Retour / fil d'Ariane
  back: { fr: 'Remonter d’un niveau', en: 'Up one level', ht: 'Monte yon nivo' },
  // ⚠️ Ces cinq-là étaient écrits en français dans le JSX, dont deux libellés destinés aux
  // seuls lecteurs d'écran : la page se disait trilingue et parlait français à qui ne l'est
  // pas. Une rubrique neuve, aux nombreux nœuds peu peuplés, les aurait exposés partout.
  nouveau: { fr: 'Nouveau', en: 'New', ht: 'Nouvo' },
  nouveauTitre: {
    fr: 'Nouveau document — voir la sous-section',
    en: 'New document — go to the sub-section',
    ht: 'Nouvo dokiman — ale nan sou-seksyon an',
  },
  replier: { fr: 'Replier', en: 'Collapse', ht: 'Fèmen' },
  deplier: { fr: 'Déplier', en: 'Expand', ht: 'Louvri' },
  // ⚠️ « Rien n'a pu être chargé » n'est PAS « il n'y a rien ». Sur un fonds juridique, la
  // seconde phrase est une affirmation sur l'état du droit ; la première, un incident.
  echec: {
    fr: 'La liste n’a pas pu être chargée. Ce n’est pas une absence de documents.',
    en: 'The list could not be loaded. This does not mean there are no documents.',
    ht: 'Nou pa t ka chaje lis la. Sa pa vle di pa gen dokiman.',
  },
  reessayer: { fr: 'Réessayer', en: 'Try again', ht: 'Eseye ankò' },
} as const

/** Liste chargée, échec de chargement, ou rien de demandé encore. */
type EtatDocs = DocRow[] | 'erreur' | null

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function ThemeBrowser({
  locale,
  rubrique,
  tree,
  counts,
  subtotals,
  recentThemeIds,
  allDocs,
}: {
  locale: Locale
  rubrique: Rubrique
  tree: ThemeNode[]
  counts: Record<string, number>
  /**
   * Sous-totaux en documents DISTINCTS, calculés côté serveur. Sommer les compteurs des
   * enfants — ce que faisait ce composant — compte deux fois un document classé sous deux
   * sous-thèmes : 143 circulaires annoncées pour 142 sur l'axe « par matière » de la BRH.
   * Le repli reste la somme, pour un appelant qui ne les fournirait pas.
   */
  subtotals?: Record<string, number>
  recentThemeIds: string[]
  allDocs: FlatDoc[]
}) {
  const lt = <T extends { fr: string; en: string; ht: string }>(o: T) => o[locale] ?? o.fr
  const lex = rubrique.lexique
  const MODE_KEY = `lv:${rubrique.slug}:mode`
  const TREE_KEY = `lv:${rubrique.slug}:tree`
  // Une rubrique à type unique n'a rien à trier « par type » : le mode rendrait un seul
  // groupe portant le nom de la rubrique. On le retire plutôt que de l'offrir vide.
  const modes = useMemo(() => modesPour(rubrique.monoType), [rubrique.monoType])
  const [mode, setMode] = useState<Mode>('theme')
  // Présentation et sens dérivés du mode unique.
  const view: View = mode === 'theme' ? 'tree' : mode === 'az' || mode === 'za' ? 'az' : mode === 'type' ? 'type' : 'recent'
  const dir: Dir = mode === 'za' ? 'desc' : 'asc'
  const dateDesc = mode !== 'oldest' // « Plus récent au plus ancien » par défaut
  // Comparateur alphabétique (accents/casse repliés, numérique) dans le SENS choisi.
  const cmp = useCallback(
    (a: string, b: string) => (dir === 'asc' ? 1 : -1) * fold(a).localeCompare(fold(b), locale, { numeric: true }),
    [locale, dir],
  )
  const label = useCallback(
    (n: ThemeNode) => (locale === 'en' ? n.labelEn : locale === 'ht' ? n.labelHt : n.labelFr) || n.labelFr,
    [locale],
  )
  const docTitle = (d: { titleFr: string; titleEn: string | null; titleHt: string | null }) =>
    (locale === 'en' ? d.titleEn : locale === 'ht' ? d.titleHt : d.titleFr) || d.titleFr

  // ⚠️ Déplié dès le PREMIER rendu, pas dans un effet : appliqué après coup, l'ouverture
  // des axes aurait produit un saut visible — la page s'affiche repliée, puis se déplie.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(rubrique.racinesOuvertes ? tree.map((n) => n.id) : []),
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [docs, setDocs] = useState<EtatDocs>(null)
  const [loading, setLoading] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  // Menu de tri : fermeture au clic extérieur et à Échap (comme SearchBox).
  useEffect(() => {
    if (!sortOpen) return
    const onDown = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSortOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [sortOpen])

  // ── Persistance (audit UX 20 juil.) : vue/tri → localStorage (durable), état de
  //    l'arbre (déplié + sélection) → sessionStorage (par onglet, survit au retour
  //    navigateur depuis une fiche — l'état était perdu auparavant). ──
  const skipPersist = useRef(true)
  useEffect(() => {
    try {
      const m = localStorage.getItem(MODE_KEY)
      if (m && (modes as string[]).includes(m)) setMode(m as Mode)
      const raw = sessionStorage.getItem(TREE_KEY)
      const st = raw ? (JSON.parse(raw) as { expanded?: string[]; selected?: string | null }) : null
      // L'état mémorisé de l'onglet l'emporte sur le dépliage par défaut : c'est un choix
      // que le lecteur a fait, et le retrouver vaut mieux que le lui reprendre.
      if (st && Array.isArray(st.expanded)) setExpanded(new Set(st.expanded))
      if (st?.selected) {
        setSelected(st.selected)
        void fetchDocs(st.selected)
      }
    } catch {
      /* stockage indisponible */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false
      return
    }
    try {
      sessionStorage.setItem(TREE_KEY, JSON.stringify({ expanded: [...expanded], selected }))
    } catch {
      /* ignore */
    }
  }, [expanded, selected, TREE_KEY])
  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode)
    } catch {
      /* ignore */
    }
  }, [mode, MODE_KEY])

  // ── Métadonnées d'arbre : parent + nœud par id (fil d'Ariane, retour). ──
  const meta = useMemo(() => {
    const parent = new Map<string, string | null>()
    const nodeById = new Map<string, ThemeNode>()
    const walk = (n: ThemeNode, p: string | null) => {
      parent.set(n.id, p)
      nodeById.set(n.id, n)
      n.children.forEach((c) => walk(c, n.id))
    }
    tree.forEach((n) => walk(n, null))
    return { parent, nodeById }
  }, [tree])
  const pathOf = useCallback(
    (id: string) => {
      const out: string[] = []
      let cur: string | null = id
      while (cur) {
        out.unshift(cur)
        cur = meta.parent.get(cur) ?? null
      }
      return out
    },
    [meta],
  )

  /**
   * Arbre trié pour l'affichage : alphabétique, ou dans l'ordre éditorial saisi en base.
   *
   * ⚠️ Le commentaire annonçait déjà les deux, le code ne faisait que l'alphabétique : le
   * serveur triait par `position`, le client le défaisait aussitôt. La BRH classe ses
   * rubriques du plus spécifique au plus général — un ordre qui porte un sens et qu'un
   * A→Z efface sans rien dire.
   */
  const displayTree = useMemo(() => {
    if (rubrique.ordre === 'position') return tree
    const rec = (nodes: ThemeNode[]): ThemeNode[] =>
      [...nodes].sort((a, b) => cmp(label(a), label(b))).map((n) => ({ ...n, children: rec(n.children) }))
    return rec(tree)
  }, [tree, cmp, label, rubrique.ordre])

  const subtotal = useMemo(() => {
    const memo = new Map<string, number>()
    const walk = (n: ThemeNode): number => {
      if (memo.has(n.id)) return memo.get(n.id)!
      // ⚠️ ON DESCEND TOUJOURS DANS LES ENFANTS, MÊME QUAND LE SERVEUR DONNE LE TOTAL.
      // Écrit `subtotals?.[n.id] ?? somme(enfants)`, le `??` court-circuitait la descente
      // dès la racine : le mémo ne recevait que les racines, et CHAQUE sous-thème affichait
      // « 0 » — donc grisé, désactivé, toute la taxonomie rendue incliquable. Le contrôle
      // des données ne pouvait pas le voir : la faute était dans la vue.
      const somme = (counts[n.id] ?? 0) + n.children.reduce((s, c) => s + walk(c), 0)
      // Le total du serveur compte des DOCUMENTS ; la somme, elle, compte des rattachements
      // et double ceux qui sont classés à deux endroits.
      const total = subtotals?.[n.id] ?? somme
      memo.set(n.id, total)
      return total
    }
    tree.forEach(walk)
    return memo
  }, [tree, counts, subtotals])

  const recentRollup = useMemo(() => {
    const recent = new Set(recentThemeIds)
    const has = new Set<string>()
    const mark = (n: ThemeNode): boolean => {
      let h = recent.has(n.id)
      for (const c of n.children) if (mark(c)) h = true
      if (h) has.add(n.id)
      return h
    }
    tree.forEach(mark)
    return has
  }, [tree, recentThemeIds])

  function expandToRecent(node: ThemeNode) {
    const ids: string[] = []
    const collect = (n: ThemeNode) => {
      if (recentRollup.has(n.id)) {
        ids.push(n.id)
        n.children.forEach(collect)
      }
    }
    collect(node)
    setExpanded((prev) => new Set([...prev, ...ids]))
  }
  const isEmpty = (n: ThemeNode) => (subtotal.get(n.id) ?? 0) === 0

  function NewBadge({ node }: { node: ThemeNode }) {
    if (!recentRollup.has(node.id)) return null
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          expandToRecent(node)
        }}
        title={lt(L.nouveauTitre)}
        className="mr-3 shrink-0 rounded-full bg-chabon px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-koton transition hover:bg-chabon hover:text-koton"
      >
        {lt(L.nouveau)}
      </button>
    )
  }

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  /**
   * ⚠️ GARDE DE CONCURRENCE. Deux clics rapides lançaient deux requêtes vers un même état :
   * la réponse la plus lente écrasait la plus rapide et s'affichait sous le thème
   * sélectionné, qui n'était pas le sien. Sur une taxonomie plate qu'on parcourt vite, la
   * liste d'une rubrique se serait retrouvée sous le nom d'une autre — un faux qu'aucune
   * erreur ne signale. On ignore désormais toute réponse qui n'est plus la dernière demandée.
   */
  const demandeEnCours = useRef(0)
  const fetchDocs = useCallback(
    async (id: string) => {
      const jeton = ++demandeEnCours.current
      setLoading(true)
      setDocs(null)
      try {
        const res = await fetch(
          `/api/themes/docs?themeId=${encodeURIComponent(id)}&section=${encodeURIComponent(rubrique.slug)}`,
        )
        const data = await res.json().catch(() => null)
        if (jeton !== demandeEnCours.current) return
        // ⚠️ TROIS ÉTATS, ET IL EN FAUT TROIS. Un 401 (session expirée), un 429, un 500 ou
        // une coupure réseau produisaient le MÊME tableau vide qu'un thème réellement vide,
        // et l'écran affichait donc « Aucune circulaire accessible dans cette rubrique ».
        // Le lecteur y lisait que la BRH n'avait rien publié sur la question. Une panne doit
        // se dire comme une panne.
        setDocs(res.ok && data?.ok ? (data.docs as DocRow[]) : 'erreur')
      } catch {
        if (jeton === demandeEnCours.current) setDocs('erreur')
      } finally {
        if (jeton === demandeEnCours.current) setLoading(false)
      }
    },
    [rubrique.slug],
  )

  const select = useCallback(
    (id: string) => {
      if (selected === id) {
        setSelected(null)
        setDocs(null)
        return
      }
      setSelected(id)
      void fetchDocs(id)
    },
    [selected, fetchDocs],
  )

  // Aller à un thème (fil d'Ariane) : sélectionne sans bascule (toujours ouvre).
  const goTo = useCallback(
    (id: string) => {
      setSelected(id)
      void fetchDocs(id)
    },
    [fetchDocs],
  )
  // Remonter d'un niveau : referme le nœud courant, sélectionne son parent (ou rien).
  const goUp = useCallback(
    (id: string) => {
      const parent = meta.parent.get(id) ?? null
      setExpanded((prev) => {
        const n = new Set(prev)
        n.delete(id)
        return n
      })
      if (parent) goTo(parent)
      else {
        setSelected(null)
        setDocs(null)
      }
    },
    [meta, goTo],
  )

  function countText(n: ThemeNode): string {
    const total = subtotal.get(n.id) ?? 0
    const t = `${total} ${total === 1 ? lex.unite : lex.unites}`
    const k = n.children.length
    // « 1 rubriques » : le compteur d'enfants n'avait pas de singulier.
    return k > 0 ? `${k} ${k === 1 ? lex.sousTheme : lex.sousThemes} · ${t}` : t
  }

  function Breadcrumb({ id }: { id: string }) {
    const path = pathOf(id)
    return (
      <div className="flex flex-wrap items-center gap-1 border-b border-chabon/5 px-3 py-2 text-xs">
        <button
          type="button"
          onClick={() => goUp(id)}
          aria-label={lt(L.back)}
          title={lt(L.back)}
          className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ank/80 transition hover:bg-chabon/5 hover:text-ank"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {path.map((pid, k) => {
          const node = meta.nodeById.get(pid)
          if (!node) return null
          const isLast = k === path.length - 1
          return (
            <span key={pid} className="flex items-center gap-1">
              {k > 0 && <span className="text-ank/80" aria-hidden>›</span>}
              {isLast ? (
                <span className="font-semibold text-ank">{label(node)}</span>
              ) : (
                <button type="button" onClick={() => goTo(pid)} className="text-ank/80 hover:text-ank hover:underline">
                  {label(node)}
                </button>
              )}
            </span>
          )
        })}
      </div>
    )
  }

  function DocLink({
    d,
    anchor,
    showType = true,
    showDate = false,
  }: {
    d: DocRow | FlatDoc
    anchor?: string | null
    showType?: boolean
    showDate?: boolean
  }) {
    // Date DU TEXTE affichée en fin de ligne dans les vues chronologiques : rend
    // l'ordre lisible même quand la désignation ne porte pas la date (« Code pénal »).
    const pub = showDate ? (d as FlatDoc).publicationDate : null
    return (
      <Link
        href={`/${locale}/doc/${d.id}${anchor ? '#' + anchor : ''}`}
        className="flex items-start gap-2.5 px-3 py-2.5 transition hover:bg-white"
      >
        {/* Badge de type masqué dans la vue « Par type » (le groupe le porte déjà) et sur
            une rubrique à type unique, où il se répéterait à chaque ligne sans rien dire.
            ⚠️ Le libellé vient de DOC_TYPE_META, source unique : une seconde table, en
            français seulement, faisait cohabiter « Circulaire BRH » sur la ligne et
            « BRH circulars » sur l'en-tête du même écran. */}
        {showType && !rubrique.monoType && (
          <span className="mt-0.5 shrink-0 rounded bg-chabon/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ank/80">
            {DOC_TYPE_META[d.type as DocType]?.badge ?? d.type}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-ank">{docTitle(d)}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            {d.number && <span className="text-xs text-ank/80">{d.number}</span>}
            {/* ⚠️ L'ÉTAT DU TEXTE, qui manquait ici seul. La recherche l'affiche, la fiche
                l'affiche ; cette liste, non — elle présentait donc côte à côte, et sans
                les distinguer, du droit applicable et du droit qui ne l'est plus. Sur
                142 circulaires de la BRH, 24 sont dans ce cas. Le libellé accompagne
                toujours la pastille : la couleur seule ne porte jamais l'information. */}
            {d.status && d.status !== 'EN_VIGUEUR' && (
              <StatusChip status={d.status} label={rubrique.statuts[d.status] ?? d.status} />
            )}
          </span>
        </span>
        {showDate && (
          <span className="mt-0.5 shrink-0 whitespace-nowrap text-xs tabular-nums text-ank/80">
            {pub ? formatDate(locale, pub) : '—'}
          </span>
        )}
      </Link>
    )
  }

  function DocList({ themeId }: { themeId: string }) {
    if (selected !== themeId) return null
    // Textes triés A→Z par titre (défaut demandé ; l'API renvoie par date).
    const sorted = Array.isArray(docs) ? [...docs].sort((a, b) => cmp(docTitle(a), docTitle(b))) : null
    return (
      <div className="mt-2 overflow-hidden rounded-xl border border-chabon/10 bg-koton/60">
        <Breadcrumb id={themeId} />
        {loading ? (
          <p className="px-3 py-3 text-xs text-ank/80">{lt(L.loading)}</p>
        ) : docs === 'erreur' ? (
          <div className="px-3 py-3">
            <p className="text-xs text-ank">{lt(L.echec)}</p>
            <button
              type="button"
              onClick={() => void fetchDocs(themeId)}
              className="mt-1.5 rounded-full border border-chabon/20 px-2.5 py-1 text-xs font-medium text-chabon transition hover:border-chabon/40"
            >
              {lt(L.reessayer)}
            </button>
          </div>
        ) : sorted && sorted.length > 0 ? (
          <ul className="divide-y divide-chabon/5">
            {sorted.map((d) => (
              <li key={d.id}>
                <DocLink d={d} anchor={d.anchor} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-3 text-xs text-ank/80">{lex.videTheme}</p>
        )}
      </div>
    )
  }

  /**
   * Domaine de tête (niveau 0).
   *
   * ⚠️ PAS DE PASTILLE DE COULEUR. Elle codait une information qu'aucune légende ne
   * traduisait : sept teintes pour sept domaines, que rien ne reliait à un sens. Le nom du
   * domaine, lui, se lit. (La couleur reste en base, `Theme.color` : c'est l'affichage
   * qu'on retire, pas la donnée.)
   */
  function DomainCard({ node }: { node: ThemeNode }) {
    const open = expanded.has(node.id)
    const hasChildren = node.children.length > 0
    const empty = isEmpty(node)
    return (
      <li>
        <div className={`overflow-hidden rounded-2xl border border-chabon/10 bg-white transition hover: ${empty ? 'opacity-55' : ''}`}>
          <div className="flex items-center gap-1">
            {hasChildren ? (
              <button type="button" onClick={() => toggleExpand(node.id)} aria-expanded={open} aria-label={open ? lt(L.replier) : lt(L.deplier)} className="flex h-12 w-9 items-center justify-center text-ank/80 hover:text-ank">
                <span className={`text-xs transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
              </button>
            ) : (
              <span className="w-3" />
            )}
            <button type="button" disabled={empty} onClick={empty ? undefined : () => select(node.id)} className={`flex flex-1 items-center gap-3 py-2.5 pl-1 pr-2 text-left ${empty ? 'cursor-default' : ''}`}>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-ank">{label(node)}</span>
                <span className="block text-xs text-ank/80">{empty ? lex.vide : countText(node)}</span>
              </span>
            </button>
            <NewBadge node={node} />
          </div>
          {(open || selected === node.id) && (
            <div className="border-t border-chabon/5 px-3 pb-3 pt-1">
              <DocList themeId={node.id} />
              {open && hasChildren && (
                <ul className="mt-1">
                  {node.children.map((c) => (
                    <SubRow key={c.id} node={c} depth={1} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </li>
    )
  }

  // Sous-thème (niveau ≥ 1) : ligne nette. Sans point de couleur non plus — hérité du
  // domaine, il aurait survécu à la pastille qui lui donnait son sens.
  function SubRow({ node, depth }: { node: ThemeNode; depth: number }) {
    const open = expanded.has(node.id)
    const isSel = selected === node.id
    const hasChildren = node.children.length > 0
    const empty = isEmpty(node)
    return (
      <li>
        <div className={`flex items-center gap-1.5 rounded-lg hover:bg-koton ${empty ? 'opacity-55' : ''}`} style={{ paddingLeft: (depth - 1) * 18 }}>
          {hasChildren ? (
            <button type="button" onClick={() => toggleExpand(node.id)} aria-expanded={open} aria-label={open ? lt(L.replier) : lt(L.deplier)} className="flex h-7 w-6 items-center justify-center text-ank/80 hover:text-ank">
              <span className={`text-[10px] transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
            </button>
          ) : (
            <span className="w-6" />
          )}
          <button type="button" disabled={empty} onClick={empty ? undefined : () => select(node.id)} className={`flex-1 py-1.5 text-left text-sm ${empty ? 'cursor-default text-ank/80' : isSel ? 'font-semibold text-ank' : 'text-grafit hover:text-ank'}`}>
            {label(node)}
            <span className="ml-2 text-xs font-normal text-ank/80">{countText(node)}</span>
          </button>
          <NewBadge node={node} />
        </div>
        {isSel && <div style={{ paddingLeft: (depth - 1) * 18 + 26 }}><DocList themeId={node.id} /></div>}
        {open && hasChildren && (
          <ul>
            {node.children.map((c) => (
              <SubRow key={c.id} node={c} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    )
  }

  // ── Vues À PLAT (A→Z / par type / récents) ──
  const flatSorted = useMemo(() => [...allDocs].sort((a, b) => cmp(docTitle(a), docTitle(b))), [allDocs, cmp, locale]) // eslint-disable-line react-hooks/exhaustive-deps

  function FlatList({
    groups,
    showType = true,
    showDate = false,
  }: {
    groups: { key: string; label: string; docs: FlatDoc[] }[]
    showType?: boolean
    showDate?: boolean
  }) {
    if (allDocs.length === 0) return <p className="rounded-2xl border border-chabon/10 bg-white px-4 py-10 text-center text-sm text-ank/80">{lex.videPlat}</p>
    return (
      <div className="overflow-hidden rounded-2xl border border-chabon/10 bg-white">
        {groups.map((g) => (
          <section key={g.key}>
            <h2 className="sticky top-0 z-10 border-y border-chabon/5 bg-koton/90 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-ank/80 backdrop-blur">
              {g.label} <span className="font-normal text-ank/80">· {g.docs.length}</span>
            </h2>
            <ul className="divide-y divide-chabon/5">
              {g.docs.map((d) => (
                <li key={d.id}>
                  <DocLink d={d} showType={showType} showDate={showDate} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    )
  }

  const azGroups = useMemo(() => {
    const by = new Map<string, FlatDoc[]>()
    for (const d of flatSorted) {
      const first = fold(docTitle(d)).charAt(0).toUpperCase()
      const key = /[A-Z]/.test(first) ? first : '#'
      ;(by.get(key) ?? by.set(key, []).get(key)!).push(d)
    }
    // Les LETTRES suivent le sens choisi (A→Z ou Z→A), comme les titres dans chaque groupe.
    return [...by.entries()]
      .sort((a, b) => (dir === 'asc' ? 1 : -1) * a[0].localeCompare(b[0]))
      .map(([key, ds]) => ({ key, label: key, docs: ds }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatSorted, locale, dir])

  const typeGroups = useMemo(() => {
    const by = new Map<string, FlatDoc[]>()
    for (const d of flatSorted) (by.get(d.type) ?? by.set(d.type, []).get(d.type)!).push(d)
    const order = Object.keys(DOC_TYPE_META)
    return [...by.entries()]
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([type, ds]) => ({ key: type, label: DOC_TYPE_META[type as DocType]?.label[locale] ?? type, docs: ds }))
  }, [flatSorted, locale])

  // Vues CHRONOLOGIQUES : ordonnées sur la date DU TEXTE (publication au Moniteur),
  // pas sur la date d'ajout en base — « du plus ancien au plus récent » doit suivre
  // la chronologie juridique. Les textes sans date connue sont renvoyés en FIN de
  // liste (dans les deux sens), classés entre eux par titre.
  const chronoDocs = useMemo(
    () =>
      [...allDocs].sort((a, b) => {
        const A = a.publicationDate
        const B = b.publicationDate
        if (!A && !B) return cmp(docTitle(a), docTitle(b))
        if (!A) return 1
        if (!B) return -1
        return dateDesc ? B.localeCompare(A) : A.localeCompare(B)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allDocs, dateDesc, cmp, locale],
  )

  /** MENU UNIQUE : mode d'affichage + sens réunis (plus d'onglets séparés). */
  const MODE_LABEL: Record<Mode, string> = {
    theme: lt(L.modeTheme),
    az: 'A→Z',
    za: 'Z→A',
    type: lt(L.modeType),
    recent: lt(L.modeRecent),
    oldest: lt(L.modeOldest),
  }

  function SortMenu() {
    const options = modes.map((m) => ({ key: m, label: MODE_LABEL[m], active: mode === m, run: () => setMode(m) }))
    const current = options.find((o) => o.active) ?? options[0]
    return (
      <div ref={sortRef} className="relative">
        <button
          type="button"
          onClick={() => setSortOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={sortOpen}
          className="inline-flex items-center gap-1.5 rounded-full border border-chabon/10 bg-white px-3 py-1.5 text-xs font-medium text-grafit transition hover:text-ank"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h11M3 12h8M3 18h5" strokeLinecap="round" />
            <path d="M18 9l3-3 3 3M21 6v12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{lt(L.sort)}</span>
          <span className="text-ank">{current.label}</span>
          <span aria-hidden className={`text-[10px] transition-transform ${sortOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {sortOpen && (
          <div role="menu" aria-label={lt(L.sort)} className="absolute left-0 top-full z-30 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-chabon/10 bg-white py-1 shadow-flottant">
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                role="menuitemradio"
                aria-checked={o.active}
                onClick={() => {
                  o.run()
                  setSortOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition ${
                  o.active ? 'bg-koton font-semibold text-ank' : 'text-grafit hover:bg-koton hover:text-ank'
                }`}
              >
                <span className="w-3 shrink-0" aria-hidden>{o.active ? '✓' : ''}</span>
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Même règle qu'en dessous : pas de carré de couleur. Celui-ci ne portait pas même
          une teinte de domaine — un gris sur gris, qui ne disait rien du tout. */}
      <header>
        <h1 className="text-2xl font-bold text-ank">{rubrique.titre}</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-ank/80">{rubrique.sousTitre}</p>
      </header>

      {/* UN SEUL contrôle (demande cliente 20 juil.) : le menu « Tri » porte à la fois
          le mode de présentation (par thème / par type) et le sens (A→Z, Z→A, dates).
          Le sélecteur d'onglets séparé a été supprimé. */}
      <div className="flex flex-wrap items-center gap-2">
        <SortMenu />
      </div>

      {view === 'tree' &&
        (tree.length === 0 ? (
          <p className="rounded-2xl border border-chabon/10 bg-white px-4 py-10 text-center text-sm text-ank/80">—</p>
        ) : (
          <ul className="space-y-2.5">
            {displayTree.map((n) => (
              <DomainCard key={n.id} node={n} />
            ))}
          </ul>
        ))}
      {view === 'az' && <FlatList groups={azGroups} />}
      {view === 'type' && <FlatList groups={typeGroups} showType={false} />}
      {view === 'recent' && (
        <FlatList groups={[{ key: 'chrono', label: lt(dateDesc ? L.modeRecent : L.modeOldest), docs: chronoDocs }]} showDate />
      )}
    </div>
  )
}
