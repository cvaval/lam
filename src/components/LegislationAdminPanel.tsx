'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { postJson } from '@/lib/http'

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
const inputCls = 'rounded-md border border-lank/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-sitwon'

export function LegislationAdminPanel({
  documentId,
  themeTree,
  currentThemeIds,
  primaryThemeId,
  articles,
  refs,
}: {
  documentId: string
  themeTree: ThemeNode[]
  currentThemeIds: string[]
  primaryThemeId: string | null
  articles: ArticleRef[]
  refs: RefItem[]
}) {
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
            <label className="flex items-center gap-1.5 text-sm text-lank">
              <input type="checkbox" checked={checked.has(n.id)} onChange={() => toggle(n.id)} className="h-3.5 w-3.5 rounded border-lank/30 accent-lank" />
              {n.labelFr}
            </label>
            {checked.has(n.id) && (
              <button type="button" onClick={() => setPrimary(n.id)} className={`text-[11px] ${primary === n.id ? 'font-semibold text-sitwon-600' : 'text-lank/40 hover:text-lank/70'}`}>
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

  return (
    <section className="mt-6 rounded-2xl border border-dashed border-sitwon/40 bg-sitwon-50/40 p-4">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-lank/70">Outils éditoriaux — Master Admin</h2>
      <p className="mb-3 text-xs text-lank/50">Classer ce texte par thèmes, ajouter des renvois, ou amender un article. Le texte officiel n’est jamais modifié.</p>
      {msg && <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-fey-50 text-lank/80' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}

      {/* Thèmes */}
      <details open className="mb-2 rounded-lg border border-lank/10 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-lank">Thèmes ({checked.size})</summary>
        <div className="border-t border-lank/10 p-3">
          {themeTree.length === 0 ? (
            <p className="text-sm text-lank/50">Aucun thème. Créez-en dans « Législation : thèmes ».</p>
          ) : (
            <div className="max-h-64 overflow-auto">{renderTree(themeTree, 0)}</div>
          )}
          <button type="button" disabled={busy} onClick={saveThemes} className="mt-3 rounded-md bg-lank px-3 py-1.5 text-xs font-semibold text-cream hover:bg-lank-600 disabled:opacity-50">
            Enregistrer les thèmes
          </button>
        </div>
      </details>

      {/* Renvois */}
      <details className="mb-2 rounded-lg border border-lank/10 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-lank">Renvois ({refs.length})</summary>
        <div className="space-y-3 border-t border-lank/10 p-3">
          {refs.length > 0 && (
            <ul className="space-y-1">
              {refs.map((r) => (
                <li key={r.refId} className="flex items-center gap-2 text-sm">
                  <span className="rounded bg-lank/5 px-1.5 text-[11px] text-lank/60">{r.kind}</span>
                  <span className="text-lank">{r.label}</span>
                  {r.anchor && <span className="font-mono text-[11px] text-lank/40">#{r.anchor}</span>}
                  {r.pending && <span className="text-[11px] text-soley-600">(cible non importée)</span>}
                  <button type="button" disabled={busy} onClick={() => call({ action: 'removeRef', refId: r.refId }, 'Renvoi retiré.')} className="ml-auto text-xs text-red-600 hover:underline">
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
          <button type="button" disabled={busy || !rnum.trim()} onClick={addRef} className="rounded-md bg-lank px-3 py-1.5 text-xs font-semibold text-cream hover:bg-lank-600 disabled:opacity-50">
            Ajouter le renvoi
          </button>
        </div>
      </details>

      {/* Amendement */}
      <details className="rounded-lg border border-lank/10 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-lank">Amender un article</summary>
        <div className="space-y-2 border-t border-lank/10 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-lank/50">Article :</span>
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
            <button type="button" disabled={busy || !anchor.trim() || !newBody.trim()} onClick={amend} className="rounded-md bg-lank px-3 py-1.5 text-xs font-semibold text-cream hover:bg-lank-600 disabled:opacity-50">
              Enregistrer l’amendement
            </button>
            <button type="button" disabled={busy || !anchor.trim()} onClick={abrogate} className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              Abroger cet article
            </button>
          </div>
        </div>
      </details>
    </section>
  )
}
