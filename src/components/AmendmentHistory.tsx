'use client'

import { useState } from 'react'
import type { Locale } from '@/lib/types'

export interface HistEntry {
  heading: string // ex. « Version d'origine — 1ᵉʳ janvier 1980 »
  body: string // texte officiel de l'ancienne version
}
export interface AmendItem {
  anchor: string // "art-95"
  label: string // "Article 95"
  abrogated: boolean
  statusLine: string // ex. « En vigueur depuis le 5 mai 2020 (Loi du 5 mai 2020) »
  history: HistEntry[]
}

const LBL = {
  title: { fr: 'Historique des amendements', en: 'Amendment history', ht: 'Istorik amandman' },
  intro: {
    fr: "Le texte ci-dessus affiche par défaut la version EN VIGUEUR de chaque article. Dépliez pour lire l'ancienne version amendée.",
    en: 'The text above shows the IN-FORCE version of each article by default. Expand to read the previous, amended version.',
    ht: 'Tèks anwo a montre vèsyon ki AN VIGÈ pou chak atik pa defo. Louvri pou li ansyen vèsyon an.',
  },
  showAll: { fr: 'Tout déplier', en: 'Expand all', ht: 'Louvri tout' },
  hideAll: { fr: 'Tout replier', en: 'Collapse all', ht: 'Fèmen tout' },
  showOld: { fr: '▸ Voir l’ancienne version', en: '▸ Show previous version', ht: '▸ Wè ansyen vèsyon' },
  hideOld: { fr: '▾ Masquer l’ancienne version', en: '▾ Hide previous version', ht: '▾ Kache ansyen vèsyon' },
  abrogated: { fr: 'Abrogé', en: 'Repealed', ht: 'Abwoje' },
} as const

export function AmendmentHistory({ items, locale }: { items: AmendItem[]; locale: Locale }) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (a: string) => {
    const n = new Set(open)
    if (n.has(a)) n.delete(a)
    else n.add(a)
    setOpen(n)
  }
  const allOpen = items.length > 0 && open.size === items.length

  return (
    <section className="mt-6 rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-lank">{LBL.title[locale]}</h2>
        <button
          type="button"
          onClick={() => setOpen(allOpen ? new Set() : new Set(items.map((i) => i.anchor)))}
          className="text-xs text-lank/60 hover:underline"
        >
          {allOpen ? LBL.hideAll[locale] : LBL.showAll[locale]}
        </button>
      </div>
      <p className="mb-3 text-xs text-lank/50">{LBL.intro[locale]}</p>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.anchor} id={`hist-${it.anchor}`} className="scroll-mt-24 rounded-lg border border-lank/10 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-lank">{it.label}</span>
              {it.abrogated && <span className="rounded-full bg-red-50 px-1.5 text-[11px] text-red-700">{LBL.abrogated[locale]}</span>}
              <span className="text-xs text-lank/55">{it.statusLine}</span>
              {it.history.length > 0 && (
                <button type="button" onClick={() => toggle(it.anchor)} className="ml-auto text-xs font-medium text-sitwon-600 hover:underline">
                  {open.has(it.anchor) ? LBL.hideOld[locale] : LBL.showOld[locale]}
                </button>
              )}
            </div>
            {open.has(it.anchor) &&
              it.history.map((h, i) => (
                <div key={i} className="mt-2 border-l-2 border-lank/15 pl-3">
                  <p className="text-xs font-medium text-lank/50">{h.heading}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-lank/80">{h.body}</p>
                </div>
              ))}
          </li>
        ))}
      </ul>
    </section>
  )
}
