'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale, Role } from '@/lib/types'
import { can } from '@/lib/rbac'

export function AdminNav({ locale, t, role, enAttente = 0 }: { locale: Locale; t: Dictionary; role: Role; enAttente?: number }) {
  const pathname = usePathname() || ''
  // Deux natures de travail, deux groupes : la CURATION du corpus, ouverte à la rédaction,
  // et la GOUVERNANCE — comptes, facturation, journaux — réservée au master admin.
  //
  // ⚠️ CE MENU N'EST PAS UNE SÉCURITÉ. Masquer une entrée ne protège rien : ce sont les
  // gardes de page et de route qui protègent. Ne jamais « ouvrir » un écran en se
  // contentant d'afficher son lien.
  const estMaster = role === 'MASTER_ADMIN'
  const peutCurer = can(role, 'corpus.manage')

  const curation = peutCurer
    ? [
        { href: `/${locale}/admin/moniteur`, label: t.admin.moniteurNav },
        { href: `/${locale}/admin/index-moniteur`, label: t.admin.indexMoniteurNav },
        { href: `/${locale}/admin/marques`, label: t.admin.marquesNav },
        { href: `/${locale}/admin/brh`, label: t.admin.brhNav },
        { href: `/${locale}/admin/tarifs`, label: t.admin.tarifsNav },
        { href: `/${locale}/admin/juridictions`, label: t.admin.juridictionsNav },
        { href: `/${locale}/admin/delais`, label: t.delaisAdmin.nav },
        { href: `/${locale}/admin/themes`, label: t.admin.themesNav },
        { href: `/${locale}/admin/jurisprudence`, label: 'Jurisprudence' },
        { href: `/${locale}/admin/notes`, label: 'Notes des lecteurs' },
        { href: `/${locale}/admin/upload`, label: t.admin.upload },
      ]
    : []

  const gouvernance = estMaster
    ? [
        { href: `/${locale}/admin`, label: t.admin.overview, exact: true, badge: enAttente },
        { href: `/${locale}/admin/users`, label: t.admin.users },
        { href: `/${locale}/admin/promo`, label: t.admin.promoNav },
        { href: `/${locale}/admin/logs`, label: t.admin.logs },
      ]
    : []

  const groupes: { titre: string; items: { href: string; label: string; exact?: boolean; badge?: number }[] }[] = [
    { titre: 'Corpus', items: curation },
    { titre: 'Administration', items: gouvernance },
  ].filter((g) => g.items.length)

  return (
    <nav className="space-y-4">
      {groupes.map((g) => (
        <div key={g.titre} className="space-y-1">
          {/* Le sur-titre n'apparaît que s'il y a deux groupes à distinguer. */}
          {groupes.length > 1 && (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-koton/70">{g.titre}</p>
          )}
          {g.items.map((it) => {
            const active = it.exact ? pathname === it.href : pathname.startsWith(it.href)
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'border-l-2 border-wouj bg-white/15 font-medium text-white'
                    : 'border-l-2 border-transparent text-white/65 hover:bg-white/10 hover:text-white'
                }`}
              >
                {it.label}
                {/* Pastille de file d'attente : le nombre est écrit, jamais suggéré par la
                    seule couleur, et l'intitulé accessible dit de quoi il s'agit. */}
                {it.badge ? (
                  <span
                    className="ml-2 inline-flex min-w-[1.25rem] justify-center rounded-full bg-wouj px-1.5 py-0.5 align-middle font-mono text-[10px] font-semibold text-white"
                    title={t.admin.kpiPending}
                  >
                    {it.badge}
                    <span className="sr-only"> {t.admin.kpiPending}</span>
                  </span>
                ) : null}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
