'use client'

import { useState } from 'react'

/**
 * Feuille de résultats mobile : réduite / mi-ouverte / entièrement ouverte.
 * Le contenu (rendu serveur) reste dans le flux du document — pas de piège de
 * focus, pas de superposition qui masquerait la carte définitivement.
 */
export function MobileResultsSheet({
  label, defaultOpen, children,
}: { label: string; defaultOpen: boolean; children: React.ReactNode }) {
  const [state, setState] = useState<'reduced' | 'half' | 'full'>(defaultOpen ? 'half' : 'reduced')
  const next = state === 'reduced' ? 'half' : state === 'half' ? 'full' : 'reduced'
  const maxH = state === 'reduced' ? 'max-h-0' : state === 'half' ? 'max-h-[45vh]' : 'max-h-none'
  return (
    <section aria-label={label} className="rounded-2xl border border-chabon/10 bg-white">
      <button
        type="button"
        aria-expanded={state !== 'reduced'}
        onClick={() => setState(next)}
        className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-ank"
      >
        {label}
        <span aria-hidden="true" className="text-ank/80">{state === 'reduced' ? '▲' : state === 'half' ? '⬍' : '▼'}</span>
      </button>
      <div className={`overflow-y-auto px-4 transition-all ${maxH} ${state === 'reduced' ? '' : 'pb-4'}`}>{children}</div>
    </section>
  )
}
