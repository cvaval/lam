'use client'

import { useParams } from 'next/navigation'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { resolveLocale } from '@/lib/i18n/config'

/**
 * Garde-fou d'erreur de l'espace authentifié (audit UX 15 juil. : sans lui,
 * une exception serveur affichait l'écran Next.js par défaut, non brandé et
 * non localisé). Client Component par contrat Next — la locale vient du
 * segment d'URL via useParams.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale: string }>()
  const t = getDictionary(resolveLocale(params?.locale ?? 'fr'))

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-chabon/10 bg-white p-8 text-center">
      <p className="text-3xl" aria-hidden>
        ⚠
      </p>
      <h1 className="mt-2 text-lg font-semibold text-ank">{t.errorPage.title}</h1>
      <p className="mt-2 text-sm text-grafit">{t.errorPage.body}</p>
      {error.digest && <p className="mt-2 text-[11px] text-ank/80">Réf. {error.digest}</p>}
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-lg bg-chabon px-4 py-2 text-sm font-semibold text-white hover:bg-chabon"
      >
        {t.errorPage.retry}
      </button>
    </div>
  )
}
