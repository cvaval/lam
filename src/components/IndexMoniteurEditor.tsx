'use client'

import { useMemo, useState } from 'react'
import type { Locale } from '@/lib/types'

type EditionType = 'REGULIERE' | 'SPECIALE'
interface TitleRow {
  id?: string // présent = entrée existante (mise à jour) ; absent = nouvelle
  text: string
}

const L = {
  title: { fr: 'Index du Moniteur — saisie / correction', en: 'Moniteur Index — entry / edit', ht: 'Endèks Monitè — sezi / korije' },
  intro: {
    fr: "Ajoutez ou corrigez une édition de l'Index du Moniteur. Une édition = un type (régulière ou spéciale), un numéro et une année ; chaque titre saisi devient une entrée d'index recherchable.",
    en: 'Add or correct a Moniteur Index edition. One edition = a type, a number and a year; each title becomes a searchable index entry.',
    ht: 'Ajoute oswa korije yon edisyon nan Endèks Monitè a. Chak tit vin yon antre rechèchab.',
  },
  type: { fr: "Type d'édition", en: 'Edition type', ht: 'Tip edisyon' },
  regular: { fr: 'Régulière', en: 'Regular', ht: 'Regilye' },
  special: { fr: 'Spéciale', en: 'Special', ht: 'Espesyal' },
  numero: { fr: 'Numéro', en: 'Number', ht: 'Nimewo' },
  annee: { fr: 'Année', en: 'Year', ht: 'Ane' },
  date: { fr: 'Date de publication', en: 'Publication date', ht: 'Dat piblikasyon' },
  dateRequired: { fr: 'La date de publication est obligatoire.', en: 'The publication date is required.', ht: 'Dat piblikasyon an obligatwa.' },
  dateYearMismatch: { fr: 'La date ne tombe pas dans l’année saisie.', en: 'The date is not in the year entered.', ht: 'Dat la pa nan ane ou mete a.' },
  ref: { fr: 'Référence', en: 'Reference', ht: 'Referans' },
  check: { fr: 'Vérifier si l’édition existe', en: 'Check if edition exists', ht: 'Verifye si edisyon an egziste' },
  titles: { fr: 'Titres des publications', en: 'Publication titles', ht: 'Tit piblikasyon yo' },
  titlesHint: { fr: 'Un titre par champ — aucune limite de caractères. Ajoutez autant de champs que nécessaire.', en: 'One title per field — no character limit. Add as many fields as needed.', ht: 'Yon tit pa chan — pa gen limit karaktè.' },
  addTitle: { fr: '+ Ajouter un titre', en: '+ Add a title', ht: '+ Ajoute yon tit' },
  remove: { fr: 'Retirer', en: 'Remove', ht: 'Retire' },
  save: { fr: 'Enregistrer l’édition', en: 'Save edition', ht: 'Anrejistre edisyon an' },
  saving: { fr: 'Enregistrement…', en: 'Saving…', ht: 'N ap anrejistre…' },
  existsWarn: { fr: 'existe déjà dans l’index', en: 'already exists in the index', ht: 'deja egziste nan endèks la' },
  notFound: { fr: 'Aucune entrée pour cette référence — nouvelle édition.', en: 'No entry for this reference — new edition.', ht: 'Pa gen antre — nouvo edisyon.' },
  dupTitle: { fr: 'Cette édition a déjà été saisie', en: 'This edition has already been entered', ht: 'Edisyon sa a deja sezi' },
  dupBody: {
    fr: 'Une version antérieure existe dans l’index. Relisez-la ci-dessous, puis choisissez : la reprendre pour la corriger, ou conserver la saisie en cours.',
    en: 'An earlier version exists in the index. Review it below, then choose: load it for editing, or keep what you have typed.',
    ht: 'Gen yon vèsyon anvan nan endèks la. Li li anba a, epi chwazi.',
  },
  dupLoad: { fr: 'Reprendre et corriger l’entrée antérieure', en: 'Load and edit the earlier entry', ht: 'Reprann epi korije antre anvan an' },
  dupKeep: { fr: 'Conserver ma saisie', en: 'Keep what I typed', ht: 'Kenbe sa m tape a' },
  dupPrev: { fr: 'Version antérieure', en: 'Earlier version', ht: 'Vèsyon anvan' },
  dupBlocked: { fr: 'Choisissez d’abord : reprendre l’entrée antérieure, ou conserver votre saisie.', en: 'Choose first: load the earlier entry, or keep your input.', ht: 'Chwazi dabò.' },
  loaded: { fr: 'Entrée antérieure chargée — vos corrections remplaceront la version en base.', en: 'Earlier entry loaded — your edits will replace the stored version.', ht: 'Antre anvan an chaje.' },
} as const

