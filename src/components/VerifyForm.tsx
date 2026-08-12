'use client'

import { useEffect, useRef, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { postJson } from '@/lib/http'
import type { Locale } from '@/lib/types'
import { hardRedirect } from '@/lib/auth/redirect'

export function VerifyForm({
  locale,
  t,
  enroll,
  qr,
  secretKey,
  sensitive,
}: {
  locale: Locale
  t: Dictionary
  enroll: boolean
  qr: string | null
  /** Clé TOTP brute (base32) — saisie manuelle si le scan échoue. */
  secretKey?: string | null
  sensitive: boolean
}) {
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

  // Curseur prêt sur la première case dès l'arrivée à la double authentification.
  useEffect(() => {
    refs.current[0]?.focus()
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
        // Le serveur nomme la cause : on la restitue telle quelle plutôt que de tout
        // ramener à « code invalide », seul message que l'utilisateur voyait jusqu'ici.
        const messages = t.errors as Record<string, string | undefined>
        setError(messages[res.error ?? ''] ?? t.errors.badCode)
        setDigits(['', '', '', '', '', ''])
        refs.current[0]?.focus()
        setLoading(false)
        return
      }
      hardRedirect(`/${locale}/dashboard`)
    } catch {
      setError(t.errors.badCode)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {enroll && qr && (
        <div className="rounded-xl border border-chabon/10 bg-koton p-4 text-center">
          <p className="mb-3 text-xs text-grafit">
            {locale === 'en'
              ? 'Scan this QR code with your authenticator app (first sign-in).'
              : locale === 'ht'
              ? 'Eskane kòd QR sa a ak aplikasyon otantifikatè ou a (premye koneksyon).'
              : "Scannez ce QR code avec votre application d'authentification (première connexion)."}
          </p>
          {/* ⚠️ L'AVERTISSEMENT QUI MANQUAIT. Après une réinitialisation de la 2FA, la clé
              change mais l'ancienne entrée « Lam » reste dans l'application : elle continue
              d'afficher des codes, tous refusés. Sans cette phrase, l'utilisateur retape
              indéfiniment un code condamné — c'est exactement ce qui s'est produit. */}
          <p className="mb-3 flex items-start gap-1.5 rounded-lg border-l-2 border-wouj bg-white px-3 py-2 text-left text-[11px] font-medium leading-relaxed text-wouj">
            <span aria-hidden="true">⚠</span>
            <span>
              {locale === 'en'
                ? 'If “Lam” already appears in your app, delete that entry first — its key is no longer valid.'
                : locale === 'ht'
                ? 'Si « Lam » deja parèt nan aplikasyon ou, efase ansyen antre a anvan — kle li pa bon ankò.'
                : "Si « Lam » figure déjà dans votre application, supprimez d'abord cette entrée — sa clé n'est plus valable."}
            </span>
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR TOTP" width={170} height={170} className="mx-auto rounded-lg" />
          {secretKey && (
            <div className="mt-3 border-t border-chabon/10 pt-3">
              <p className="text-[11px] text-ank/80">
                {locale === 'en'
                  ? "Can't scan? Enter this key manually:"
                  : locale === 'ht'
                  ? 'Ou pa ka eskane? Antre kle sa a alamen:'
                  : 'Impossible de scanner ? Saisissez cette clé manuellement :'}
              </p>
              <p className="mt-1 select-all font-mono text-sm font-semibold tracking-widest text-ank">
                {secretKey.replace(/(.{4})/g, '$1 ').trim()}
              </p>
            </div>
          )}
          <p className="mt-3 rounded-lg bg-pil px-3 py-2 text-[11px] leading-relaxed text-grafit">
            {locale === 'en'
              ? '⏰ Make sure your phone’s date & time are set to automatic — a clock that is off by more than ~2 min makes every code fail.'
              : locale === 'ht'
              ? '⏰ Asire dat ak lè telefòn ou an regle otomatikman — si lè a dekale plis pase ~2 min, chak kòd ap refize.'
              : "⏰ Vérifiez que la date et l’heure de votre téléphone sont réglées sur automatique — une horloge décalée de plus de ~2 min fait échouer chaque code."}
          </p>
        </div>
      )}

      <div>
        <p className="text-center text-sm text-ank/80">{t.verify.instruction}</p>
        <p className="text-center text-xs text-ank/80">{t.verify.instructionAlt}</p>
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
            className="h-14 w-11 rounded-xl border border-chabon/15 bg-white text-center text-2xl font-semibold text-ank outline-none focus:border-liy"
          />
        ))}
      </div>

      {devCode && (
        <p className="rounded-lg bg-pil px-3 py-2 text-center text-xs text-grafit">
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
        <p className="rounded-lg bg-pil px-3 py-2 text-center text-sm text-wouj" role="alert">
          {error}
        </p>
      )}

      {/* Appareil de confiance : indisponible pour les rôles sensibles (admin/éditeur),
          qui refont la 2FA à chaque session. On masque la case (au lieu de la griser)
          pour ne pas donner l'impression d'un contrôle cassé ; la note explique pourquoi. */}
      {sensitive ? (
        <p className="text-center text-[11px] text-ank/80">{t.verify.sensitiveNote}</p>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 text-xs text-grafit">
          <input
            type="checkbox"
            checked={trust}
            onChange={(e) => setTrust(e.target.checked)}
            className="h-4 w-4 rounded border-chabon/30 accent-chabon"
          />
          {t.verify.trust} / {t.verify.trustAlt}
        </label>
      )}

      <button
        type="submit"
        disabled={loading || digits.join('').length !== 6}
        className="min-h-[44px] w-full rounded-lg bg-wouj text-sm font-semibold text-white outline-none ring-wouj ring-offset-2 transition hover:brightness-95 focus-visible:ring-2 disabled:opacity-50"
      >
        {loading ? t.common.loading : t.verify.validate}
      </button>
    </form>
  )
}
