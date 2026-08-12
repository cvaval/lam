import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * Encadré « trop de requêtes » servi quand le garde anti-scraping (§ sécurité)
 * bloque une page (recherche, document, société). Source unique du visuel —
 * remplace trois blocs JSX identiques.
 */
export function RateLimitNotice({ t }: { t: Dictionary }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-chabon/40 bg-pil p-8 text-center text-sm text-ank">
      {t.errors.rate}
    </div>
  )
}
