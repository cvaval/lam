'use client'

import { useState } from 'react'
import type { Locale } from '@/lib/types'
import {
  SOLUTIONS, TRAITEMENTS, PORTEES, GLYPHE_TRAITEMENT, GLYPHE_PORTEE,
  type Solution, type Traitement, type Portee,
} from '@/lib/jurisprudence/constants'

/**
 * Versement des décisions judiciaires — depuis le PORTAIL, jamais en ligne de commande :
 * la rédaction doit pouvoir verser un recueil sans passer par un développeur.
 *
 * ⚠️ LE TABLEAU DE CONTRÔLE EST ÉDITABLE, et c'est ce qui rend la fonction utilisable sur
 * des documents que personne n'a prévus. L'analyseur ne devine rien : ce qu'il n'a pas su
 * lire reste vide, signalé en rouge, et l'opérateur le complète ici — avant que quoi que
 * ce soit ne soit écrit en base.
 */

interface Ligne {
  numero: string; intitule: string; juridiction: string; chambre: string
  dateISO: string; decisionAttaquee: string; dispositif: string
  solution: Solution | ''; resume: string; domaines: string
  traitement: Traitement | ''; portee: Portee | ''
  traitementNote: string; porteeNote: string; noteRedaction: string
  manquants: string[]
}

const L = {
  titre: { fr: 'Décisions judiciaires — versement', en: 'Judicial decisions — upload', ht: 'Desizyon jidisyè — depoze' },
  intro: {
    fr: "Téléversez un recueil au format Word, vérifiez et corrigez ce que l'analyseur a compris, puis enregistrez. Rien n'est écrit avant votre validation.",
    en: 'Upload a Word volume, check and correct what the parser understood, then save. Nothing is written before you confirm.',
    ht: 'Depoze yon rekèy Word, verifye epi korije, apre sa anrejistre. Anyen pa ekri anvan ou valide.',
  },
  choisir: { fr: 'Choisir un fichier .docx', en: 'Choose a .docx file', ht: 'Chwazi yon fichye .docx' },
  analyse: { fr: 'Analyse en cours…', en: 'Parsing…', ht: 'N ap analize…' },
  recueil: { fr: 'Recueil', en: 'Volume', ht: 'Rekèy' },
  source: { fr: 'Référence de source', en: 'Source reference', ht: 'Referans sous' },
  exercice: { fr: 'Exercice (début / fin)', en: 'Term (from / to)', ht: 'Ekzèsis' },
  enregistrer: { fr: 'Enregistrer les décisions', en: 'Save decisions', ht: 'Anrejistre desizyon yo' },
  vide: { fr: 'Aucune décision analysée pour le moment.', en: 'No decision parsed yet.', ht: 'Pa gen desizyon ankò.' },
  manquant: { fr: 'champ(s) à compléter', en: 'field(s) to complete', ht: 'chan pou konplete' },
  dejaEnBase: { fr: 'déjà en base — sera mise à jour', en: 'already stored — will be updated', ht: 'deja nan baz la' },
} as const

