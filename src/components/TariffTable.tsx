'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { highlightRegex } from '@/lib/search/highlight'
import { tariffLabel } from '@/lib/tarif-format'
import { TariffCalculator } from './TariffCalculator'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'

export interface TariffRow {
  id: string
  code: string
  designation: string
  unite: string | null
  dd: string | null
  ddRef: string | null
  tca: string | null
  accises: string | null
  note: string | null
}
interface Chapter { code: string; label: string; count: number }

const digits = (s: string) => (s ?? '').replace(/\D/g, '')

/**
 * Section Tarifs douaniers : NAVIGABLE (sommaire par chapitre SH) ET cherchable
 * (recherche dynamique débouncée, paginée « charger plus »). Badges DD, hiérarchie SH
 * indentée, en-tête figé, copie du code, lien profond ?q=/?chapter=, info loi de finances
 * visible, calculateur de droits à l'import. Distingue dépassement de débit ≠ aucun résultat.
 */
export function TariffTable({
  locale,
  t,
  chapters,
  total,
  docCount,
}: {
  locale: Locale
  t: Dictionary
  chapters: Chapter[]
  total: number
  docCount: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [chapter, setChapter] = useState(sp.get('chapter') ?? '')
  const [rows, setRows] = useState<TariffRow[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [rate, setRate] = useState(false)
  const [rateMore, setRateMore] = useState(false)
  const [calcRow, setCalcRow] = useState<TariffRow | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const active = q.trim().length >= 2 || Boolean(chapter)

  async function doFetch(qq: string, ch: string, skip: number, reset: boolean) {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    setRateMore(false)
    if (reset) setRate(false)
    try {
      const p = new URLSearchParams()
      if (qq.trim().length >= 2) p.set('q', qq.trim())
      if (ch) p.set('chapter', ch)
      p.set('skip', String(skip))
      const res = await fetch(`/api/tarifs/search?${p.toString()}`, { signal: ac.signal })
      if (abortRef.current !== ac) return // requête supplantée → ne pas committer
      if (res.status === 429) {
        // Débit dépassé : plein écran si recherche initiale, en ligne si « charger plus »
        // (ne pas effacer les lignes déjà affichées).
        if (reset) { setRate(true); setRows([]); setCount(0) } else setRateMore(true)
        return
      }
      const j = await res.json()
      if (abortRef.current !== ac || !j?.ok) return
      setRows((prev) => (reset ? (j.rows as TariffRow[]) : [...prev, ...(j.rows as TariffRow[])]))
      if (typeof j.total === 'number' && j.total >= 0) setCount(j.total)
    } catch {
      /* annulé / réseau */
    } finally {
      if (abortRef.current === ac) setLoading(false)
    }
  }

  // Recherche/chapitre → requête (débounce 200 ms pour la saisie, immédiat pour un chapitre).
  useEffect(() => {
    if (q.trim().length < 2 && !chapter) {
      abortRef.current?.abort()
      setRows([]); setCount(0); setRate(false); setLoading(false)
      return
    }
    setLoading(true)
    const id = setTimeout(() => void doFetch(q, chapter, 0, true), q.trim().length >= 2 ? 200 : 0)
    return () => { clearTimeout(id); abortRef.current?.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, chapter])

  // Lien profond : ?q= / ?chapter= dans l'URL.
  useEffect(() => {
    const p = new URLSearchParams()
    if (q.trim()) p.set('q', q.trim())
    if (chapter) p.set('chapter', chapter)
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, chapter])

  async function copy(code: string) {
    try { await navigator.clipboard.writeText(digits(code)); setCopied(code); setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500) } catch { /* */ }
  }

  const hlRe = q.trim().length >= 2 ? highlightRegex([q.trim()]) : null
  const hl = (v: string) => {
    if (!hlRe || !v) return v
    const parts = v.split(hlRe)
    return parts.length <= 1 ? v : parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="hl">{p}</mark> : p))
  }
  // Surlignage infixe du code (taper « 0101 » ou « 8703 » surligne dans « 8703.21 00 »).
  const codeHl = (code: string) => {
    const term = q.trim()
    if (!term) return code
    const i = code.toLowerCase().indexOf(term.toLowerCase())
    if (i < 0) return code
    return <>{code.slice(0, i)}<mark className="hl">{code.slice(i, i + term.length)}</mark>{code.slice(i + term.length)}</>
  }

  function ddCell(r: TariffRow) {
    const v = r.dd
    if (!v) return <span title={t.tarifs.ddUnknown} className="text-lank/35">—</span>
    if (v === 'Exonéré') return <span className="rounded bg-fey/10 px-1.5 py-0.5 text-[11px] font-semibold text-fey">{v}</span>
    if (v === 'Suspendu') return <span className="rounded bg-soley-100 px-1.5 py-0.5 text-[11px] font-semibold text-soley-700">{v}</span>
    return <span className={v === '0 %' ? 'text-lank/45' : 'font-medium text-lank'}>{v}</span>
  }

  const chLabel = chapters.find((c) => c.code === chapter)?.label
  const hasMore = count > rows.length
  const numCls = 'px-3 py-1.5 text-right tabular-nums whitespace-nowrap'

  return (
    <div className="space-y-4">
      {calcRow && <TariffCalculator row={calcRow} t={t} onClose={() => setCalcRow(null)} />}

      {/* Recherche */}
      <div className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.tarifs.searchPlaceholder}
          aria-label={t.tarifs.searchPlaceholder}
          autoComplete="off"
          className="w-full rounded-xl border border-lank/15 bg-white px-4 py-2 pr-10 text-sm text-lank outline-none focus:border-kannel"
        />
        {loading && <span aria-hidden className="absolute right-3 top-1/2 -mt-2 h-4 w-4 animate-spin rounded-full border-2 border-kannel/30 border-t-kannel" />}
        <span role="status" className="sr-only">{loading ? t.tarifs.loadingTxt : ''}</span>
      </div>
      <p className="text-xs text-lank/55">{t.tarifs.tcaNote}</p>

      {/* Page d'atterrissage : sommaire des chapitres */}
      {!active ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-lank/45">{t.tarifs.chaptersTitle}</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {chapters.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => { setQ(''); setChapter(c.code) }}
                className="flex items-start gap-3 rounded-xl border border-lank/10 bg-white px-3 py-2.5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-kannel/40 hover:shadow-lg"
              >
                <span className="mt-0.5 shrink-0 rounded-md bg-kannel-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-kannel-700">{c.code}</span>
                <span className="min-w-0">
                  <span className="block text-sm leading-snug text-lank">{c.label}</span>
                  <span className="text-[11px] text-lank/45">{c.count} {t.tarifs.results}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-lank/40">{total.toLocaleString('fr')} {t.tarifs.results} · {chapters.length} {t.tarifs.chapterPrefix.toLowerCase()}s</p>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setChapter(''); setQ('') }} className="rounded-lg border border-lank/15 bg-white px-2.5 py-1 text-xs text-lank/70 hover:bg-paper">← {t.tarifs.allChapters}</button>
              {chapter && <span className="text-sm font-semibold text-lank">{t.tarifs.chapterPrefix} {chapter}{chLabel ? ` — ${chLabel}` : ''}</span>}
            </div>
            <p aria-live="polite" className="text-sm text-lank/55">
              {!rate && <>{count.toLocaleString('fr')} {t.tarifs.results}{q.trim() && <> · « {q.trim()} »</>}</>}
            </p>
          </div>

          {rate ? (
            <div role="alert" className="rounded-2xl border border-soley/40 bg-soley-50 p-6 text-center text-sm text-lank">{t.tarifs.rateLimited}</div>
          ) : rows.length === 0 && !loading ? (
            <div className="rounded-2xl border border-lank/10 bg-white p-10 text-center text-lank/45">{t.tarifs.empty}</div>
          ) : (
            <div className="max-h-[72vh] overflow-auto rounded-2xl border border-lank/10 bg-white shadow-card">
              <table className="w-full border-collapse text-[13px] text-lank/90">
                <caption className="sr-only">{t.tarifs.title}</caption>
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-lank/15 bg-kannel-50 text-left text-xs uppercase tracking-wide text-lank/60">
                    <th scope="col" className="px-3 py-2 font-semibold">{t.tarifs.thCode}</th>
                    <th scope="col" className="px-3 py-2 font-semibold">{t.tarifs.thDesignation}</th>
                    <th scope="col" className="px-3 py-2 font-semibold">{t.tarifs.thUnite}</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">{t.tarifs.thDd}</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">{t.tarifs.thAccises}</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const { level, label } = tariffLabel(r.designation)
                    return (
                      <tr key={r.id} className={i % 2 === 1 ? 'bg-[rgba(27,31,61,0.025)]' : ''}>
                        <td className="whitespace-nowrap px-3 py-1.5 align-top">
                          <span className="font-mono text-xs font-medium text-lank">{codeHl(r.code)}</span>
                          <button type="button" onClick={() => copy(r.code)} title={t.tarifs.copyCode} aria-label={t.tarifs.copyCode} className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded text-xs text-lank/40 hover:bg-kannel-50 hover:text-kannel-700">
                            {copied === r.code ? '✓' : '⧉'}
                          </button>
                        </td>
                        <td className="px-3 py-1.5 align-top" style={{ paddingLeft: level ? `${0.75 + level * 0.85}rem` : undefined }}>
                          {hl(label)}
                          {r.note && <span className="mt-0.5 block text-[11px] text-lank/55">{r.note}</span>}
                          {r.ddRef && <span title={r.ddRef} className="mt-0.5 block line-clamp-1 text-[11px] text-kannel-700/80">ⓘ {r.ddRef}</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 align-top text-lank/70">{r.unite ?? '—'}</td>
                        <td className={`${numCls} align-top`}>{ddCell(r)}</td>
                        <td className={`${numCls} align-top ${r.accises ? 'bg-soley-50' : ''}`}>{r.accises ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right align-top">
                          <button type="button" onClick={() => setCalcRow(r)} className="rounded-md border border-kannel/30 px-2 py-1 text-xs font-medium text-kannel-700 hover:bg-kannel-50">{t.tarifs.calc}</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {hasMore && !rate && (
            <div className="text-center">
              {rateMore ? (
                <p role="alert" className="text-sm text-soley-700">{t.tarifs.rateLimited}</p>
              ) : (
                <button type="button" onClick={() => void doFetch(q, chapter, rows.length, false)} disabled={loading} className="rounded-lg border border-lank/15 bg-white px-4 py-2 text-sm font-medium text-lank hover:bg-paper disabled:opacity-50">
                  {t.tarifs.loadMore} ({(count - rows.length).toLocaleString('fr')})
                </button>
              )}
            </div>
          )}
        </>
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
