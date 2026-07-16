'use client'

import { ActionButton } from './ActionButton'

/**
 * Impression du document courant : le chrome applicatif (TopBar, boutons, pied
 * de page…) porte la classe `.no-print` (globals.css) — le tirage ne contient
 * que le texte officiel et son en-tête.
 */
export function PrintButton({ label }: { label: string }) {
  return (
    <ActionButton onClick={() => window.print()}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 14h12v7H6z" strokeLinejoin="round" />
      </svg>
      {label}
    </ActionButton>
  )
}
