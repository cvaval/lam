'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { DocType, Locale } from '@/lib/types'

/** Critères conservés quand on relance une requête depuis la page de résultats
 *  (section, période, statut, n°, tri, panneau ouvert) — promesse du panneau avancé. */
const KEPT_PARAMS = ['type', 'year', 'yearFrom', 'yearTo', 'status', 'num', 'sort', 'adv'] as const

// Historique des recherches : stocké côté CLIENT uniquement (localStorage), JAMAIS
// envoyé au serveur — les termes de recherche juridiques sont sensibles. Liste « plus
// récent d'abord », dédupliquée, plafonnée.
const HISTORY_KEY = 'lv:searchHistory'
const MAX_HISTORY = 8
const MAX_TERM = 80

function loadHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string').slice(0, MAX_HISTORY) : []
  } catch {
    return []
  }
}
function saveHistory(list: string[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)))
  } catch {
    /* stockage indisponible */
  }
}

// Recherches fréquentes proposées quand le champ est vide (onboarding, §07).
const THEMES: Record<Locale, string[]> = {
  fr: ['Réserves obligatoires', 'Lutte contre le blanchiment (LBC/FT)', 'Secret bancaire', 'Taux de change', 'Microfinance', 'Protection du consommateur'],
  en: ['Reserve requirements', 'Anti-money laundering (AML/CFT)', 'Banking secrecy', 'Exchange rate', 'Microfinance', 'Consumer protection'],
  ht: ['Rezèv obligatwa', 'Lit kont blanchiman (LBC/FT)', 'Sekrè bankè', 'To echanj', 'Mikwofinans', 'Pwoteksyon konsomatè'],
}

const LBL = {
  search: { fr: 'Rechercher', en: 'Search', ht: 'Chèche' },
  recent: { fr: 'Recherches récentes', en: 'Recent searches', ht: 'Dènye rechèch yo' },
  suggestions: { fr: 'Suggestions', en: 'Suggestions', ht: 'Sijesyon' },
  themes: { fr: 'Recherches fréquentes', en: 'Common searches', ht: 'Rechèch souvan' },
  open: { fr: 'Ouvrir', en: 'Open', ht: 'Ouvri' },
  clearAll: { fr: "Effacer l'historique", en: 'Clear history', ht: 'Efase istwa a' },
  remove: { fr: 'Retirer', en: 'Remove', ht: 'Retire' },
  clearInput: { fr: 'Effacer la recherche', en: 'Clear search', ht: 'Efase rechèch la' },
} as const

interface Suggestion {
  kind: 'direct' | 'doc' | 'company'
  id: string
  type?: DocType
  number?: string | null
  title: string
}

// Élément affiché/sélectionnable du menu (liste à plat pour la navigation clavier).
type Item =
  | { t: 'nav'; key: string; label: string; sub?: string; badge?: string; href: string }
  | { t: 'term'; key: string; label: string; section: 'recent' | 'theme' }

