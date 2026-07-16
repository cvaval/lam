'use client'

/**
 * Chrome partagé des boutons de la barre d'actions du document (Citer,
 * Copier l'article, Imprimer…) — un seul endroit pour le style, les boutons
 * voisins ne peuvent pas diverger visuellement.
 */
export function ActionButton({
  onClick,
  ariaLive,
  children,
}: {
  onClick: () => void
  ariaLive?: 'polite'
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-live={ariaLive}
      className="inline-flex items-center gap-1.5 rounded-lg border border-lank/15 bg-white px-3 py-1.5 text-sm text-lank/70 transition hover:bg-lank-50"
    >
      {children}
    </button>
  )
}
