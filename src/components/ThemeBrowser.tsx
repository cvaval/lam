'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { DocType, Locale } from '@/lib/types'
import { DOC_TYPE_META } from '@/lib/brand'
import { formatDate } from '@/lib/i18n/format'

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
/** Présentation dérivée du mode. */
type View = 'tree' | 'az' | 'type' | 'recent'
type Dir = 'asc' | 'desc'

const TYPE_SHORT: Record<string, string> = {
  LEGISLATION: 'Législation',
  CIRCULAIRE_BRH: 'Circulaire BRH',
  JURISPRUDENCE: 'Jurisprudence',
  DOCTRINE: 'Législation annotée',
  LOI_FINANCES: 'Loi de finances',
  MARQUE: 'Marque',
  TARIF_DOUANIER: 'Tarif douanier',
  INDEX: 'Index',
}
const DEFAULT_COLOR = '#5E7488' // brim — repli si un domaine n'a pas de couleur
const MODE_KEY = 'lv:doctrineMode'
const TREE_KEY = 'lv:doctrineTree'

const L = {
  title: { fr: 'Législation annotée', en: 'Annotated legislation', ht: 'Lejislasyon anote' },
  sub: {
    fr: 'Explorez les lois, décrets et arrêtés par domaine. Dépliez un domaine, puis ouvrez un thème pour voir ses textes.',
    en: 'Browse laws, decrees and orders by domain. Expand a domain, then open a theme to see its texts.',
    ht: 'Gade lwa, dekrè ak arete pa domèn. Louvri yon domèn, epi louvri yon tèm pou wè tèks li yo.',
  },
  themes: { fr: 'sous-thèmes', en: 'sub-themes', ht: 'sou-tèm' },
  texts: { fr: 'textes', en: 'texts', ht: 'tèks' },
  text1: { fr: 'texte', en: 'text', ht: 'tèks' },
  loading: { fr: 'Chargement…', en: 'Loading…', ht: 'N ap chaje…' },
  empty: { fr: 'Aucun texte accessible dans ce thème pour le moment.', en: 'No accessible text in this theme yet.', ht: 'Pa gen tèks aksesib nan tèm sa a pou kounye a.' },
  // Menu unique « Tri » : mode d'affichage + sens
  sort: { fr: 'Tri', en: 'Sort', ht: 'Triye' },
  modeTheme: { fr: 'Par thème', en: 'By theme', ht: 'Pa tèm' },
  modeType: { fr: 'Par type', en: 'By type', ht: 'Pa tip' },
  modeRecent: { fr: 'Plus récent au plus ancien', en: 'Newest to oldest', ht: 'Pi resan rive pi ansyen' },
  modeOldest: { fr: 'Plus ancien au plus récent', en: 'Oldest to newest', ht: 'Pi ansyen rive pi resan' },
  // Retour / fil d'Ariane
  back: { fr: 'Remonter d’un niveau', en: 'Up one level', ht: 'Monte yon nivo' },
  emptyFlat: { fr: 'Aucun texte accessible pour le moment.', en: 'No accessible text yet.', ht: 'Pa gen tèks aksesib pou kounye a.' },
} as const

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function ThemeBrowser({
  locale,
  tree,
  counts,
  recentThemeIds,
  allDocs,
}: {
  locale: Locale
  tree: ThemeNode[]
  counts: Record<string, number>
  recentThemeIds: string[]
  allDocs: FlatDoc[]
}) {
  const lt = <T extends { fr: string; en: string; ht: string }>(o: T) => o[locale] ?? o.fr
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

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [docs, setDocs] = useState<DocRow[] | null>(null)
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
      if (m && (MODES as string[]).includes(m)) setMode(m as Mode)
      const raw = sessionStorage.getItem(TREE_KEY)
      if (raw) {
        const st = JSON.parse(raw) as { expanded?: string[]; selected?: string | null }
        if (Array.isArray(st.expanded)) setExpanded(new Set(st.expanded))
        if (st.selected) {
          setSelected(st.selected)
          void fetchDocs(st.selected)
        }
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
  }, [expanded, selected])
  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode)
    } catch {
      /* ignore */
    }
  }, [mode])

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

  // Arbre trié pour l'affichage : alphabétique (défaut) ou classement admin (position).
  const displayTree = useMemo(() => {
    const rec = (nodes: ThemeNode[]): ThemeNode[] =>
      [...nodes].sort((a, b) => cmp(label(a), label(b))).map((n) => ({ ...n, children: rec(n.children) }))
    return rec(tree)
  }, [tree, cmp, label])

  const subtotal = useMemo(() => {
    const memo = new Map<string, number>()
    const walk = (n: ThemeNode): number => {
      if (memo.has(n.id)) return memo.get(n.id)!
      const total = (counts[n.id] ?? 0) + n.children.reduce((s, c) => s + walk(c), 0)
      memo.set(n.id, total)
      return total
    }
    tree.forEach(walk)
    return memo
  }, [tree, counts])

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
        title="Nouveau document — voir la sous-section"
        className="mr-3 shrink-0 rounded-full bg-sitwon px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lank transition hover:bg-sitwon-600 hover:text-cream"
      >
        Nouveau
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

  const fetchDocs = useCallback(async (id: string) => {
    setLoading(true)
    setDocs(null)
    try {
      const res = await fetch(`/api/legislation/theme-docs?themeId=${encodeURIComponent(id)}`)
      const data = await res.json().catch(() => null)
      setDocs(data?.ok ? (data.docs as DocRow[]) : [])
    } catch {
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, [])

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
    const t = `${total} ${total === 1 ? lt(L.text1) : lt(L.texts)}`
    return n.children.length > 0 ? `${n.children.length} ${lt(L.themes)} · ${t}` : t
  }

  function Breadcrumb({ id }: { id: string }) {
    const path = pathOf(id)
    return (
      <div className="flex flex-wrap items-center gap-1 border-b border-lank/5 px-3 py-2 text-xs">
        <button
          type="button"
          onClick={() => goUp(id)}
          aria-label={lt(L.back)}
          title={lt(L.back)}
          className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-lank/50 transition hover:bg-lank/5 hover:text-lank"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {path.map((pid, k) => {
          const node = meta.nodeById.get(pid)
          if (!node) return null
          const isLast = k === path.length - 1
          return (
            <span key={pid} className="flex items-center gap-1">
              {k > 0 && <span className="text-lank/25" aria-hidden>›</span>}
              {isLast ? (
                <span className="font-semibold text-lank">{label(node)}</span>
              ) : (
                <button type="button" onClick={() => goTo(pid)} className="text-lank/55 hover:text-lank hover:underline">
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
        {/* Badge de type masqué dans la vue « Par type » : le groupe le porte déjà
            (et évite deux libellés différents pour un même type). */}
        {showType && (
          <span className="mt-0.5 shrink-0 rounded bg-lank/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-lank/50">
            {TYPE_SHORT[d.type] ?? d.type}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-lank">{docTitle(d)}</span>
          {d.number && <span className="block text-xs text-lank/40">{d.number}</span>}
        </span>
        {showDate && (
          <span className="mt-0.5 shrink-0 whitespace-nowrap text-xs tabular-nums text-lank/45">
            {pub ? formatDate(locale, pub) : '—'}
          </span>
        )}
      </Link>
    )
  }

  function DocList({ themeId }: { themeId: string }) {
    if (selected !== themeId) return null
    // Textes triés A→Z par titre (défaut demandé ; l'API renvoie par date).
    const sorted = docs ? [...docs].sort((a, b) => cmp(docTitle(a), docTitle(b))) : docs
    return (
      <div className="mt-2 overflow-hidden rounded-xl border border-lank/10 bg-paper/60">
        <Breadcrumb id={themeId} />
        {loading ? (
          <p className="px-3 py-3 text-xs text-lank/50">{lt(L.loading)}</p>
        ) : sorted && sorted.length > 0 ? (
          <ul className="divide-y divide-lank/5">
            {sorted.map((d) => (
              <li key={d.id}>
                <DocLink d={d} anchor={d.anchor} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-3 text-xs text-lank/50">{lt(L.empty)}</p>
        )}
      </div>
    )
  }

  // Domaine de tête (niveau 0) : carte avec pastille colorée (couleur de marque LAM).
  function DomainCard({ node }: { node: ThemeNode }) {
    const color = node.color || DEFAULT_COLOR
    const open = expanded.has(node.id)
    const hasChildren = node.children.length > 0
    const empty = isEmpty(node)
    return (
      <li>
        <div className={`overflow-hidden rounded-2xl border border-lank/10 bg-white shadow-card transition hover:shadow-lg ${empty ? 'opacity-55' : ''}`}>
          <div className="flex items-center gap-1">
            {hasChildren ? (
              <button type="button" onClick={() => toggleExpand(node.id)} aria-expanded={open} aria-label={open ? 'Replier' : 'Déplier'} className="flex h-12 w-9 items-center justify-center text-lank/40 hover:text-lank">
                <span className={`text-xs transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
              </button>
            ) : (
              <span className="w-3" />
            )}
            <button type="button" disabled={empty} onClick={empty ? undefined : () => select(node.id)} className={`flex flex-1 items-center gap-3 py-2.5 pr-2 text-left ${empty ? 'cursor-default' : ''}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: color + '22' }}>
                <span className="h-4 w-4 rounded-md" style={{ backgroundColor: color }} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-lank">{label(node)}</span>
                <span className="block text-xs text-lank/45">{empty ? 'Aucun texte pour le moment' : countText(node)}</span>
              </span>
            </button>
            <NewBadge node={node} />
          </div>
          {(open || selected === node.id) && (
            <div className="border-t border-lank/5 px-3 pb-3 pt-1">
              <DocList themeId={node.id} />
              {open && hasChildren && (
                <ul className="mt-1">
                  {node.children.map((c) => (
                    <SubRow key={c.id} node={c} domainColor={color} depth={1} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </li>
    )
  }

  // Sous-thème (niveau ≥ 1) : ligne nette avec point de couleur héritée du domaine.
  function SubRow({ node, domainColor, depth }: { node: ThemeNode; domainColor: string; depth: number }) {
    const open = expanded.has(node.id)
    const isSel = selected === node.id
    const hasChildren = node.children.length > 0
    const empty = isEmpty(node)
    return (
      <li>
        <div className={`flex items-center gap-1.5 rounded-lg hover:bg-paper ${empty ? 'opacity-55' : ''}`} style={{ paddingLeft: (depth - 1) * 18 }}>
          {hasChildren ? (
            <button type="button" onClick={() => toggleExpand(node.id)} aria-expanded={open} aria-label={open ? 'Replier' : 'Déplier'} className="flex h-7 w-6 items-center justify-center text-lank/40 hover:text-lank">
              <span className={`text-[10px] transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
            </button>
          ) : (
            <span className="w-6" />
          )}
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: domainColor }} />
          <button type="button" disabled={empty} onClick={empty ? undefined : () => select(node.id)} className={`flex-1 py-1.5 text-left text-sm ${empty ? 'cursor-default text-lank/40' : isSel ? 'font-semibold text-lank' : 'text-lank/75 hover:text-lank'}`}>
            {label(node)}
            <span className="ml-2 text-xs font-normal text-lank/35">{countText(node)}</span>
          </button>
          <NewBadge node={node} />
        </div>
        {isSel && <div style={{ paddingLeft: (depth - 1) * 18 + 26 }}><DocList themeId={node.id} /></div>}
        {open && hasChildren && (
          <ul>
            {node.children.map((c) => (
              <SubRow key={c.id} node={c} domainColor={domainColor} depth={depth + 1} />
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
    if (allDocs.length === 0) return <p className="rounded-2xl border border-lank/10 bg-white px-4 py-10 text-center text-sm text-lank/40 shadow-card">{lt(L.emptyFlat)}</p>
    return (
      <div className="overflow-hidden rounded-2xl border border-lank/10 bg-white shadow-card">
        {groups.map((g) => (
          <section key={g.key}>
            <h2 className="sticky top-0 z-10 border-y border-lank/5 bg-paper/90 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-lank/50 backdrop-blur">
              {g.label} <span className="font-normal text-lank/35">· {g.docs.length}</span>
            </h2>
            <ul className="divide-y divide-lank/5">
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
      .map(([type, ds]) => ({ key: type, label: DOC_TYPE_META[type as DocType]?.label[locale] ?? TYPE_SHORT[type] ?? type, docs: ds }))
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
    const options = MODES.map((m) => ({ key: m, label: MODE_LABEL[m], active: mode === m, run: () => setMode(m) }))
    const current = options.find((o) => o.active) ?? options[0]
    return (
      <div ref={sortRef} className="relative">
        <button
          type="button"
          onClick={() => setSortOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={sortOpen}
          className="inline-flex items-center gap-1.5 rounded-full border border-lank/10 bg-white px-3 py-1.5 text-xs font-medium text-lank/60 shadow-card transition hover:text-lank"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 6h11M3 12h8M3 18h5" strokeLinecap="round" />
            <path d="M18 9l3-3 3 3M21 6v12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{lt(L.sort)}</span>
          <span className="text-lank">{current.label}</span>
          <span aria-hidden className={`text-[10px] transition-transform ${sortOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {sortOpen && (
          <div role="menu" aria-label={lt(L.sort)} className="absolute left-0 top-full z-30 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-lank/10 bg-white py-1 shadow-xl">
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
                  o.active ? 'bg-paper font-semibold text-lank' : 'text-lank/70 hover:bg-paper hover:text-lank'
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
      <header className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-lagon/25">
          <span className="h-5 w-5 rounded-lg bg-lagon-700" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-lank">{lt(L.title)}</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-lank/55">{lt(L.sub)}</p>
        </div>
      </header>

      {/* UN SEUL contrôle (demande cliente 20 juil.) : le menu « Tri » porte à la fois
          le mode de présentation (par thème / par type) et le sens (A→Z, Z→A, dates).
          Le sélecteur d'onglets séparé a été supprimé. */}
      <div className="flex flex-wrap items-center gap-2">
        <SortMenu />
      </div>

      {view === 'tree' &&
        (tree.length === 0 ? (
          <p className="rounded-2xl border border-lank/10 bg-white px-4 py-10 text-center text-sm text-lank/40 shadow-card">—</p>
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
