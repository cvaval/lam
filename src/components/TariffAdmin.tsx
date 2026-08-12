'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { tariffLabel } from '@/lib/tarif-format'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'

export interface TariffRow {
  id: string
  code: string
  designation: string
  unite: string | null
  dd: string | null
  ddRef: string | null
  tca: string | null
  accises: string | null
  note: string | null
  chapter: string | null
  position: number
}
type Draft = { code: string; designation: string; unite: string; dd: string; ddRef: string; tca: string; accises: string; note: string }
const EMPTY: Draft = { code: '', designation: '', unite: '', dd: '', ddRef: '', tca: '', accises: '', note: '' }
const toDraft = (r: TariffRow): Draft => ({
  code: r.code, designation: r.designation, unite: r.unite ?? '', dd: r.dd ?? '', ddRef: r.ddRef ?? '', tca: r.tca ?? '', accises: r.accises ?? '', note: r.note ?? '',
})

export function TariffAdmin({ locale, t, q, total, rows }: { locale: Locale; t: Dictionary; q: string; total: number; rows: TariffRow[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function startAdd() { setEditingId(null); setAdding(true); setDraft(EMPTY); setError('') }
  function startEdit(r: TariffRow) { setAdding(false); setEditingId(r.id); setDraft(toDraft(r)); setError('') }
  function cancel() { setAdding(false); setEditingId(null); setError('') }

  // Code d'erreur machine → message traduit (repli actionFailed : couvre notFound et inconnus).
  const errMsg = (code: string) => (t.errors as Record<string, string>)[code] ?? t.errors.actionFailed

  async function send(method: 'POST' | 'PATCH' | 'DELETE', payload: Record<string, unknown>) {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/admin/tarifs', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.ok) { setError(errMsg(j?.error ? String(j.error) : 'actionFailed')); return false }
      cancel()
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
      router.refresh()
      return true
    } catch {
      // Échec réseau (hors-ligne, DNS) : signaler à l'admin, ne pas laisser un rejet non capturé.
      setError(errMsg('actionFailed'))
      return false
    } finally { setBusy(false) }
  }

  function save() {
    if (!draft.code.trim() || !draft.designation.trim()) { setError(errMsg('invalidFields')); return }
    if (adding) void send('POST', draft)
    else if (editingId) void send('PATCH', { id: editingId, ...draft })
  }
  function remove(r: TariffRow) {
    if (window.confirm(`${t.tarifs.confirmDel}\n\n${r.code} — ${r.designation}`)) void send('DELETE', { id: r.id })
  }

  const inputCls = 'w-full rounded-md border border-chabon/15 bg-white px-2 py-1 text-xs text-ank outline-none focus:border-liy'
  const field = (k: keyof Draft, ph: string, mono = false) => (
    <input
      value={draft[k]}
      onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
      placeholder={ph}
      className={`${inputCls} ${mono ? 'font-mono' : ''}`}
    />
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ank">{t.tarifs.adminTitle}</h1>
          <p className="mt-0.5 text-sm text-ank/80">{t.tarifs.adminSub}</p>
        </div>
        <button type="button" onClick={startAdd} className="rounded-lg bg-chabon px-3 py-2 text-sm font-medium text-white hover:bg-chabon">
          + {t.tarifs.add}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action={`/${locale}/admin/tarifs`} method="get" className="flex gap-2">
          <input name="q" defaultValue={q} placeholder={t.tarifs.searchPlaceholder} className="w-72 rounded-lg border border-chabon/15 bg-white px-3 py-1.5 text-sm text-ank outline-none focus:border-liy" />
          <button type="submit" className="rounded-lg border border-chabon/15 bg-white px-3 py-1.5 text-sm text-ank hover:bg-koton">{t.common.search}</button>
        </form>
        <span className="text-sm text-ank/80">{total.toLocaleString('fr')} {t.tarifs.results}</span>
      </div>

      {error && <p className="rounded-lg bg-pil px-3 py-2 text-sm text-chabon">{error}</p>}
      {saved && <p role="status" className="rounded-lg bg-chabon/10 px-3 py-2 text-sm font-medium text-chabon">✓ {t.tarifs.saved}</p>}

      {adding && (
        <div className="rounded-xl border border-chabon/40 bg-pil p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-7">
            {field('code', t.tarifs.thCode, true)}
            <div className="sm:col-span-2">{field('designation', t.tarifs.thDesignation)}</div>
            {field('unite', t.tarifs.thUnite)}
            {field('dd', t.tarifs.thDd)}
            {field('tca', t.tarifs.thTca)}
            {field('accises', t.tarifs.thAccises)}
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {field('ddRef', t.tarifs.thRef)}
            {field('note', t.tarifs.thNote)}
          </div>
          <div className="mt-2 flex items-center justify-end gap-2">
            <button type="button" disabled={busy} onClick={save} className="shrink-0 rounded-lg bg-chabon px-3 py-1.5 text-sm font-medium text-white hover:bg-chabon disabled:opacity-50">{t.tarifs.save}</button>
            <button type="button" onClick={cancel} className="shrink-0 rounded-lg border border-chabon/15 px-3 py-1.5 text-sm text-grafit hover:bg-koton">{t.tarifs.cancel}</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-chabon/10 bg-white">
        <table className="w-full border-collapse text-[13px] text-ank/90">
          <thead>
            <tr className="border-b border-chabon/15 bg-koton text-left text-xs uppercase tracking-wide text-ank/80">
              <th className="px-3 py-2 font-semibold">{t.tarifs.thCode}</th>
              <th className="px-3 py-2 font-semibold">{t.tarifs.thDesignation}</th>
              <th className="px-3 py-2 font-semibold">{t.tarifs.thUnite}</th>
              <th className="px-3 py-2 text-right font-semibold">{t.tarifs.thDd}</th>
              <th className="px-3 py-2 text-right font-semibold">{t.tarifs.thTca}</th>
              <th className="px-3 py-2 text-right font-semibold">{t.tarifs.thAccises}</th>
              <th className="px-3 py-2 text-right font-semibold" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-ank/80">{q ? t.tarifs.empty : t.tarifs.emptyAll}</td></tr>
            )}
            {rows.map((r) =>
              editingId === r.id ? (
                <tr key={r.id} className="bg-pil/60">
                  <td className="px-2 py-1.5">{field('code', t.tarifs.thCode, true)}</td>
                  <td className="space-y-1 px-2 py-1.5">{field('designation', t.tarifs.thDesignation)}{field('note', t.tarifs.thNote)}{field('ddRef', t.tarifs.thRef)}</td>
                  <td className="px-2 py-1.5">{field('unite', t.tarifs.thUnite)}</td>
                  <td className="px-2 py-1.5">{field('dd', t.tarifs.thDd)}</td>
                  <td className="px-2 py-1.5">{field('tca', t.tarifs.thTca)}</td>
                  <td className="px-2 py-1.5">{field('accises', t.tarifs.thAccises)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    <button type="button" disabled={busy} onClick={save} className="rounded-md bg-chabon px-2 py-1 text-xs font-medium text-white hover:bg-chabon disabled:opacity-50">{t.tarifs.save}</button>
                    <button type="button" onClick={cancel} className="ml-1 rounded-md border border-chabon/15 px-2 py-1 text-xs text-grafit hover:bg-koton">{t.tarifs.cancel}</button>
                  </td>
                </tr>
              ) : (
                <tr key={r.id} className="border-b border-chabon/5 last:border-0 hover:bg-koton">
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs font-medium text-ank">{r.code}</td>
                  <td className="px-3 py-1.5">{tariffLabel(r.designation).label}{r.note && <span className="mt-0.5 block text-[11px] text-ank/80">{r.note}</span>}{r.ddRef && <span className="mt-0.5 block text-[11px] text-chabon/80">ⓘ {r.ddRef}</span>}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-grafit">{r.unite ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{r.dd ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{r.tca ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{r.accises ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right">
                    <button type="button" onClick={() => startEdit(r)} className="rounded-md border border-chabon/15 px-2 py-1 text-xs text-grafit hover:bg-koton">{t.tarifs.edit}</button>
                    <button type="button" onClick={() => remove(r)} className="ml-1 rounded-md border border-chabon/30 px-2 py-1 text-xs text-chabon hover:bg-pil">{t.tarifs.del}</button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
