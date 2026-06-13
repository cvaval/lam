'use client'

import { useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { postJson } from '@/lib/http'

export function FavoriteButton({
  documentId,
  initial,
  t,
}: {
  documentId: string
  initial: boolean
  t: Dictionary
}) {
  const [on, setOn] = useState(initial)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    const next = !on
    setOn(next)
    const res = await postJson('/api/favorite', { documentId, on: next })
    if (!res.ok) setOn(!next)
    setBusy(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
        on ? 'border-sitwon-600 bg-sitwon-50 text-lank' : 'border-lank/15 bg-white text-lank/70 hover:border-lank/40'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M12 21s-7-4.35-9.5-8.5C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 7C19 16.65 12 21 12 21z" />
      </svg>
      {on ? t.doc.removeFavorite : t.doc.addFavorite}
    </button>
  )
}
