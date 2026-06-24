'use client'

import { useMemo, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { articleAnchorFromNum } from '@/lib/doc/anchors'

export interface ThemeArticle { num: string; heading: string; themes: string[]; summary: string }

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
// Normalisation partagée avec OfficialText : « 12 » → art-12, « 95-bis » → art-95-bis.
const anchorOf = (num: string) => articleAnchorFromNum(num)

/**
 * Index thématique du Code des Douanes : recherche par thème (ou sujet), navigation par
 * thèmes (taggés par IA), THÈMES PROCHES (co-occurrence des thèmes IA) et RENVOIS entre
 * articles partageant des thèmes. Les articles renvoient aux ancres #art-N du texte intégral.
 */
export function CodeThemeBrowser({ index, t }: { index: ThemeArticle[]; t: Dictionary }) {
  const [q, setQ] = useState('')
  const [theme, setTheme] = useState<string | null>(null)

  // thème → articles ; co-occurrence pour « thèmes proches »
  const { themeMap, themesSorted, coOcc } = useMemo(() => {
    const tm = new Map<string, ThemeArticle[]>()
    for (const a of index) for (const th of a.themes) { if (!tm.has(th)) tm.set(th, []); tm.get(th)!.push(a) }
    const sorted = [...tm.keys()].sort((a, b) => (tm.get(b)!.length - tm.get(a)!.length) || a.localeCompare(b))
    const co = new Map<string, Map<string, number>>()
    for (const a of index) for (const x of a.themes) for (const y of a.themes) {
      if (x === y) continue
      if (!co.has(x)) co.set(x, new Map())
      co.get(x)!.set(y, (co.get(x)!.get(y) ?? 0) + 1)
    }
    return { themeMap: tm, themesSorted: sorted, coOcc: co }
  }, [index])

  const related = (a: ThemeArticle) =>
    index
      .filter((b) => b.num !== a.num && b.themes.some((th) => a.themes.includes(th)))
      .map((b) => ({ b, n: b.themes.filter((th) => a.themes.includes(th)).length }))
      .sort((x, y) => y.n - x.n)
      .slice(0, 4)
      .map((x) => x.b)

  const fq = fold(q.trim())
  // Résultats : si un thème est sélectionné → ses articles ; sinon si recherche texte →
  // articles dont thème/résumé/titre contient la saisie ; sinon → page des thèmes.
  const matchingThemes = fq ? themesSorted.filter((th) => fold(th).includes(fq)) : themesSorted
  const articles = theme
    ? themeMap.get(theme) ?? []
    : fq
      ? index.filter((a) => fold(a.summary + ' ' + a.heading + ' ' + a.themes.join(' ')).includes(fq))
      : []
  const proches = theme ? [...(coOcc.get(theme)?.entries() ?? [])].sort((a, b) => b[1] - a[1]).slice(0, 6).map((e) => e[0]) : []

  const ThemeChip = ({ th, count }: { th: string; count?: number }) => (
    <button
      type="button"
      onClick={() => { setTheme(th); setQ('') }}
      className="inline-flex items-center gap-1.5 rounded-full border border-lank/15 bg-white px-3 py-1 text-xs text-lank/80 transition hover:border-lank/40 hover:bg-paper"
    >
      {th}{count != null && <span className="rounded-full bg-lank-50 px-1.5 text-[10px] font-semibold text-lank/55">{count}</span>}
    </button>
  )

  return (
    <details className="rounded-2xl border border-lank/10 bg-white shadow-card" open>
      <summary className="cursor-pointer list-none px-5 py-4">
        <span className="font-semibold text-lank">{t.codeIndex.title}</span>
        <span className="mt-0.5 block text-xs text-lank/55">{t.codeIndex.sub}</span>
      </summary>
      <div className="space-y-4 border-t border-lank/10 px-5 py-4">
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setTheme(null) }}
          placeholder={t.codeIndex.searchPlaceholder}
          aria-label={t.codeIndex.searchPlaceholder}
          className="w-full rounded-xl border border-lank/15 px-4 py-2 text-sm text-lank outline-none focus:border-lank/50"
        />

        {theme && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setTheme(null)} className="rounded-lg border border-lank/15 bg-white px-2.5 py-1 text-xs text-lank/70 hover:bg-paper">← {t.codeIndex.allThemes}</button>
            <span className="text-sm font-semibold text-lank">{theme}</span>
            <span className="text-xs text-lank/45">{articles.length} {t.codeIndex.articles}</span>
          </div>
        )}

        {theme && proches.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-lank/45">{t.codeIndex.relatedThemes}</p>
            <div className="flex flex-wrap gap-1.5">{proches.map((th) => <ThemeChip key={th} th={th} count={themeMap.get(th)?.length} />)}</div>
          </div>
        )}

        {/* Page des thèmes (rien de sélectionné, pas de recherche d'article) */}
        {!theme && !fq && (
          <div className="flex flex-wrap gap-1.5">{themesSorted.map((th) => <ThemeChip key={th} th={th} count={themeMap.get(th)!.length} />)}</div>
        )}
        {!theme && fq && matchingThemes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{matchingThemes.map((th) => <ThemeChip key={th} th={th} count={themeMap.get(th)!.length} />)}</div>
        )}

        {/* Articles (thème sélectionné ou recherche texte) */}
        {(theme || fq) && (
          articles.length === 0 ? (
            <p className="text-sm text-lank/45">{t.codeIndex.noResult}</p>
          ) : (
            <ul className="divide-y divide-lank/5">
              {articles.map((a) => {
                const rel = related(a)
                return (
                  <li key={a.num} className="py-2">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <a href={`#${anchorOf(a.num)}`} className="font-semibold text-lank underline decoration-lank/30 underline-offset-2 hover:decoration-lank">{t.codeIndex.articleLabel} {a.num.replace('-', ' ')}</a>
                      {a.summary && <span className="text-sm text-lank/70">{a.summary}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {a.themes.map((th) => <button key={th} type="button" onClick={() => { setTheme(th); setQ('') }} className="rounded bg-lank-50 px-1.5 py-0.5 text-[10px] text-lank/55 hover:bg-lank-100">{th}</button>)}
                      {rel.length > 0 && (
                        <span className="text-[11px] text-lank/45">
                          ↔ {t.codeIndex.related} : {rel.map((b, i) => <span key={b.num}>{i > 0 && ', '}<a href={`#${anchorOf(b.num)}`} className="text-lagon-700 hover:underline">{b.num.replace('-', ' ')}</a></span>)}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        )}
      </div>
    </details>
  )
}
