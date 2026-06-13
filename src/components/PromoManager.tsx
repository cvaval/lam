'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Role } from '@/lib/types'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { postJson } from '@/lib/http'
import { Labeled, fieldCls as field } from './forms'
import { StatusChip } from './StatusChip'

export interface PromoCodeRow {
  id: string
  code: string
  label: string | null
  grantsRole: Role
  durationDays: number | null
  maxRedemptions: number | null
  redeemedCount: number
  expiresAt: string | null
  active: boolean
}
export interface AssignUser {
  id: string
  email: string
  role: Role
}

const GRANT_ROLES: Role[] = ['PWOFESYONEL', 'ENSTITISYON']

export function PromoManager({
  t,
  codes,
  users,
}: {
  t: Dictionary
  codes: PromoCodeRow[]
  users: AssignUser[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignCode, setAssignCode] = useState('')
  const [assignUser, setAssignUser] = useState('')
  const [assignMsg, setAssignMsg] = useState<string | null>(null)

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const durationDays = fd.get('durationDays') ? Number(fd.get('durationDays')) : null
    const maxRedemptions = fd.get('maxRedemptions') ? Number(fd.get('maxRedemptions')) : null
    const expiresRaw = fd.get('expiresAt') as string
    const res = await postJson('/api/admin/promo', {
      code: (fd.get('code') as string)?.trim() || undefined,
      label: (fd.get('label') as string)?.trim() || undefined,
      grantsRole: fd.get('grantsRole'),
      durationDays,
      maxRedemptions,
      expiresAt: expiresRaw ? new Date(expiresRaw).toISOString() : null,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error === 'exists' ? t.errors.exists : t.errors.invalidFields)
      return
    }
    ;(e.target as HTMLFormElement).reset()
    router.refresh()
  }

  async function assign() {
    if (!assignCode || !assignUser) return
    setAssignMsg(null)
    const res = await postJson('/api/admin/promo/assign', { code: assignCode, userId: assignUser })
    if (res.ok) {
      setAssignMsg(t.promo.assignDone)
      router.refresh()
    } else {
      setAssignMsg((t.promo.errors as Record<string, string>)[res.error ?? ''] ?? t.errors.actionFailed)
    }
  }

  return (
    <div className="space-y-8">
      {/* Générer un code */}
      <form onSubmit={create} className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-lank">{t.promo.create}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Labeled label={t.promo.code} hint={t.promo.codeAuto}>
            <input name="code" placeholder="LV-…" className={field} />
          </Labeled>
          <Labeled label={t.promo.label}>
            <input name="label" className={field} />
          </Labeled>
          <Labeled label={t.promo.grants}>
            <select name="grantsRole" defaultValue="PWOFESYONEL" className={field}>
              {GRANT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {t.roles[r]}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label={`${t.promo.duration} (${t.promo.days})`} hint={t.promo.permanent}>
            <input name="durationDays" type="number" min={1} placeholder="90" className={field} />
          </Labeled>
          <Labeled label={t.promo.maxUses} hint={t.promo.unlimited}>
            <input name="maxRedemptions" type="number" min={1} placeholder="∞" className={field} />
          </Labeled>
          <Labeled label={t.promo.expires}>
            <input name="expiresAt" type="date" className={field} />
          </Labeled>
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="mt-4 rounded-lg bg-lank px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? t.common.loading : t.promo.create}
        </button>
      </form>

      {/* Attribuer un code à un compte */}
      <div className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-lank">{t.promo.assignTitle}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <Labeled label={t.promo.code}>
            <select value={assignCode} onChange={(e) => setAssignCode(e.target.value)} className={field}>
              <option value="">—</option>
              {codes.filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code} · {t.roles[c.grantsRole]}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label={t.promo.assignTo}>
            <select value={assignUser} onChange={(e) => setAssignUser(e.target.value)} className={`${field} min-w-[220px]`}>
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email} ({t.roles[u.role]})
                </option>
              ))}
            </select>
          </Labeled>
          <button
            onClick={assign}
            disabled={!assignCode || !assignUser}
            className="rounded-lg bg-fey px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {t.promo.assign}
          </button>
          {assignMsg && <span className="text-sm text-lank/70">{assignMsg}</span>}
        </div>
      </div>

      {/* Liste des codes */}
      <div className="overflow-hidden rounded-2xl border border-lank/10 bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-lank/10 bg-paper text-left text-[11px] uppercase tracking-wide text-lank/45">
              <th className="px-4 py-3 font-semibold">{t.promo.code}</th>
              <th className="px-4 py-3 font-semibold">{t.promo.grants}</th>
              <th className="px-4 py-3 font-semibold">{t.promo.duration}</th>
              <th className="px-4 py-3 font-semibold">{t.promo.redeemedCount}</th>
              <th className="px-4 py-3 font-semibold">{t.admin.status}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-lank/5">
            {codes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-lank/40">
                  {t.promo.none}
                </td>
              </tr>
            )}
            {codes.map((c) => (
              <tr key={c.id} className="hover:bg-paper/50">
                <td className="px-4 py-2.5">
                  <span className="font-mono font-semibold text-lank">{c.code}</span>
                  {c.label && <span className="ml-2 text-xs text-lank/45">{c.label}</span>}
                </td>
                <td className="px-4 py-2.5 text-lank/70">{t.roles[c.grantsRole]}</td>
                <td className="px-4 py-2.5 text-lank/60">
                  {c.durationDays ? `${c.durationDays} ${t.promo.days}` : t.promo.permanent}
                </td>
                <td className="px-4 py-2.5 font-mono text-lank/60">
                  {c.redeemedCount}
                  {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}
                </td>
                <td className="px-4 py-2.5">
                  <StatusChip status={c.active ? 'ACTIVE' : 'INACTIVE'} label={c.active ? t.promo.active : t.promo.inactive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


