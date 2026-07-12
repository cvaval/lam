'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/types'
import type { ConnexeBlock } from '@/lib/legislation/annotated'

const LBL = {
  title: {
    fr: 'Ancienne version & législation connexe',
    en: 'Former version & related legislation',
    ht: 'Ansyen vèsyon & lejislasyon ki gen rapò',
  },
  old: { fr: 'Ancienne version', en: 'Former version', ht: 'Ansyen vèsyon' },
  show: { fr: 'afficher', en: 'show', ht: 'montre' },
  hide: { fr: 'masquer', en: 'hide', ht: 'kache' },
} as const

/**
 * Pliable « Ancienne version & législation connexe » sous un article (Code civil) : ancienne
 * version de l'article quand elle existe (les amendements prévalent dans le texte principal)
 * + décrets/lois intégrés qui le modifient ou s'y rattachent. Fermé par défaut, petits
 * caractères — même patron visuel qu'OldVersion (Constitution).
 */
export function RelatedLaw({ old, blocks = [], locale }: { old?: string; blocks?: ConnexeBlock[]; locale: Locale }) {
  const [open, setOpen] = useState(false)
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr
  const count = blocks.length + (old ? 1 : 0)
  if (!count) return null
  return (
    <div className="mt-2.5 overflow-hidden rounded-lg border border-lagon-600/30 bg-lagon-50/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs transition hover:bg-lagon-50"
      >
        <span aria-hidden className="select-none text-lagon-700">{open ? '▾' : '▸'}</span>
        <span className="font-semibold text-lank">{lt(LBL.title)}</span>
        <span className="rounded-full bg-lagon-600/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-lagon-700">{count}</span>
        <span className="ml-auto text-[11px] font-medium text-lagon-700">{open ? lt(LBL.hide) : lt(LBL.show)}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-lagon-600/20 bg-white/60 px-4 py-3">
          {old && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-lagon-700">{lt(LBL.old)}</p>
              <p className="mt-1 whitespace-pre-wrap text-[11.5px] italic leading-relaxed text-lank/60">{old}</p>
            </div>
          )}
          {blocks.map((b, i) => (
            <div key={i}>
              {b.label &&
                (b.docId ? (
                  // Décret/loi modificateur téléversé → intitulé cliquable vers sa fiche.
                  <Link href={`/${locale}/doc/${b.docId}`} className="text-[11.5px] font-semibold leading-snug text-lagon-700 underline decoration-lagon-600/40 underline-offset-2 hover:decoration-lagon-600">
                    {b.label}
                  </Link>
                ) : (
                  <p className="text-[11.5px] font-semibold leading-snug text-lank/80">{b.label}</p>
                ))}
              <p className="mt-1 whitespace-pre-wrap text-[11.5px] leading-relaxed text-lank/60">{b.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
