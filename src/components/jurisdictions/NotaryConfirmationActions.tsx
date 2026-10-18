'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChampErreur } from '../ChampErreur'

/**
 * RETRAIT du badge « Confirmé » d'une inscription — rendu pour le MASTER ADMIN seulement ; la route
 * le revérifie à chaque appel. Motif obligatoire, consigné dans l'historique.
 */
export function NotaryConfirmationActions({ notaryId }: { notaryId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const retirer = async (f: FormData) => {
    setBusy(true); setErreur(null)
    const res = await fetch(`/api/admin/notaires/${notaryId}/confirmation`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'RETIRER', motif: String(f.get('motif') ?? '').trim() }),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setErreur(data?.error === 'invalidFields' ? 'Le motif doit compter 10 caractères au moins.' : data?.error === 'forbidden' ? 'Réservé au master admin.' : `erreur ${res.status}`)
      return
    }
    router.refresh()
  }
  return (
    <form action={retirer} className="mt-3 grid gap-2">
      {erreur && <ChampErreur prefixe="Erreur —" surface="bg-white">{erreur}</ChampErreur>}
      <label className="text-xs font-medium text-grafit">
        Motif du retrait (obligatoire, consigné)
        <textarea name="motif" required minLength={10} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border border-chabon/15 px-3 py-2 text-sm" />
      </label>
      <button type="submit" disabled={busy} className="justify-self-start rounded-full border border-chabon/20 bg-white px-4 py-2 text-xs font-semibold text-ank disabled:opacity-50">
        Retirer la confirmation
      </button>
    </form>
  )
}
