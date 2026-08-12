'use client'

import { useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { postJson } from '@/lib/http'
import type { Locale } from '@/lib/types'
import { hardRedirect } from '@/lib/auth/redirect'

export function LoginForm({ locale, t }: { locale: Locale; t: Dictionary }) {
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
    hardRedirect(res.data.step === 'done' ? `/${locale}/dashboard` : `/${locale}/verify`)
  }

  // Un identifiant stable relie libellé, champ et message d'erreur. `aria-describedby`
  // ne pointe l'erreur QUE si elle existe : une référence morte est ignorée par certains
  // lecteurs d'écran et bruyante chez d'autres.
  const champ =
    'min-h-[44px] w-full rounded-lg border border-liy bg-white px-3.5 py-2.5 text-sm text-ank outline-none ring-wouj transition focus:border-wouj focus-visible:ring-2'
  const etiquette = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-grafit'

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="login-email" className={etiquette}>
          {t.home.emailLabel}
        </label>
        <input
          id="login-email"
          type="email"
          required
          autoComplete="email"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@cabinet.ht"
          className={champ}
        />
      </div>
      <div>
        <label htmlFor="login-password" className={etiquette}>
          {t.home.passwordLabel}
        </label>
        <input
          id="login-password"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••"
          className={champ}
        />
      </div>

      {error && (
        // Le pictogramme double la couleur : la règle 5 interdit l'information portée
        // par la seule teinte.
        <p id="login-error" role="alert" className="flex items-start gap-2 rounded-lg border-l-2 border-wouj bg-pil px-3 py-2 text-sm text-wouj">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="min-h-[44px] w-full rounded-lg bg-wouj py-2.5 text-sm font-semibold text-white outline-none ring-wouj ring-offset-2 transition hover:brightness-95 focus-visible:ring-2 disabled:opacity-60"
      >
        {loading ? t.common.loading : t.home.signinBtn}
      </button>

      <div className="text-center">
        <a href={`/${locale}/forgot`} className="inline-flex min-h-[44px] items-center text-xs text-grafit underline-offset-2 outline-none ring-wouj transition hover:text-wouj hover:underline focus-visible:ring-2">
          {t.home.forgot}
        </a>
      </div>
    </form>
  )
}
