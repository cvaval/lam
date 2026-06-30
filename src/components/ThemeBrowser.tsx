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
  DOCTRINE: 'Doctrine',
  LOI_FINANCES: 'Loi de finances',
  MARQUE: 'Marque',
  TARIF_DOUANIER: 'Tarif douanier',
  INDEX: 'Index',
}
const L = {
  title: { fr: 'Législation annotée', en: 'Annotated legislation', ht: 'Lejislasyon anote' },
  sub: {
    fr: 'Dépliez les domaines pour explorer les sous-thèmes ; cliquez un thème pour voir les textes qu’il renferme.',
    en: 'Expand domains to explore sub-themes; click a theme to see the texts it contains.',
    ht: 'Louvri domèn yo pou eksplore sou-tèm yo ; klike yon tèm pou wè tèks ki ladann.',
  },
  texts: { fr: 'textes', en: 'texts', ht: 'tèks' },
  loading: { fr: 'Chargement…', en: 'Loading…', ht: 'N ap chaje…' },
  empty: { fr: 'Aucun texte accessible dans ce thème.', en: 'No accessible text in this theme.', ht: 'Pa gen tèks aksesib nan tèm sa a.' },
} as const

export function ThemeBrowser({ locale, tree, counts }: { locale: Locale; tree: ThemeNode[]; counts: Record<string, number> }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [docs, setDocs] = useState<DocRow[] | null>(null)
  const [loading, setLoading] = useState(false)

  // Total du sous-arbre (rattachements directs cumulés) — repère de volume.
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

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const select = useCallback(async (id: string) => {
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
  }, [selected])

  const label = (n: ThemeNode) => (locale === 'en' ? n.labelEn : locale === 'ht' ? n.labelHt : n.labelFr) || n.labelFr
  const docTitle = (d: DocRow) => (locale === 'en' ? d.titleEn : locale === 'ht' ? d.titleHt : d.titleFr) || d.titleFr

  function Node({ node, depth }: { node: ThemeNode; depth: number }) {
    const hasChildren = node.children.length > 0
    const isOpen = expanded.has(node.id)
    const isSel = selected === node.id
    const total = subtotal.get(node.id) ?? 0
    return (
      <li>
        <div className="flex items-center gap-1.5 rounded-lg px-1 py-1 hover:bg-paper" style={{ paddingLeft: depth * 18 + 4 }}>
          {hasChildren ? (
            <button type="button" onClick={() => toggleExpand(node.id)} className="flex h-5 w-5 items-center justify-center rounded text-lank/50 hover:bg-lank/10" aria-label={isOpen ? 'Replier' : 'Déplier'} aria-expanded={isOpen}>
              <span className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>▸</span>
            </button>
          ) : (
            <span className="h-5 w-5 shrink-0" />
          )}
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-lank/15" style={{ backgroundColor: node.color ?? 'transparent' }} />
          <button type="button" onClick={() => select(node.id)} className={`text-left text-sm ${isSel ? 'font-semibold text-lank' : 'text-lank/85 hover:text-lank'}`}>
            {label(node)}
          </button>
          {total > 0 && <span className="rounded-full bg-sitwon-50 px-1.5 text-[11px] text-lank/55">{total}</span>}
        </div>

        {isSel && (
          <div className="mb-1 ml-7 rounded-lg border border-lank/10 bg-white p-2" style={{ marginLeft: depth * 18 + 28 }}>
            {loading ? (
              <p className="px-2 py-2 text-xs text-lank/50">{L.loading[locale]}</p>
            ) : docs && docs.length > 0 ? (
              <ul className="divide-y divide-lank/5">
                {docs.map((d) => (
                  <li key={d.id}>
                    <Link href={`/${locale}/doc/${d.id}`} className="flex items-baseline gap-2 px-2 py-1.5 text-sm hover:bg-paper">
                      <span className="shrink-0 rounded bg-lank/5 px-1.5 text-[10px] uppercase tracking-wide text-lank/50">{TYPE_SHORT[d.type] ?? d.type}</span>
                      <span className="text-lank">{docTitle(d)}</span>
                      {d.number && <span className="text-xs text-lank/40">· {d.number}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-2 py-2 text-xs text-lank/50">{L.empty[locale]}</p>
            )}
          </div>
        )}

        {hasChildren && isOpen && (
          <ul>
            {node.children.map((c) => (
              <Node key={c.id} node={c} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="space-y-5">
      <header className="border-l-4 border-lank pl-4">
        <h1 className="text-2xl font-bold text-lank">{L.title[locale]}</h1>
        <p className="mt-1 max-w-2xl text-sm text-lank/55">{L.sub[locale]}</p>
      </header>
      <div className="rounded-2xl border border-lank/10 bg-white p-3 shadow-card">
        {tree.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-lank/40">—</p>
        ) : (
          <ul>
            {tree.map((n) => (
              <Node key={n.id} node={n} depth={0} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
