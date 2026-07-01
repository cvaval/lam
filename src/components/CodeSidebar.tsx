'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { fold } from '@/lib/search/normalize'
import type { Locale } from '@/lib/types'
import { cleanIndexSubject, prettyRef } from '@/lib/legislation/annotated'
import type { NavGroup, NavItem, IndexEntry, ArtRef } from '@/lib/legislation/annotated'

type Tab = 'toc' | 'index'

const L = {
  search: { fr: 'Recherche', en: 'Search', ht: 'Rechèch' },
  toc: { fr: 'Sommaire', en: 'Contents', ht: 'Somè' },
  index: { fr: 'Index', en: 'Index', ht: 'Endèks' },
  menu: { fr: 'Menu du Code', en: 'Code menu', ht: 'Meni Kòd la' },
  ph: { fr: 'Rechercher dans le Code…', en: 'Search the Code…', ht: 'Chèche nan Kòd la…' },
  phIndex: { fr: 'Filtrer un sujet…', en: 'Filter a subject…', ht: 'Filtre yon sijè…' },
  ai: { fr: 'Thèmes proches (IA)', en: 'Related themes (AI)', ht: 'Tèm pwòch (IA)' },
  none: { fr: 'Aucun article trouvé.', en: 'No article found.', ht: 'Pa jwenn atik.' },
  hint: { fr: 'Tapez pour voir les articles applicables.', en: 'Type to see applicable articles.', ht: 'Tape pou wè atik aplikab yo.' },
  themes: { fr: 'Thèmes proches', en: 'Related themes', ht: 'Tèm pwòch' },
  art: { fr: 'art.', en: 'art.', ht: 'atik' },
} as const

interface Hit { n: number; anchor: string; label: string; snippet: string }

/**
 * Menu latéral du Code du travail : recherche dynamique (articles applicables au fil de la
 * frappe, + expansion IA Gemini des thèmes proches), sommaire hiérarchique (livres → chapitres,
 * annexes → divisions) et index alphabétique. Tous les liens pointent vers les ancres du texte.
 */
