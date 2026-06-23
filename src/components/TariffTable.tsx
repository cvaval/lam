'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { highlightRegex } from '@/lib/search/highlight'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'

export interface TariffRow {
  id: string
  code: string
  designation: string
  unite: string | null
  dd: string | null
  tca: string | null
  accises: string | null
  note: string | null
}

const MAX = 100 // doit refléter le take de /api/tarifs/search

/**
 * Table des tarifs douaniers à recherche DYNAMIQUE : la liste se filtre au fur et à
 * mesure de la frappe (débounce 200 ms, requête /api/tarifs/search sur les 5 266 lignes,
 * pas seulement la page chargée). Premier rendu = lignes initiales rendues côté serveur.
 */
export function TariffTable({
  locale,
  t,
  initialRows,
  initialTotal,
  docCount,
}: {
  locale: Locale
  t: Dictionary
  initialRows: TariffRow[]
  initialTotal: number
  docCount: number
}) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<TariffRow[]>(initialRows)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      abortRef.current?.abort()
      setRows(initialRows)
      setTotal(initialTotal)
      setLoading(false)
      return
    }
    setLoading(true)
    const id = setTimeout(async () => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      try {
        const res = await fetch(`/api/tarifs/search?q=${encodeURIComponent(term)}`, { signal: ac.signal })
        const j = await res.json()
        if (j?.ok) {
          setRows(j.rows as TariffRow[])
          setTotal(j.total as number)
        }
      } catch {
        /* requête annulée ou réseau : on garde l'affichage courant */
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(id)
  }, [q, initialRows, initialTotal])

  const hlRe = q.trim().length >= 2 ? highlightRegex([q.trim()]) : null
  const hl = (v: string) => {
    if (!hlRe || !v) return v
    const parts = v.split(hlRe)
    return parts.length <= 1 ? v : parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="hl">{p}</mark> : p))
  }
  const numCls = 'px-3 py-1.5 text-right tabular-nums whitespace-nowrap'

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.tarifs.searchPlaceholder}
          autoComplete="off"
          className="w-full rounded-xl border border-lank/15 bg-white px-4 py-2 pr-10 text-sm text-lank outline-none focus:border-kannel"
        />
        {loading && (
          <span aria-hidden className="absolute right-3 top-1/2 -mt-2 h-4 w-4 animate-spin rounded-full border-2 border-kannel/30 border-t-kannel" />
        )}
      </div>

      <p className="text-sm text-lank/55" aria-live="polite">
        {total.toLocaleString('fr')} {t.tarifs.results}
        {q.trim() && <> · « {q.trim()} »</>}
        {total > MAX && <span className="text-lank/40"> · {MAX} {t.tarifs.shownMax}</span>}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-lank/10 bg-white p-10 text-center text-lank/45">
          {q.trim() ? t.tarifs.empty : t.tarifs.emptyAll}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-lank/10 bg-white shadow-card">
          <table className="w-full border-collapse text-[13px] text-lank/90">
            <thead>
              <tr className="border-b border-lank/15 bg-kannel-50 text-left text-xs uppercase tracking-wide text-lank/60">
                <th scope="col" className="px-3 py-2 font-semibold">{t.tarifs.thCode}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{t.tarifs.thDesignation}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{t.tarifs.thUnite}</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">{t.tarifs.thDd}</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">{t.tarifs.thTca}</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">{t.tarifs.thAccises}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={i % 2 === 1 ? 'bg-[rgba(27,31,61,0.025)]' : ''}>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs font-medium text-lank">{hl(r.code)}</td>
                  <td className="px-3 py-1.5">
                    {hl(r.designation)}
                    {r.note && <span className="mt-0.5 block text-[11px] text-lank/45">{r.note}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-lank/70">{r.unite ?? '—'}</td>
                  <td className={numCls}>{r.dd ?? '—'}</td>
                  <td className={numCls}>{r.tca ?? '—'}</td>
                  <td className={numCls}>{r.accises ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link
        href={`/${locale}/search?type=tarifs`}
        className="flex items-center justify-between rounded-2xl border border-kannel/30 bg-kannel-50 px-5 py-4 transition hover:border-kannel/60"
      >
        <span>
          <span className="block font-semibold text-lank">{t.tarifs.docsTitle}</span>
          <span className="mt-0.5 block text-xs text-lank/55">{t.tarifs.docsSub}</span>
        </span>
        <span className="shrink-0 text-sm font-medium text-kannel-700">
          {docCount > 0 && <span className="mr-2 text-lank/45">{docCount}</span>}
          {t.tarifs.docsLink} →
        </span>
      </Link>
    </div>
  )
}
