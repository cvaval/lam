'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/types'

interface Edition {
  id: string
  title: string
  number: string
  dateISO: string | null
  special: boolean
}
interface Month {
  idx: number
  editions: Edition[]
}

const MONTHS: Record<Locale, string[]> = {
  fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ht: ['Janvye', 'Fevriye', 'Mas', 'Avril', 'Me', 'Jen', 'Jiyè', 'Out', 'Septanm', 'Oktòb', 'Novanm', 'Desanm'],
}
const LBL = {
  back: { fr: '← Toutes les années', en: '← All years', ht: '← Tout ane yo' },
  editions: { fr: 'éditions', en: 'editions', ht: 'edisyon' },
  special: { fr: 'Spécial', en: 'Special', ht: 'Espesyal' },
} as const

// Navigation Législation : mois pliables → numéros (éditions) cliquables vers le document.
export function LegislationYearView({ locale, year, months }: { locale: Locale; year: number; months: Month[] }) {
  // Premier mois ouvert par défaut pour montrer le contenu d'emblée.
  const [open, setOpen] = useState<number | null>(months.length ? months[0].idx : null)

  return (
    <div className="space-y-5">
      <div className="border-l-4 border-lank pl-4">
        <Link href={`/${locale}/legislation`} className="text-xs font-medium text-endeks-700 hover:underline">
          {LBL.back[locale]}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-lank">Le Moniteur — {year}</h1>
      </div>

      <div className="space-y-2">
        {months.map((m) => {
          const isOpen = open === m.idx
          return (
            <div key={m.idx} className="overflow-hidden rounded-xl border border-lank/10 bg-white shadow-card">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : m.idx)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-paper"
              >
                <span className="font-semibold text-lank">{MONTHS[locale][m.idx]}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-lank/50">
                    {m.editions.length} {LBL.editions[locale]}
                  </span>
                  <span className={`text-lank/40 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                </span>
              </button>

              {isOpen && (
                <ul className="divide-y divide-lank/5 border-t border-lank/10">
                  {m.editions.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/${locale}/doc/${e.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition hover:bg-paper"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {e.special && (
                            <span className="shrink-0 rounded bg-soley px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lank">
                              {LBL.special[locale]}
                            </span>
                          )}
                          <span className="truncate text-lank">{e.title}</span>
                        </span>
                        {e.dateISO && <span className="shrink-0 text-xs text-lank/40">{e.dateISO}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
