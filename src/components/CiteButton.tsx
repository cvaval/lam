'use client'

import { useState } from 'react'

/**
 * Copie une citation juridique prête à coller (désignation + référence + date + lien profond
 * vers la fiche, ancre comprise). Le préfixe de citation est construit côté serveur ; le lien
 * exact (avec un éventuel #art-N) est lu depuis l'URL courante.
 */
export function CiteButton({ citation, label, copiedLabel }: { citation: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const text = url ? `${citation}. ${url}` : citation
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* presse-papiers indisponible : on n'affiche pas d'erreur bloquante */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-lg border border-lank/15 bg-white px-3 py-1.5 text-sm text-lank/70 transition hover:bg-lank-50"
    >
      {copied ? `✓ ${copiedLabel}` : `❝ ${label}`}
    </button>
  )
}
