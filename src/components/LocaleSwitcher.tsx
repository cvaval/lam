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
    // ⚠️ CIBLE TACTILE DE 44 px (§16). Les trois boutons mesuraient 24 px de haut : sur
    // 24 cibles trop petites relevées dans tout le site public, C'ÉTAIENT LES SEULES —
    // et elles paraissent sur chaque page. La pastille garde son allure ; c'est la zone
    // CLIQUABLE qui s'étend, par le rembourrage vertical.
    <div className="inline-flex items-center rounded-full border border-liy bg-white text-xs font-medium">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          aria-pressed={l === current}
          aria-label={LOCALE_NAMES[l]}
          title={LOCALE_NAMES[l]}
          className={`min-h-[44px] min-w-[44px] rounded-full px-4 outline-none ring-wouj transition focus-visible:ring-2 ${
            l === current ? 'bg-wouj text-white' : 'text-grafit hover:text-wouj'
          }`}
        >
          {LOCALE_SHORT[l]}
        </button>
      ))}
    </div>
  )
}
