'use client'

import { useMemo, useState } from 'react'
import type { Locale } from '@/lib/types'

type EditionType = 'REGULIERE' | 'SPECIALE'
interface TitleRow {
  id?: string // présent = entrée existante (mise à jour) ; absent = nouvelle
  text: string
}

const L = {
  title: { fr: 'Index du Moniteur — saisie / correction', en: 'Moniteur Index — entry / edit', ht: 'Endèks Monitè — sezi / korije' },
  intro: {
    fr: "Ajoutez ou corrigez une édition de l'Index du Moniteur. Une édition = un type (régulière ou spéciale), un numéro et une année ; chaque titre saisi devient une entrée d'index recherchable.",
    en: 'Add or correct a Moniteur Index edition. One edition = a type, a number and a year; each title becomes a searchable index entry.',
    ht: 'Ajoute oswa korije yon edisyon nan Endèks Monitè a. Chak tit vin yon antre rechèchab.',
  },
  type: { fr: "Type d'édition", en: 'Edition type', ht: 'Tip edisyon' },
  regular: { fr: 'Régulière', en: 'Regular', ht: 'Regilye' },
  special: { fr: 'Spéciale', en: 'Special', ht: 'Espesyal' },
  numero: { fr: 'Numéro', en: 'Number', ht: 'Nimewo' },
  annee: { fr: 'Année', en: 'Year', ht: 'Ane' },
  dateOpt: { fr: 'Date exacte (facultatif)', en: 'Exact date (optional)', ht: 'Dat egzak (opsyonèl)' },
  ref: { fr: 'Référence', en: 'Reference', ht: 'Referans' },
  check: { fr: 'Vérifier si l’édition existe', en: 'Check if edition exists', ht: 'Verifye si edisyon an egziste' },
  titles: { fr: 'Titres des publications', en: 'Publication titles', ht: 'Tit piblikasyon yo' },
  titlesHint: { fr: 'Un titre par champ — aucune limite de caractères. Ajoutez autant de champs que nécessaire.', en: 'One title per field — no character limit. Add as many fields as needed.', ht: 'Yon tit pa chan — pa gen limit karaktè.' },
  addTitle: { fr: '+ Ajouter un titre', en: '+ Add a title', ht: '+ Ajoute yon tit' },
  remove: { fr: 'Retirer', en: 'Remove', ht: 'Retire' },
  save: { fr: 'Enregistrer l’édition', en: 'Save edition', ht: 'Anrejistre edisyon an' },
  saving: { fr: 'Enregistrement…', en: 'Saving…', ht: 'N ap anrejistre…' },
  existsWarn: { fr: 'existe déjà dans l’index', en: 'already exists in the index', ht: 'deja egziste nan endèks la' },
  loadedForEdit: { fr: 'entrées chargées pour modification.', en: 'entries loaded for editing.', ht: 'antre chaje pou modifikasyon.' },
  notFound: { fr: 'Aucune entrée pour cette référence — nouvelle édition.', en: 'No entry for this reference — new edition.', ht: 'Pa gen antre — nouvo edisyon.' },
} as const

function editionNumber(annee: string, numero: string, special: boolean): string {
  const y = annee.trim()
  const n = numero.trim().replace(/^SP/i, '').replace(/\s+/g, '')
  if (!y || !n) return ''
  return special ? `LM${y}-SP${n}` : `LM${y}-${n}`
}

