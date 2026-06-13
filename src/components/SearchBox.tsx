'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/lib/types'

const LAST_KEY = 'lv:lastSearch'

export function SearchBox({
  locale,
  placeholder,
  size = 'md',
  initial = '',
  remember = false,
}: {
  locale: Locale
  placeholder: string
  size?: 'md' | 'lg'
  initial?: string
  /** mémorise/restaure la dernière recherche soumise (localStorage) */
  remember?: boolean
}) {
  const router = useRouter()
  const [q, setQ] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)

  // Mémoire de la recherche précédente : restaure si le champ est vide.
  useEffect(() => {
    if (remember && !initial) {
      try {
        const last = window.localStorage.getItem(LAST_KEY)
        if (last) setQ(last)
      } catch {
        /* stockage indisponible */
      }
    }
  }, [remember, initial])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = q.trim()
    if (!value) return
    try {
      window.localStorage.setItem(LAST_KEY, value)
    } catch {
      /* ignore */
    }
    router.push(`/${locale}/search?q=${encodeURIComponent(value)}`)
  }

  function clear() {
    setQ('')
    inputRef.current?.focus()
  }

  const big = size === 'lg'
  return (
    <form onSubmit={submit} className="relative w-full">
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
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-full border border-lank/15 bg-white pl-10 text-lank shadow-card outline-none focus:border-sitwon ${
          big ? 'py-3.5 pr-12 text-base' : 'py-2 pr-10 text-sm'
        }`}
      />
      {q && (
        <button
          type="button"
          onClick={clear}
          aria-label="Effacer la recherche"
          className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full text-lank/40 transition hover:bg-lank/5 hover:text-lank ${
            big ? 'h-7 w-7' : 'h-5 w-5'
          }`}
        >
          <svg viewBox="0 0 24 24" className={big ? 'h-4 w-4' : 'h-3.5 w-3.5'} fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </form>
  )
}
