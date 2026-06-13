'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { postJson } from '@/lib/http'
import type { Locale } from '@/lib/types'

export function VerifyForm({
  locale,
  t,
  enroll,
  qr,
  sensitive,
}: {
  locale: Locale
  t: Dictionary
  enroll: boolean
  qr: string | null
  sensitive: boolean
}) {
  const router = useRouter()
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [trust, setTrust] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [devCode, setDevCode] = useState<string | null>(null)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  // Confort de démonstration (dev) : récupère le code TOTP courant.
  useEffect(() => {
    fetch('/api/auth/devcode')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.ok && setDevCode(d.code))
      .catch(() => {})
  }, [])

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, '')
    if (!clean) {
      const next = [...digits]
      next[i] = ''
      setDigits(next)
      return
    }
    const next = [...digits]
    // collage multi-chiffres
    if (clean.length > 1) {
      const chars = clean.slice(0, 6 - i).split('')
      chars.forEach((c, k) => (next[i + k] = c))
      setDigits(next)
      refs.current[Math.min(i + chars.length, 5)]?.focus()
      return
    }
    next[i] = clean
    setDigits(next)
    if (i < 5) refs.current[i + 1]?.focus()
  }

  function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const code = digits.join('')
    if (code.length !== 6) return
    setError(null)
    setLoading(true)
    try {
      const res = await postJson('/api/auth/verify', { code, trustDevice: trust })
      if (!res.ok) {
        setError(res.error === 'locked' ? t.errors.locked : t.errors.badCode)
        setDigits(['', '', '', '', '', ''])
        refs.current[0]?.focus()
        setLoading(false)
        return
      }
      router.push(`/${locale}/dashboard`)
    } catch {
      setError(t.errors.badCode)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {enroll && qr && (
        <div className="rounded-xl border border-lank/10 bg-paper p-4 text-center">
          <p className="mb-3 text-xs text-lank/60">
            {locale === 'en'
              ? 'Scan this QR code with your authenticator app (first sign-in).'
              : locale === 'ht'
              ? 'Eskane kòd QR sa a ak aplikasyon otantifikatè ou a (premye koneksyon).'
              : "Scannez ce QR code avec votre application d'authentification (première connexion)."}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR TOTP" width={170} height={170} className="mx-auto rounded-lg" />
        </div>
      )}

      <div>
        <p className="text-center text-sm text-lank/80">{t.verify.instruction}</p>
        <p className="text-center text-xs text-lank/45">{t.verify.instructionAlt}</p>
      </div>

      <div className="flex justify-center gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            inputMode="numeric"
            maxLength={6}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            aria-label={`chiffre ${i + 1}`}
            className="h-14 w-11 rounded-xl border border-lank/15 bg-white text-center text-2xl font-semibold text-lank outline-none focus:border-sitwon"
          />
        ))}
      </div>

      {devCode && (
        <p className="rounded-lg bg-sitwon-50 px-3 py-2 text-center text-xs text-lank/70">
          {locale === 'en' ? 'Demo code (dev only): ' : 'Code de démo (dev) : '}
          <button
            type="button"
            onClick={() => {
              setDigits(devCode.split(''))
              refs.current[5]?.focus()
            }}
            className="font-mono font-bold tracking-widest underline"
          >
            {devCode}
          </button>
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <label className={`flex items-center justify-center gap-2 text-xs ${sensitive ? 'opacity-40' : 'text-lank/70'}`}>
        <input
          type="checkbox"
          checked={trust}
          disabled={sensitive}
          onChange={(e) => setTrust(e.target.checked)}
          className="h-4 w-4 rounded border-lank/30 accent-lank"
        />
        {t.verify.trust} / {t.verify.trustAlt}
      </label>
      {sensitive && <p className="text-center text-[11px] text-lank/40">{t.verify.sensitiveNote}</p>}

      <button
        type="submit"
        disabled={loading || digits.join('').length !== 6}
        className="w-full rounded-lg bg-lank py-2.5 text-sm font-semibold text-white transition hover:bg-lank-600 disabled:opacity-50"
      >
        {loading ? t.common.loading : t.verify.validate}
      </button>
    </form>
  )
}
