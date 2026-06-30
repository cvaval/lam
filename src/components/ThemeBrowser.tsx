'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/types'

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
}

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
} as const

export function ThemeBrowser({
  locale,
  tree,
  counts,
  recentThemeIds,
}: {
  locale: Locale
  tree: ThemeNode[]
  counts: Record<string, number>
  recentThemeIds: string[]
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [docs, setDocs] = useState<DocRow[] | null>(null)
  const [loading, setLoading] = useState(false)

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

  // Sous-arbres contenant un document récent → badge « Nouveau » (remonté aux ancêtres).
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

  const select = useCallback(
    async (id: string) => {
      if (selected === id) {
        setSelected(null)
        setDocs(null)
        return
      }
      setSelected(id)
      setDocs(null)
      setLoading(true)
      try {
        const res = await fetch(`/api/legislation/theme-docs?themeId=${encodeURIComponent(id)}`)
        const data = await res.json().catch(() => null)
        setDocs(data?.ok ? (data.docs as DocRow[]) : [])
      } catch {
        setDocs([])
      } finally {
        setLoading(false)
      }
    },
    [selected],
  )

  const label = (n: ThemeNode) => (locale === 'en' ? n.labelEn : locale === 'ht' ? n.labelHt : n.labelFr) || n.labelFr
  const docTitle = (d: DocRow) => (locale === 'en' ? d.titleEn : locale === 'ht' ? d.titleHt : d.titleFr) || d.titleFr

  function countText(n: ThemeNode): string {
    const total = subtotal.get(n.id) ?? 0
    const t = `${total} ${total === 1 ? L.text1[locale] : L.texts[locale]}`
    return n.children.length > 0 ? `${n.children.length} ${L.themes[locale]} · ${t}` : t
  }

  function DocList({ themeId }: { themeId: string }) {
    if (selected !== themeId) return null
    return (
      <div className="mt-2 overflow-hidden rounded-xl border border-lank/10 bg-paper/60">
        {loading ? (
          <p className="px-3 py-3 text-xs text-lank/50">{L.loading[locale]}</p>
        ) : docs && docs.length > 0 ? (
          <ul className="divide-y divide-lank/5">
            {docs.map((d) => (
              <li key={d.id}>
                <Link href={`/${locale}/doc/${d.id}`} className="flex items-start gap-2.5 px-3 py-2.5 transition hover:bg-white">
                  <span className="mt-0.5 shrink-0 rounded bg-lank/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-lank/50">{TYPE_SHORT[d.type] ?? d.type}</span>
                  <span className="min-w-0">
                    <span className="block text-sm text-lank">{docTitle(d)}</span>
                    {d.number && <span className="block text-xs text-lank/40">{d.number}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-3 text-xs text-lank/50">{L.empty[locale]}</p>
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

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-lagon/25">
          <span className="h-5 w-5 rounded-lg bg-lagon-700" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-lank">{L.title[locale]}</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-lank/55">{L.sub[locale]}</p>
        </div>
      </header>

      {tree.length === 0 ? (
        <p className="rounded-2xl border border-lank/10 bg-white px-4 py-10 text-center text-sm text-lank/40 shadow-card">—</p>
      ) : (
        <ul className="space-y-2.5">
          {tree.map((n) => (
            <DomainCard key={n.id} node={n} />
          ))}
        </ul>
      )}
    </div>
  )
}
