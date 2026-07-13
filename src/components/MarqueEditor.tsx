'use client'

import { useEffect, useRef, useState } from 'react'
import type { Locale } from '@/lib/types'

interface Marque {
  id: string
  titleFr: string
  holder: string | null
  imageUrl: string | null
  sourcePdfUrl: string | null
  number: string | null
}

const L = {
  title: { fr: 'Marques de fabrique et de commerce', en: 'Trademarks', ht: 'Mak fabrik ak komès' },
  intro: { fr: 'Enregistrez une marque : son nom et sa reproduction (image ou PDF).', en: 'Register a trademark: its name and reproduction (image or PDF).', ht: 'Anrejistre yon mak : non l ak repwodiksyon l (imaj oswa PDF).' },
  nom: { fr: 'Nom de la marque', en: 'Trademark name', ht: 'Non mak la' },
  holder: { fr: 'Titulaire (facultatif)', en: 'Holder (optional)', ht: 'Titilè (opsyonèl)' },
  numberOpt: { fr: 'N° de dépôt (facultatif)', en: 'Filing no. (optional)', ht: 'Nº depo (opsyonèl)' },
  file: { fr: 'Reproduction (image ou PDF)', en: 'Reproduction (image or PDF)', ht: 'Repwodiksyon (imaj oswa PDF)' },
  add: { fr: 'Enregistrer la marque', en: 'Save trademark', ht: 'Anrejistre mak la' },
  saving: { fr: 'Enregistrement…', en: 'Saving…', ht: 'N ap anrejistre…' },
  existing: { fr: 'Marques enregistrées', en: 'Registered trademarks', ht: 'Mak anrejistre' },
  none: { fr: 'Aucune marque pour l’instant.', en: 'No trademark yet.', ht: 'Poko gen mak.' },
  file2: { fr: 'fichier', en: 'file', ht: 'fichye' },
  del: { fr: 'Supprimer', en: 'Delete', ht: 'Efase' },
  confirmDel: { fr: 'Supprimer cette marque ?', en: 'Delete this trademark?', ht: 'Efase mak sa a ?' },
} as const

export function MarqueEditor({ locale }: { locale: Locale }) {
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr
  const [nom, setNom] = useState('')
  const [holder, setHolder] = useState('')
  const [number, setNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [marques, setMarques] = useState<Marque[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    try {
      const res = await fetch('/api/admin/marques')
      const data = await res.json()
      setMarques(data.marques ?? [])
    } catch {
      /* silencieux */
    }
  }
  useEffect(() => {
    void load()
  }, [])

  async function save() {
    if (nom.trim().length < 2) return
    setBusy(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.set('nom', nom.trim())
      if (holder.trim()) fd.set('holder', holder.trim())
      if (number.trim()) fd.set('number', number.trim())
      const f = fileRef.current?.files?.[0]
      if (f) fd.set('file', f)
      const res = await fetch('/api/admin/marques', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'error')
      setMsg(`✓ « ${data.nom} » enregistrée.`)
      setNom('')
      setHolder('')
      setNumber('')
      if (fileRef.current) fileRef.current.value = ''
      await load()
    } catch {
      setMsg('Échec de l’enregistrement.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!confirm(lt(L.confirmDel))) return
    await fetch(`/api/admin/marques?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-lank">{lt(L.title)}</h1>
        <p className="mt-1 max-w-2xl text-sm text-lank/55">{lt(L.intro)}</p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-lank/10 bg-white p-5 shadow-card sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-lank/55">{lt(L.nom)}</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} className="w-full rounded-lg border border-lank/15 bg-paper px-3 py-2 text-sm text-lank outline-none focus:border-sitwon" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-lank/55">{lt(L.holder)}</label>
          <input value={holder} onChange={(e) => setHolder(e.target.value)} className="w-full rounded-lg border border-lank/15 bg-paper px-3 py-2 text-sm text-lank outline-none focus:border-sitwon" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-lank/55">{lt(L.numberOpt)}</label>
          <input value={number} onChange={(e) => setNumber(e.target.value)} className="w-full rounded-lg border border-lank/15 bg-paper px-3 py-2 text-sm text-lank outline-none focus:border-sitwon" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-lank/55">{lt(L.file)}</label>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" className="block w-full text-sm text-lank/70 file:mr-3 file:rounded-lg file:border-0 file:bg-lank file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-lank-600" />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="button" onClick={save} disabled={busy || nom.trim().length < 2} className="rounded-lg bg-lank px-5 py-2.5 text-sm font-semibold text-white hover:bg-lank-600 disabled:opacity-40">
            {busy ? lt(L.saving) : lt(L.add)}
          </button>
          {msg && <span className="text-sm text-lank/70">{msg}</span>}
        </div>
      </div>

      <div className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-lank">{lt(L.existing)} <span className="text-lank/45">({marques.length})</span></h2>
        {marques.length === 0 ? (
          <p className="text-sm text-lank/45">{lt(L.none)}</p>
        ) : (
          <ul className="divide-y divide-lank/10">
            {marques.map((m) => {
              const fileUrl = m.imageUrl || m.sourcePdfUrl
              return (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-lank">{m.titleFr}</p>
                    {(m.holder || m.number) && <p className="truncate text-xs text-lank/55">{[m.holder, m.number].filter(Boolean).join(' · ')}</p>}
                  </div>
                  {fileUrl ? (
                    <a href={`/api/admin/marques/${m.id}/file`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-medium text-sitwon-700 hover:underline">
                      {m.imageUrl ? '🖼 image' : '📄 PDF'}
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-lank/35">— {lt(L.file2)}</span>
                  )}
                  <button type="button" onClick={() => remove(m.id)} title={lt(L.del)} className="shrink-0 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                    ✕
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
