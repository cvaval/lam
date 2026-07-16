import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * Compteur de quota PROACTIF (Sitwayen §03) : « N / 30 recherches restantes »,
 * affiché sur le tableau de bord et la page de recherche — l'utilisateur voit
 * venir l'épuisement au lieu de heurter le mur `errors.quota`. Ambre ≤ 5,
 * rouge à 0. Rien n'est rendu pour les paliers illimités (quota null).
 *
 * `remaining` vient de remainingQuota() (lib/quota) — ou, sur la page de
 * recherche, du retour de consumeSearchQuota() pour refléter la recherche que
 * la requête courante vient de consommer.
 */
export function QuotaChip({
  locale,
  monthlyQuota,
  remaining,
  t,
}: {
  locale: string
  monthlyQuota: number | null
  remaining: number | null
  t: Dictionary
}) {
  if (monthlyQuota == null || remaining == null) return null
  const tone =
    remaining === 0
      ? 'border-red-200 bg-red-50 text-red-800'
      : remaining <= 5
        ? 'border-soley/40 bg-soley-50 text-lank'
        : 'border-lank/15 bg-white text-lank/55'
  return (
    <Link
      href={`/${locale}/account`}
      title={remaining <= 5 ? t.search.quotaLow : undefined}
      className={`no-print inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${tone}`}
    >
      {remaining <= 5 && <span aria-hidden>⚠</span>}
      {remaining} / {monthlyQuota} {t.account.searchesRemaining}
    </Link>
  )
}
