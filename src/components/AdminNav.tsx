'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale, Role } from '@/lib/types'

export function AdminNav({ locale, t, role }: { locale: Locale; t: Dictionary; role: Role }) {
  const pathname = usePathname() || ''
  const isAdmin = role === 'MASTER_ADMIN'
  const items = [
    ...(isAdmin ? [{ href: `/${locale}/admin`, label: t.admin.overview, exact: true }] : []),
    ...(isAdmin ? [{ href: `/${locale}/admin/users`, label: t.admin.users }] : []),
    ...(isAdmin ? [{ href: `/${locale}/admin/promo`, label: t.admin.promoNav }] : []),
    ...(isAdmin ? [{ href: `/${locale}/admin/moniteur`, label: t.admin.moniteurNav }] : []),
    ...(isAdmin ? [{ href: `/${locale}/admin/index-moniteur`, label: t.admin.indexMoniteurNav }] : []),
    ...(isAdmin ? [{ href: `/${locale}/admin/marques`, label: t.admin.marquesNav }] : []),
    ...(isAdmin ? [{ href: `/${locale}/admin/brh`, label: t.admin.brhNav }] : []),
    ...(isAdmin ? [{ href: `/${locale}/admin/tarifs`, label: t.admin.tarifsNav }] : []),
    ...(isAdmin ? [{ href: `/${locale}/admin/themes`, label: t.admin.themesNav }] : []),
    { href: `/${locale}/admin/upload`, label: t.admin.upload },
    ...(isAdmin ? [{ href: `/${locale}/admin/logs`, label: t.admin.logs }] : []),
  ]
  return (
    <nav className="space-y-1">
      {items.map((it) => {
        const active = it.exact ? pathname === it.href : pathname.startsWith(it.href)
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`block rounded-lg px-3 py-2 text-sm transition ${
              active ? 'bg-white/15 font-medium text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'
            }`}
          >
            {it.label}
          </Link>
        )
      })}
    </nav>
  )
}
