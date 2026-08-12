'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/types'
import type { ConnexeBlock } from '@/lib/legislation/annotated'
import { CodeRefText, type CodeHrefs } from './CodeRefText'

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
export function RelatedLaw({ old, blocks = [], locale, codeHrefs }: { old?: string; blocks?: ConnexeBlock[]; locale: Locale; codeHrefs?: CodeHrefs }) {
  const [open, setOpen] = useState(false)
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr
  const count = blocks.length + (old ? 1 : 0)
  if (!count) return null
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
        <span className="rounded-full bg-chabon/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-chabon">{count}</span>
        <span className="ml-auto text-[11px] font-medium text-chabon">{open ? lt(LBL.hide) : lt(LBL.show)}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-chabon/20 bg-white/60 px-4 py-3">
          {old && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-chabon">{lt(LBL.old)}</p>
              <p className="mt-1 whitespace-pre-wrap text-[11.5px] italic leading-relaxed text-grafit"><CodeRefText text={old} codeHrefs={codeHrefs} /></p>
            </div>
          )}
          {blocks.map((b, i) => (
            <div key={i}>
              {b.label &&
                (b.docId ? (
                  // Décret/loi modificateur téléversé → intitulé cliquable vers sa fiche
                  // (ancre optionnelle : ex. « Constitution de 1987 » → article 35).
                  <Link href={`/${locale}/doc/${b.docId}${b.anchor ? `#${b.anchor}` : ''}`} className="text-[11.5px] font-semibold leading-snug text-chabon underline decoration-chabon/40 underline-offset-2 hover:decoration-chabon">
                    {b.label}
                  </Link>
                ) : (
                  <p className="text-[11.5px] font-semibold leading-snug text-ank/80">
                    <CodeRefText text={b.label} codeHrefs={codeHrefs} />
                  </p>
                ))}
              {/* Le contenu d'un texte connexe cite les codes comme n'importe quelle
                  disposition (« - C. civ., 1728 »). Il était rendu BRUT, alors que
                  l'ancienne version juste au-dessus et tout le pliable des annotations
                  passent par le linkificateur : le même renvoi était cliquable au corps et
                  mort dans le pliable. */}
              <p className="mt-1 whitespace-pre-wrap text-[11.5px] leading-relaxed text-grafit">
                <CodeRefText text={b.text} codeHrefs={codeHrefs} />
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
