'use client'

import { useState } from 'react'
import type { Locale } from '@/lib/types'
import type { JurisCase } from '@/lib/legislation/annotated'

const LBL = {
  juris: { fr: 'Jurisprudence', en: 'Case law', ht: 'Jurisprudans' },
  show: { fr: 'Afficher les décisions', en: 'Show decisions', ht: 'Montre desizyon yo' },
  hide: { fr: 'Masquer', en: 'Hide', ht: 'Kache' },
} as const

/**
 * Bloc de jurisprudence rattaché à un article — carte repliable bien visible, fermée par
 * défaut (« on l'ouvre au besoin »). Annotations éditoriales (J.-F. Salès), distinctes du
 * texte officiel ; couleur lagon (turquoise) de la marque.
 */
export function Jurisprudence({ cases, locale }: { cases: JurisCase[]; locale: Locale }) {
  const [open, setOpen] = useState(false)
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-lagon-600/30 bg-gradient-to-br from-lagon-50/70 to-lagon-50/20 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-lagon-50"
      >
        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lagon-600/15 text-base text-lagon-700">
          ⚖
        </span>
        <span className="text-sm font-bold text-lank">{lt(LBL.juris)}</span>
        <span className="rounded-full bg-lagon-600 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">{cases.length}</span>
        <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-lagon-700">
          {open ? lt(LBL.hide) : lt(LBL.show)}
          <span aria-hidden className="text-sm leading-none">{open ? '▴' : '▾'}</span>
        </span>
      </button>
      {open && (
        <ol className="space-y-3 border-t border-lagon-600/20 bg-white/60 px-4 py-3.5">
          {cases.map((c, i) => (
            <li key={i} className="relative pl-8">
              <span
                aria-hidden
                className="absolute left-0 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-lagon-600/15 text-[10px] font-bold tabular-nums text-lagon-700"
              >
                {i + 1}
              </span>
              <p className="text-sm font-semibold leading-snug text-lank">{c.ref}</p>
              {c.excerpt && <p className="mt-1 text-[13px] leading-relaxed text-lank/70">{c.excerpt}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
