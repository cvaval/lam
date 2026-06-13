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
  /** année de publication (entrée en vigueur en repli), null si inconnue */
  year: number | null
}

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

  // Regroupement par année (desc), « Sans date » en dernier ; ordre numéro préservé.
  const byYear = useMemo(() => {
    const groups = new Map<number | null, BrhRow[]>()
    for (const r of rows) {
      const arr = groups.get(r.year) ?? []
      arr.push(r)
      groups.set(r.year, arr)
    }
    return [...groups.entries()].sort((a, b) => {
      if (a[0] === null) return 1
      if (b[0] === null) return -1
      return b[0] - a[0]
    })
  }, [rows])

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
      <div className="mb-3 flex items-center gap-1 rounded-lg border border-lank/15 p-1">
        {tab('number', labels.byNumber)}
        {tab('year', labels.byYear)}
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
              {rows.map((d) => (
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
