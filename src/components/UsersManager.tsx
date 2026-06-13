'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ROLES, type Role, type UserStatus, type Locale } from '@/lib/types'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { formatDate } from '@/lib/i18n/format'
import { postJson } from '@/lib/http'
import { StatusChip } from './StatusChip'
import type { AdminUser } from '@/lib/admin/mappers'

export type { AdminUser } from '@/lib/admin/mappers'

const ASSIGNABLE: Role[] = [...ROLES]

export function UsersManager({
  users,
  t,
  locale,
  mode,
}: {
  users: AdminUser[]
  t: Dictionary
  locale: Locale
  mode: 'pending' | 'all'
}) {
  const router = useRouter()
  const [roles, setRoles] = useState<Record<string, Role>>(
    Object.fromEntries(users.map((u) => [u.id, u.role === 'SITWAYEN' && mode === 'pending' ? 'PWOFESYONEL' : u.role])),
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(userId: string, action: string, role?: Role, indexOnly?: boolean) {
    setBusy(userId + action)
    setError(null)
    const res = await postJson('/api/admin/users', { action, userId, role, indexOnly })
    setBusy(null)
    if (!res.ok) {
      setError(t.errors.actionFailed)
      return
    }
    router.refresh()
  }

  if (users.length === 0) {
    return <p className="rounded-xl border border-lank/10 bg-white p-8 text-center text-sm text-lank/40">—</p>
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-lank/10 bg-white shadow-card">
      {error && (
        <p className="border-b border-soley/40 bg-soley-50 px-4 py-2 text-sm text-lank">{error}</p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-lank/10 bg-paper text-left text-[11px] uppercase tracking-wide text-lank/45">
            <th className="px-4 py-3 font-semibold">Email</th>
            <th className="px-4 py-3 font-semibold">{mode === 'pending' ? t.admin.requestedOn : t.admin.status}</th>
            <th className="px-4 py-3 font-semibold">{mode === 'pending' ? t.admin.typeToAssign : t.admin.role}</th>
            <th className="px-4 py-3 text-right font-semibold">{t.admin.action}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-lank/5">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-paper/50">
              <td className="px-4 py-3">
                <p className="font-medium text-lank">{u.email}</p>
                {u.name && <p className="text-xs text-lank/45">{u.name}</p>}
              </td>
              <td className="px-4 py-3 text-lank/60">
                {mode === 'pending' ? (
                  formatDate(locale, u.requestedAt, { day: 'numeric', month: 'short' })
                ) : (
                  <StatusPill status={u.status} t={t} />
                )}
              </td>
              <td className="px-4 py-3">
                <select
                  value={roles[u.id]}
                  onChange={(e) => setRoles((r) => ({ ...r, [u.id]: e.target.value as Role }))}
                  className="rounded-lg border border-lank/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-sitwon"
                >
                  {ASSIGNABLE.map((r) => (
                    <option key={r} value={r}>
                      {t.roles[r]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1.5">
                  {mode === 'pending' ? (
                    <>
                      <button
                        onClick={() => act(u.id, 'activate', roles[u.id])}
                        disabled={!!busy}
                        className="rounded-lg bg-fey px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {t.admin.activate}
                      </button>
                      <button
                        onClick={() => act(u.id, 'reject')}
                        disabled={!!busy}
                        className="rounded-lg border border-lank/15 px-3 py-1.5 text-xs font-medium text-lank/70 hover:bg-paper"
                      >
                        {t.admin.reject}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => act(u.id, 'changeType', roles[u.id])}
                        disabled={!!busy || roles[u.id] === u.role}
                        className="rounded-lg border border-lank/15 px-2.5 py-1.5 text-xs font-medium text-lank/70 hover:bg-paper disabled:opacity-40"
                      >
                        {t.admin.changeType}
                      </button>
                      {u.status === 'SUSPENDED' ? (
                        <button
                          onClick={() => act(u.id, 'reactivate')}
                          disabled={!!busy}
                          className="rounded-lg bg-fey px-2.5 py-1.5 text-xs font-semibold text-white"
                        >
                          {t.admin.reactivate}
                        </button>
                      ) : (
                        <button
                          onClick={() => act(u.id, 'suspend')}
                          disabled={!!busy}
                          className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          {t.admin.suspend}
                        </button>
                      )}
                      <button
                        onClick={() => act(u.id, 'reset2fa')}
                        disabled={!!busy}
                        className="rounded-lg border border-lank/15 px-2.5 py-1.5 text-xs font-medium text-lank/70 hover:bg-paper"
                      >
                        {t.admin.reset2fa}
                      </button>
                      <button
                        onClick={() => act(u.id, 'setIndexOnly', undefined, !u.indexOnly)}
                        disabled={!!busy}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                          u.indexOnly
                            ? 'border-endeks bg-endeks-50 text-endeks-700'
                            : 'border-lank/15 text-lank/70 hover:bg-paper'
                        }`}
                        title={t.admin.indexOnly}
                      >
                        {u.indexOnly ? t.admin.fullAccess : t.admin.indexOnly}
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusPill({ status, t }: { status: UserStatus; t: Dictionary }) {
  return <StatusChip status={status} label={(t.statuses as Record<string, string>)[status] ?? status} />
}
