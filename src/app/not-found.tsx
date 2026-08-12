'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { resolveLocale } from '@/lib/i18n/config'

/**
 * 404 brandée et localisée (audit UX 15 juil. : la page Next.js par défaut,
 * anglaise et non brandée, détonnait dans un produit trilingue). Next ne passe
 * aucun params à not-found — la locale est lue dans le SEGMENT D'URL
 * (/fr/…, /en/…, /ht/…), comme le fait error.tsx via useParams ; repli FR pour
 * les chemins hors segment localisé. Réexportée par [locale]/not-found.tsx
 * pour les notFound() lancés dans les pages (ex. document inexistant).
 */
export default function NotFound() {
  const pathname = usePathname()
  const locale = resolveLocale(pathname?.split('/')[1])
  const t = getDictionary(locale)

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-koton px-4">
      <div className="mx-auto max-w-md rounded-2xl border border-chabon/10 bg-white p-8 text-center">
        <p className="text-4xl font-semibold text-ank/80">404</p>
        <h1 className="mt-2 text-lg font-semibold text-ank">{t.errorPage.notFoundTitle}</h1>
        <p className="mt-2 text-sm text-grafit">{t.errorPage.notFoundBody}</p>
        <Link
          href={`/${locale}/dashboard`}
          className="mt-5 inline-block rounded-lg bg-chabon px-4 py-2 text-sm font-semibold text-white hover:bg-chabon"
        >
          {t.errorPage.home}
        </Link>
      </div>
    </div>
  )
}
