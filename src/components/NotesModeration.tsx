'use client'

import { useCallback, useEffect, useState } from 'react'
import { NoteBody } from './NoteBody'

/**
 * FILE DE MODÉRATION DES NOTES DE LECTEURS.
 *
 * ⚠️ LA RÉDACTION VOIT TOUJOURS L'AUTEUR, anonymat compris — elle répond de ce qu'elle
 * publie. L'anonymat protège le lecteur du PUBLIC, pas de son modérateur ; l'écran le dit
 * explicitement pour qu'aucun modérateur ne croie l'auteur inconnu.
 *
 * ⚠️ REFUSER SANS MOTIF EST POSSIBLE MAIS SIGNALÉ : le motif est renvoyé à l'auteur sous sa
 * note. Une note qui disparaît sans explication passe pour une panne.
 */

interface Note {
  id: string
  body: string
  anonymous: boolean
  status: string
  createdAt: string
  moderationNote: string | null
  author: { name: string | null; email: string; role: string }
  moderatedBy: { name: string | null; email: string } | null
  document: { id: string; titleFr: string; number: string | null; type: string }
}

const FILTRES = [
  { id: 'EN_ATTENTE', label: 'En attente' },
  { id: 'PUBLIEE', label: 'Publiées' },
  { id: 'REFUSEE', label: 'Refusées' },
  { id: 'TOUTES', label: 'Toutes' },
] as const

export function NotesModeration({ locale }: { locale: string }) {
  const [filtre, setFiltre] = useState<string>('EN_ATTENTE')
  const [notes, setNotes] = useState<Note[]>([])
  const [enAttente, setEnAttente] = useState(0)
  const [motifs, setMotifs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [etat, setEtat] = useState<{ kind: 'ok' | 'err'; texte: string } | null>(null)

  const charger = useCallback(async (f: string) => {
    setBusy(true)
    try {
      const r = await fetch(`/api/notes?status=${encodeURIComponent(f)}`)
      const d = await r.json()
      if (!r.ok) { setEtat({ kind: 'err', texte: `Chargement impossible (${d?.error ?? r.status}).` }); return }
      setNotes(d.notes ?? [])
      setEnAttente(d.enAttente ?? 0)
    } catch {
      setEtat({ kind: 'err', texte: 'Erreur réseau.' })
    } finally { setBusy(false) }
  }, [])

  useEffect(() => { void charger(filtre) }, [filtre, charger])

  async function moderer(id: string, status: 'PUBLIEE' | 'REFUSEE') {
    setBusy(true); setEtat(null)
    try {
      const r = await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status, moderationNote: motifs[id]?.trim() || null }),
      })
      const d = await r.json()
      if (!r.ok) { setEtat({ kind: 'err', texte: `Échec (${d?.error ?? r.status}).` }); return }
      setEtat({ kind: 'ok', texte: status === 'PUBLIEE' ? '✓ Note publiée.' : '✓ Note refusée — le motif est visible de son auteur.' })
      await charger(filtre)
    } catch {
      setEtat({ kind: 'err', texte: 'Erreur réseau.' })
    } finally { setBusy(false) }
  }

 const bouton = 'inline-flex min-h-[44px] items-center rounded-lg px-4 text-sm font-semibold transition disabled:opacity-40'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-ank">Notes des lecteurs — modération</h1>
        <p className="mt-1 max-w-3xl text-sm text-grafit">
          Aucune note n’est visible des autres lecteurs avant d’être publiée ici. {enAttente > 0 && <strong className="text-ank">{enAttente} en attente.</strong>}
        </p>
      </div>

      <div role="tablist" aria-label="Filtres" className="flex flex-wrap gap-2 border-b border-liy">
        {FILTRES.map((f) => {
          const actif = filtre === f.id
          return (
            <button key={f.id} type="button" role="tab" aria-selected={actif} onClick={() => setFiltre(f.id)}
 className={`-mb-px min-h-[44px] rounded-t-lg px-4 text-sm transition ${
                actif ? 'border-b-2 border-wouj bg-pil font-semibold text-chabon' : 'font-medium text-grafit hover:bg-pil'
              }`}>
              {f.label}
              {f.id === 'EN_ATTENTE' && enAttente > 0 && <span className="ml-1.5">({enAttente})</span>}
            </button>
          )
        })}
      </div>

      {etat && (
        <p role="status" className={`rounded-lg border-l-2 px-3 py-2 text-sm ${etat.kind === 'ok' ? 'border-vet bg-pil text-vet' : 'border-wouj bg-pil text-wouj'}`}>
          {etat.texte}
        </p>
      )}

      {!notes.length && !busy && <p className="text-sm text-grafit">Aucune note dans cette file.</p>}

      <ul className="space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="rounded-2xl border border-liy bg-white p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-grafit">
              <a href={`/${locale}/doc/${n.document.id}`} className="font-semibold text-ank underline decoration-liy underline-offset-2 hover:decoration-wouj">
                {n.document.number ? `n° ${n.document.number} · ` : ''}{n.document.titleFr}
              </a>
              <time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString('fr-FR')}</time>
              <span className="rounded-full border border-liy bg-pil px-2 py-0.5 font-medium text-ank">{n.status.replace('_', ' ').toLowerCase()}</span>
            </div>

            <p className="mt-1 text-xs text-grafit">
              Auteur : <span className="font-medium text-ank">{n.author.name?.trim() || n.author.email}</span> · {n.author.role.toLowerCase()}
              {n.anonymous && (
                <span className="ml-2 rounded-full border border-liy bg-pil px-2 py-0.5 font-medium text-ank">
                  🕶 publiée sans son nom — vous seul le voyez
                </span>
              )}
            </p>

            {/* ⚠️ MÊME RENDU QUE LA FICHE. Afficher ici les marqueurs bruts ferait approuver
                un texte que le modérateur n'a pas vu tel qu'il sera publié. */}
            <NoteBody corps={n.body} className="mt-3 rounded-xl border border-liy bg-pil p-4 text-sm leading-relaxed text-ank" />

            {n.moderatedBy && (
              <p className="mt-2 text-xs text-grafit">Modérée par {n.moderatedBy.name?.trim() || n.moderatedBy.email}{n.moderationNote ? ` — « ${n.moderationNote} »` : ''}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={motifs[n.id] ?? n.moderationNote ?? ''}
                onChange={(e) => setMotifs((m) => ({ ...m, [n.id]: e.target.value }))}
                placeholder="Motif communiqué à l’auteur — optionnel, recommandé en cas de refus"
                aria-label="Motif de modération"
 className="min-h-[44px] flex-1 rounded-lg border border-liy bg-white px-3 text-sm text-ank transition focus:border-wouj"
              />
              <button type="button" disabled={busy || n.status === 'PUBLIEE'} onClick={() => moderer(n.id, 'PUBLIEE')}
                className={`${bouton} bg-wouj text-white hover:brightness-95`}>
                Publier
              </button>
              <button type="button" disabled={busy || n.status === 'REFUSEE'} onClick={() => moderer(n.id, 'REFUSEE')}
                className={`${bouton} border border-liy text-ank hover:bg-pil`}>
                Refuser
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
