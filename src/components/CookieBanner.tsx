'use client'

import { useEffect, useState } from 'react'

/**
 * Bandeau de consentement aux cookies (Politique §9). Cookies strictement
 * nécessaires sans consentement ; cookies d'analyse sur consentement explicite.
 * État mémorisé dans un cookie réel (pas de localStorage) ; rien n'est déposé tant
 * que l'utilisateur n'a pas choisi.
 */
export function CookieBanner({
  text,
  accept,
  reject,
  manage,
  manageHref,
}: {
  text: string
  accept: string
  reject: string
  manage: string
  manageHref: string
}) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!document.cookie.split('; ').some((c) => c.startsWith('lam_cc='))) setShow(true)
  }, [])
  if (!show) return null
  const choose = (v: 'all' | 'essential') => {
    document.cookie = `lam_cc=${v};path=/;max-age=${60 * 60 * 24 * 180};SameSite=Lax`
    setShow(false)
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-sitwon bg-lank text-cream shadow-2xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <p className="max-w-2xl text-sm text-cream/85">{text}</p>
        <div className="flex flex-wrap gap-2">
          <a href={manageHref} className="rounded-full border border-cream/30 px-4 py-2 text-sm font-medium text-cream hover:bg-white/10">{manage}</a>
          <button onClick={() => choose('essential')} className="rounded-full border border-cream/30 px-4 py-2 text-sm font-medium text-cream hover:bg-white/10">{reject}</button>
          <button onClick={() => choose('all')} className="rounded-full bg-sitwon px-4 py-2 text-sm font-semibold text-lank hover:bg-sitwon/90">{accept}</button>
        </div>
      </div>
    </div>
  )
}
