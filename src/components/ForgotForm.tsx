'use client'

import { useState } from 'react'
import { postJson } from '@/lib/http'
import type { Locale } from '@/lib/types'

// Libellés trilingues en ligne (même approche que IdleTimer) — pas de dépendance i18n.
const LBL = {
  email: { fr: 'Adresse courriel / Email', en: 'Email address', ht: 'Adrès imèl' },
  submit: { fr: 'Envoyer le lien', en: 'Send reset link', ht: 'Voye lyen an' },
  sending: { fr: 'Envoi…', en: 'Sending…', ht: 'N ap voye…' },
  done: {
    fr: "Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d'être envoyé. Vérifiez votre boîte de réception (et les indésirables).",
    en: 'If an account exists for this address, a reset email has just been sent. Check your inbox (and spam).',
    ht: 'Si gen yon kont pou adrès sa a, nou fèk voye yon imèl pou reyinisyalize. Tcheke bwat resepsyon w (ak spam).',
  },
  back: { fr: 'Retour à la connexion', en: 'Back to sign in', ht: 'Tounen nan koneksyon' },
} as const

export function ForgotForm({ locale }: { locale: Locale }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await postJson('/api/auth/forgot', { email }) // réponse toujours ok (anti-énumération)
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-pil px-3 py-3 text-sm leading-relaxed text-ank/80">{LBL.done[locale]}</p>
        <a href={`/${locale}/login`} className="inline-flex min-h-[44px] w-full items-center justify-center text-xs text-grafit outline-none ring-wouj transition hover:text-wouj focus-visible:ring-2">
          {LBL.back[locale]}
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-grafit">
          {LBL.email[locale]}
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@cabinet.ht"
          className="min-h-[44px] w-full rounded-lg border border-liy bg-white px-3.5 text-sm text-ank outline-none ring-wouj transition focus:border-wouj focus-visible:ring-2"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="min-h-[44px] w-full rounded-lg bg-wouj text-sm font-semibold text-white outline-none ring-wouj ring-offset-2 transition hover:brightness-95 focus-visible:ring-2 disabled:opacity-60"
      >
        {loading ? LBL.sending[locale] : LBL.submit[locale]}
      </button>
      <a href={`/${locale}/login`} className="inline-flex min-h-[44px] w-full items-center justify-center text-xs text-grafit outline-none ring-wouj transition hover:text-wouj focus-visible:ring-2">
        {LBL.back[locale]}
      </a>
    </form>
  )
}
