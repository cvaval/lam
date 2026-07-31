'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'

interface Suggestion {
  id: string
  name: string
  department: string
  arrondissement: string
  postalCode: string | null
}

/**
 * Recherche d'une commune — combobox ARIA complète (rôles combobox/listbox/option,
 * aria-activedescendant, annonces aria-live), clavier ↑ ↓ Entrée Échap.
 * Débouncée (200 ms), 8 suggestions au plus, AUCUN géocodeur externe.
 * Les suggestions sont rendues en TEXTE (jamais de HTML injecté).
 */
export function JudicialSearch({ locale, t, layersQs }: { locale: Locale; t: Dictionary; layersQs: string }) {
  const j = t.judicial
  const router = useRouter()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [announce, setAnnounce] = useState('')

  const fetchSuggestions = useCallback(
    (value: string) => {
      abortRef.current?.abort()
      if (value.trim().length < 2) { setItems([]); setOpen(false); return }
      const ctl = new AbortController()
      abortRef.current = ctl
      fetch(`/api/public/jurisdictions/search?q=${encodeURIComponent(value.slice(0, 80))}&limit=8`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((data: { items?: Suggestion[] }) => {
          const list = Array.isArray(data.items) ? data.items.slice(0, 8) : []
          setItems(list)
          setOpen(true)
          setActive(list.length ? 0 : -1)
          setAnnounce(list.length ? `${list.length} ${j.resultsAnnounce}` : j.noResults)
        })
        .catch(() => { /* requête annulée ou réseau — on garde l'état courant */ })
    },
    [j.noResults, j.resultsAnnounce],
  )

  useEffect(() => {
    const id = setTimeout(() => fetchSuggestions(q), 200)
    return () => clearTimeout(id)
  }, [q, fetchSuggestions])

  const select = (s: Suggestion) => {
    setOpen(false)
    setQ(s.name)
    router.push(`/${locale}/juridictions?commune=${encodeURIComponent(s.id)}${layersQs}`, { scroll: false })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !items.length) {
      if (e.key === 'ArrowDown' && items.length) { setOpen(true); e.preventDefault() }
      return
    }
    if (e.key === 'ArrowDown') { setActive((a) => (a + 1) % items.length); e.preventDefault() }
    else if (e.key === 'ArrowUp') { setActive((a) => (a - 1 + items.length) % items.length); e.preventDefault() }
    else if (e.key === 'Enter') { if (active >= 0) { select(items[active]); e.preventDefault() } }
    else if (e.key === 'Escape') { setOpen(false); e.preventDefault() }
  }

  return (
    <div className="relative w-full max-w-xl">
      <label htmlFor={`${listId}-input`} className="mb-1 block text-sm font-medium text-lank/70">
        {j.searchLabel}
      </label>
      <input
        ref={inputRef}
        id={`${listId}-input`}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${listId}-listbox`}
        aria-activedescendant={active >= 0 && open ? `${listId}-opt-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        maxLength={80}
        value={q}
        placeholder={j.searchPlaceholder}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => { if (items.length) setOpen(true) }}
        className="min-h-[44px] w-full rounded-xl border border-lank/15 bg-white px-4 py-3 text-sm text-lank shadow-card outline-none ring-sitwon focus:ring-2"
      />
      <div aria-live="polite" className="sr-only">{announce}</div>
      {open && (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          aria-label={j.searchLabel}
          className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-lank/10 bg-white py-1 shadow-lg"
        >
          {items.length === 0 ? (
            <li role="presentation" className="px-4 py-2 text-sm text-lank/50">{j.noResults}</li>
          ) : (
            items.map((s, i) => (
              <li
                key={s.id}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); select(s) }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-4 py-2 text-sm ${i === active ? 'bg-sitwon-50 text-lank' : 'text-lank/80'}`}
              >
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-xs text-lank/50">{s.department} · {s.arrondissement}</span>
                {s.postalCode && <span className="ml-2 font-mono text-xs text-lank/45">{s.postalCode}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
