'use client'

import { useMemo, useState } from 'react'
import { fold } from '@/lib/search/normalize'
import type { Locale } from '@/lib/types'
import type { IndexEntry } from '@/lib/legislation/annotated'

const LBL = {
  title: { fr: 'Index alphabétique des matières', en: 'Alphabetical subject index', ht: 'Endèks alfabetik matyè yo' },
  hint: { fr: 'du sujet à l’article', en: 'from subject to article', ht: 'sijè → atik' },
  filter: { fr: 'Filtrer un sujet…', en: 'Filter a subject…', ht: 'Filtre yon sijè…' },
  none: { fr: 'Aucun sujet ne correspond.', en: 'No matching subject.', ht: 'Pa gen sijè ki koresponn.' },
  art: { fr: 'art.', en: 'art.', ht: 'atik' },
  count: { fr: 'sujets', en: 'subjects', ht: 'sijè' },
} as const

/**
 * Index alphabétique des matières (INDEX ALPHABÉTIQUE DES MATIÈRES) en outil de renvois :
 * repliable, filtrable, groupé par initiale ; chaque sujet pointe vers ses articles du Code
 * (#art-N). Données dans annotationsJson.indexEntries.
 */
export function IndexAlphabetique({ entries, locale }: { entries: IndexEntry[]; locale: Locale }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr

  // Pré-calcule la forme folée une seule fois (pas à chaque frappe).
  const folded = useMemo(() => entries.map((e) => ({ e, f: fold(e.subject) })), [entries])
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
  const shown = groups.reduce((n, [, list]) => n + list.length, 0)

  return (
    <div className="mb-4 rounded-xl border border-lank/10 bg-paper/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <span aria-hidden className="select-none text-lank/50">
          {open ? '▾' : '▸'}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-lank/70">{lt(LBL.title)}</span>
        <span className="rounded-full bg-lank/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-lank/60">{entries.length}</span>
        <span className="ml-auto text-[11px] text-lank/40">{lt(LBL.hint)}</span>
      </button>

      {open && (
        <div className="border-t border-lank/10 px-3 py-2.5">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={lt(LBL.filter)}
            className="mb-2 w-full rounded-lg border border-lank/15 bg-white px-3 py-1.5 text-sm text-lank outline-none focus:border-sitwon"
          />
          {shown === 0 ? (
            <p className="px-1 py-2 text-xs text-lank/50">{lt(LBL.none)}</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto pr-1">
              {groups.map(([letter, list]) => (
                <section key={letter} className="mb-2">
                  <h4 className="sticky top-0 bg-paper/95 py-1 text-xs font-bold uppercase tracking-wider text-sitwon-700">{letter}</h4>
                  <ul className="space-y-1">
                    {list.map((e) => (
                      <li key={`${e.subject}#${e.ctRefs.join(',')}`} className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
                        <span className="text-lank/85">{e.subject}</span>
                        <span className="text-lank/40">{lt(LBL.art)}</span>
                        {e.ctRefs.map((n, k) => (
                          <span key={`${n}-${k}`}>
                            <a href={`#art-${n}`} className="font-medium text-sitwon-700 hover:underline">
                              {n}
                            </a>
                            {k < e.ctRefs.length - 1 && <span className="text-lank/30"> ·</span>}
                          </span>
                        ))}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
