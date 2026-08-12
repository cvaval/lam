'use client'

import { useState } from 'react'
import type { Locale } from '@/lib/types'
import type { JurisCase } from '@/lib/legislation/annotated'
import { CodeRefText, type CodeHrefs } from './CodeRefText'

const LBL = {
  juris: { fr: 'Jurisprudence', en: 'Case law', ht: 'Jurisprudans' },
  annotations: { fr: 'Annotations', en: 'Annotations', ht: 'Anotasyon' },
  comments: { fr: 'Commentaires', en: 'Commentary', ht: 'Kòmantè' },
  jurisSub: { fr: 'Jurisprudence', en: 'Case law', ht: 'Jurisprudans' },
  show: { fr: 'Afficher', en: 'Show', ht: 'Montre' },
  hide: { fr: 'Masquer', en: 'Hide', ht: 'Kache' },
} as const

/**
 * Bloc d'annotations rattaché à un article — carte repliable bien visible, fermée par
 * défaut (« on l'ouvre au besoin »). Deux variantes :
 *  - « Jurisprudence » (Code du travail) : notes d'arrêts seules ;
 *  - « Annotations » (Code civil) : commentaires doctrinaux de l'auteur + jurisprudence.
 * Annotations éditoriales, distinctes du texte officiel ; couleur lagon de la marque.
 */
export function Jurisprudence({
  cases,
  comments,
  variant = 'juris',
  locale,
  codeHrefs,
}: {
  cases: JurisCase[]
  comments?: string[]
  variant?: 'juris' | 'annotations'
  locale: Locale
  /** Code civil : les notes citent « C. p. c. 949 » — lien vers le Code de procédure civile. */
  codeHrefs?: CodeHrefs
}) {
  const [open, setOpen] = useState(false)
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr
  const count = cases.length + (comments?.length ?? 0)
  if (!count) return null
  return (
    <div data-nocopy className="mt-3 overflow-hidden rounded-xl border border-chabon/30 bg-gradient-to-br from-chabon/70 to-chabon/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-pil"
      >
        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-chabon/15 text-base text-chabon">
          ⚖
        </span>
        <span className="text-sm font-bold text-ank">{lt(variant === 'annotations' ? LBL.annotations : LBL.juris)}</span>
        <span className="rounded-full bg-chabon px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">{count}</span>
        <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-chabon">
          {open ? lt(LBL.hide) : lt(LBL.show)}
          <span aria-hidden className="text-sm leading-none">{open ? '▴' : '▾'}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-chabon/20 bg-white/60 px-4 py-3.5">
          {comments && comments.length > 0 && (
            <div className="mb-3">
              {cases.length > 0 && (
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-chabon">{lt(LBL.comments)}</p>
              )}
              <ul className="space-y-2">
                {comments.map((c, i) => (
                  <li key={i} className="relative pl-6 text-[13px] italic leading-relaxed text-grafit">
                    <span aria-hidden className="absolute left-0 top-0 text-chabon">✎</span>
                    <CodeRefText text={c} codeHrefs={codeHrefs} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cases.length > 0 && (
            <>
              {comments && comments.length > 0 && (
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-chabon">{lt(LBL.jurisSub)}</p>
              )}
              <ol className="space-y-3">
                {cases.map((c, i) => (
                  <li key={i} className="relative pl-8">
                    <span
                      aria-hidden
                      className="absolute left-0 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-chabon/15 text-[10px] font-bold tabular-nums text-chabon"
                    >
                      {i + 1}
                    </span>
                    {c.ref ? (
                      <>
                        <p className="text-sm font-semibold leading-snug text-ank"><CodeRefText text={c.ref} codeHrefs={codeHrefs} /></p>
                        {c.excerpt && <p className="mt-1 text-[13px] leading-relaxed text-grafit"><CodeRefText text={c.excerpt} codeHrefs={codeHrefs} /></p>}
                      </>
                    ) : (
                      // Note sans intitulé distinct (Code civil) : l'extrait EST la note.
                      <p className="text-[13px] leading-relaxed text-ank/80"><CodeRefText text={c.excerpt ?? ''} codeHrefs={codeHrefs} /></p>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  )
}
