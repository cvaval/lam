'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LOCALES, LOCALE_SHORT, LOCALE_NAMES, LOCALE_COOKIE } from '@/lib/i18n/config'
import type { Locale } from '@/lib/types'

/** Sélecteur FR | EN | HT persistant (§02) — mémorisé par cookie + compte. */
export function LocaleSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname()
  const router = useRouter()

  function switchTo(locale: Locale) {
    if (locale === current) return
    document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`
    const segments = (pathname || '/').split('/')
    if (LOCALES.includes(segments[1] as Locale)) segments[1] = locale
    else segments.splice(1, 0, locale)
    router.push(segments.join('/') || `/${locale}`)
    // persiste aussi côté compte
    fetch('/api/account/locale', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale }),
    }).catch(() => {})
  }

  return (
    <div className="inline-flex items-center rounded-full border border-lank/15 bg-white p-0.5 text-xs font-medium">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          aria-pressed={l === current}
          aria-label={LOCALE_NAMES[l]}
          title={LOCALE_NAMES[l]}
          className={`rounded-full px-2.5 py-1 transition ${
            l === current ? 'bg-lank text-white' : 'text-lank/60 hover:text-lank'
          }`}
        >
          {LOCALE_SHORT[l]}
        </button>
      ))}
    </div>
  )
}
