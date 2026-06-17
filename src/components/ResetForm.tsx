'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { postJson } from '@/lib/http'
import type { Locale } from '@/lib/types'

const LBL = {
  password: { fr: 'Nouveau mot de passe', en: 'New password', ht: 'Nouvo modpas' },
  confirm: { fr: 'Confirmer le mot de passe', en: 'Confirm password', ht: 'Konfime modpas' },
  hint: { fr: '8 caractères minimum.', en: 'At least 8 characters.', ht: 'Omwen 8 karaktè.' },
  submit: { fr: 'Réinitialiser le mot de passe', en: 'Reset password', ht: 'Reyinisyalize modpas' },
  saving: { fr: 'Enregistrement…', en: 'Saving…', ht: 'N ap anrejistre…' },
  mismatch: { fr: 'Les mots de passe ne correspondent pas.', en: 'Passwords do not match.', ht: 'Modpas yo pa menm.' },
  weak: {
    fr: 'Le mot de passe doit contenir au moins 8 caractères.',
    en: 'Password must be at least 8 characters.',
    ht: 'Modpas la dwe gen omwen 8 karaktè.',
  },
  invalid: {
    fr: 'Ce lien est invalide ou a expiré. Veuillez refaire une demande.',
    en: 'This link is invalid or has expired. Please request a new one.',
    ht: 'Lyen sa a pa valab oswa li ekspire. Tanpri refè demann lan.',
  },
  rate: {
    fr: 'Trop de tentatives. Réessayez dans quelques minutes.',
    en: 'Too many attempts. Try again in a few minutes.',
    ht: 'Twòp tantativ. Reseye nan kèk minit.',
  },
  generic: { fr: 'Une erreur est survenue. Réessayez.', en: 'Something went wrong. Try again.', ht: 'Yon erè rive. Reseye.' },
  done: {
    fr: 'Mot de passe réinitialisé. Vous pouvez maintenant vous connecter.',
    en: 'Password reset. You can now sign in.',
    ht: 'Modpas reyinisyalize. Ou ka konekte kounye a.',
  },
  toLogin: { fr: 'Se connecter', en: 'Sign in', ht: 'Konekte' },
} as const

export function ResetForm({ locale, token }: { locale: Locale; token: string }) {
  const router = useRouter()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (pw.length < 8) return setError(LBL.weak[locale])
    if (pw !== confirm) return setError(LBL.mismatch[locale])
    setLoading(true)
    const res = await postJson('/api/auth/reset', { token, password: pw })
    if (!res.ok) {
      const code = res.error
      setError(
        code === 'resetInvalid' ? LBL.invalid[locale]
          : code === 'rate' ? LBL.rate[locale]
          : code === 'weakPassword' ? LBL.weak[locale]
          : LBL.generic[locale],
      )
      setLoading(false)
      return
    }
    setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-green-50 px-3 py-3 text-sm text-green-800">{LBL.done[locale]}</p>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/login`)}
          className="w-full rounded-lg bg-lank py-2.5 text-sm font-semibold text-white transition hover:bg-lank-600"
        >
          {LBL.toLogin[locale]}
        </button>
      </div>
    )
  }

  const input = 'w-full rounded-lg border border-lank/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sitwon'
  const label = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-lank/60'

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={label}>{LBL.password[locale]}</label>
        <input type="password" required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={input} />
        <p className="mt-1 text-[11px] text-lank/45">{LBL.hint[locale]}</p>
      </div>
      <div>
        <label className={label}>{LBL.confirm[locale]}</label>
        <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
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
        {loading ? LBL.saving[locale] : LBL.submit[locale]}
      </button>
    </form>
  )
}
