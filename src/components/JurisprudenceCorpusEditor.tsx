'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Locale } from '@/lib/types'
import {
  TRAITEMENTS, PORTEES, GLYPHE_TRAITEMENT, GLYPHE_PORTEE,
  type Traitement, type Portee,
} from '@/lib/jurisprudence/constants'

/**
 * APPAREIL ÉDITORIAL DES DÉCISIONS — résumé éditorial, texte intégral, note d'édition.
 *
 * ⚠️ DEUX TEXTES DE NATURES OPPOSÉES sur le même écran. Le TEXTE INTÉGRAL est la parole du
 * juge : on le verse, on ne le réécrit pas. Le RÉSUMÉ ÉDITORIAL est celle de la rédaction.
 * Les champs sont donc séparés, étiquetés et stockés séparément — jamais fondus en un seul
 * bloc, sans quoi plus personne ne saurait, à la lecture, ce qui vient de la Cour.
 *
 * ⚠️ CHAQUE CHAMP S'ALIMENTE AU CHOIX PAR COLLAGE OU PAR TÉLÉVERSEMENT. Le téléversement
 * d'un .docx n'écrit rien : il REMPLIT la zone de texte, que l'éditeur relit puis
 * enregistre. Un import direct en base priverait la rédaction du dernier regard.
 */

interface Fiche {
  id: string
  number: string | null
  titleFr: string
  publicationDate: string | null
  resumeEditorial: string
  texteIntegral: string
  noteRedaction: string
  noteRedactionBy: string | null
  traitement: Traitement | ''
  portee: Portee | ''
  traitementNote: string
  porteeNote: string
  texteIntegralPresent: boolean
  /** Vrai dès que l'opérateur a touché à la fiche — seules celles-là sont envoyées. */
  modifiee: boolean
}

const L = {
  titre: { fr: 'Corpus — résumés éditoriaux et textes intégraux', en: 'Corpus — editorial summaries and full texts', ht: 'Kòpis — rezime ak tèks konplè' },
  intro: {
    fr: "Choisissez un recueil, puis complétez chaque décision. Le texte intégral peut être collé, téléversé décision par décision, ou versé d'un seul fichier pour tout le recueil.",
    en: 'Pick a volume, then complete each decision. Full text can be pasted, uploaded per decision, or loaded from a single file for the whole volume.',
    ht: 'Chwazi yon rekèy, apre sa konplete chak desizyon.',
  },
  recueil: { fr: 'Recueil', en: 'Volume', ht: 'Rekèy' },
  aucunRecueil: { fr: 'Aucun recueil versé pour le moment.', en: 'No volume uploaded yet.', ht: 'Pa gen rekèy ankò.' },
  verserIntegraux: { fr: 'Verser un fichier de textes intégraux (.docx)', en: 'Load a full-text file (.docx)', ht: 'Depoze yon fichye tèks konplè' },
  resume: { fr: 'Résumé éditorial', en: 'Editorial summary', ht: 'Rezime editoryal' },
  integral: { fr: 'Texte intégral de la décision', en: 'Full text of the decision', ht: 'Tèks konplè desizyon an' },
  note: { fr: 'Note d’édition', en: 'Editorial note', ht: 'Nòt edisyon' },
  televerser: { fr: 'Téléverser', en: 'Upload', ht: 'Depoze' },
  enregistrer: { fr: 'Enregistrer les modifications', en: 'Save changes', ht: 'Anrejistre chanjman yo' },
  rienAEnregistrer: { fr: 'Aucune modification à enregistrer.', en: 'Nothing to save.', ht: 'Pa gen chanjman.' },
  absent: { fr: 'texte intégral absent', en: 'full text missing', ht: 'tèks konplè manke' },
  present: { fr: 'texte intégral présent', en: 'full text present', ht: 'tèks konplè la' },
  chargement: { fr: 'Chargement…', en: 'Loading…', ht: 'N ap chaje…' },
} as const