export function IndexMoniteurEditor({ locale }: { locale: Locale }) {
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr
  const [editionType, setEditionType] = useState<EditionType>('REGULIERE')
  const [numero, setNumero] = useState('')
  const [annee, setAnnee] = useState(String(new Date().getUTCFullYear()))
  const [dateISO, setDateISO] = useState('')
  const [rows, setRows] = useState<TitleRow[]>(() => Array.from({ length: 5 }, () => ({ text: '' })))
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: 'info' | 'ok' | 'warn' | 'err'; text: string } | null>(null)

  const number = useMemo(() => editionNumber(annee, numero, editionType === 'SPECIALE'), [annee, numero, editionType])

  function setRow(i: number, text: string) {
    setRows((r) => r.map((row, k) => (k === i ? { ...row, text } : row)))
  }
  function addRow() {
    setRows((r) => [...r, { text: '' }])
  }
  function removeRow(i: number) {
    setRows((r) => {
      const row = r[i]
      if (row.id) setDeletedIds((d) => [...d, row.id!])
      return r.filter((_, k) => k !== i)
    })
  }

  async function checkExisting() {
    if (!number) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/admin/index-moniteur?number=${encodeURIComponent(number)}`)
      const data = await res.json()
      if (data.exists) {
        const loaded: TitleRow[] = data.entries.map((e: { id: string; titleFr: string }) => ({ id: e.id, text: e.titleFr }))
        setRows(loaded.length ? loaded : [{ text: '' }])
        setDeletedIds([])
        setStatus({ kind: 'warn', text: `⚠ ${number} ${lt(L.existsWarn)} : ${data.count} ${lt(L.loadedForEdit)}` })
      } else {
        setStatus({ kind: 'info', text: lt(L.notFound) })
      }
    } catch {
      setStatus({ kind: 'err', text: 'Erreur réseau.' })
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!number || !rows.some((r) => r.text.trim())) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/admin/index-moniteur', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          editionType,
          numero: numero.trim(),
          annee: Number(annee),
          dateISO: dateISO || null,
          titles: rows.filter((r) => r.text.trim()).map((r) => ({ id: r.id, text: r.text })),
          deletedIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'error')
      setStatus({ kind: 'ok', text: `✓ ${data.number} — ${data.created} créées, ${data.updated} modifiées, ${data.deleted} supprimées.` })
      setDeletedIds([])
      // Recharge l'état "édité" (les nouvelles entrées ont maintenant un id) :
      await checkExisting()
    } catch {
      setStatus({ kind: 'err', text: 'Échec de l’enregistrement.' })
    } finally {
      setBusy(false)
    }
  }

  const statusCls =
    status?.kind === 'ok' ? 'bg-green-50 text-green-800 border-green-200'
    : status?.kind === 'warn' ? 'bg-soley-50 text-soley-700 border-soley/30'
    : status?.kind === 'err' ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-lank-50 text-lank/70 border-lank/15'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-lank">{lt(L.title)}</h1>
        <p className="mt-1 max-w-2xl text-sm text-lank/55">{lt(L.intro)}</p>
      </div>

      {/* En-tête d'édition */}
      <div className="grid gap-4 rounded-2xl border border-lank/10 bg-white p-5 shadow-card sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-lank/55">{lt(L.type)}</label>
          <div className="flex gap-2">
            {(['REGULIERE', 'SPECIALE'] as EditionType[]).map((et) => (
              <button
                key={et}
                type="button"
                onClick={() => setEditionType(et)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  editionType === et ? 'border-soley bg-soley-50 text-soley-700' : 'border-lank/15 bg-paper text-lank/60 hover:border-lank/30'
                }`}
              >
                {et === 'REGULIERE' ? lt(L.regular) : lt(L.special)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-lank/55">{lt(L.numero)}</label>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} onBlur={checkExisting} inputMode="numeric" placeholder="51" className="w-full rounded-lg border border-lank/15 bg-paper px-3 py-2 text-sm text-lank outline-none focus:border-sitwon" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-lank/55">{lt(L.annee)}</label>
          <input value={annee} onChange={(e) => setAnnee(e.target.value)} onBlur={checkExisting} inputMode="numeric" placeholder="2024" className="w-full rounded-lg border border-lank/15 bg-paper px-3 py-2 text-sm text-lank outline-none focus:border-sitwon" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-lank/55">{lt(L.dateOpt)}</label>
          <input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} className="w-full rounded-lg border border-lank/15 bg-paper px-3 py-2 text-sm text-lank outline-none focus:border-sitwon" />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <div className="flex-1 text-xs text-lank/55">
            {lt(L.ref)} : <span className="font-mono font-semibold text-lank">{number || '—'}</span>
          </div>
          <button type="button" onClick={checkExisting} disabled={!number || busy} className="rounded-lg border border-lank/20 px-3 py-1.5 text-xs font-semibold text-lank/70 hover:bg-paper disabled:opacity-40">
            {lt(L.check)}
          </button>
        </div>
      </div>

      {status && <div className={`rounded-lg border px-3 py-2 text-sm ${statusCls}`}>{status.text}</div>}

      {/* Titres */}
      <div className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-lank">{lt(L.titles)}</h2>
          <span className="text-xs text-lank/45">{rows.filter((r) => r.text.trim()).length}</span>
        </div>
        <p className="mb-3 text-xs text-lank/50">{lt(L.titlesHint)}</p>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2 w-6 shrink-0 text-right text-xs tabular-nums text-lank/40">{i + 1}.</span>
              <textarea
                value={row.text}
                onChange={(e) => setRow(i, e.target.value)}
                rows={2}
                placeholder="Titre de la publication…"
                className={`min-h-[2.5rem] flex-1 resize-y rounded-lg border bg-paper px-3 py-2 text-sm text-lank outline-none focus:border-sitwon ${row.id ? 'border-sitwon/30' : 'border-lank/15'}`}
              />
              <button type="button" onClick={() => removeRow(i)} title={lt(L.remove)} className="mt-1.5 shrink-0 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow} className="mt-3 rounded-lg border border-dashed border-lank/25 px-3 py-1.5 text-sm font-medium text-lank/60 hover:border-lank/40 hover:text-lank">
          {lt(L.addTitle)}
        </button>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={busy || !number || !rows.some((r) => r.text.trim())} className="rounded-lg bg-lank px-5 py-2.5 text-sm font-semibold text-white hover:bg-lank-600 disabled:opacity-40">
          {busy ? lt(L.saving) : lt(L.save)}
        </button>
      </div>
    </div>
  )
}
