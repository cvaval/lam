'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ROLES, type Role, type UserStatus, type Locale, type DocType } from '@/lib/types'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { formatDate } from '@/lib/i18n/format'
import { postJson } from '@/lib/http'
import { FULLTEXT_TYPE_LIST, DOC_TYPE_META } from '@/lib/brand'
import { isStaff } from '@/lib/access'
import { Pastille } from './TypeBadge'
import { StatusChip } from './StatusChip'
import type { AdminUser } from '@/lib/admin/mappers'

export type { AdminUser } from '@/lib/admin/mappers'

const ASSIGNABLE: Role[] = [...ROLES]

/** Payload optionnel transmis à l'API admin selon l'action. */
type ActOpts = { role?: Role; services?: DocType[]; canViewSourcePdf?: boolean }

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
  const [openServices, setOpenServices] = useState<string | null>(null)

  async function act(userId: string, action: string, opts: ActOpts = {}) {
    setBusy(userId + action)
    setError(null)
    const res = await postJson('/api/admin/users', { action, userId, ...opts })
    setBusy(null)
    if (!res.ok) {
      setError(t.errors.actionFailed)
      return
    }
    setOpenServices(null)
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
            <Fragment key={u.id}>
              <tr className="hover:bg-paper/50">
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
                          onClick={() => act(u.id, 'activate', { role: roles[u.id] })}
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
                          onClick={() => act(u.id, 'changeType', { role: roles[u.id] })}
                          disabled={!!busy || roles[u.id] === u.role}
                          className="rounded-lg border border-lank/15 px-2.5 py-1.5 text-xs font-medium text-lank/70 hover:bg-paper disabled:opacity-40"
                        >
                          {t.admin.changeType}
                        </button>
                        <button
                          onClick={() => setOpenServices((id) => (id === u.id ? null : u.id))}
                          disabled={!!busy}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                            openServices === u.id
                              ? 'border-endeks bg-endeks-50 text-endeks-700'
                              : 'border-lank/15 text-lank/70 hover:bg-paper'
                          }`}
                          title={t.admin.services}
                        >
                          {t.admin.services}
                          {!isStaff(u.role) && ` (${u.services.length})`}
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
                      </>
                    )}
                  </div>
                </td>
              </tr>
              {mode === 'all' && openServices === u.id && (
                <tr className="bg-paper/40">
                  <td colSpan={4} className="px-4 py-4">
                    <ServicesPanel
                      user={u}
                      t={t}
                      locale={locale}
                      busy={busy === u.id + 'setServices'}
                      onSave={(services, canViewSourcePdf) => act(u.id, 'setServices', { services, canViewSourcePdf })}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Éditeur des services accordés à un compte + option PDF original (§03). */
function ServicesPanel({
  user,
  t,
  locale,
  busy,
  onSave,
}: {
  user: AdminUser
  t: Dictionary
  locale: Locale
  busy: boolean
  onSave: (services: DocType[], canViewSourcePdf: boolean) => void
}) {
  const staff = isStaff(user.role)
  const [services, setServices] = useState<Set<DocType>>(new Set(user.services))
  const [pdf, setPdf] = useState(user.canViewSourcePdf)

  if (staff) {
    return <p className="text-xs text-lank/55">{t.admin.staffAllServices}</p>
  }

  function toggle(type: DocType) {
    setServices((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-lank/45">{t.admin.services}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {/* Index : toujours actif (socle). */}
        <label className="flex items-center gap-2 rounded-lg border border-lank/10 bg-white px-3 py-2 text-sm text-lank/50">
          <input type="checkbox" checked disabled className="accent-endeks" />
          <Pastille type="INDEX" />
          <span>{t.admin.indexAlwaysOn}</span>
        </label>
        {FULLTEXT_TYPE_LIST.map((m) => (
          <label
            key={m.type}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-lank/10 bg-white px-3 py-2 text-sm text-lank hover:border-lank/30"
          >
            <input
              type="checkbox"
              checked={services.has(m.type)}
              onChange={() => toggle(m.type)}
              className="accent-fey"
            />
            <Pastille type={m.type as DocType} />
            <span>{DOC_TYPE_META[m.type].label[locale]}</span>
          </label>
        ))}
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-lank/10 bg-white px-3 py-2 text-sm text-lank hover:border-lank/30">
        <input type="checkbox" checked={pdf} onChange={(e) => setPdf(e.target.checked)} className="accent-fey" />
        <span>{t.admin.sourcePdfPerm}</span>
      </label>

      <div className="flex justify-end">
        <button
          onClick={() => onSave([...services], pdf)}
          disabled={busy}
          className="rounded-lg bg-lank px-4 py-1.5 text-xs font-semibold text-white hover:bg-lank-600 disabled:opacity-50"
        >
          {t.admin.save}
        </button>
      </div>
    </div>
  )
}

function StatusPill({ status, t }: { status: UserStatus; t: Dictionary }) {
  return <StatusChip status={status} label={(t.statuses as Record<string, string>)[status] ?? status} />
}