export function JurisprudenceCorpusEditor({ locale }: { locale: Locale }) {
  const lt = (o: Record<string, string>) => o[locale] ?? o.fr
  const [sources, setSources] = useState<{ source: string; total: number }[]>([])
  const [source, setSource] = useState('')
  const [fiches, setFiches] = useState<Fiche[]>([])
  const [busy, setBusy] = useState(false)
  const [avertissements, setAvertissements] = useState<string[]>([])
  const [notesGenerales, setNotesGenerales] = useState<string[]>([])
  const [etat, setEtat] = useState<{ kind: 'ok' | 'err'; texte: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/jurisprudence')
      .then((r) => r.json())
      .then((d) => {
        const s = (d.sources ?? []) as { source: string; total: number }[]
        setSources(s)
        setSource((cur) => cur || s[0]?.source || '')
      })
      .catch(() => setEtat({ kind: 'err', texte: 'Impossible de lister les recueils.' }))
  }, [])

  const charger = useCallback(async (src: string) => {
    if (!src) return
    setBusy(true); setEtat(null); setAvertissements([]); setNotesGenerales([])
    try {
      const r = await fetch(`/api/admin/jurisprudence?source=${encodeURIComponent(src)}`)
      const d = await r.json()
      if (!r.ok) { setEtat({ kind: 'err', texte: `Chargement impossible (${d?.error ?? r.status}).` }); return }
      setFiches(
        (d.decisions as Record<string, unknown>[]).map((x) => ({
          id: x.id as string,
          number: (x.number as string) ?? null,
          titleFr: (x.titleFr as string) ?? '',
          publicationDate: (x.publicationDate as string) ?? null,
          resumeEditorial: (x.summaryFr as string) ?? '',
          // Tant que le texte intégral n'a pas été versé, `bodyOriginal` n'est que la
          // composition du sommaire : la proposer à l'édition la ferait passer pour l'arrêt.
          texteIntegral: x.texteIntegralPresent ? ((x.bodyOriginal as string) ?? '') : '',
          noteRedaction: (x.noteRedaction as string) ?? '',
          noteRedactionBy: (x.noteRedactionBy as string) ?? null,
          traitement: ((x.traitement as Traitement) ?? '') as Traitement | '',
          portee: ((x.portee as Portee) ?? '') as Portee | '',
          traitementNote: (x.traitementNote as string) ?? '',
          porteeNote: (x.porteeNote as string) ?? '',
          texteIntegralPresent: !!x.texteIntegralPresent,
          modifiee: false,
        })),
      )
    } catch {
      setEtat({ kind: 'err', texte: 'Erreur réseau.' })
    } finally { setBusy(false) }
  }, [])

  useEffect(() => { void charger(source) }, [source, charger])

  const maj = (id: string, champ: keyof Fiche, v: string) =>
    setFiches((f) => f.map((x) => (x.id === id ? { ...x, [champ]: v, modifiee: true } : x)))

  /** Téléverse un .docx et REMPLIT un champ — l'éditeur relit avant d'enregistrer. */
  async function televerserChamp(id: string, champ: 'resumeEditorial' | 'texteIntegral', f: File | undefined) {
    if (!f) return
    setBusy(true); setEtat(null)
    const fd = new FormData()
    fd.append('file', f)
    fd.append('mode', 'texte')
    try {
      const r = await fetch('/api/admin/jurisprudence', { method: 'PUT', body: fd })
      const d = await r.json()
      if (!r.ok) { setEtat({ kind: 'err', texte: `Lecture impossible (${d?.error ?? r.status}).` }); return }
      maj(id, champ, d.texte ?? '')
    } catch {
      setEtat({ kind: 'err', texte: 'Erreur réseau.' })
    } finally { setBusy(false) }
  }

  /** Verse un recueil ENTIER de textes intégraux et les répartit par numéro d'arrêt. */
  async function verserRecueilIntegral(f: File | undefined) {
    if (!f || !source) return
    setBusy(true); setEtat(null)
    const fd = new FormData()
    fd.append('file', f)
    fd.append('mode', 'integral')
    fd.append('source', source)
    try {
      const r = await fetch('/api/admin/jurisprudence', { method: 'PUT', body: fd })
      const d = await r.json()
      if (!r.ok) { setEtat({ kind: 'err', texte: `Analyse impossible (${d?.error ?? r.status}).` }); return }
      const parNum = new Map<string, string>((d.textes as { numero: string; texte: string }[]).map((t) => [t.numero, t.texte]))
      const notes = (d.notesParArret ?? {}) as Record<string, string>
      let touchees = 0
      setFiches((fs) =>
        fs.map((x) => {
          const t = x.number ? parNum.get(x.number) : undefined
          const n = x.number ? notes[x.number] : undefined
          if (!t && !n) return x
          touchees++
          return {
            ...x,
            texteIntegral: t ?? x.texteIntegral,
            // La note de transcription nomme elle-même son arrêt ; elle ne remplace jamais
            // une note d'édition déjà écrite.
            noteRedaction: x.noteRedaction || (n ?? ''),
            modifiee: true,
          }
        }),
      )
      setAvertissements(d.avertissements ?? [])
      setNotesGenerales(d.notesGenerales ?? [])
      setEtat({ kind: 'ok', texte: `${touchees} décision(s) alimentée(s) — relisez, puis enregistrez.` })
    } catch {
      setEtat({ kind: 'err', texte: 'Erreur réseau.' })
    } finally { setBusy(false) }
  }

  const aEnregistrer = fiches.filter((f) => f.modifiee)

  async function enregistrer() {
    if (!aEnregistrer.length) return
    setBusy(true); setEtat(null)
    try {
      const r = await fetch('/api/admin/jurisprudence', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          majs: aEnregistrer.map((f) => ({
            id: f.id,
            resumeEditorial: f.resumeEditorial || null,
            texteIntegral: f.texteIntegral || null,
            noteRedaction: f.noteRedaction || null,
            traitement: f.traitement || null,
            traitementNote: f.traitementNote || null,
            portee: f.portee || null,
            porteeNote: f.porteeNote || null,
          })),
        }),
      })
      const d = await r.json()
      if (!r.ok) { setEtat({ kind: 'err', texte: `Échec (${d?.error ?? r.status}).` }); return }
      setEtat({ kind: 'ok', texte: `✓ ${d.modifies} décision(s) enregistrée(s).` })
      await charger(source)
    } catch {
      setEtat({ kind: 'err', texte: 'Erreur réseau.' })
    } finally { setBusy(false) }
  }

  const champ = 'w-full rounded-lg border border-liy bg-white px-3 py-2 text-sm text-ank outline-none ring-wouj transition focus:border-wouj focus-visible:ring-2'
  const etiq = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-grafit'
  const bouton = 'inline-flex min-h-[44px] items-center rounded-lg bg-wouj px-5 text-sm font-semibold text-white outline-none ring-wouj ring-offset-2 transition hover:brightness-95 focus-visible:ring-2 disabled:opacity-40'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-ank">{lt(L.titre)}</h2>
        <p className="mt-1 max-w-3xl text-sm text-grafit">{lt(L.intro)}</p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-liy bg-white p-5 sm:grid-cols-2">
        <div>
          <label htmlFor="jc-source" className={etiq}>{lt(L.recueil)}</label>
          {sources.length ? (
            <select id="jc-source" value={source} onChange={(e) => setSource(e.target.value)} className={`${champ} min-h-[44px]`}>
              {sources.map((s) => <option key={s.source} value={s.source}>{s.source} ({s.total})</option>)}
            </select>
          ) : (
            <p className="text-sm text-grafit">{lt(L.aucunRecueil)}</p>
          )}
        </div>
        <div className="flex items-end">
          <label className={`${bouton} cursor-pointer focus-within:ring-2 ${!source || busy ? 'pointer-events-none opacity-40' : ''}`}>
            <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only" disabled={busy || !source}
              onChange={(e) => { void verserRecueilIntegral(e.target.files?.[0]); e.target.value = '' }} />
            📄 {lt(L.verserIntegraux)}
          </label>
        </div>
      </div>

      {avertissements.length > 0 && (
        <ul className="space-y-1 rounded-lg border-l-2 border-wouj bg-pil px-4 py-3 text-sm text-ank">
          {avertissements.map((a, i) => <li key={i}>⚠ {a}</li>)}
        </ul>
      )}
      {notesGenerales.length > 0 && (
        <div className="rounded-lg border border-liy bg-pil px-4 py-3 text-sm text-ank">
          <p className={etiq}>Notes de transcription — portée générale (à recopier si besoin)</p>
          <ul className="list-disc space-y-1 pl-5">{notesGenerales.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}
      {etat && (
        <p role="status" className={`rounded-lg border-l-2 px-3 py-2 text-sm ${etat.kind === 'ok' ? 'border-vet bg-pil text-vet' : 'border-wouj bg-pil text-wouj'}`}>
          {etat.texte}
        </p>
      )}

      {busy && !fiches.length && <p className="text-sm text-grafit">{lt(L.chargement)}</p>}

      {fiches.map((f) => (
        <details key={f.id} className="rounded-2xl border border-liy bg-white p-5">
          <summary className="cursor-pointer text-sm font-semibold text-ank">
            n° {f.number ?? '—'} · {f.titleFr}
            <span className={`ml-2 rounded-full bg-pil px-2 py-0.5 text-[11px] font-medium ${f.texteIntegral ? 'text-grafit' : 'text-wouj'}`}>
              {f.texteIntegral ? lt(L.present) : `⚠ ${lt(L.absent)}`}
            </span>
            {f.modifiee && <span className="ml-2 rounded-full bg-sitwon px-2 py-0.5 text-[11px] font-semibold text-chabon">modifiée</span>}
          </summary>

          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor={`r-${f.id}`} className={etiq}>{lt(L.resume)}</label>
                <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg border border-liy px-3 text-xs font-semibold text-ank outline-none ring-wouj transition hover:bg-pil focus-within:ring-2">
                  <input type="file" accept=".docx" className="sr-only" disabled={busy}
                    onChange={(e) => { void televerserChamp(f.id, 'resumeEditorial', e.target.files?.[0]); e.target.value = '' }} />
                  ⬆ {lt(L.televerser)}
                </label>
              </div>
              <textarea id={`r-${f.id}`} value={f.resumeEditorial} rows={4}
                onChange={(e) => maj(f.id, 'resumeEditorial', e.target.value)} className={champ} />
            </div>

            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor={`t-${f.id}`} className={etiq}>
                  {lt(L.integral)} <span className="font-normal normal-case text-ank/80">— {f.texteIntegral.length.toLocaleString('fr-FR')} car.</span>
                </label>
                <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg border border-liy px-3 text-xs font-semibold text-ank outline-none ring-wouj transition hover:bg-pil focus-within:ring-2">
                  <input type="file" accept=".docx" className="sr-only" disabled={busy}
                    onChange={(e) => { void televerserChamp(f.id, 'texteIntegral', e.target.files?.[0]); e.target.value = '' }} />
                  ⬆ {lt(L.televerser)}
                </label>
              </div>
              <textarea id={`t-${f.id}`} value={f.texteIntegral} rows={10}
                onChange={(e) => maj(f.id, 'texteIntegral', e.target.value)}
                className={`${champ} font-serif leading-relaxed`} />
            </div>

            <div>
              <label htmlFor={`n-${f.id}`} className={etiq}>
                {lt(L.note)}
                {f.noteRedactionBy && <span className="font-normal normal-case text-ank/80"> — signée {f.noteRedactionBy}</span>}
              </label>
              <textarea id={`n-${f.id}`} value={f.noteRedaction} rows={3}
                onChange={(e) => maj(f.id, 'noteRedaction', e.target.value)} className={champ} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`tr-${f.id}`} className={etiq}>Traitement ultérieur</label>
                <select id={`tr-${f.id}`} value={f.traitement} onChange={(e) => maj(f.id, 'traitement', e.target.value)} className={`${champ} min-h-[44px]`}>
                  <option value="">— non évalué —</option>
                  {TRAITEMENTS.map((t) => <option key={t} value={t}>{GLYPHE_TRAITEMENT[t]} {t.toLowerCase()}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`po-${f.id}`} className={etiq}>Portée</label>
                <select id={`po-${f.id}`} value={f.portee} onChange={(e) => maj(f.id, 'portee', e.target.value)} className={`${champ} min-h-[44px]`}>
                  <option value="">— non qualifiée —</option>
                  {PORTEES.map((p) => <option key={p} value={p}>{GLYPHE_PORTEE[p]} {p === 'JURISPRUDENCE' ? 'fait jurisprudence' : 'décision d’espèce'}</option>)}
                </select>
              </div>
            </div>
          </div>
        </details>
      ))}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {!aEnregistrer.length && <p className="text-xs text-grafit">{lt(L.rienAEnregistrer)}</p>}
        <button type="button" onClick={enregistrer} disabled={busy || !aEnregistrer.length} className={bouton}>
          {busy ? '…' : `${lt(L.enregistrer)} (${aEnregistrer.length})`}
        </button>
      </div>
    </div>
  )
}
