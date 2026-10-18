'use client'

import { useState } from 'react'
import type { Locale } from '@/lib/types'
import { classes } from '@/lib/legislation/situations'

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
    <section className="mt-6 rounded-2xl border border-chabon/10 bg-white p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ank">{LBL.title[locale]}</h2>
        <button
          type="button"
          onClick={() => setOpen(allOpen ? new Set() : new Set(items.map((i) => i.anchor)))}
          className="text-xs text-grafit hover:underline"
        >
          {allOpen ? LBL.hideAll[locale] : LBL.showAll[locale]}
        </button>
      </div>
      <p className="mb-3 text-xs text-ank/80">{LBL.intro[locale]}</p>
      <ul className="space-y-2">
        {items.map((it) => (
          // ⚠️ PAS DE PASTILLE ICI (registre des situations, 17 oct. 2026). L'état se dit en tête
          // d'article — pastille « Amendé » / « Abrogé » et, pour l'abrogé, la ligne « [Abrogé — acte] »
          // du corps ; l'historique porte le TEXTE d'avant, sa ligne datée le dit en toutes lettres, et
          // le filet de gauche reprend la gamme de l'état (ocre amendé, bordeaux abrogé). Une pastille
          // de plus faisait le troisième signal des 80 articles abrogés.
          <li
            key={it.anchor}
            id={`hist-${it.anchor}`}
            className={`scroll-mt-24 rounded-r-lg border border-l-[3px] border-chabon/10 p-3 ${classes(it.abrogated ? 'abroge' : 'amende').barre}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ank">{it.label}</span>
              <span className="text-xs text-ank/80">{it.statusLine}</span>
              {it.history.length > 0 && (
                <button type="button" onClick={() => toggle(it.anchor)} className="ml-auto text-xs font-medium text-chabon hover:underline">
                  {open.has(it.anchor) ? LBL.hideOld[locale] : LBL.showOld[locale]}
                </button>
              )}
            </div>
            {open.has(it.anchor) &&
              it.history.map((h, i) => (
                <div key={i} className={`mt-2 border-l-[3px] pl-3 ${classes(it.abrogated ? 'texte_abroge' : 'ancienne_redaction').barre}`}>
                  <p className="text-xs font-medium text-ank/80">{h.heading}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-ank/80">{h.body}</p>
                </div>
              ))}
          </li>
        ))}
      </ul>
    </section>
  )
}
