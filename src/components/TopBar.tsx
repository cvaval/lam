'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from './Logo'
import { LocaleSwitcher } from './LocaleSwitcher'
import { TopBarSearch } from './TopBarSearch'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { postJson } from '@/lib/http'
import { LOGGED_OUT_KEY } from './IdleTimer'
import type { Locale } from '@/lib/types'

export function TopBar({
  locale,
  t,
  name,
  email,
  roleLabel,
  isAdmin,
}: {
  locale: Locale
  t: Dictionary
  name: string
  email: string
  roleLabel: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function logout() {
    await postJson('/api/auth/logout')
    // Préviens les AUTRES onglets (IdleTimer les bascule vers /login) : sans cela ils
    // restent affichés sur une session détruite et le clic suivant y « déconnecte ».
    try {
      localStorage.setItem(LOGGED_OUT_KEY, String(Date.now()))
    } catch {
      /* sans stockage : les autres onglets le découvriront à leur prochaine requête */
    }
    router.push(`/${locale}/login`)
  }

  return (
    <header className="no-print sticky top-0 z-30 border-b border-lank/10 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link href={`/${locale}/dashboard`} className="shrink-0">
          <Logo size={26} />
        </Link>
        <div className="mx-2 hidden max-w-xl flex-1 sm:block">
          <TopBarSearch locale={locale} placeholder={t.dashboard.omnibox} advancedLabel={t.search.advanced} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isAdmin && (
            <Link
              href={`/${locale}/admin`}
              className="hidden rounded-full bg-lank px-3 py-1.5 text-xs font-semibold text-white md:inline-block"
            >
              {t.nav.admin}
            </Link>
          )}
          <LocaleSwitcher current={locale} />
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-lank/15 bg-white py-1 pl-1 pr-2.5"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-lank text-xs font-semibold text-white">
                {(name || email).slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden text-xs font-medium text-lank sm:inline">{name || email.split('@')[0]}</span>
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-lank/10 bg-white p-2 shadow-card">
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium text-lank">{email}</p>
                  <p className="text-xs text-lank/55">{roleLabel}</p>
                </div>
                <Link
                  href={`/${locale}/account`}
                  className="block rounded-lg px-3 py-2 text-sm text-lank hover:bg-paper"
                  onClick={() => setOpen(false)}
                >
                  {t.nav.account}
                </Link>
                {isAdmin && (
                  <Link
                    href={`/${locale}/admin`}
                    className="block rounded-lg px-3 py-2 text-sm text-lank hover:bg-paper md:hidden"
                    onClick={() => setOpen(false)}
                  >
                    {t.nav.admin}
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                >
                  {t.common.signOut}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="px-4 pb-2.5 sm:hidden">
        <TopBarSearch locale={locale} placeholder={t.dashboard.omnibox} advancedLabel={t.search.advanced} />
      </div>
    </header>
  )
}
