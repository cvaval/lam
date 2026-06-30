'use client'

import { useState } from 'react'
import type { Locale } from '@/lib/types'
import type { JurisCase } from '@/lib/legislation/annotated'

const LBL = {
  juris: { fr: 'Jurisprudence', en: 'Case law', ht: 'Jurisprudans' },
  show: { fr: 'voir les décisions', en: 'show decisions', ht: 'wè desizyon yo' },
  hide: { fr: 'masquer', en: 'hide', ht: 'kache' },
} as const

/**
 * Bloc de jurisprudence rattaché à un article — repliable, fermé par défaut (« on l'ouvre
 * au besoin »). Annotations éditoriales (J.-F. Salès), distinctes du texte officiel.
 */
export function Jurisprudence({ cases, locale }: { cases: JurisCase[]; locale: Locale }) {
  const [open, setOpen] = useState(false)
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr
  return (
    <div className="my-2.5 overflow-hidden rounded-lg border border-lagon/30 bg-lagon-50/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-lagon-800 transition hover:bg-lagon-50"
      >
        <span aria-hidden className="select-none text-lagon-700">
          {open ? '▾' : '▸'}
        </span>
        <span className="uppercase tracking-wide">{lt(LBL.juris)}</span>
        <span className="rounded-full bg-lagon/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-lagon-800">
          {cases.length}
        </span>
        <span className="ml-auto text-[11px] font-normal text-lagon-700/70">{open ? lt(LBL.hide) : lt(LBL.show)}</span>
      </button>
      {open && (
        <ol className="space-y-2.5 border-t border-lagon/20 px-4 py-3">
          {cases.map((c, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="min-w-[1.5ch] shrink-0 font-semibold tabular-nums text-lagon-700/70">{i + 1}.</span>
              <div>
                <p className="font-medium text-lank">{c.ref}</p>
                {c.excerpt && <p className="mt-0.5 leading-relaxed text-lank/75">{c.excerpt}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
