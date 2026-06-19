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

interface Sommaire {
  source: 'text' | 'index' | 'excerpt' | 'none'
  text?: string | null
  items?: { title: string; category: string | null }[]
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
  sommaire: { fr: 'Sommaire de l’édition', en: 'Edition summary', ht: 'Somè edisyon an' },
  loading: { fr: 'Chargement…', en: 'Loading…', ht: 'Chajman…' },
  fullText: { fr: 'Lire le texte intégral', en: 'Read full text', ht: 'Li tèks konplè a' },
  none: { fr: 'Sommaire non disponible pour cette édition.', en: 'No summary available for this edition.', ht: 'Pa gen somè pou edisyon sa a.' },
} as const

/** Aperçu (sommaire) d'une édition — texte verbatim, liste d'index, ou extrait. */
function SommairePreview({ som, locale }: { som: Sommaire; locale: Locale }) {
  if (som.source === 'none') return <p className="text-sm text-lank/40">{LBL.none[locale]}</p>
  if (som.source === 'index' && som.items?.length) {
    return (
      <ul className="space-y-1">
        {som.items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm text-lank/75">
            {it.category && (
              <span className="mt-0.5 shrink-0 rounded bg-lank-50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-lank/50">{it.category}</span>
            )}
            <span>{it.title}</span>
          </li>
        ))}
      </ul>
    )
  }
  return <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-lank/80">{som.text}</pre>
}

// Navigation Législation : mois pliables → numéros (éditions). Au clic sur un numéro :
// aperçu du sommaire de l'édition + bouton « texte intégral ».
export function LegislationYearView({ locale, year, months }: { locale: Locale; year: number; months: Month[] }) {
  const [open, setOpen] = useState<number | null>(months.length ? months[0].idx : null)
  const [preview, setPreview] = useState<string | null>(null) // id de l'édition prévisualisée
  const [cache, setCache] = useState<Record<string, Sommaire>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function togglePreview(id: string) {
    if (preview === id) { setPreview(null); return }
    setPreview(id)
    if (!cache[id]) {
      setLoadingId(id)
      try {
        const res = await fetch(`/api/doc/${id}/sommaire`)
        const data = res.ok ? await res.json() : null
        setCache((c) => ({ ...c, [id]: data?.ok ? data : { source: 'none' } }))
      } catch {
        setCache((c) => ({ ...c, [id]: { source: 'none' } }))
      } finally {
        setLoadingId(null)
      }
    }
  }

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
                  {m.editions.map((e) => {
                    const isPrev = preview === e.id
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => togglePreview(e.id)}
                          aria-expanded={isPrev}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-paper"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {e.special && (
                              <span className="shrink-0 rounded bg-soley px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lank">
                                {LBL.special[locale]}
                              </span>
                            )}
                            <span className="truncate text-lank">{e.title}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            {e.dateISO && <span className="text-xs text-lank/40">{e.dateISO}</span>}
                            <span className={`text-lank/40 transition-transform ${isPrev ? 'rotate-90' : ''}`}>›</span>
                          </span>
                        </button>

                        {isPrev && (
                          <div className="border-t border-lank/10 bg-paper/40 px-4 py-3">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-lank/45">{LBL.sommaire[locale]}</p>
                            {loadingId === e.id || !cache[e.id] ? (
                              <p className="text-sm text-lank/40">{LBL.loading[locale]}</p>
                            ) : (
                              <SommairePreview som={cache[e.id]} locale={locale} />
                            )}
                            <Link
                              href={`/${locale}/doc/${e.id}`}
                              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-lank px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-lank-600"
                            >
                              {LBL.fullText[locale]} →
                            </Link>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
