'use client'

import { useRef, useState } from 'react'
import { LONGUEUR_MAX_NOTE } from '@/lib/notes/rules'
import { NoteBody } from './NoteBody'

/**
 * NOTES DES LECTEURS sous une décision.
 *
 * ⚠️ CE QUI EST AFFICHÉ N'EST PAS CE QUI EST ÉCRIT. Seules les notes VALIDÉES par la
 * rédaction sont visibles de tous ; l'auteur voit en plus les siennes, avec leur état, pour
 * qu'un envoi ne paraisse pas s'être perdu. Un lecteur ne doit jamais pouvoir croire qu'il
 * lit une note approuvée quand elle attend encore.
 *
 * ⚠️ L'ANONYMAT NE VAUT QUE POUR LES LECTEURS. La case n'apparaît pas à la rédaction, et la
 * route la refuserait de toute façon : la parole d'un éditeur engage la plateforme.
 */

export interface NoteAffichee {
  id: string
  body: string
  signature: string
  createdAt: string
  status: string
  moderationNote: string | null
  /** Vrai pour les notes de l'utilisateur courant — les seules non publiées qu'il voit. */
  sienne: boolean
}

const L = {
  titre: { fr: 'Notes des lecteurs', en: 'Reader notes', ht: 'Nòt lektè yo' },
  vide: { fr: 'Aucune note publiée pour cette décision.', en: 'No published note for this decision.', ht: 'Pa gen nòt pibliye.' },
  ajouter: { fr: 'Ajouter une note', en: 'Add a note', ht: 'Ajoute yon nòt' },
  placeholder: {
    fr: 'Votre observation sur cette décision…',
    en: 'Your observation on this decision…',
    ht: 'Obsèvasyon ou sou desizyon sa a…',
  },
  anonyme: { fr: 'Publier sans mon nom', en: 'Post without my name', ht: 'Pibliye san non m' },
  envoyer: { fr: 'Soumettre pour validation', en: 'Submit for review', ht: 'Voye pou validasyon' },
  moderation: {
    fr: 'Votre note sera lue par la rédaction avant d’être affichée aux autres lecteurs.',
    en: 'Your note will be reviewed by the editorial team before other readers see it.',
    ht: 'Redaksyon an ap li nòt ou anvan lòt lektè yo wè l.',
  },
  enAttente: { fr: 'En attente de validation', en: 'Awaiting review', ht: 'K ap tann validasyon' },
  refusee: { fr: 'Non retenue', en: 'Not retained', ht: 'Pa kenbe' },
  gras: { fr: 'Mettre en gras', en: 'Bold', ht: 'Mete an gra' },
  italique: { fr: 'Mettre en italique', en: 'Italic', ht: 'Mete an italik' },
  ecrire: { fr: 'Écrire', en: 'Write', ht: 'Ekri' },
  apercu: { fr: 'Aperçu', en: 'Preview', ht: 'Apèsi' },
  apercuVide: { fr: 'Rien à prévisualiser.', en: 'Nothing to preview.', ht: 'Anyen pou wè.' },
  aide: { fr: 'gras', en: 'bold', ht: 'gra' },
  aideIt: { fr: 'italique', en: 'italic', ht: 'italik' },
  anonymeRefuse: {
    fr: 'L’anonymat n’est pas ouvert à la rédaction : votre note portera votre nom.',
    en: 'Anonymity is not available to the editorial team: your note will carry your name.',
    ht: 'Anonimite pa disponib pou redaksyon an.',
  },
} as const

