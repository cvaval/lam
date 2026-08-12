'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LOCATION_PRECISIONS, VERIFICATION_STATUSES } from '@/lib/jurisdictions/constants'

interface Row {
  id: string
  type: string
  name: string
  department: string | null
  city: string | null
  commune: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  locationPrecision: string
  verificationStatus: string
  operationalStatus: string | null
  active: boolean
  verifiedAt: string | null
}

/**
 * Table d'administration : filtres « à vérifier », édition d'une juridiction
 * (adresse, coordonnées, précision, source, vérification, désactivation).
 * Chaque enregistrement PATCH /api/admin/jurisdictions → AuditLog.
 */
export function JudicialAdminTable({ courts }: { courts: Row[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<'tous' | 'UNMAPPED' | 'TO_VERIFY' | 'sans-coordonnees' | 'inactifs'>('tous')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Row | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = useMemo(() => {
    let r = courts
    if (filter === 'UNMAPPED' || filter === 'TO_VERIFY') r = r.filter((c) => c.verificationStatus === filter)
    if (filter === 'sans-coordonnees') r = r.filter((c) => c.latitude == null && c.active)
    if (filter === 'inactifs') r = r.filter((c) => !c.active)
    const needle = q.trim().toLowerCase()
    if (needle) r = r.filter((c) => `${c.name} ${c.department ?? ''} ${c.city ?? ''}`.toLowerCase().includes(needle))
    return r.slice(0, 300)
  }, [courts, filter, q])

  const save = async (form: FormData) => {
    if (!editing) return
    setBusy(true)
    setError(null)
    const latRaw = String(form.get('latitude') ?? '').trim()
    const lngRaw = String(form.get('longitude') ?? '').trim()
    const body: Record<string, unknown> = {
      courtId: editing.id,
      address: String(form.get('address') ?? '').trim() || null,
      latitude: latRaw ? Number(latRaw) : null,
      longitude: lngRaw ? Number(lngRaw) : null,
      locationPrecision: String(form.get('locationPrecision')),
      verificationStatus: String(form.get('verificationStatus')),
      active: form.get('active') === 'on',
      markVerified: form.get('markVerified') === 'on',
    }
    const src = String(form.get('addSourceUrl') ?? '').trim()
    if (src) body.addSourceUrl = src
    const res = await fetch('/api/admin/jurisdictions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? `erreur ${res.status}`)
      return
    }
    setEditing(null)
    router.refresh()
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        {(['tous', 'UNMAPPED', 'TO_VERIFY', 'sans-coordonnees', 'inactifs'] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${filter === f ? 'border-liy bg-chabon text-koton' : 'border-chabon/20 bg-white text-grafit'}`}
          >
            {f}
          </button>
        ))}
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrer par nom, département, ville…"
          className="ml-auto w-64 rounded-lg border border-chabon/15 px-3 py-1.5 text-sm"
          aria-label="Filtrer les juridictions"
        />
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-chabon/10 bg-white">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="border-b border-chabon/10 bg-pil/50 font-mono text-[10px] uppercase tracking-wide text-ank/80">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Département</th>
              <th className="px-3 py-2">Siège</th>
              <th className="px-3 py-2">Coordonnées</th>
              <th className="px-3 py-2">Précision</th>
              <th className="px-3 py-2">Vérification</th>
              <th className="px-3 py-2">Actif</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-chabon/5 hover:bg-koton">
                <td className="px-3 py-2 font-mono text-[10px]">{c.type}</td>
                <td className="px-3 py-2 font-medium text-ank">{c.name}</td>
                <td className="px-3 py-2">{c.department ?? '—'}</td>
                <td className="px-3 py-2">{c.city ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-[10px]">{c.latitude != null ? `${c.latitude}, ${c.longitude}` : '—'}</td>
                <td className="px-3 py-2">{c.locationPrecision}</td>
                <td className="px-3 py-2">
                  <span className={c.verificationStatus === 'UNMAPPED' ? 'text-wouj' : c.verificationStatus === 'TO_VERIFY' ? 'text-chabon' : 'text-chabon'}>
                    {c.verificationStatus}
                  </span>
                  {c.verifiedAt && <span className="ml-1 text-ank/80">({c.verifiedAt})</span>}
                </td>
                <td className="px-3 py-2">{c.active ? 'oui' : 'non'}</td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => { setEditing(c); setError(null) }} className="rounded-full bg-chabon px-3 py-1 text-[10px] font-semibold text-koton">
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div role="dialog" aria-modal="true" aria-label={`Modifier ${editing.name}`} className="fixed inset-0 z-50 flex items-center justify-center bg-chabon/50 p-4" onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null) }}>
          <form
            action={save}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5"
          >
            <h3 className="font-serif text-lg font-semibold text-ank">{editing.name}</h3>
            <p className="font-mono text-[10px] text-ank/80">{editing.id}</p>
            {error && <p role="alert" className="mt-2 rounded-lg bg-pil px-3 py-2 text-xs text-wouj">{error}</p>}
            <div className="mt-3 grid gap-3">
              <label className="text-xs font-medium text-grafit">
                Adresse (uniquement si vérifiée)
                <input name="address" defaultValue={editing.address ?? ''} maxLength={300} className="mt-1 w-full rounded-lg border border-chabon/15 px-3 py-2 text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-grafit">
                  Latitude (17.5 à 20.5)
                  <input name="latitude" type="number" step="any" min="17.5" max="20.5" defaultValue={editing.latitude ?? ''} className="mt-1 w-full rounded-lg border border-chabon/15 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-grafit">
                  Longitude (−75.5 à −71)
                  <input name="longitude" type="number" step="any" min="-75.5" max="-71" defaultValue={editing.longitude ?? ''} className="mt-1 w-full rounded-lg border border-chabon/15 px-3 py-2 text-sm" />
                </label>
              </div>
              <label className="text-xs font-medium text-grafit">
                Précision
                <select name="locationPrecision" defaultValue={editing.locationPrecision} className="mt-1 w-full rounded-lg border border-chabon/15 px-3 py-2 text-sm">
                  {LOCATION_PRECISIONS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-grafit">
                Statut de vérification
                <select name="verificationStatus" defaultValue={editing.verificationStatus} className="mt-1 w-full rounded-lg border border-chabon/15 px-3 py-2 text-sm">
                  {VERIFICATION_STATUSES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-grafit">
                Ajouter une source (URL)
                <input name="addSourceUrl" type="url" maxLength={500} placeholder="https://…" className="mt-1 w-full rounded-lg border border-chabon/15 px-3 py-2 text-sm" />
              </label>
              <div className="flex items-center gap-5">
                <label className="flex items-center gap-2 text-xs font-medium text-grafit">
                  <input name="active" type="checkbox" defaultChecked={editing.active} /> Active (décocher = désactiver, jamais supprimer)
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-grafit">
                  <input name="markVerified" type="checkbox" /> Marquer vérifiée aujourd’hui
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-full border border-chabon/20 px-4 py-2 text-xs font-semibold text-grafit">
                Annuler
              </button>
              <button type="submit" disabled={busy} className="rounded-full bg-wouj px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
