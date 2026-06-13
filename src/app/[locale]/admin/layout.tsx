import Link from 'next/link'
import { FruitMark } from '@/components/Logo'
import { BRAND } from '@/lib/brand'
import { AdminNav } from '@/components/AdminNav'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { dictFor } from '@/lib/i18n/server'
import { requireCapability } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

// Écran 6 — Master Admin (§08). Chrome utilitariste : sidebar Lank.
// Accessible aux comptes capables de publier (Éditeur + Master Admin) ; les pages
// Vue d'ensemble / Utilisateurs / Logs restent réservées au Master Admin.
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireCapability(locale, 'upload.publish')

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="hidden w-60 shrink-0 flex-col bg-lank px-4 py-5 md:flex">
        <div className="mb-1 flex items-center gap-2 px-2 text-cream">
          <FruitMark size={24} tone="dark" />
          <span className="text-sm font-extrabold lowercase tracking-tight">{BRAND.wordmark}</span>
        </div>
        <p className="mb-6 px-2 text-[10px] font-semibold uppercase tracking-widest text-sitwon">
          {user.role === 'MASTER_ADMIN' ? 'Master Admin' : t.roles.EDITEUR}
        </p>
        <AdminNav locale={locale} t={t} role={user.role} />
        <div className="mt-auto px-2 pt-6">
          <Link href={`/${locale}/dashboard`} className="text-xs text-white/55 hover:text-white">
            ← {t.nav.dashboard}
          </Link>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-lank/10 bg-white px-6 py-3 md:justify-end">
          <div className="flex items-center gap-2 text-lank md:hidden">
            <FruitMark size={22} />
            <span className="text-xs font-semibold uppercase tracking-wide text-lank/60">Admin</span>
          </div>
          <LocaleSwitcher current={locale} />
        </header>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  )
}
