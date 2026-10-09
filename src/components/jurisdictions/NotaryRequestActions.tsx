'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChampErreur } from '../ChampErreur'

const champ = 'mt-1 w-full rounded-lg border border-chabon/15 px-3 py-2 text-sm'
const etiquette = 'text-xs font-medium text-grafit'
const ERREURS: Record<string, string> = {
  invalidFields: 'Un champ est invalide : le motif ou la vérification est trop court, ou la date est illisible.',
  transition_refused: 'Cette décision n’est plus possible : la demande a changé d’état.',
  commune_not_found: 'Commune introuvable.',
  forbidden: 'Réservé au master admin.',
  unavailable: 'La table des demandes n’existe pas encore dans cette base.',
}

/**
 * Décisions du master admin sur une demande (chantier D). L'inscription d'un notaire absent de la
 * liste exige la VÉRIFICATION CONSIGNÉE : comment (appel à la Chambre, commission au Moniteur…)
 * et quand. Elle est publiée sur la page du notaire.
 */
export function NotaryRequestActions({
  locale, requestId, kind, status, prefill, communes,
}: {
  locale: string
  requestId: string
  kind: string
  status: string
  prefill: { fullName: string; communeId: string }
  communes: Array<{ id: string; name: string; department: string }>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const envoyer = async (body: Record<string, unknown>) => {
    setBusy(true); setErreur(null)
    const res = await fetch(`/api/admin/notaires/demandes/${requestId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) { setErreur(ERREURS[data?.error] ?? data?.error ?? `erreur ${res.status}`); return }
    // `refresh` aussi : le compteur du menu (rendu par la mise en page) doit suivre la décision.
    if (data?.notaryId) { router.push(`/${locale}/admin/notaires/${data.notaryId}?demande=${requestId}`); router.refresh(); return }
    router.refresh()
  }

  if (status !== 'NOUVELLE' && status !== 'EN_COURS') return null
  const aujourdHui = new Date().toISOString().slice(0, 10)

  return (
    <div className="mt-6 grid max-w-2xl gap-4">
      {erreur && <ChampErreur prefixe="Erreur —" surface="bg-white">{erreur}</ChampErreur>}

      {status === 'NOUVELLE' && (
        <div>
          <button type="button" disabled={busy} onClick={() => envoyer({ action: 'EN_COURS' })} className="rounded-full border border-chabon/20 bg-white px-4 py-2 text-xs font-semibold text-grafit disabled:opacity-50">
            Prendre en charge
          </button>
        </div>
      )}

      {kind === 'LISTING' && (
        <form
          action={(f) => envoyer({
            action: 'INSCRIRE',
            fullName: String(f.get('fullName') ?? '').trim(),
            communeId: String(f.get('communeId') ?? ''),
            verifiedOn: String(f.get('verifiedOn') ?? ''),
            note: String(f.get('note') ?? '').trim(),
          })}
          className="rounded-xl border border-chabon/10 bg-white p-4"
        >
          <h2 className="font-serif text-lg font-semibold text-ank">Inscrire ce notaire</h2>
          <p className="mt-1 text-xs text-grafit">
            Hors de la liste du MJSP : l’entrée porte la mention « ajouté par la rédaction après vérification » et la date ci-dessous.
          </p>
          <div className="mt-3 grid gap-3">
            <label className={etiquette}>
              Nom à publier
              <input name="fullName" required minLength={3} maxLength={120} defaultValue={prefill.fullName} className={champ} />
            </label>
            <label className={etiquette}>
              Commune de commission
              <select name="communeId" required defaultValue={prefill.communeId} className={champ}>
                <option value="">—</option>
                {communes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.department})</option>)}
              </select>
            </label>
            <label className={etiquette}>
              Vérifié le
              <input name="verifiedOn" type="date" required defaultValue={aujourdHui} className={champ} />
            </label>
            <label className={etiquette}>
              Comment la qualité de notaire a été vérifiée (obligatoire, 10 caractères au moins)
              <textarea name="note" required minLength={10} maxLength={1000} rows={3} className={champ} />
            </label>
          </div>
          <button type="submit" disabled={busy} className="mt-3 rounded-full bg-chabon px-4 py-2 text-xs font-semibold text-koton disabled:opacity-50">
            Inscrire et accepter la demande
          </button>
        </form>
      )}

      <form action={(f) => envoyer({ action: 'REFUSER', note: String(f.get('note') ?? '').trim() })} className="rounded-xl border border-chabon/10 bg-white p-4">
        <h2 className="font-serif text-lg font-semibold text-ank">Refuser</h2>
        <label className={etiquette}>
          Motif (interne ; aucun courriel n’est envoyé au demandeur)
          <textarea name="note" required minLength={3} maxLength={1000} rows={2} className={champ} />
        </label>
        <button type="submit" disabled={busy} className="mt-3 rounded-full border border-chabon/20 px-4 py-2 text-xs font-semibold text-grafit disabled:opacity-50">
          Refuser la demande
        </button>
      </form>
    </div>
  )
}
