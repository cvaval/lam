'use client'

import { useRouter } from 'next/navigation'

/**
 * Lien « retour » de la fiche document : revient à la page PRÉCÉDENTE de
 * l'historique (donc à la page de résultats / pagination exacte d'où l'on vient),
 * et non à la première page d'une recherche reconstruite. Repli sur `fallback`
 * quand il n'y a pas d'historique (accès direct, nouvel onglet).
 */
export function BackLink({ fallback, label }: { fallback: string; label: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back()
        else router.push(fallback)
      }}
      className="text-sm text-lank/50 hover:text-lank"
    >
      ← {label}
    </button>
  )
}
