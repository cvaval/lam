'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { postJson } from '@/lib/http'
import { TRAITEMENTS, PORTEES, GLYPHE_TRAITEMENT, GLYPHE_PORTEE } from '@/lib/jurisprudence/constants'

interface ThemeNode {
  id: string
  labelFr: string
  active: boolean
  children: ThemeNode[]
}
interface ArticleRef {
  anchor: string
  label: string
}
interface RefItem {
  refId: string
  kind: string
  label: string
  toId: string | null
  pending: boolean
  anchor: string | null
}

const KINDS = ['CITE', 'COMMENTE', 'MODIFIE', 'ABROGE', 'APPLIQUE', 'VOIR']
const TYPES = ['LEGISLATION', 'CIRCULAIRE_BRH', 'JURISPRUDENCE', 'DOCTRINE', 'LOI_FINANCES', 'MARQUE', 'TARIF_DOUANIER']
const inputCls = 'rounded-md border border-chabon/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-liy'

export interface NoteEdition {
  noteRedaction: string | null
  noteRedactionBy: string | null
  traitement: string | null
  portee: string | null
  traitementNote: string | null
  porteeNote: string | null
}

export function LegislationAdminPanel({
  documentId,
  docType,
  peutCurer,
  themeTree,
  currentThemeIds,
  primaryThemeId,
  articles,
  refs,
  noteEdition,
}: {
  documentId: string
  docType: string
  /** Thèmes, renvois et amendements : capacité de curation (cf. requireCapabilityApi). */
  peutCurer: boolean
  themeTree: ThemeNode[]
  currentThemeIds: string[]
  primaryThemeId: string | null
  articles: ArticleRef[]
  refs: RefItem[]
  noteEdition?: NoteEdition
}) {
  // Une décision n'a pas d'articles à amender : ce qu'on y amende, c'est la NOTE D'ÉDITION.
  const estDecision = docType === 'JURISPRUDENCE'
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function call(body: Record<string, unknown>, okText: string) {
    setBusy(true)
    setMsg(null)
    const r = await postJson('/api/admin/legislation', body)
    setBusy(false)
    setMsg({ ok: r.ok, text: r.ok ? okText : `Échec (${r.error ?? r.status}).` })
    if (r.ok) router.refresh()
    return r.ok
  }

  // ── Thèmes ──
  const [checked, setChecked] = useState<Set<string>>(new Set(currentThemeIds))
  const [primary, setPrimary] = useState<string | null>(primaryThemeId)
  function toggle(id: string) {
    const n = new Set(checked)
    if (n.has(id)) {
      n.delete(id)
      if (primary === id) setPrimary(null)
    } else n.add(id)
    setChecked(n)
  }
  async function saveThemes() {
    const prim = primary && checked.has(primary) ? primary : [...checked][0] ?? null
    await call({ action: 'setThemes', documentId, themeIds: [...checked], primaryThemeId: prim }, 'Thèmes enregistrés.')
  }
  function renderTree(nodes: ThemeNode[], depth: number) {
    return nodes
      .filter((n) => n.active)
      .map((n) => (
        <div key={n.id}>
          <div className="flex items-center gap-2 py-0.5" style={{ paddingLeft: depth * 16 }}>
            <label className="flex items-center gap-1.5 text-sm text-ank">
              <input type="checkbox" checked={checked.has(n.id)} onChange={() => toggle(n.id)} className="h-3.5 w-3.5 rounded border-chabon/30 accent-chabon" />
              {n.labelFr}
            </label>
            {checked.has(n.id) && (
              <button type="button" onClick={() => setPrimary(n.id)} className={`text-[11px] ${primary === n.id ? 'font-semibold text-chabon' : 'text-ank/80 hover:text-ank/70'}`}>
                {primary === n.id ? '★ principal' : 'définir principal'}
              </button>
            )}
          </div>
          {n.children.length > 0 && renderTree(n.children, depth + 1)}
        </div>
      ))
  }

  // ── Renvois ──
  const [rk, setRk] = useState('CITE')
  const [rtype, setRtype] = useState('LEGISLATION')
  const [rnum, setRnum] = useState('')
  const [ranchor, setRanchor] = useState('')
  const [rnote, setRnote] = useState('')
  async function addRef() {
    if (!rnum.trim()) return
    const ok = await call({ action: 'addRef', fromId: documentId, toType: rtype, toNumber: rnum.trim(), toAnchor: ranchor.trim() || null, kind: rk, note: rnote.trim() || null }, 'Renvoi ajouté.')
    if (ok) {
      setRnum('')
      setRanchor('')
      setRnote('')
    }
  }

  // ── Amendement ──
  const [anchor, setAnchor] = useState(articles[0]?.anchor ?? '')
  const [oldBody, setOldBody] = useState('')
  const [newBody, setNewBody] = useState('')
  const [aby, setAby] = useState('')
  const [eff, setEff] = useState('')
  const [anote, setAnote] = useState('')
  async function amend() {
    if (!anchor.trim() || !newBody.trim()) return
    const label = articles.find((a) => a.anchor === anchor)?.label
    const ok = await call(
      { action: 'amend', documentId, anchor: anchor.trim(), label, originalBody: oldBody.trim() || null, newBody: newBody.trim(), amendedByNumber: aby.trim() || null, effectiveDate: eff || null, note: anote.trim() || null },
      'Article amendé.',
    )
    if (ok) {
      setOldBody('')
      setNewBody('')
      setAby('')
      setAnote('')
    }
  }
  async function abrogate() {
    if (!anchor.trim()) return
    if (!window.confirm(`Abroger ${anchor} ?`)) return
    await call({ action: 'abrogate', documentId, anchor: anchor.trim(), originalBody: oldBody.trim() || null, amendedByNumber: aby.trim() || null, effectiveDate: eff || null, note: anote.trim() || null }, 'Article abrogé.')
  }

  // ── Note d'édition (décisions judiciaires) ──
  const [note, setNote] = useState(noteEdition?.noteRedaction ?? '')
  const [trait, setTrait] = useState(noteEdition?.traitement ?? '')
  const [traitNote, setTraitNote] = useState(noteEdition?.traitementNote ?? '')
  const [port, setPort] = useState(noteEdition?.portee ?? '')
  const [portNote, setPortNote] = useState(noteEdition?.porteeNote ?? '')
  async function enregistrerNote() {
    setBusy(true)
    setMsg(null)
    const r = await fetch('/api/admin/jurisprudence', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        majs: [{
          id: documentId,
          noteRedaction: note.trim() || null,
          traitement: trait || null,
          traitementNote: traitNote.trim() || null,
          portee: port || null,
          porteeNote: portNote.trim() || null,
        }],
      }),
    }).catch(() => null)
    setBusy(false)
    const ok = !!r?.ok
    setMsg({ ok, text: ok ? 'Note d’édition enregistrée.' : `Échec (${r?.status ?? 'réseau'}).` })
    if (ok) router.refresh()
  }

  return (
    <section className="mt-6 rounded-2xl border border-dashed border-chabon/40 bg-pil/40 p-4">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-grafit">Outils éditoriaux</h2>
      <p className="mb-3 text-xs text-ank/80">
        {estDecision
          ? 'Classer cette décision par thèmes, ajouter des renvois, ou amender la note d’édition. Le texte de la décision n’est jamais modifié.'
          : 'Classer ce texte par thèmes, ajouter des renvois, ou amender un article. Le texte officiel n’est jamais modifié.'}
      </p>
      {msg && <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-vet/10 text-ank/80' : 'bg-pil text-wouj'}`}>{msg.text}</p>}

      {/* Thèmes — capacité de curation */}
      {peutCurer && (
      <details open className="mb-2 rounded-lg border border-chabon/10 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-ank">Thèmes ({checked.size})</summary>
        <div className="border-t border-chabon/10 p-3">
          {themeTree.length === 0 ? (
            <p className="text-sm text-ank/80">Aucun thème. Créez-en dans « Législation : thèmes ».</p>
          ) : (
            <div className="max-h-64 overflow-auto">{renderTree(themeTree, 0)}</div>
          )}
          <button type="button" disabled={busy} onClick={saveThemes} className="mt-3 rounded-md bg-chabon px-3 py-1.5 text-xs font-semibold text-koton hover:bg-chabon disabled:opacity-50">
            Enregistrer les thèmes
          </button>
        </div>
      </details>
      )}

      {/* Renvois — capacité de curation */}
      {peutCurer && (
      <details className="mb-2 rounded-lg border border-chabon/10 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-ank">Renvois ({refs.length})</summary>
        <div className="space-y-3 border-t border-chabon/10 p-3">
          {refs.length > 0 && (
            <ul className="space-y-1">
              {refs.map((r) => (
                <li key={r.refId} className="flex items-center gap-2 text-sm">
                  <span className="rounded bg-chabon/5 px-1.5 text-[11px] text-grafit">{r.kind}</span>
                  <span className="text-ank">{r.label}</span>
                  {r.anchor && <span className="font-mono text-[11px] text-ank/80">#{r.anchor}</span>}
                  {r.pending && <span className="text-[11px] text-chabon">(cible non importée)</span>}
                  <button type="button" disabled={busy} onClick={() => call({ action: 'removeRef', refId: r.refId }, 'Renvoi retiré.')} className="ml-auto text-xs text-wouj hover:underline">
                    retirer
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <select value={rk} onChange={(e) => setRk(e.target.value)} className={inputCls}>
              {KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <select value={rtype} onChange={(e) => setRtype(e.target.value)} className={inputCls}>
              {TYPES.map((tp) => (
                <option key={tp} value={tp}>{tp}</option>
              ))}
            </select>
            <input value={rnum} onChange={(e) => setRnum(e.target.value)} placeholder="Désignation cible (ex. « Loi du 10 sept. 2009 ») *" className={`${inputCls} sm:col-span-2`} />
            <input value={ranchor} onChange={(e) => setRanchor(e.target.value)} placeholder="Article cible (ex. art-12) — optionnel" className={inputCls} />
            <input value={rnote} onChange={(e) => setRnote(e.target.value)} placeholder="Note — optionnel" className={inputCls} />
          </div>
          <button type="button" disabled={busy || !rnum.trim()} onClick={addRef} className="rounded-md bg-chabon px-3 py-1.5 text-xs font-semibold text-koton hover:bg-chabon disabled:opacity-50">
            Ajouter le renvoi
          </button>
        </div>
      </details>
      )}

      {/* Amender : un ARTICLE pour un texte normatif, la NOTE D'ÉDITION pour une décision. */}
      {!estDecision && peutCurer && (
      <details className="rounded-lg border border-chabon/10 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-ank">Amender un article</summary>
        <div className="space-y-2 border-t border-chabon/10 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ank/80">Article :</span>
            {articles.length > 0 ? (
              <select value={anchor} onChange={(e) => setAnchor(e.target.value)} className={inputCls}>
                {articles.map((a) => (
                  <option key={a.anchor} value={a.anchor}>{a.label} ({a.anchor})</option>
                ))}
              </select>
            ) : (
              <input value={anchor} onChange={(e) => setAnchor(e.target.value)} placeholder="art-95" className={inputCls} />
            )}
          </div>
          <textarea value={oldBody} onChange={(e) => setOldBody(e.target.value)} rows={2} placeholder="Ancien texte (à conserver dans l’historique — utile au 1ᵉʳ amendement)" className={`${inputCls} w-full`} />
          <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={3} placeholder="Nouveau texte en vigueur *" className={`${inputCls} w-full`} />
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={aby} onChange={(e) => setAby(e.target.value)} placeholder="Modifié par (ex. « Loi du … »)" className={inputCls} />
            <input type="date" value={eff} onChange={(e) => setEff(e.target.value)} className={inputCls} title="Entrée en vigueur" />
            <input value={anote} onChange={(e) => setAnote(e.target.value)} placeholder="Note" className={inputCls} />
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy || !anchor.trim() || !newBody.trim()} onClick={amend} className="rounded-md bg-chabon px-3 py-1.5 text-xs font-semibold text-koton hover:bg-chabon disabled:opacity-50">
              Enregistrer l’amendement
            </button>
            <button type="button" disabled={busy || !anchor.trim()} onClick={abrogate} className="rounded-md border border-wouj/40 px-3 py-1.5 text-xs font-semibold text-wouj hover:bg-pil disabled:opacity-50">
              Abroger cet article
            </button>
          </div>
        </div>
      </details>
      )}

      {/* Note d'édition — ce qu'on amende sur une DÉCISION. Un arrêt n'a pas d'articles :
          ce que la rédaction reprend au fil du temps, c'est son commentaire et ses
          qualifications. La signature est ajoutée par le serveur — un éditeur n'est
          jamais anonyme. */}
      {estDecision && (
        <details open className="rounded-lg border border-chabon/10 bg-white">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-ank">Amender la note d’édition</summary>
          <div className="space-y-2 border-t border-chabon/10 p-3">
            {noteEdition?.noteRedactionBy && (
              <p className="text-xs text-ank/80">Dernière signature : {noteEdition.noteRedactionBy}</p>
            )}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Note d’édition — commentaire de la rédaction sur cette décision" className={`${inputCls} w-full`} />
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor="ne-trait" className="mb-1 block text-xs text-ank/80">Traitement ultérieur</label>
                <select id="ne-trait" value={trait} onChange={(e) => setTrait(e.target.value)} className={`${inputCls} w-full`}>
                  <option value="">— non évalué —</option>
                  {TRAITEMENTS.map((tv) => <option key={tv} value={tv}>{GLYPHE_TRAITEMENT[tv]} {tv.toLowerCase()}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ne-port" className="mb-1 block text-xs text-ank/80">Portée</label>
                <select id="ne-port" value={port} onChange={(e) => setPort(e.target.value)} className={`${inputCls} w-full`}>
                  <option value="">— non qualifiée —</option>
                  {PORTEES.map((pv) => <option key={pv} value={pv}>{GLYPHE_PORTEE[pv]} {pv === 'JURISPRUDENCE' ? 'fait jurisprudence' : 'décision d’espèce'}</option>)}
                </select>
              </div>
              <input value={traitNote} onChange={(e) => setTraitNote(e.target.value)} placeholder="Précision sur le traitement — optionnel" className={inputCls} />
              <input value={portNote} onChange={(e) => setPortNote(e.target.value)} placeholder="Précision sur la portée — optionnel" className={inputCls} />
            </div>
            <button type="button" disabled={busy} onClick={enregistrerNote} className="rounded-md bg-chabon px-3 py-1.5 text-xs font-semibold text-koton hover:bg-chabon disabled:opacity-50">
              Enregistrer la note d’édition
            </button>
          </div>
        </details>
      )}
    </section>
  )
}
