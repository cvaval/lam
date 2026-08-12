'use client'

import { useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { postJson } from '@/lib/http'

export function RegisterForm({ t }: { t: Dictionary }) {
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const res = await postJson('/api/auth/register', {
      email: fd.get('email'),
      password: fd.get('password'),
      name: fd.get('name') || undefined,
      org: fd.get('org') || undefined,
    })
    setLoading(false)
    if (res.ok) setDone(true)
    else setError(t.errors.invalidCredentials)
  }

  if (done) {
    return <p className="rounded-lg bg-pil px-4 py-3 text-sm text-ank">{t.register.done}</p>
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input
        name="name"
        placeholder={t.register.name}
        className="min-h-[44px] w-full rounded-lg border border-liy bg-white px-3.5 text-sm text-ank outline-none ring-wouj transition focus:border-wouj focus-visible:ring-2"
      />
      <input
        name="org"
        placeholder={t.register.org}
        className="min-h-[44px] w-full rounded-lg border border-liy bg-white px-3.5 text-sm text-ank outline-none ring-wouj transition focus:border-wouj focus-visible:ring-2"
      />
      <input
        name="email"
        type="email"
        required
        placeholder={t.home.emailLabel}
        className="min-h-[44px] w-full rounded-lg border border-liy bg-white px-3.5 text-sm text-ank outline-none ring-wouj transition focus:border-wouj focus-visible:ring-2"
      />
      <input
        name="password"
        type="password"
        required
        minLength={8}
        placeholder={t.home.passwordLabel}
        className="min-h-[44px] w-full rounded-lg border border-liy bg-white px-3.5 text-sm text-ank outline-none ring-wouj transition focus:border-wouj focus-visible:ring-2"
      />
      {error && (
        <p role="alert" className="rounded-lg border-l-2 border-wouj bg-white px-3 py-2 text-sm text-wouj">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="min-h-[44px] w-full rounded-lg bg-wouj text-sm font-semibold text-white outline-none ring-wouj ring-offset-2 transition hover:brightness-95 focus-visible:ring-2 disabled:opacity-60"
      >
        {loading ? t.common.loading : t.register.submit}
      </button>
    </form>
  )
}
