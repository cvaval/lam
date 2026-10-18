'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Recherche et filtre par juridiction de l'annuaire des notaires. C'est un VRAI formulaire GET
 * (`/{locale}/juridictions?vue=notaires&q=…&juridiction=…`) : sans JavaScript, le navigateur le
 * soumet tel quel. Avec JavaScript, la navigation reste interne (la carte n'est pas démontée) et
 * l'état « mise à jour » est exposé (`aria-busy` + message), annoncé par la région des résultats.
 *
 * Le filtre communal (choisi sur la carte) est conservé à la recherche ; il est abandonné si l'on
 * choisit une autre juridiction que la sienne (l'intersection serait vide par construction).
 */
export function AnnuaireFiltres({
  locale, ou = 'onglet', q, juridiction, commune, communeJuridiction, juridictions, layers, labels,
}: {
  locale: string
  /** Onglet de la carte (`/juridictions?vue=notaires`) ou page d'annuaire (`/juridictions/notaires`). */
  ou?: 'onglet' | 'page'
  q: string
  juridiction: string | null
  commune: string | null
  communeJuridiction: string | null
  juridictions: Array<{ id: string; label: string; total: number }>
  /** `?layers=` explicite de l'onglet, à garder (null = défaut). */
  layers: string | null
  labels: { search: string; placeholder: string; submit: string; jurisdiction: string; all: string; loading: string }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const naviguer = (form: HTMLFormElement) => {
    const data = new FormData(form)
    const s = new URLSearchParams(ou === 'onglet' ? { vue: 'notaires' } : {})
    const qv = String(data.get('q') ?? '').trim().slice(0, 80)
    const jv = String(data.get('juridiction') ?? '')
    if (qv) s.set('q', qv)
    if (jv) s.set('juridiction', jv)
    if (commune && (!jv || jv === communeJuridiction)) s.set('commune', commune)
    if (layers !== null) s.set('layers', layers)
    const chemin = ou === 'onglet' ? '/juridictions' : '/juridictions/notaires'
    const qs = s.toString()
    startTransition(() => router.push(`/${locale}${chemin}${qs ? `?${qs}` : ''}#ag-annuaire-resultats`, { scroll: false }))
  }

  return (
    <form
      ref={formRef}
      role="search"
      method="get"
      action={`/${locale}${ou === 'onglet' ? '/juridictions' : '/juridictions/notaires'}`}
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault()
        naviguer(e.currentTarget)
      }}
      className="flex flex-col gap-3"
    >
      {ou === 'onglet' && <input type="hidden" name="vue" value="notaires" />}
      {commune && <input type="hidden" name="commune" value={commune} />}
      {layers !== null && <input type="hidden" name="layers" value={layers} />}
      <div className="flex flex-col gap-1">
        <label htmlFor="ag-annuaire-q" className="text-[13px] font-medium text-[#52656B]">{labels.search}</label>
        <div className="flex gap-2">
          <input
            id="ag-annuaire-q"
            type="search"
            name="q"
            defaultValue={q}
            maxLength={80}
            autoComplete="off"
            placeholder={labels.placeholder}
            className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-[#D7DCD7] bg-white px-3 font-sans text-sm text-chabon placeholder:text-[#52656B]/80"
          />
          <button type="submit" className="min-h-[44px] shrink-0 rounded-lg bg-chabon px-4 text-sm font-medium text-white transition hover:bg-chabon/90">
            {labels.submit}
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="ag-annuaire-juridiction" className="text-[13px] font-medium text-[#52656B]">{labels.jurisdiction}</label>
        <select
          id="ag-annuaire-juridiction"
          name="juridiction"
          defaultValue={juridiction ?? ''}
          onChange={() => formRef.current && naviguer(formRef.current)}
          className="min-h-[44px] w-full rounded-lg border border-[#D7DCD7] bg-white px-3 font-sans text-sm text-chabon"
        >
          <option value="">{labels.all}</option>
          {juridictions.map((j) => (
            <option key={j.id} value={j.id}>{j.label} ({j.total})</option>
          ))}
        </select>
      </div>
      {pending && (
        <p className="text-xs text-[#52656B]" aria-hidden="true">
          <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-[#9B422C] align-middle" />
          {labels.loading}
        </p>
      )}
    </form>
  )
}
