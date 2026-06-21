'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/lib/types'

// Historique des recherches : stocké côté CLIENT uniquement (localStorage), JAMAIS
// envoyé au serveur — les termes de recherche juridiques sont sensibles (un cookie
// partirait dans l'en-tête de chaque requête, et tomberait sous le bandeau de
// consentement). Liste « plus récent d'abord », dédupliquée, plafonnée.
const HISTORY_KEY = 'lv:searchHistory'
const MAX_HISTORY = 8
const MAX_TERM = 80

function loadHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string').slice(0, MAX_HISTORY) : []
  } catch {
    return []
  }
}
function saveHistory(list: string[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)))
  } catch {
    /* stockage indisponible */
  }
}

const LBL = {
  search: { fr: 'Rechercher', en: 'Search', ht: 'Chèche' },
  recent: { fr: 'Recherches récentes', en: 'Recent searches', ht: 'Dènye rechèch yo' },
  clearAll: { fr: "Effacer l'historique", en: 'Clear history', ht: 'Efase istwa a' },
  remove: { fr: 'Retirer', en: 'Remove', ht: 'Retire' },
  clearInput: { fr: 'Effacer la recherche', en: 'Clear search', ht: 'Efase rechèch la' },
} as const

export function SearchBox({
  locale,
  placeholder,
  size = 'md',
  initial = '',
}: {
  locale: Locale
  placeholder: string
  size?: 'md' | 'lg'
  /** valeur pré-remplie (ex. la requête courante sur la page de résultats) */
  initial?: string
}) {
  const router = useRouter()
  const [q, setQ] = useState(initial)
  const [history, setHistory] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1) // index surligné au clavier
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  // Fermer le menu au clic en dehors.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Suggestions = historique filtré par la saisie (ou tout l'historique si vide).
  const term = q.trim().toLowerCase()
  const suggestions = (term
    ? history.filter((h) => h.toLowerCase().includes(term) && h.toLowerCase() !== term)
    : history
  ).slice(0, MAX_HISTORY)

  function run(raw: string) {
    const value = raw.trim().slice(0, MAX_TERM)
    if (!value) return
    const next = [value, ...history.filter((h) => h.toLowerCase() !== value.toLowerCase())].slice(0, MAX_HISTORY)
    setHistory(next)
    saveHistory(next)
    setOpen(false)
    setActive(-1)
    router.push(`/${locale}/search?q=${encodeURIComponent(value.slice(0, 300))}`)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    run(active >= 0 && suggestions[active] ? suggestions[active] : q)
  }

  function removeItem(t: string) {
    const next = history.filter((h) => h !== t)
    setHistory(next)
    saveHistory(next)
    setActive(-1)
    inputRef.current?.focus()
  }
  function clearHistory() {
    setHistory([])
    saveHistory([])
    setOpen(false)
    inputRef.current?.focus()
  }
  function clearInput() {
    setQ('')
    setActive(-1)
    inputRef.current?.focus()
    if (history.length) setOpen(true)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); setActive(-1); return }
    if (!open || !suggestions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)) }
  }

  const big = size === 'lg'
  const searchLabel = LBL.search[locale] ?? LBL.search.fr
  const showMenu = open && suggestions.length > 0

  return (
    <form onSubmit={submit} className="flex w-full items-center gap-2" role="search">
      <div ref={boxRef} className="relative flex-1">
        <svg
          viewBox="0 0 24 24"
          className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lank/35 ${big ? 'h-5 w-5' : 'h-4 w-4'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(-1); if (history.length) setOpen(true) }}
          onFocus={() => { if (history.length) setOpen(true) }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={showMenu}
          aria-autocomplete="list"
          aria-controls="lv-search-history"
          autoComplete="off"
          className={`w-full rounded-full border border-lank/15 bg-white pl-10 text-lank shadow-card outline-none focus:border-sitwon ${
            big ? 'py-3.5 pr-12 text-base' : 'py-2 pr-10 text-sm'
          }`}
        />
        {q && (
          <button
            type="button"
            onClick={clearInput}
            aria-label={LBL.clearInput[locale] ?? LBL.clearInput.fr}
            className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full text-lank/40 transition hover:bg-lank/5 hover:text-lank ${
              big ? 'h-7 w-7' : 'h-5 w-5'
            }`}
          >
            <svg viewBox="0 0 24 24" className={big ? 'h-4 w-4' : 'h-3.5 w-3.5'} fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {/* Menu « Recherches récentes » (historique local). */}
        {showMenu && (
          <div
            id="lv-search-history"
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-lank/10 bg-white py-1 shadow-xl"
          >
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-lank/40">{LBL.recent[locale] ?? LBL.recent.fr}</span>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); clearHistory() }} className="text-[11px] font-medium text-endeks-700 hover:underline">
                {LBL.clearAll[locale] ?? LBL.clearAll.fr}
              </button>
            </div>
            {suggestions.map((s, i) => (
              <div
                key={s}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); run(s) }}
                className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm ${i === active ? 'bg-paper' : 'hover:bg-paper'}`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-lank/30" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="flex-1 truncate text-lank/80">{s}</span>
                <button
                  type="button"
                  aria-label={`${LBL.remove[locale] ?? LBL.remove.fr} « ${s} »`}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); removeItem(s) }}
                  className="shrink-0 rounded-full p-1 text-lank/30 transition hover:bg-lank/5 hover:text-lank"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bouton « Rechercher » explicite (clic) — en plus de la touche Entrée. Libellé
          visible sur la grande barre (tableau de bord) ; icône seule dans la barre du haut. */}
      <button
        type="submit"
        aria-label={searchLabel}
        title={searchLabel}
        className={`flex shrink-0 items-center justify-center gap-2 rounded-full bg-lank font-semibold text-white shadow-card transition hover:bg-lank-600 ${
          big ? 'px-5 py-3.5 text-base' : 'px-3.5 py-2 text-sm'
        }`}
      >
        <svg viewBox="0 0 24 24" className={big ? 'h-5 w-5' : 'h-4 w-4'} fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
        {big && <span>{searchLabel}</span>}
      </button>
    </form>
  )
}