export function JurisprudenceEditor({ locale }: { locale: Locale }) {
  const lt = (o: Record<string, string>) => o[locale] ?? o.fr
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [synthese, setSynthese] = useState('')
  const [recueilRef, setRecueilRef] = useState('')
  const [source, setSource] = useState('')
  const [exDebut, setExDebut] = useState('')
  const [exFin, setExFin] = useState('')
  const [avertissements, setAvertissements] = useState<string[]>([])
  const [existants, setExistants] = useState<{ number: string | null }[]>([])
  const [busy, setBusy] = useState(false)
  const [etat, setEtat] = useState<{ kind: 'ok' | 'err' | 'info'; texte: string } | null>(null)

  const maj = (i: number, champ: keyof Ligne, v: string) =>
    setLignes((l) => l.map((x, k) => (k === i ? { ...x, [champ]: v } : x)))

  async function analyser(f: File | undefined) {
    if (!f) return
    setBusy(true); setEtat(null)
    const fd = new FormData()
    fd.append('file', f)
    try {
      const res = await fetch('/api/admin/jurisprudence', { method: 'PUT', body: fd })
      const d = await res.json()
      if (!res.ok) { setEtat({ kind: 'err', texte: `Analyse impossible (${d?.error ?? res.status}).` }); return }
      setLignes(
        (d.decisions as Record<string, string | string[] | null>[]).map((x) => ({
          numero: (x.numero as string) ?? '', intitule: (x.intitule as string) ?? '',
          juridiction: (x.juridiction as string) ?? '', chambre: '',
          dateISO: (x.dateISO as string) ?? '', decisionAttaquee: (x.decisionAttaquee as string) ?? '',
          dispositif: (x.dispositif as string) ?? '', solution: ((x.solution as Solution) ?? '') as Solution | '',
          resume: (x.resume as string) ?? '', domaines: (x.domaines as string) ?? '',
          traitement: '', portee: '', traitementNote: '', porteeNote: '', noteRedaction: '',
          manquants: (x.manquants as string[]) ?? [],
        })),
      )
      setSynthese(d.synthese ?? '')
      setAvertissements(d.avertissements ?? [])
      setExistants(d.existants ?? [])
      if (!source) setSource(f.name.replace(/\.docx$/i, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 60))
    } catch {
      setEtat({ kind: 'err', texte: 'Erreur réseau.' })
    } finally { setBusy(false) }
  }

  const incompletes = lignes.filter((l) => !l.numero || !l.intitule || !l.dateISO).length
  const blocage = !lignes.length ? lt(L.vide)
    : !source.trim() ? 'La référence de source est obligatoire.'
    : incompletes ? `${incompletes} décision(s) sans numéro, intitulé ou date.`
    : null

  async function enregistrer() {
    if (blocage) return
    setBusy(true); setEtat(null)
    try {
      const res = await fetch('/api/admin/jurisprudence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recueilRef: recueilRef.trim() || null,
          exerciceDebut: exDebut ? Number(exDebut) : null,
          exerciceFin: exFin ? Number(exFin) : null,
          source: source.trim(),
          decisions: lignes.map((l) => ({
            numero: l.numero, intitule: l.intitule, juridiction: l.juridiction || null,
            chambre: l.chambre || null, dateISO: l.dateISO,
            decisionAttaquee: l.decisionAttaquee || null, dispositif: l.dispositif || null,
            solution: l.solution || null, resume: l.resume || null, domaines: l.domaines || null,
            traitement: l.traitement || null, portee: l.portee || null,
            traitementNote: l.traitementNote || null, porteeNote: l.porteeNote || null,
            noteRedaction: l.noteRedaction || null,
          })),
        }),
      })
      const d = await res.json()
      if (!res.ok) { setEtat({ kind: 'err', texte: `Échec (${d?.error ?? res.status}).` }); return }
      setEtat({ kind: 'ok', texte: `✓ ${d.crees} créée(s), ${d.modifies} mise(s) à jour.` })
    } catch {
      setEtat({ kind: 'err', texte: 'Erreur réseau.' })
    } finally { setBusy(false) }
  }

  const champ = 'min-h-[44px] w-full rounded-lg border border-liy bg-white px-3 text-sm text-ank outline-none ring-wouj transition focus:border-wouj focus-visible:ring-2'
  const etiq = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-grafit'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-ank">{lt(L.titre)}</h2>
        <p className="mt-1 max-w-3xl text-sm text-grafit">{lt(L.intro)}</p>
      </div>

      {/* ── Recueil ─────────────────────────────────────────────── */}
      <div className="grid gap-4 rounded-2xl border border-liy bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label htmlFor="j-recueil" className={etiq}>{lt(L.recueil)}</label>
          <input id="j-recueil" value={recueilRef} onChange={(e) => setRecueilRef(e.target.value)}
            placeholder="Cass. 1re Sect. — exercice 1964-1965" className={champ} />
        </div>
        <div>
          <label htmlFor="j-source" className={etiq}>{lt(L.source)} <span className="text-wouj" aria-hidden="true">*</span></label>
          <input id="j-source" value={source} onChange={(e) => setSource(e.target.value)}
            placeholder="CASSATION_1964_1965" className={champ} />
        </div>
        <div>
          <label htmlFor="j-ex1" className={etiq}>{lt(L.exercice)}</label>
          <div className="flex gap-2">
            <input id="j-ex1" value={exDebut} onChange={(e) => setExDebut(e.target.value)} inputMode="numeric" placeholder="1964" className={champ} />
            <input aria-label="Fin d’exercice" value={exFin} onChange={(e) => setExFin(e.target.value)} inputMode="numeric" placeholder="1965" className={champ} />
          </div>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg bg-wouj px-5 text-sm font-semibold text-white outline-none ring-wouj ring-offset-2 transition hover:brightness-95 focus-within:ring-2">
            <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only" disabled={busy}
              onChange={(e) => analyser(e.target.files?.[0])} />
            {busy ? lt(L.analyse) : `📄 ${lt(L.choisir)}`}
          </label>
        </div>
      </div>

      {avertissements.length > 0 && (
        <ul className="space-y-1 rounded-lg border-l-2 border-wouj bg-pil px-4 py-3 text-sm text-ank">
          {avertissements.map((a, i) => <li key={i}>⚠ {a}</li>)}
        </ul>
      )}
      {etat && (
        <p role="status" className={`rounded-lg border-l-2 px-3 py-2 text-sm ${etat.kind === 'ok' ? 'border-vet bg-pil text-vet' : etat.kind === 'err' ? 'border-wouj bg-pil text-wouj' : 'border-liy bg-pil text-grafit'}`}>
          {etat.texte}
        </p>
      )}

      {/* ── Tableau de contrôle, ÉDITABLE ───────────────────────── */}
      {lignes.map((l, i) => {
        const dejaEnBase = existants.some((e) => e.number === l.numero)
        return (
          <details key={i} open={l.manquants.length > 0} className="rounded-2xl border border-liy bg-white p-5">
            <summary className="cursor-pointer text-sm font-semibold text-ank">
              n° {l.numero || '—'} · {l.intitule || <span className="text-wouj">sans intitulé</span>}
              {l.manquants.length > 0 && (
                <span className="ml-2 rounded-full bg-pil px-2 py-0.5 text-[11px] font-medium text-wouj">
                  ⚠ {l.manquants.length} {lt(L.manquant)}
                </span>
              )}
              {dejaEnBase && (
                <span className="ml-2 rounded-full bg-pil px-2 py-0.5 text-[11px] font-medium text-grafit">
                  {lt(L.dejaEnBase)}
                </span>
              )}
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><label className={etiq}>Numéro</label><input value={l.numero} onChange={(e) => maj(i, 'numero', e.target.value)} className={champ} /></div>
              <div className="lg:col-span-2"><label className={etiq}>Intitulé</label><input value={l.intitule} onChange={(e) => maj(i, 'intitule', e.target.value)} className={champ} /></div>
              <div><label className={etiq}>Date</label><input type="date" value={l.dateISO} onChange={(e) => maj(i, 'dateISO', e.target.value)} className={champ} /></div>
              <div className="lg:col-span-2"><label className={etiq}>Juridiction</label><input value={l.juridiction} onChange={(e) => maj(i, 'juridiction', e.target.value)} className={champ} /></div>
              <div className="lg:col-span-2"><label className={etiq}>Chambre / section</label><input value={l.chambre} onChange={(e) => maj(i, 'chambre', e.target.value)} className={champ} /></div>
              <div className="sm:col-span-2 lg:col-span-4"><label className={etiq}>Décision attaquée</label><textarea value={l.decisionAttaquee} onChange={(e) => maj(i, 'decisionAttaquee', e.target.value)} rows={2} className={`${champ} py-2`} /></div>
              <div className="sm:col-span-2 lg:col-span-3"><label className={etiq}>Dispositif (littéral)</label><input value={l.dispositif} onChange={(e) => maj(i, 'dispositif', e.target.value)} className={champ} /></div>
              <div>
                <label className={etiq}>Issue</label>
                <select value={l.solution} onChange={(e) => maj(i, 'solution', e.target.value)} className={champ}>
                  <option value="">— non déterminée —</option>
                  {SOLUTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4"><label className={etiq}>Résumé</label><textarea value={l.resume} onChange={(e) => maj(i, 'resume', e.target.value)} rows={4} className={`${champ} py-2`} /></div>
              <div className="sm:col-span-2 lg:col-span-4"><label className={etiq}>Domaine(s) du droit</label><textarea value={l.domaines} onChange={(e) => maj(i, 'domaines', e.target.value)} rows={2} className={`${champ} py-2`} /></div>

              {/* Qualifications éditoriales : glyphe ET libellé, jamais le glyphe seul. */}
              <div className="lg:col-span-2">
                <label className={etiq}>Traitement ultérieur</label>
                <select value={l.traitement} onChange={(e) => maj(i, 'traitement', e.target.value)} className={champ}>
                  <option value="">— non évalué —</option>
                  {TRAITEMENTS.map((t) => <option key={t} value={t}>{GLYPHE_TRAITEMENT[t]} {t.toLowerCase()}</option>)}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className={etiq}>Portée</label>
                <select value={l.portee} onChange={(e) => maj(i, 'portee', e.target.value)} className={champ}>
                  <option value="">— non qualifiée —</option>
                  {PORTEES.map((p) => <option key={p} value={p}>{GLYPHE_PORTEE[p]} {p === 'JURISPRUDENCE' ? 'fait jurisprudence' : 'décision d’espèce'}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4"><label className={etiq}>Note de la rédaction</label><textarea value={l.noteRedaction} onChange={(e) => maj(i, 'noteRedaction', e.target.value)} rows={2} className={`${champ} py-2`} /></div>
            </div>
          </details>
        )
      })}

      {synthese && (
        <div className="rounded-2xl border border-liy bg-pil p-5">
          <h2 className="text-sm font-semibold text-ank">Synthèse du recueil</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ank">{synthese}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {blocage && (
          <p className="inline-flex items-center gap-1.5 rounded-lg border-l-2 border-wouj bg-pil px-3 py-1.5 text-xs font-medium text-wouj">
            <span aria-hidden="true">⚠</span> {blocage}
          </p>
        )}
        <button type="button" onClick={enregistrer} disabled={busy || !!blocage}
          className="inline-flex min-h-[44px] items-center rounded-lg bg-wouj px-5 text-sm font-semibold text-white outline-none ring-wouj ring-offset-2 transition hover:brightness-95 focus-visible:ring-2 disabled:opacity-40">
          {busy ? '…' : `${lt(L.enregistrer)} (${lignes.length})`}
        </button>
      </div>
    </div>
  )
}