function editionNumber(annee: string, numero: string, special: boolean): string {
  const y = annee.trim()
  const n = numero.trim().replace(/^SP/i, '').replace(/\s+/g, '')
  if (!y || !n) return ''
  return special ? `LM${y}-SP${n}` : `LM${y}-${n}`
}

const MOTIF_SUPPRESSION = 'Suppression d’une entrée déjà enregistrée : réservée au master admin'

export function IndexMoniteurEditor({ locale, peutSupprimer }: { locale: Locale; peutSupprimer: boolean }) {
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr
  const [editionType, setEditionType] = useState<EditionType>('REGULIERE')
  const [numero, setNumero] = useState('')
  const [annee, setAnnee] = useState(String(new Date().getUTCFullYear()))
  const [dateISO, setDateISO] = useState('')
  const [rows, setRows] = useState<TitleRow[]>(() => Array.from({ length: 5 }, () => ({ text: '' })))
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  /**
   * Doublon détecté ET NON ENCORE ARBITRÉ. Auparavant `checkExisting` écrasait
   * directement les champs par la version en base : une saisie de vingt titres
   * disparaissait au simple passage du curseur hors du champ « numéro ». La version
   * antérieure est désormais MISE DE CÔTÉ et affichée ; c'est l'opérateur qui tranche.
   */
  const [previous, setPrevious] = useState<{
    number: string
    entries: { id: string; text: string }[]
    dateISO: string | null
    editionType: EditionType | null
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: 'info' | 'ok' | 'warn' | 'err'; text: string } | null>(null)

  const number = useMemo(() => editionNumber(annee, numero, editionType === 'SPECIALE'), [annee, numero, editionType])
  /**
   * L'alerte ne vaut que pour la référence qui l'a produite. Sans ce rattachement, elle
   * survivait à un changement de numéro et bloquait l'enregistrement d'une AUTRE édition.
   */
  const doublon = previous && previous.number === number ? previous : null

  /** Motif du blocage de l'enregistrement, ou null si tout est en règle. */
  const blocage = useMemo(() => {
    if (!dateISO) return lt(L.dateRequired)
    if (doublon) return lt(L.dupBlocked)
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO, doublon, locale])

  /**
   * ⚠️ AVERTISSEMENT, PAS BLOCAGE. Une année de date différente de l'année de référence
   * est presque toujours une coquille — mais pas toujours : une édition tardive peut
   * paraître l'année suivante. Refuser la saisie coûterait plus cher que la signaler.
   */
  const avertissementAnnee = dateISO && annee.trim() && dateISO.slice(0, 4) !== annee.trim()

  function setRow(i: number, text: string) {
    setRows((r) => r.map((row, k) => (k === i ? { ...row, text } : row)))
  }
  function addRow() {
    setRows((r) => [...r, { text: '' }])
  }
  function removeRow(i: number) {
    setRows((r) => {
      const row = r[i]
      // ⚠️ Retirer une ligne NON ENREGISTRÉE est libre ; retirer une entrée déjà en base
      // est une suppression de document, réservée au master admin. La route refuse la
      // requête entière si `deletedIds` arrive d'un compte qui n'y a pas droit : mieux
      // vaut ne pas laisser l'opérateur composer un enregistrement qui sera rejeté.
      if (row.id && !peutSupprimer) return r
      if (row.id) setDeletedIds((d) => [...d, row.id!])
      return r.filter((_, k) => k !== i)
    })
  }

  async function checkExisting() {
    if (!number) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/admin/index-moniteur?number=${encodeURIComponent(number)}`)
      const data = await res.json()
      if (data.exists) {
        const e0 = data.entries[0] as { publicationDate?: string; editionType?: EditionType } | undefined
        setPrevious({
          number: data.number,
          entries: data.entries.map((e: { id: string; titleFr: string }) => ({ id: e.id, text: e.titleFr })),
          // La date et le type de l'édition enregistrée : sans eux, « reprendre » laissait
          // le champ date vide et l'opérateur redatait l'édition à son insu.
          dateISO: e0?.publicationDate ? String(e0.publicationDate).slice(0, 10) : null,
          editionType: e0?.editionType ?? null,
        })
        setStatus(null)
      } else {
        setPrevious(null)
        setStatus({ kind: 'info', text: lt(L.notFound) })
      }
    } catch {
      setStatus({ kind: 'err', text: 'Erreur réseau.' })
    } finally {
      setBusy(false)
    }
  }

  /** Reprend la version en base dans le formulaire : les champs deviennent modifiables. */
  function reprendrePrecedente() {
    if (!doublon) return
    setRows(doublon.entries.length ? doublon.entries.map((e) => ({ id: e.id, text: e.text })) : [{ text: '' }])
    // On restitue l'édition TELLE QU'ELLE EST EN BASE — date et type compris.
    if (doublon.dateISO) setDateISO(doublon.dateISO)
    if (doublon.editionType) setEditionType(doublon.editionType)
    setDeletedIds([])
    setPrevious(null)
    setStatus({ kind: 'warn', text: `⚠ ${lt(L.loaded)}` })
  }

  /** Conserve la saisie en cours : les titres seront AJOUTÉS à l'édition existante. */
  function conserverSaisie() {
    setPrevious(null)
    setStatus({ kind: 'warn', text: `⚠ ${number} ${lt(L.existsWarn)}.` })
  }

  async function save() {
    if (!number || blocage || !rows.some((r) => r.text.trim())) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/admin/index-moniteur', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          editionType,
          numero: numero.trim(),
          annee: Number(annee),
          dateISO,
          titles: rows.filter((r) => r.text.trim()).map((r) => ({ id: r.id, text: r.text })),
          deletedIds,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'error')
      setStatus({ kind: 'ok', text: `✓ ${data.number} — ${data.created} créées, ${data.updated} modifiées, ${data.deleted} supprimées.` })
      setDeletedIds([])
      // Recharge les identifiants sans rouvrir l'alerte : à ce stade le doublon est
      // arbitré, et le reproposer donnerait l'impression d'un échec.
      try {
        const r2 = await fetch(`/api/admin/index-moniteur?number=${encodeURIComponent(number)}`)
        const d2 = await r2.json()
        if (d2.exists) setRows(d2.entries.map((e: { id: string; titleFr: string }) => ({ id: e.id, text: e.titleFr })))
      } catch { /* l'enregistrement a réussi : un rechargement raté n'est pas une erreur */ }
    } catch {
      setStatus({ kind: 'err', text: 'Échec de l’enregistrement.' })
    } finally {
      setBusy(false)
    }
  }

  const statusCls =
    status?.kind === 'ok' ? 'bg-vet/10 text-vet border-vet/30'
    : status?.kind === 'warn' ? 'bg-pil text-chabon border-chabon/30'
    : status?.kind === 'err' ? 'bg-pil text-wouj border-wouj/40'
    : 'bg-pil text-ank/70 border-chabon/15'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-ank">{lt(L.title)}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ank/80">{lt(L.intro)}</p>
      </div>

      {/* En-tête d'édition */}
      <div className="grid gap-4 rounded-2xl border border-chabon/10 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ank/80">{lt(L.type)}</label>
          <div className="flex gap-2">
            {(['REGULIERE', 'SPECIALE'] as EditionType[]).map((et) => (
              // ⚠️ L'état choisi était `bg-pil` face à `bg-koton` : 1,08:1 l'un contre
              // l'autre, on ne voyait pas lequel était retenu. Il passe au Wouj de
              // l'action (AV-03), texte Blan à 5,43:1 — et `aria-pressed` le dit aussi
              // aux outils d'assistance, la couleur ne renseignant jamais seule.
              <button
                key={et}
                type="button"
                aria-pressed={editionType === et}
                onClick={() => setEditionType(et)}
 className={`min-h-[44px] flex-1 rounded-lg border px-3 text-sm font-semibold transition ${
                  editionType === et
                    ? 'border-wouj bg-wouj text-white'
                    : 'border-grafit bg-white text-grafit hover:border-chabon hover:text-chabon'
                }`}
              >
                {et === 'REGULIERE' ? lt(L.regular) : lt(L.special)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ank/80">{lt(L.numero)}</label>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} onBlur={checkExisting} inputMode="numeric" placeholder="51" className="w-full rounded-lg border border-chabon/15 bg-koton px-3 py-2 text-sm text-ank outline-none focus:border-liy" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ank/80">{lt(L.annee)}</label>
          <input value={annee} onChange={(e) => setAnnee(e.target.value)} onBlur={checkExisting} inputMode="numeric" placeholder="2024" className="w-full rounded-lg border border-chabon/15 bg-koton px-3 py-2 text-sm text-ank outline-none focus:border-liy" />
        </div>
        <div>
          <label htmlFor="idx-date" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ank/80">
            {lt(L.date)} <span className="text-wouj" aria-hidden="true">*</span>
            <span className="sr-only"> ({lt(L.dateRequired)})</span>
          </label>
          <input
            id="idx-date"
            type="date"
            required
            value={dateISO}
            onChange={(e) => setDateISO(e.target.value)}
            aria-invalid={!dateISO || undefined}
            aria-describedby={!dateISO ? 'idx-date-err' : undefined}
 className={`min-h-[44px] w-full rounded-lg border bg-white px-3 text-sm text-ank transition ${dateISO ? 'border-liy' : 'border-wouj'}`}
          />
          {!dateISO && (
            <p id="idx-date-err" className="mt-1 flex items-center gap-1 text-[11px] font-medium text-wouj">
              <span aria-hidden="true">⚠</span> {lt(L.dateRequired)}
            </p>
          )}
          {avertissementAnnee && (
            <p role="status" className="mt-1 flex items-center gap-1 text-[11px] font-medium text-wouj">
              <span aria-hidden="true">⚠</span> {lt(L.dateYearMismatch)}
            </p>
          )}
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <div className="flex-1 text-xs text-ank/80">
            {lt(L.ref)} : <span className="font-mono font-semibold text-ank">{number || '—'}</span>
          </div>
          <button type="button" onClick={checkExisting} disabled={!number || busy} className="rounded-lg border border-chabon/20 px-3 py-1.5 text-xs font-semibold text-grafit hover:bg-koton disabled:opacity-40">
            {lt(L.check)}
          </button>
        </div>
      </div>

      {/* ── ALERTE DE DOUBLON ────────────────────────────────────────────────
          Elle ne se contente pas de prévenir : elle MONTRE ce qui existe déjà et
          n'écrit rien tant que l'opérateur n'a pas tranché. C'est le contraire de
          l'ancien comportement, qui remplaçait la saisie en silence. */}
      {doublon && (
        <section role="alert" aria-labelledby="dup-h" className="overflow-hidden rounded-2xl border-2 border-wouj bg-white">
          <div className="border-b border-liy bg-wouj/5 px-5 py-4">
            <h2 id="dup-h" className="flex items-center gap-2 text-sm font-semibold text-wouj">
              <span aria-hidden="true">⚠</span>
              {lt(L.dupTitle)} — <span className="font-mono">{doublon.number}</span>
              <span className="font-normal text-grafit">({doublon.entries.length})</span>
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ank">{lt(L.dupBody)}</p>
          </div>

          <div className="px-5 py-4">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-grafit">{lt(L.dupPrev)}</p>
            {/* Bornée en hauteur : une édition peut compter des centaines de titres,
                et le choix doit rester visible sans défiler toute la page. */}
            <ol className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-liy bg-pil p-3 text-sm text-ank">
              {doublon.entries.map((e, i) => (
                <li key={e.id} className="flex gap-2 leading-relaxed">
                  <span className="w-6 shrink-0 text-right text-xs tabular-nums text-grafit">{i + 1}.</span>
                  <span>{e.text}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-liy px-5 py-4">
            <button
              type="button"
              onClick={reprendrePrecedente}
 className="inline-flex min-h-[44px] items-center rounded-lg bg-wouj px-4 text-sm font-semibold text-white transition hover:brightness-95"
            >
              {lt(L.dupLoad)}
            </button>
            <button
              type="button"
              onClick={conserverSaisie}
 className="inline-flex min-h-[44px] items-center rounded-lg border border-liy px-4 text-sm font-semibold text-ank transition hover:border-chabon hover:text-chabon"
            >
              {lt(L.dupKeep)}
            </button>
          </div>
        </section>
      )}

      {status && <div className={`rounded-lg border px-3 py-2 text-sm ${statusCls}`}>{status.text}</div>}

      {/* Titres */}
      <div className="rounded-2xl border border-chabon/10 bg-white p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ank">{lt(L.titles)}</h2>
          <span className="text-xs text-ank/80">{rows.filter((r) => r.text.trim()).length}</span>
        </div>
        <p className="mb-3 text-xs text-ank/80">{lt(L.titlesHint)}</p>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2 w-6 shrink-0 text-right text-xs tabular-nums text-ank/80">{i + 1}.</span>
              <textarea
                value={row.text}
                onChange={(e) => setRow(i, e.target.value)}
                rows={2}
                placeholder="Titre de la publication…"
                className={`min-h-[2.5rem] flex-1 resize-y rounded-lg border bg-koton px-3 py-2 text-sm text-ank outline-none focus:border-liy ${row.id ? 'border-chabon/30' : 'border-chabon/15'}`}
              />
              <button type="button" onClick={() => removeRow(i)} title={lt(L.remove)} className="mt-1.5 shrink-0 rounded-md px-2 py-1 text-xs text-wouj hover:bg-pil">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow} className="mt-3 rounded-lg border border-dashed border-chabon/25 px-3 py-1.5 text-sm font-medium text-grafit hover:border-chabon/40 hover:text-ank">
          {lt(L.addTitle)}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {/* Un bouton grisé sans motif laisse l'opérateur deviner : le motif est écrit. */}
        {blocage && (
          <p className="inline-flex items-center gap-1.5 rounded-lg border-l-2 border-wouj bg-pil px-3 py-1.5 text-xs font-medium text-wouj">
            <span aria-hidden="true">⚠</span> {blocage}
          </p>
        )}
        <button
          type="button"
          onClick={save}
          disabled={busy || !number || !!blocage || !rows.some((r) => r.text.trim())}
 className="inline-flex min-h-[44px] items-center rounded-lg bg-wouj px-5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-40"
        >
          {busy ? lt(L.saving) : lt(L.save)}
        </button>
      </div>
    </div>
  )
}
