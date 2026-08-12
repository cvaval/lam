'use client'

import { useState } from 'react'
import type { Locale } from '@/lib/types'
import { CodeRefText, type CodeHrefs } from './CodeRefText'

const LBL = {
  title: { fr: 'Ancienne version (1987)', en: 'Former version (1987)', ht: 'Ansyen vèsyon (1987)' },
  show: { fr: 'afficher', en: 'show', ht: 'montre' },
  hide: { fr: 'masquer', en: 'hide', ht: 'kache' },
} as const

/**
 * Ancienne version (1987) d'un article amendé — repliable, fermée par défaut. La version
 * en vigueur (amendée) reste le texte principal ; celle-ci est l'ancienne, à titre historique.
 */
export function OldVersion({ text, locale, codeHrefs }: { text: string; locale: Locale; codeHrefs?: CodeHrefs }) {
  const [open, setOpen] = useState(false)
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr
  return (
    <div data-nocopy className="mt-2.5 overflow-hidden rounded-lg border border-chabon/30 bg-pil/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs transition hover:bg-pil"
      >
        <span aria-hidden className="select-none text-chabon">{open ? '▾' : '▸'}</span>
        <span className="font-semibold text-ank">{lt(LBL.title)}</span>
        <span className="ml-auto text-[11px] font-medium text-chabon">{open ? lt(LBL.hide) : lt(LBL.show)}</span>
      </button>
      {open && (
        <p className="whitespace-pre-wrap border-t border-chabon/20 bg-white/60 px-4 py-2.5 text-[11.5px] italic leading-relaxed text-grafit">
          <CodeRefText text={text} codeHrefs={codeHrefs} />
        </p>
      )}
    </div>
  )
}