export function SearchBox({
  locale,
  placeholder,
  advancedLabel,
  size = 'md',
  initial = '',
}: {
  locale: Locale
  placeholder: string
  /** libellé « Recherche avancée » — vient du dictionnaire (t.search.advanced),
   *  même source que le panneau : les deux entrées ne peuvent pas diverger. */
  advancedLabel: string
  size?: 'md' | 'lg'
  /** valeur pré-remplie (ex. la requête courante sur la page de résultats) */
  initial?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Sur la page de résultats, cette barre EST la barre de recherche (une seule
  // par page — audit 17 juil.) : elle reflète la requête courante de l'URL.
  const onSearchPage = pathname === `/${locale}/search`
  const urlQ = onSearchPage ? searchParams?.get('q') ?? '' : null
  const [q, setQ] = useState(initial || (urlQ ?? ''))
  const [history, setHistory] = useState<string[]>([])
  const [corpus, setCorpus] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  // Navigation client vers/sur /search : resynchroniser le champ avec l'URL
  // (la barre vit dans le layout et ne se remonte pas à chaque page).
  useEffect(() => {
    if (urlQ != null) setQ(urlQ)
  }, [urlQ])

  /** URL de recherche : conserve les critères actifs quand on est déjà sur la
   *  page de résultats (sinon recherche neuve). */
  function searchUrl(extra: Record<string, string | undefined>): string {
    const params = new URLSearchParams()
    if (onSearchPage && searchParams) {
      for (const k of KEPT_PARAMS) {
        const v = searchParams.get(k)
        if (v) params.set(k, v)
      }
    }
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v)
      else params.delete(k)
    }
    return `/${locale}/search?${params.toString()}`
  }

  // Fermer au clic extérieur.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Autocomplétion depuis le corpus (débordée, annulable) — dès 2 caractères.
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setCorpus([]); return }
    const ctrl = new AbortController()
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        const data = res.ok ? await res.json() : null
        setCorpus(data?.ok && Array.isArray(data.suggestions) ? data.suggestions : [])
      } catch {
        /* annulé / hors-ligne */
      }
    }, 180)
    return () => { clearTimeout(id); ctrl.abort() }
  }, [q, locale])

  // ── Construction des sections du menu ──
  const term = q.trim()
  const termLow = term.toLowerCase()
  const groups: { header: string; items: Item[] }[] = []

  if (term.length >= 2) {
    const navs: Item[] = corpus.map((s) => {
      const href = s.kind === 'company' ? `/${locale}/company/${s.id}` : `/${locale}/doc/${s.id}`
      return {
        t: 'nav' as const,
        key: `${s.kind}:${s.id}`,
        label: s.title,
        sub: s.number ?? undefined,
        badge: s.kind === 'direct' ? (LBL.open[locale] ?? LBL.open.fr) : undefined,
        href,
      }
    })
    if (navs.length) groups.push({ header: LBL.suggestions[locale] ?? LBL.suggestions.fr, items: navs })
    const recents = history
      .filter((h) => h.toLowerCase().includes(termLow) && h.toLowerCase() !== termLow)
      .slice(0, 3)
      .map<Item>((h) => ({ t: 'term', key: `r:${h}`, label: h, section: 'recent' }))
    if (recents.length) groups.push({ header: LBL.recent[locale] ?? LBL.recent.fr, items: recents })
  } else {
    if (history.length) {
      groups.push({
        header: LBL.recent[locale] ?? LBL.recent.fr,
        items: history.map<Item>((h) => ({ t: 'term', key: `r:${h}`, label: h, section: 'recent' })),
      })
    }
    groups.push({
      header: LBL.themes[locale] ?? LBL.themes.fr,
      items: (THEMES[locale] ?? THEMES.fr).map<Item>((h) => ({ t: 'term', key: `t:${h}`, label: h, section: 'theme' })),
    })
  }

  const flat: Item[] = groups.flatMap((g) => g.items)
  // Le menu s'affiche dès le focus : même sans suggestion ni historique, le pied
  // « Recherche avancée » reste accessible depuis la barre. Le rôle listbox (et
  // aria-expanded) ne couvrent que les OPTIONS — pas le pied, qui est un bouton.
  const showMenu = open
  const hasOptions = flat.length > 0

  function run(raw: string) {
    const value = raw.trim().slice(0, MAX_TERM)
    if (!value) return
    const next = [value, ...history.filter((h) => h.toLowerCase() !== value.toLowerCase())].slice(0, MAX_HISTORY)
    setHistory(next)
    saveHistory(next)
    setOpen(false)
    setActive(-1)
    router.push(searchUrl({ q: value }))
  }

  function select(item: Item) {
    if (item.t === 'nav') {
      setOpen(false)
      setActive(-1)
      router.push(item.href)
    } else {
      setQ(item.label)
      run(item.label)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (active >= 0 && flat[active]) select(flat[active])
    else run(q)
  }

  function removeItem(t: string) {
    const next = history.filter((h) => h !== t)
    setHistory(next)
    saveHistory(next)
    setActive(-1)
    inputRef.current?.focus()
  }
  function clearHistory() {
    setHistory([])
    saveHistory([])
    setActive(-1)
    inputRef.current?.focus()
  }
  function clearInput() {
    setQ('')
    setActive(-1)
    inputRef.current?.focus()
    setOpen(true)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); setActive(-1); return }
    if (!showMenu) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)) }
  }

  const big = size === 'lg'
  const searchLabel = LBL.search[locale] ?? LBL.search.fr
  let idx = -1 // index plat courant pour la navigation clavier

  return (
    <form onSubmit={submit} className="flex w-full items-center gap-2" role="search">
      <div ref={boxRef} className="relative flex-1">
        <svg viewBox="0 0 24 24" className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lank/35 ${big ? 'h-5 w-5' : 'h-4 w-4'}`} fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(-1); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={showMenu && hasOptions}
          aria-autocomplete="list"
          aria-controls="lv-search-menu"
          autoComplete="off"
          className={`w-full rounded-full border border-lank/15 bg-white pl-10 text-lank shadow-card outline-none focus:border-sitwon ${big ? 'py-3.5 pr-12 text-base' : 'py-2 pr-10 text-sm'}`}
        />
        {q && (
          <button type="button" onClick={clearInput} aria-label={LBL.clearInput[locale] ?? LBL.clearInput.fr} className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full text-lank/40 transition hover:bg-lank/5 hover:text-lank ${big ? 'h-7 w-7' : 'h-5 w-5'}`}>
            <svg viewBox="0 0 24 24" className={big ? 'h-4 w-4' : 'h-3.5 w-3.5'} fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
          </button>
        )}

        {showMenu && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-lank/10 bg-white py-1 shadow-xl">
            <div id="lv-search-menu" role="listbox">
            {groups.map((g, gi) => (
              <div key={g.header} className={gi > 0 ? 'border-t border-lank/5' : ''}>
                <div className="flex items-center justify-between px-3 pt-2 pb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-lank/40">{g.header}</span>
                  {g.items[0]?.t === 'term' && (g.items[0] as { section: string }).section === 'recent' && term.length < 2 && (
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); clearHistory() }} className="text-[11px] font-medium text-endeks-700 hover:underline">
                      {LBL.clearAll[locale] ?? LBL.clearAll.fr}
                    </button>
                  )}
                </div>
                {g.items.map((it) => {
                  idx++
                  const i = idx
                  const on = i === active
                  if (it.t === 'nav') {
                    return (
                      <div key={it.key} role="option" aria-selected={on} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); select(it) }} className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm ${on ? 'bg-paper' : 'hover:bg-paper'}`}>
                        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-lank/30" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h13M4 10h13M4 15h9" strokeLinecap="round" /><path d="m17 14 4 3-4 3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <span className="min-w-0 flex-1 truncate text-lank/85">{it.label}</span>
                        {it.sub && <span className="shrink-0 text-xs text-lank/40">{it.sub}</span>}
                        {it.badge && <span className="shrink-0 rounded-full bg-endeks-50 px-2 py-0.5 text-[10px] font-semibold text-endeks-700">{it.badge} ›</span>}
                      </div>
                    )
                  }
                  return (
                    <div key={it.key} role="option" aria-selected={on} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); select(it) }} className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm ${on ? 'bg-paper' : 'hover:bg-paper'}`}>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-lank/30" fill="none" stroke="currentColor" strokeWidth="2">
                        {it.section === 'recent' ? (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" /></>) : (<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" /></>)}
                      </svg>
                      <span className="min-w-0 flex-1 truncate text-lank/80">{it.label}</span>
                      {it.section === 'recent' && term.length < 2 && (
                        <button type="button" aria-label={`${LBL.remove[locale] ?? LBL.remove.fr} « ${it.label} »`} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); removeItem(it.label) }} className="shrink-0 rounded-full p-1 text-lank/30 transition hover:bg-lank/5 hover:text-lank">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
            </div>
            {/* Recherche avancée : section, période « entre l'année X et Y », numéro,
                statut — ouvre le panneau de la page de résultats (?adv=1). Hors du
                listbox (c'est un bouton, pas une option) ; onClick pour rester
                actionnable au CLAVIER (Entrée/Espace), onMouseDown ne gardant que
                l'anti-blur. */}
            <div className={hasOptions ? 'border-t border-lank/5' : ''}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false)
                  router.push(searchUrl({ adv: '1', q: term || undefined }))
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-endeks-700 hover:bg-paper"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
                </svg>
                {advancedLabel} ›
              </button>
            </div>
          </div>
        )}
      </div>

      <button type="submit" aria-label={searchLabel} title={searchLabel} className={`flex shrink-0 items-center justify-center gap-2 rounded-full bg-lank font-semibold text-white shadow-card transition hover:bg-lank-600 ${big ? 'px-5 py-3.5 text-base' : 'px-3.5 py-2 text-sm'}`}>
        <svg viewBox="0 0 24 24" className={big ? 'h-5 w-5' : 'h-4 w-4'} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" /></svg>
        {big && <span>{searchLabel}</span>}
      </button>
    </form>
  )
}
