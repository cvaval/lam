'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChampErreur } from '../ChampErreur'

export interface NotaryContactInitial {
  address: string
  phones: string[]
  email: string
  searchAliases: string[]
  observation: string
  upToDateOn: string
  providedBy: string
  channel: string
  active: boolean
}

const LIBELLES_ERREUR: Record<string, string> = {
  coordonnees: 'Il faut au moins une adresse, un numéro ou un courriel.',
  courriel: 'Le courriel n’est pas lisible.',
  invalidFields: 'Un champ est invalide (date AAAA-MM-JJ, source et canal obligatoires).',
  forbidden: 'Vos droits ne permettent pas cette action.',
  notFound: 'Entrée introuvable ou retirée de la liste.',
  request_mismatch: 'La demande ne vise pas ce notaire.',
  request_closed: 'La demande a déjà été décidée.',
  unavailable: 'La table des coordonnées n’existe pas encore dans cette base.',
}
const libelle = (code: string) =>
  code.startsWith('telephone:') ? `Numéro illisible : « ${code.slice('telephone:'.length)} » (8 chiffres haïtiens, ou +indicatif).` : LIBELLES_ERREUR[code] ?? code

const champ = 'mt-1 w-full rounded-lg border border-chabon/15 px-3 py-2 text-sm'
const etiquette = 'text-xs font-medium text-grafit'

/**
 * Saisie des coordonnées d'un notaire (chantier C). Les numéros sont recopiés tels que
 * communiqués : le serveur les met en E.164 et REFUSE tout numéro illisible plutôt que de le
 * deviner. La source (« communiqué par ») et le canal sont obligatoires : une coordonnée sans
 * provenance ne se publie pas.
 */
export function NotaryContactEditor({
  notaryId, initial, existe, requestId, peutSupprimer,
}: {
  notaryId: string
  initial: NotaryContactInitial
  existe: boolean
  /** Demande d'un tiers à accepter en enregistrant (master admin). */
  requestId: string | null
  peutSupprimer: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [erreurs, setErreurs] = useState<string[]>([])
  const [ok, setOk] = useState<string | null>(null)

  const liste = (v: FormDataEntryValue | null) => String(v ?? '').split(/\n|;/).map((x) => x.trim()).filter(Boolean)

  const enregistrer = async (form: FormData) => {
    setBusy(true); setErreurs([]); setOk(null)
    const body = {
      address: String(form.get('address') ?? '').trim() || null,
      phones: liste(form.get('phones')),
      email: String(form.get('email') ?? '').trim() || null,
      searchAliases: liste(form.get('searchAliases')),
      observation: String(form.get('observation') ?? '').trim() || null,
      upToDateOn: String(form.get('upToDateOn') ?? ''),
      providedBy: String(form.get('providedBy') ?? '').trim(),
      channel: String(form.get('channel') ?? '').trim(),
      active: form.get('active') === 'on',
      requestId,
    }
    const res = await fetch(`/api/admin/notaires/${notaryId}/coordonnees`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) { setErreurs(data?.fields ?? [data?.error ?? `erreur ${res.status}`]); return }
    setOk(requestId ? 'Coordonnées enregistrées ; la demande est acceptée.' : 'Coordonnées enregistrées.')
    router.refresh()
  }

  const supprimer = async () => {
    if (!window.confirm('Supprimer définitivement cette fiche ? Pour la retirer sans la perdre, décochez « Publiée ».')) return
    setBusy(true); setErreurs([]); setOk(null)
    const res = await fetch(`/api/admin/notaires/${notaryId}/coordonnees`, { method: 'DELETE' })
    const data = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) { setErreurs([data?.error ?? `erreur ${res.status}`]); return }
    setOk('Fiche supprimée.')
    router.refresh()
  }

  return (
    <form action={enregistrer} className="mt-4 max-w-2xl rounded-xl border border-chabon/10 bg-white p-5">
      {erreurs.length > 0 && (
        <ChampErreur prefixe="Erreur —" surface="bg-white">
          {erreurs.map((e) => <span key={e} className="block">{libelle(e)}</span>)}
        </ChampErreur>
      )}
      {ok && <p role="status" className="mb-3 text-sm font-medium text-ank">✓ {ok}</p>}
      <div className="grid gap-3">
        <label className={etiquette}>
          Adresse de l’étude (une ligne, telle que communiquée)
          <input name="address" defaultValue={initial.address} maxLength={200} className={champ} />
        </label>
        <label className={etiquette}>
          Téléphones (un par ligne, 4 au plus)
          <textarea name="phones" defaultValue={initial.phones.join('\n')} rows={3} className={`${champ} font-mono`} />
        </label>
        <label className={etiquette}>
          Courriel
          <input name="email" type="email" defaultValue={initial.email} maxLength={120} className={champ} />
        </label>
        <label className={etiquette}>
          Autres noms pour la recherche (un par ligne, 5 au plus : nom d’usage, nom de jeune fille…)
          <textarea name="searchAliases" defaultValue={initial.searchAliases.join('\n')} rows={2} className={champ} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={etiquette}>
            À jour au
            <input name="upToDateOn" type="date" required defaultValue={initial.upToDateOn} className={champ} />
          </label>
          <label className={`${etiquette} sm:col-span-2`}>
            Communiqué par (obligatoire)
            <input name="providedBy" required defaultValue={initial.providedBy} maxLength={120} className={champ} />
          </label>
        </div>
        <label className={etiquette}>
          Canal (obligatoire : courriel à la rédaction, appel, formulaire du site…)
          <input name="channel" required defaultValue={initial.channel} maxLength={120} className={champ} />
        </label>
        <label className={etiquette}>
          Observation interne (jamais publiée)
          <textarea name="observation" defaultValue={initial.observation} rows={2} maxLength={1000} className={champ} />
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-grafit">
          <input name="active" type="checkbox" defaultChecked={initial.active} /> Publiée sur la page du notaire
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="submit" disabled={busy} className="rounded-full bg-chabon px-4 py-2 text-xs font-semibold text-koton disabled:opacity-50">
          {requestId ? 'Enregistrer et accepter la demande' : existe ? 'Enregistrer les modifications' : 'Créer la fiche'}
        </button>
        {existe && peutSupprimer && (
          <button type="button" onClick={supprimer} disabled={busy} className="rounded-full border border-chabon/20 px-4 py-2 text-xs font-semibold text-grafit disabled:opacity-50">
            Supprimer la fiche
          </button>
        )}
      </div>
    </form>
  )
}
