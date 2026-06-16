'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/lib/types'

/**
 * Déconnexion automatique pour inactivité (§sécurité). Détecte l'absence d'activité
 * (souris, clavier, défilement, tactile) ; affiche un avertissement avec compte à
 * rebours `warningSeconds` avant la fin, puis déconnecte et renvoie à /login.
 * Pendant l'activité, envoie un ping (throttle) pour garder la session serveur vivante.
 * NB : pendant l'avertissement, l'activité ne réarme PAS automatiquement — il faut
 * cliquer « Rester connecté » (plus sûr : un mouvement accidentel ne maintient pas
 * une session à un poste abandonné).
 */
const LBL = {
  title: { fr: 'Toujours là ?', en: 'Still there?', ht: 'Ou la toujou ?' },
  body: {
    fr: 'Par mesure de sécurité, vous allez être déconnecté pour inactivité dans',
    en: 'For security, you will be signed out for inactivity in',
    ht: 'Pou sekirite, n ap dekonekte w pou inaktivite nan',
  },
  seconds: { fr: 'secondes', en: 'seconds', ht: 'segonn' },
  stay: { fr: 'Rester connecté', en: 'Stay signed in', ht: 'Rete konekte' },
  logout: { fr: 'Se déconnecter', en: 'Sign out', ht: 'Dekonekte' },
} as const

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const
const HEARTBEAT_THROTTLE_MS = 5 * 60_000

export function IdleTimer({
  locale,
  idleMinutes,
  warningSeconds,
}: {
  locale: Locale
  idleMinutes: number
  warningSeconds: number
}) {
  const router = useRouter()
  const [warning, setWarning] = useState(false)
  const [remaining, setRemaining] = useState(warningSeconds)

  const warningRef = useRef(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdown = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastBeat = useRef(0)
  const loggingOut = useRef(false)

  useEffect(() => {
    warningRef.current = warning
  }, [warning])

  const logout = useCallback(async () => {
    if (loggingOut.current) return
    loggingOut.current = true
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      /* on redirige quand même */
    }
    router.push(`/${locale}/login?timeout=1`)
  }, [router, locale])

  const beat = useCallback((force = false) => {
    const now = Date.now()
    if (!force && now - lastBeat.current < HEARTBEAT_THROTTLE_MS) return
    lastBeat.current = now
    fetch('/api/auth/heartbeat', { method: 'POST' }).catch(() => {})
  }, [])

  const arm = useCallback(() => {
    if (loggingOut.current) return
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (countdown.current) clearInterval(countdown.current)
    setWarning(false)
    const warnAfterMs = Math.max(1000, idleMinutes * 60_000 - warningSeconds * 1000)
    idleTimer.current = setTimeout(() => {
      setWarning(true)
      setRemaining(warningSeconds)
      countdown.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            if (countdown.current) clearInterval(countdown.current)
            logout()
            return 0
          }
          return r - 1
        })
      }, 1000)
    }, warnAfterMs)
  }, [idleMinutes, warningSeconds, logout])

  useEffect(() => {
    const onActivity = () => {
      if (loggingOut.current || warningRef.current) return // pendant l'avertissement : clic explicite requis
      arm()
      beat()
    }
    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, onActivity, { passive: true })
    arm()
    return () => {
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, onActivity)
      if (idleTimer.current) clearTimeout(idleTimer.current)
      if (countdown.current) clearInterval(countdown.current)
    }
  }, [arm, beat])

  if (!warning) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-lank/40 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="idle-title" className="text-lg font-bold text-lank">
          {LBL.title[locale]}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-lank/70">
          {LBL.body[locale]} <span className="font-bold text-lank">{remaining}</span> {LBL.seconds[locale]}.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => {
              arm()
              beat(true)
            }}
            className="flex-1 rounded-lg bg-lank px-4 py-2 text-sm font-medium text-cream transition hover:bg-lank/90"
          >
            {LBL.stay[locale]}
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-lank/15 px-4 py-2 text-sm text-lank/70 transition hover:bg-paper"
          >
            {LBL.logout[locale]}
          </button>
        </div>
      </div>
    </div>
  )
}
