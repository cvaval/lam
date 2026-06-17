'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { postJson } from '@/lib/http'
import type { Locale } from '@/lib/types'

export function LoginForm({ locale, t }: { locale: Locale; t: Dictionary }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await postJson('/api/auth/login', { email, password })
    if (!res.ok) {
      setError((t.errors as Record<string, string>)[res.error ?? ''] ?? t.errors.invalidCredentials)
      setLoading(false)
      return
    }
    router.push(res.data.step === 'done' ? `/${locale}/dashboard` : `/${locale}/verify`)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-lank/60">
          {t.home.emailLabel}
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@cabinet.ht"
          className="w-full rounded-lg border border-lank/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sitwon"
        />
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-lank/60">
          {t.home.passwordLabel}
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••"
          className="w-full rounded-lg border border-lank/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sitwon"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-lank py-2.5 text-sm font-semibold text-white transition hover:bg-lank-600 disabled:opacity-60"
      >
        {loading ? t.common.loading : t.home.signinBtn}
      </button>

      <div className="text-center">
        <a href={`/${locale}/forgot`} className="text-xs text-lank/50 hover:text-lank">
          {t.home.forgot}
        </a>
      </div>
    </form>
  )
}
