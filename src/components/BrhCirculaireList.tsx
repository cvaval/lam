'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

export interface BrhRow {
  id: string
  number: string | null
  serie: 'CIRCULAIRE' | 'LETTRE' | null
  base: number | null
  rev: number | null
  titleFr: string
  matiere: string | null
  pubLabel: string
  effLabel: string
  /** dates triables (epoch ms), null si absente */
  pubTs: number | null
  effTs: number | null
  /** année de publication (entrée en vigueur en repli), null si inconnue */
  year: number | null
}

type SortMode = 'num-asc' | 'num-desc' | 'sig' | 'eff'

interface Labels {
  byNumber: string
  byYear: string
  number: string
  pubDate: string
  effDate: string
  matiere: string
  titleCol: string
  none: string
  noDate: string
  count: string // « circulaires » (suffixe de comptage par année)
}

/**
 * Liste des circulaires BRH avec deux vues commutables :
 *  - « Par numéro » : tableau complet (numéro, date de publication, entrée en
 *    vigueur, matière, titre) ;
 *  - « Par année » : regroupement par année de publication (la plus récente en
 *    tête), chaque année listant ses numéros (puces cliquables).
 * `rows` est déjà trié par numéro (série, base, révision).
 */
export function BrhCirculaireList({ rows, locale, labels }: { rows: BrhRow[]; locale: string; labels: Labels }) {
  const [view, setView] = useState<'number' | 'year'>('number')
  const [sort, setSort] = useState<SortMode>('num-asc')

  // Tri appliqué (numéro ↑/↓, date de signature, date d'entrée en vigueur) ; dates et
  // numéros non renseignés rejetés en fin de liste.
  const sorted = useMemo(() => {
    const serieOrd = (s: BrhRow['serie']) => (s === 'CIRCULAIRE' ? 0 : s === 'LETTRE' ? 1 : 2)
    const byNum = (a: BrhRow, b: BrhRow, dir: 1 | -1) => {
      const so = serieOrd(a.serie) - serieOrd(b.serie)
      if (so) return so
      const an = a.base == null, bn = b.base == null
      if (an && bn) return 0
      if (an) return 1
      if (bn) return -1
      if (a.base !== b.base) return (a.base! - b.base!) * dir
      return ((a.rev ?? 0) - (b.rev ?? 0)) * dir
    }
    const byDate = (a: number | null, b: number | null) => (b ?? -Infinity) - (a ?? -Infinity) // récent d'abord
    const r = [...rows]
    if (sort === 'num-asc') r.sort((a, b) => byNum(a, b, 1))
    else if (sort === 'num-desc') r.sort((a, b) => byNum(a, b, -1))
    else if (sort === 'sig') r.sort((a, b) => byDate(a.pubTs, b.pubTs))
    else r.sort((a, b) => byDate(a.effTs, b.effTs))
    return r
  }, [rows, sort])

  // Regroupement par année (desc), « Sans date » en dernier ; ordre du tri préservé.
  const byYear = useMemo(() => {
    const groups = new Map<number | null, BrhRow[]>()
    for (const r of sorted) {
      const arr = groups.get(r.year) ?? []
      arr.push(r)
      groups.set(r.year, arr)
    }
    return [...groups.entries()].sort((a, b) => {
      if (a[0] === null) return 1
      if (b[0] === null) return -1
      return b[0] - a[0]
    })
  }, [sorted])

  const tab = (key: 'number' | 'year', label: string) => (
    <button
      type="button"
      onClick={() => setView(key)}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
        view === key ? 'bg-lank text-white' : 'text-lank/60 hover:bg-paper'
      }`}
    >
      {label}
    </button>
  )

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-lank/15 p-1">
          {tab('number', labels.byNumber)}
          {tab('year', labels.byYear)}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-lank/60">
          {/* icône « trier » */}
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-lank/45" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 6h12M3 12h9M3 18h6" strokeLinecap="round" />
            <path d="M18 9l3-3 3 3M21 6v12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-medium">Trier&nbsp;:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            aria-label="Trier les circulaires"
            className="rounded-md border border-lank/15 bg-white px-2 py-1 text-xs text-lank outline-none focus:border-sitwon"
          >
            <option value="num-asc">N° croissant</option>
            <option value="num-desc">N° décroissant</option>
            <option value="sig">Date de signature</option>
            <option value="eff">Date d’entrée en vigueur</option>
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-lank/10 bg-white px-4 py-8 text-center text-sm text-lank/40 shadow-card">
          {labels.none}
        </p>
      ) : view === 'number' ? (
        <div className="overflow-hidden rounded-2xl border border-lank/10 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-lank/10 bg-paper text-left text-[11px] uppercase tracking-wide text-lank/45">
                <th className="px-4 py-3 font-semibold">{labels.number}</th>
                <th className="px-4 py-3 font-semibold">{labels.pubDate}</th>
                <th className="px-4 py-3 font-semibold">{labels.effDate}</th>
                <th className="px-4 py-3 font-semibold">{labels.matiere}</th>
                <th className="px-4 py-3 font-semibold">{labels.titleCol}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lank/5">
              {sorted.map((d) => (
                <tr key={d.id} className="hover:bg-paper/50">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono font-semibold text-lank">{d.number ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-lank/65">{d.pubLabel}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-lank/65">{d.effLabel}</td>
                  <td className="px-4 py-2.5 text-lank/65">{d.matiere ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/${locale}/doc/${d.id}`} className="text-lank hover:underline">
                      {d.titleFr}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {byYear.map(([year, list]) => (
            <div key={year ?? 'none'} className="rounded-2xl border border-lank/10 bg-white p-4 shadow-card">
              <div className="mb-2 flex items-baseline gap-2">
                <h3 className="font-mono text-lg font-semibold text-lank">{year ?? labels.noDate}</h3>
                <span className="text-xs text-lank/45">
                  {list.length} {labels.count}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((d) => (
                  <Link
                    key={d.id}
                    href={`/${locale}/doc/${d.id}`}
                    title={`${d.titleFr}${d.pubLabel !== '—' ? ` — ${d.pubLabel}` : ''}`}
                    className="rounded-full border border-lank/15 bg-paper px-2.5 py-1 font-mono text-xs text-lank hover:border-sitwon hover:text-lank"
                  >
                    {d.number ?? '—'}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