export function DocumentNotes({
  documentId,
  notes,
  locale,
  peutEtreAnonyme,
}: {
  documentId: string
  notes: NoteAffichee[]
  locale: string
  peutEtreAnonyme: boolean
}) {
  const lt = (o: Record<string, string>) => o[locale] ?? o.fr
  const zone = useRef<HTMLTextAreaElement>(null)
  const [liste, setListe] = useState(notes)
  const [texte, setTexte] = useState('')
  const [apercu, setApercu] = useState(false)
  const [anonyme, setAnonyme] = useState(false)
  const [busy, setBusy] = useState(false)
  const [etat, setEtat] = useState<{ kind: 'ok' | 'err'; texte: string } | null>(null)

  /**
   * Encadre la sélection — ou la débarrasse de ses marqueurs si elle en porte déjà.
   *
   * ⚠️ ON RESTE SUR UN `<textarea>`. Un champ `contenteditable` casserait le collage,
   * l'annulation (Ctrl+Z) et le comportement sur mobile, et ferait rentrer du HTML dans
   * l'application — ce que l'analyseur écarte par construction.
   */
  function basculer(marqueur: '**' | '*') {
    const ta = zone.current
    if (!ta) return
    const s = ta.selectionStart
    const e = ta.selectionEnd
    const v = texte
    const m = marqueur.length
    // ⚠️ Pour l'italique, refuser de mordre sur un `**` voisin : sans cette garde, mettre
    // « gras » en italique dans `**gras**` en retirerait une étoile de chaque côté.
    const voisinDouble = marqueur === '*' && (v[s - 2] === '*' || v[e + 1] === '*')
    const entoure = !voisinDouble && v.slice(Math.max(0, s - m), s) === marqueur && v.slice(e, e + m) === marqueur
    const inclus = v.slice(s, s + m) === marqueur && v.slice(e - m, e) === marqueur && e - s >= 2 * m

    let nouveau: string
    let ns: number
    let ne: number
    if (entoure) {
      nouveau = v.slice(0, s - m) + v.slice(s, e) + v.slice(e + m)
      ns = s - m
      ne = e - m
    } else if (inclus) {
      nouveau = v.slice(0, s) + v.slice(s + m, e - m) + v.slice(e)
      ns = s
      ne = e - 2 * m
    } else {
      nouveau = v.slice(0, s) + marqueur + v.slice(s, e) + marqueur + v.slice(e)
      // Sélection vide : le curseur se pose ENTRE les marqueurs, prêt à écrire.
      ns = s + m
      ne = e + m
    }
    if (nouveau.length > LONGUEUR_MAX_NOTE) return
    setTexte(nouveau)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(ns, ne)
    })
  }

  async function envoyer() {
    const corps = texte.trim()
    if (corps.length < 3) return
    setBusy(true); setEtat(null)
    try {
      const r = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documentId, body: corps, anonymous: anonyme && peutEtreAnonyme }),
      })
      const d = await r.json()
      if (!r.ok) {
        setEtat({ kind: 'err', texte: r.status === 429 ? 'Trop de notes envoyées — réessayez plus tard.' : `Envoi impossible (${d?.error ?? r.status}).` })
        return
      }
      setListe((l) => [
        {
          id: d.id, body: corps,
          signature: d.anonymous ? lt({ fr: 'Contribution anonyme', en: 'Anonymous contribution', ht: 'Kontribisyon anonim' }) : 'vous',
          createdAt: new Date().toISOString(), status: 'EN_ATTENTE', moderationNote: null, sienne: true,
        },
        ...l,
      ])
      setTexte(''); setAnonyme(false)
      setEtat({ kind: 'ok', texte: lt(L.moderation) })
    } catch {
      setEtat({ kind: 'err', texte: 'Erreur réseau.' })
    } finally { setBusy(false) }
  }

  return (
    <section className="rounded-2xl border border-liy bg-white p-5" aria-labelledby="notes-lecteurs">
      <h2 id="notes-lecteurs" className="text-sm font-semibold text-ank">{lt(L.titre)}</h2>

      <ul className="mt-4 space-y-3">
        {liste.map((n) => {
          const attente = n.status === 'EN_ATTENTE'
          const refusee = n.status === 'REFUSEE'
          return (
            <li key={n.id} className={`rounded-xl border p-4 ${attente || refusee ? 'border-dashed border-liy bg-pil' : 'border-liy bg-white'}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-grafit">
                <span className="font-semibold text-ank">{n.signature}</span>
                <time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR')}</time>
                {/* L'état porte son LIBELLÉ, jamais une simple couleur ni un point. */}
                {attente && <span className="rounded-full border border-liy bg-white px-2 py-0.5 font-medium text-wouj">⏳ {lt(L.enAttente)}</span>}
                {refusee && <span className="rounded-full border border-liy bg-white px-2 py-0.5 font-medium text-wouj">✕ {lt(L.refusee)}</span>}
              </div>
              <NoteBody corps={n.body} className="mt-2 text-sm leading-relaxed text-ank" />
              {refusee && n.moderationNote && (
                <p className="mt-2 border-l-2 border-wouj pl-3 text-xs text-grafit">{n.moderationNote}</p>
              )}
            </li>
          )
        })}
        {!liste.length && <li className="text-sm text-grafit">{lt(L.vide)}</li>}
      </ul>

      <div className="mt-5 border-t border-liy pt-4">
        <label htmlFor="note-corps" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-grafit">
          {lt(L.ajouter)}
        </label>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          {/* Le libellé accessible porte l'action ; « B » et « I » seuls ne disent rien à un
              lecteur d'écran. */}
          <button type="button" onClick={() => basculer('**')} aria-label={lt(L.gras)} title={lt(L.gras)}
 className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-liy bg-white font-bold text-ank transition hover:bg-pil">
            B
          </button>
          <button type="button" onClick={() => basculer('*')} aria-label={lt(L.italique)} title={lt(L.italique)}
 className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-liy bg-white font-serif italic text-ank transition hover:bg-pil">
            I
          </button>
          <div className="ml-auto flex gap-1" role="tablist" aria-label={lt(L.apercu)}>
            {[false, true].map((v) => (
              <button key={String(v)} type="button" role="tab" aria-selected={apercu === v} onClick={() => setApercu(v)}
 className={`min-h-[44px] rounded-lg px-3 text-sm transition ${
                  apercu === v ? 'bg-wouj font-semibold text-white' : 'font-medium text-grafit hover:bg-pil'
                }`}>
                {v ? lt(L.apercu) : lt(L.ecrire)}
              </button>
            ))}
          </div>
        </div>

        {apercu ? (
          // ⚠️ L'aperçu emploie le MÊME composant que la fiche et la modération : ce que
          // l'auteur voit ici est exactement ce qui sera publié.
          <div className="min-h-[7.5rem] rounded-lg border border-dashed border-liy bg-pil px-3 py-2 text-sm leading-relaxed text-ank">
            {texte.trim() ? <NoteBody corps={texte} /> : <span className="text-grafit">{lt(L.apercuVide)}</span>}
          </div>
        ) : (
          <textarea
            id="note-corps" ref={zone} rows={4} value={texte} maxLength={LONGUEUR_MAX_NOTE}
            onChange={(e) => setTexte(e.target.value)} placeholder={lt(L.placeholder)}
            onKeyDown={(e) => {
              if (!(e.metaKey || e.ctrlKey)) return
              const k = e.key.toLowerCase()
              if (k === 'b') { e.preventDefault(); basculer('**') }
              else if (k === 'i') { e.preventDefault(); basculer('*') }
            }}
 className="w-full rounded-lg border border-liy bg-white px-3 py-2 text-sm text-ank transition focus:border-wouj"
          />
        )}

        <p className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-grafit">
          {/* Apprendre la syntaxe à qui colle du texte sans passer par les boutons. */}
          <span><code>**{lt(L.aide)}**</code> · <code>*{lt(L.aideIt)}*</code></span>
          {/* Le compte porte sur le corps MARQUEURS COMPRIS — c'est lui qui part en base. */}
          <span>{texte.length.toLocaleString('fr-FR')} / {LONGUEUR_MAX_NOTE.toLocaleString('fr-FR')}</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          {peutEtreAnonyme ? (
            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-ank">
              <input type="checkbox" checked={anonyme} onChange={(e) => setAnonyme(e.target.checked)}
                className="h-4 w-4 rounded border-liy accent-wouj" />
              {lt(L.anonyme)}
            </label>
          ) : (
            <p className="text-xs text-grafit">{lt(L.anonymeRefuse)}</p>
          )}
          <button type="button" onClick={envoyer} disabled={busy || texte.trim().length < 3}
 className="inline-flex min-h-[44px] items-center rounded-lg bg-wouj px-5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-40">
            {busy ? '…' : lt(L.envoyer)}
          </button>
        </div>
        <p className="mt-2 text-xs text-grafit">{lt(L.moderation)}</p>
        {etat && (
          <p role="status" className={`mt-2 rounded-lg border-l-2 px-3 py-2 text-sm ${etat.kind === 'ok' ? 'border-vet bg-pil text-vet' : 'border-wouj bg-pil text-wouj'}`}>
            {etat.texte}
          </p>
        )}
      </div>
    </section>
  )
}
