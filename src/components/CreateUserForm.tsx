'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ROLES, type Role } from '@/lib/types'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { postJson } from '@/lib/http'
import { fieldCls as field } from './forms'

const ASSIGNABLE: Role[] = [...ROLES]

export function CreateUserForm({ t }: { t: Dictionary }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ email: string; tempPassword: string; promo?: { applied: boolean } } | null>(null)
  const [copied, setCopied] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const res = await postJson('/api/admin/users/create', {
      email: fd.get('email'),
      name: fd.get('name') || undefined,
      role: fd.get('role'),
      organizationName: fd.get('org') || undefined,
      promoCode: fd.get('promo') || undefined,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error === 'exists' ? 'exists' : 'invalid')
      return
    }
    setResult({ email: res.data.email, tempPassword: res.data.tempPassword, promo: res.data.promo })
    router.refresh()
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-fey/30 bg-fey-50 p-5">
        <p className="text-sm font-medium text-lank">{result.email}</p>
        <p className="mt-3 text-xs uppercase tracking-wide text-lank/50">{t.admin.tempPasswordNote}</p>
        <div className="mt-1 flex items-center gap-2">
          <code className="rounded-lg bg-white px-3 py-2 font-mono text-base font-semibold tracking-widest text-lank">
            {result.tempPassword}
          </code>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(result.tempPassword)
              setCopied(true)
            }}
            className="rounded-lg border border-lank/15 bg-white px-3 py-2 text-xs font-medium text-lank/70 hover:bg-paper"
          >
            {copied ? t.admin.copied : '⧉'}
          </button>
        </div>
        {result.promo?.applied && <p className="mt-3 text-xs text-fey">✔ {t.promo.assignDone}</p>}
        <button
          onClick={() => {
            setResult(null)
            setOpen(false)
            setCopied(false)
          }}
          className="mt-4 text-xs text-lank/60 hover:text-lank"
        >
          ← {t.common.close}
        </button>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-lank px-4 py-2 text-sm font-semibold text-white hover:bg-lank-600"
      >
        + {t.admin.createAccount}
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-lank">{t.admin.createAccount}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="email" type="email" required placeholder={t.admin.emailField} className={field} />
        <input name="name" placeholder={t.admin.nameField} className={field} />
        <select name="role" defaultValue="PWOFESYONEL" className={field}>
          {ASSIGNABLE.map((r) => (
            <option key={r} value={r}>
              {t.roles[r]}
            </option>
          ))}
        </select>
        <input name="org" placeholder={t.admin.orgField} className={field} />
        <input name="promo" placeholder={`${t.promo.code} (${t.admin.applyPromo})`} className={`${field} sm:col-span-2`} />
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error === 'exists' ? t.errors.exists : t.errors.invalidFields}</p>}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-lank px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? t.common.loading : t.admin.create}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-lank/15 px-4 py-2 text-sm text-lank/70">
          {t.common.cancel}
        </button>
      </div>
    </form>
  )
}

