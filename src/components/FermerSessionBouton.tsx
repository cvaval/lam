'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { postJson } from '@/lib/http'

/**
 * « Fermer cette session » — depuis le journal des connexions du master admin. Confirmation
 * explicite : on coupe quelqu'un en plein travail. Puis `router.refresh()` : ce n'est pas un
 * changement d'identité (la session fermée est celle d'un autre), la navigation douce convient.
 */
const L = {
  fermer: { fr: 'Fermer cette session', en: 'Close this session', ht: 'Fèmen sesyon sa a' },
  confirmer: {
    fr: 'Fermer cette session ? L’utilisateur sera renvoyé à l’écran de connexion à sa prochaine action, avec la mention « fermée par l’administrateur ».',
    en: 'Close this session? The user will be sent back to the sign-in screen at their next action, with the notice “closed by the administrator”.',
    ht: 'Fèmen sesyon sa a ? Itilizatè a ap retounen sou ekran koneksyon an nan pwochen aksyon li, ak nòt « administratè a fèmen l ».',
  },
  enCours: { fr: 'Fermeture…', en: 'Closing…', ht: 'Ap fèmen…' },
  erreur: { fr: 'La fermeture a échoué. Réessayez.', en: 'Closing failed. Try again.', ht: 'Fèmti a echwe. Eseye ankò.' },
} as const

export function FermerSessionBouton({ sessionId, locale }: { sessionId: string; locale: 'fr' | 'en' | 'ht' }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState(false)
  const lt = (o: { fr: string; en: string; ht: string }) => o[locale] ?? o.fr
  async function fermer() {
    if (!window.confirm(lt(L.confirmer))) return
    setBusy(true)
    setErreur(false)
    try {
      const res = await postJson('/api/admin/connexions/close', { sessionId })
      if (!res.ok) throw new Error('close')
      router.refresh()
    } catch {
      setErreur(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={fermer} disabled={busy} className="rounded-lg border border-chabon/15 px-2.5 py-1.5 text-xs font-medium text-grafit hover:bg-koton disabled:opacity-50">
        {busy ? lt(L.enCours) : lt(L.fermer)}
      </button>
      {erreur && <span className="text-[11px] text-wouj">{lt(L.erreur)}</span>}
    </span>
  )
}