export function CodeSidebar({
  docId,
  groups,
  indexEntries,
  locale,
}: {
  docId: string
  groups: NavGroup[]
  indexEntries: IndexEntry[]
  locale: Locale
}) {
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr
  const [tab, setTab] = useState<Tab>('toc')
  const [open, setOpen] = useState(false) // mobile : replié par défaut (toujours ouvert sur desktop)

  return (
    <aside className="order-first rounded-2xl border border-lank/10 bg-white shadow-card lg:order-none lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-hidden">
      {/* Bascule mobile : un bouton compact qui ouvre le menu (sur desktop, masqué). */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left lg:hidden"
      >
        <span className="text-xs font-bold uppercase tracking-wide text-lank/70">{lt(L.menu)}</span>
        <span aria-hidden className="ml-auto text-lank/40">{open ? '▴' : '▾'}</span>
      </button>

      <div className={`${open ? 'block' : 'hidden'} lg:block`}>
        {/* Recherche — toujours en haut, au-dessus du sommaire et de l'index. */}
        <div className="border-t border-lank/10 lg:border-t-0">
          <SearchPanel docId={docId} locale={locale} lt={lt} />
        </div>
        {/* Onglets Sommaire | Index */}
        <div className="flex border-y border-lank/10">
          {(['toc', 'index'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 border-b-2 px-3 py-2 text-xs font-semibold transition ${
                tab === t ? 'border-soley text-lank' : 'border-transparent text-lank/45 hover:text-lank/70'
              }`}
            >
              {lt(L[t])}
            </button>
          ))}
        </div>
        <div className="max-h-[48vh] overflow-auto lg:max-h-[calc(100vh-16rem)]">
          {tab === 'toc' && <TocPanel groups={groups} />}
          {tab === 'index' && <IndexPanel entries={indexEntries} locale={locale} lt={lt} />}
        </div>
      </div>
    </aside>
  )
}

// ─────────────────────────── Recherche ───────────────────────────
function SearchPanel({ docId, locale, lt }: { docId: string; locale: Locale; lt: (o: Record<Locale, string>) => string }) {
  const [q, setQ] = useState('')
  const [ai, setAi] = useState(false)
  const [hits, setHits] = useState<Hit[]>([])
  const [themes, setThemes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) {
      setHits([])
      setThemes([])
      return
    }
    const id = ++seq.current
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/legislation/code-search?docId=${encodeURIComponent(docId)}&q=${encodeURIComponent(query)}${ai ? '&ai=1' : ''}`)
        const data = await res.json()
        if (id !== seq.current) return // réponse périmée
        setHits(data.results ?? [])
        setThemes(data.themes ?? [])
      } catch {
        if (id === seq.current) {
          setHits([])
          setThemes([])
        }
      } finally {
        if (id === seq.current) setLoading(false)
      }
    }, ai ? 450 : 220)
    return () => clearTimeout(timer)
  }, [q, ai, docId])

  return (
    <div className="p-3">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={lt(L.ph)}
        className="w-full rounded-lg border border-lank/15 bg-paper px-3 py-2 text-sm text-lank outline-none focus:border-sitwon"
      />
      <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-lank/60">
        <input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} className="h-3.5 w-3.5 rounded border-lank/30 accent-sitwon" />
        ✨ {lt(L.ai)}
      </label>

      {ai && themes.length > 0 && (
        <div className="mt-2.5 rounded-lg bg-sitwon-50 px-2.5 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-sitwon-700">{lt(L.themes)}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {themes.map((t) => (
              <span key={t} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-lank/70">{t}</span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3">
        {q.trim().length < 2 ? (
          <p className="px-1 text-xs text-lank/45">{lt(L.hint)}</p>
        ) : loading && hits.length === 0 ? (
          <p className="px-1 text-xs text-lank/45">…</p>
        ) : hits.length === 0 ? (
          <p className="px-1 text-xs text-lank/45">{lt(L.none)}</p>
        ) : (
          <ul className="max-h-[34vh] space-y-1 overflow-auto">
            {hits.map((h) => (
              <li key={h.anchor}>
                <a href={`#${h.anchor}`} className="block rounded-lg px-2 py-1.5 transition hover:bg-paper">
                  <span className="text-sm font-semibold text-soley-700">{h.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-lank/55 line-clamp-2">{h.snippet}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── Sommaire (arbre) ───────────────────────────
function TocPanel({ groups }: { groups: NavGroup[] }) {
  if (!groups.length) return null
  return (
    <nav className="p-2.5">
      {groups.map((g) => (
        <div key={g.anchor} className="mb-3 last:mb-0">
          <a href={`#${g.anchor}`} className="block px-1.5 py-1 text-xs font-bold uppercase tracking-wide text-lank/70 hover:text-sitwon-700">
            {g.label}
          </a>
          <ul className="mt-0.5">
            {g.children.map((c) => (
              <TreeNode key={c.anchor} item={c} depth={0} />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function TreeNode({ item, depth }: { item: NavItem; depth: number }) {
  const hasKids = !!item.children && item.children.length > 0
  // Livres (niveau 0) dépliés par défaut → les chapitres sont visibles d'emblée ;
  // niveaux plus profonds (sections) repliés.
  const [open, setOpen] = useState(depth === 0)
  return (
    <li>
      <div className="flex items-start gap-1" style={{ paddingLeft: depth * 8 }}>
        {hasKids ? (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? 'Replier' : 'Déplier'} className="mt-0.5 select-none px-0.5 text-[10px] text-lank/40 hover:text-lank">
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="px-0.5 text-[10px] text-transparent">▸</span>
        )}
        <a href={`#${item.anchor}`} className="block flex-1 py-0.5 text-[13px] leading-snug text-lank/75 hover:text-sitwon-700 hover:underline">
          {item.label}
        </a>
      </div>
      {hasKids && open && (
        <ul className="border-l border-lank/10" style={{ marginLeft: depth * 8 + 8 }}>
          {item.children!.map((c) => (
            <TreeNode key={c.anchor} item={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

// ─────────────────────────── Index alphabétique ───────────────────────────
function IndexPanel({ entries, locale, lt }: { entries: IndexEntry[]; locale: Locale; lt: (o: Record<Locale, string>) => string }) {
  const [q, setQ] = useState('')
  // Nettoie « X — définition » / « Définitions — X » → « X » et déduplique (fusionne les renvois) ;
  // le tri alphabétique est appliqué ensuite.
  const cleaned = useMemo(() => {
    const m = new Map<string, { subject: string; refs: Set<ArtRef> }>()
    for (const e of entries) {
      const subject = cleanIndexSubject(e.subject)
      if (!subject) continue // « Définition » nue ignorée
      const k = fold(subject)
      const cur = m.get(k)
      if (cur) e.ctRefs.forEach((n) => cur.refs.add(n))
      else m.set(k, { subject, refs: new Set(e.ctRefs) })
    }
    return [...m.values()].map((v) => ({
      subject: v.subject,
      ctRefs: [...v.refs].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })),
    }))
  }, [entries])
  const folded = useMemo(() => cleaned.map((e) => ({ e, f: fold(e.subject) })), [cleaned])
  const groups = useMemo(() => {
    const fq = fold(q.trim())
    const filtered = fq ? folded.filter((x) => x.f.includes(fq)) : folded
    const sorted = [...filtered].sort((a, b) => a.f.localeCompare(b.f))
    const byLetter = new Map<string, IndexEntry[]>()
    for (const { e, f } of sorted) {
      const first = (f[0] || '#').toUpperCase()
      const key = /[A-Z]/.test(first) ? first : '#'
      const arr = byLetter.get(key)
      if (arr) arr.push(e)
      else byLetter.set(key, [e])
    }
    return [...byLetter.entries()]
  }, [folded, q])
  if (!entries.length) return null

  return (
    <div className="p-3">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={lt(L.phIndex)}
        className="mb-2 w-full rounded-lg border border-lank/15 bg-paper px-3 py-2 text-sm text-lank outline-none focus:border-sitwon"
      />
      {groups.map(([letter, list]) => (
        <section key={letter} className="mb-2">
          <h4 className="sticky top-0 bg-white py-1 text-xs font-bold uppercase tracking-wider text-sitwon-700">{letter}</h4>
          <ul className="space-y-1">
            {list.map((e) => (
              <li key={`${e.subject}#${e.ctRefs.join(',')}`} className="flex flex-wrap items-baseline gap-x-1.5 text-[13px]">
                <span className="text-lank/85">{e.subject}</span>
                <span className="text-lank/40">{lt(L.art)}</span>
                {e.ctRefs.map((n, k) => (
                  <span key={`${n}-${k}`}>
                    <a href={`#art-${n}`} className="font-medium text-soley-700 hover:underline">{prettyRef(n)}</a>
                    {k < e.ctRefs.length - 1 && <span className="text-lank/30"> ·</span>}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
