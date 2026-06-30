'use client'

import { useState } from 'react'
import type { Locale } from '@/lib/types'
import type { NavGroup } from '@/lib/legislation/annotated'

const LBL = {
  toc: { fr: 'Table des matières', en: 'Table of contents', ht: 'Tab matyè' },
  hint: { fr: 'parcourir les sections', en: 'browse sections', ht: 'gade seksyon yo' },
  collapse: { fr: 'Replier', en: 'Collapse', ht: 'Fèmen' },
  expand: { fr: 'Déplier', en: 'Expand', ht: 'Louvri' },
} as const

/**
 * Table des matières repliable, fermée par défaut (« quand on ouvre le document elle est
 * collapsable pour ouvrir les sections »). Deux niveaux : groupes (livres du Code / lois
 * connexes), eux-mêmes dépliables ; chaque entrée pointe vers son ancre #sec-N.
 */
export function DocumentToc({ groups, locale }: { groups: NavGroup[]; locale: Locale }) {
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr
  const [open, setOpen] = useState(false)
  // Groupes dépliés (par défaut tous ouverts une fois la TOC ouverte).
  const [shut, setShut] = useState<Set<string>>(new Set())
  const toggleGroup = (a: string) =>
    setShut((s) => {
      const n = new Set(s)
      if (n.has(a)) n.delete(a)
      else n.add(a)
      return n
    })

  if (!groups.length) return null

  return (
    <div className="mb-4 rounded-xl border border-lank/10 bg-paper/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <span aria-hidden className="select-none text-lank/50">
          {open ? '▾' : '▸'}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-lank/70">{lt(LBL.toc)}</span>
        <span className="ml-auto text-[11px] text-lank/40">{lt(LBL.hint)}</span>
      </button>

      {open && (
        <nav className="border-t border-lank/10 px-3 py-2.5">
          <ul className="space-y-1.5">
            {groups.map((g) => {
              const groupOpen = !shut.has(g.anchor)
              return (
                <li key={g.anchor}>
                  <div className="flex items-center gap-1">
                    {g.children.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.anchor)}
                        aria-expanded={groupOpen}
                        aria-label={groupOpen ? lt(LBL.collapse) : lt(LBL.expand)}
                        className="select-none px-1 text-xs text-lank/45 hover:text-lank"
                      >
                        {groupOpen ? '▾' : '▸'}
                      </button>
                    )}
                    <a href={`#${g.anchor}`} className="text-sm font-semibold text-lank hover:text-sitwon-700 hover:underline">
                      {g.label}
                    </a>
                  </div>
                  {groupOpen && g.children.length > 0 && (
                    <ul className="ml-5 mt-1 space-y-0.5 border-l border-lank/10 pl-3">
                      {g.children.map((c) => (
                        <li key={c.anchor}>
                          <a href={`#${c.anchor}`} className="block py-0.5 text-sm text-lank/70 hover:text-sitwon-700 hover:underline">
                            {c.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </div>
  )
}
