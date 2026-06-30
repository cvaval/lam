'use client'

import { useCallback, useState } from 'react'
import { postJson } from '@/lib/http'
import type { Locale } from '@/lib/types'

/** Nœud de l'arbre des thèmes (forme renvoyée par /api/admin/themes). */
interface ThemeNode {
  id: string
  slug: string
  labelFr: string
  labelEn: string | null
  labelHt: string | null
  parentId: string | null
  position: number
  color: string | null
  icon: string | null
  active: boolean
  children: ThemeNode[]
}

const COLORS = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#ca8a04', '#dc2626', '#db2777', '#475569']

type Draft = { labelFr: string; labelEn: string; labelHt: string; color: string | null }
const emptyDraft: Draft = { labelFr: '', labelEn: '', labelHt: '', color: null }

function flattenTree(nodes: ThemeNode[], depth = 0, out: { node: ThemeNode; depth: number }[] = []) {
  for (const n of nodes) {
    out.push({ node: n, depth })
    flattenTree(n.children, depth + 1, out)
  }
  return out
}
function subtreeIds(node: ThemeNode, set = new Set<string>()) {
  set.add(node.id)
  node.children.forEach((c) => subtreeIds(c, set))
  return set
}

export function ThemeManager({
  locale,
  initialTree,
  docCounts,
}: {
  locale: Locale
  initialTree: ThemeNode[]
  docCounts: Record<string, number>
}) {
  const [tree, setTree] = useState<ThemeNode[]>(initialTree)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [addingUnder, setAddingUnder] = useState<string | null | undefined>(undefined) // undefined=fermé, null=racine
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [moveTarget, setMoveTarget] = useState<string>('') // parentId cible ('' = racine)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/themes')
    const data = await res.json().catch(() => null)
    if (data?.tree) setTree(data.tree)
  }, [])

  const act = useCallback(
    async (body: Record<string, unknown>, okText: string) => {
      setBusy(true)
      setMsg(null)
      const res = await postJson('/api/admin/themes', body)
      setBusy(false)
      if (!res.ok) {
        const reasons: Record<string, string> = {
          exists: 'Ce thème existe déjà (slug en double).',
          cycle: 'Déplacement impossible : un thème ne peut pas devenir l’enfant de son descendant.',
          hasChildren: 'Retirez d’abord les sous-thèmes.',
          notFound: 'Thème introuvable.',
          forbidden: 'Accès refusé.',
        }
        setMsg({ kind: 'err', text: reasons[res.error ?? ''] ?? `Échec (${res.error ?? res.status}).` })
        return false
      }
      setMsg({ kind: 'ok', text: okText })
      await refresh()
      return true
    },
    [refresh],
  )

  function startAdd(parentId: string | null) {
    setEditingId(null)
    setMovingId(null)
    setDraft(emptyDraft)
    setAddingUnder(parentId)
  }
  function startEdit(n: ThemeNode) {
    setAddingUnder(undefined)
    setMovingId(null)
    setEditingId(n.id)
    setDraft({ labelFr: n.labelFr, labelEn: n.labelEn ?? '', labelHt: n.labelHt ?? '', color: n.color })
  }
  function startMove(n: ThemeNode) {
    setAddingUnder(undefined)
    setEditingId(null)
    setMoveTarget(n.parentId ?? '')
    setMovingId(n.id)
  }
  function cancel() {
    setAddingUnder(undefined)
    setEditingId(null)
    setMovingId(null)
    setDraft(emptyDraft)
  }
  async function doMove(id: string) {
    const ok = await act({ action: 'update', id, parentId: moveTarget || null }, 'Thème déplacé.')
    if (ok) cancel()
  }

  async function submitAdd(parentId: string | null) {
    if (!draft.labelFr.trim()) return
    const ok = await act(
      { action: 'create', parentId, labelFr: draft.labelFr.trim(), labelEn: draft.labelEn.trim() || undefined, labelHt: draft.labelHt.trim() || undefined, color: draft.color },
      'Thème créé.',
    )
    if (ok) cancel()
  }
  async function submitEdit(id: string) {
    if (!draft.labelFr.trim()) return
    const ok = await act(
      { action: 'update', id, labelFr: draft.labelFr.trim(), labelEn: draft.labelEn.trim() || null, labelHt: draft.labelHt.trim() || null, color: draft.color },
      'Thème mis à jour.',
    )
    if (ok) cancel()
  }

  async function reorder(siblings: ThemeNode[], index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= siblings.length) return
    const ids = siblings.map((s) => s.id)
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    await act({ action: 'reorder', orderedIds: ids }, 'Ordre mis à jour.')
  }

  async function remove(n: ThemeNode) {
    const docs = docCounts[n.id] ?? 0
    const warn =
      n.children.length > 0
        ? `« ${n.labelFr} » a des sous-thèmes : ils doivent être retirés d’abord.`
        : `Supprimer définitivement « ${n.labelFr} » ?${docs ? ` ${docs} document(s) y sont rattachés — ils seront détachés (les documents ne sont pas supprimés).` : ''}`
    if (n.children.length > 0) {
      setMsg({ kind: 'err', text: warn })
      return
    }
    if (!window.confirm(warn)) return
    await act({ action: 'remove', id: n.id, hardDelete: true }, 'Thème supprimé.')
  }

  function renderDraftForm(onSubmit: () => void, submitLabel: string) {
    return (
      <div className="mt-2 space-y-2 rounded-lg border border-lank/15 bg-paper p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <input autoFocus value={draft.labelFr} onChange={(e) => setDraft({ ...draft, labelFr: e.target.value })} placeholder="Libellé (FR) *" className="rounded-md border border-lank/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-sitwon" />
          <input value={draft.labelEn} onChange={(e) => setDraft({ ...draft, labelEn: e.target.value })} placeholder="Label (EN)" className="rounded-md border border-lank/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-sitwon" />
          <input value={draft.labelHt} onChange={(e) => setDraft({ ...draft, labelHt: e.target.value })} placeholder="Etikèt (HT)" className="rounded-md border border-lank/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-sitwon" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-lank/50">Couleur :</span>
          <button type="button" onClick={() => setDraft({ ...draft, color: null })} className={`h-5 w-5 rounded-full border ${draft.color === null ? 'border-lank ring-2 ring-lank/30' : 'border-lank/20'} bg-white`} title="Aucune" />
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setDraft({ ...draft, color: c })} className={`h-5 w-5 rounded-full ${draft.color === c ? 'ring-2 ring-offset-1 ring-lank/40' : ''}`} style={{ backgroundColor: c }} title={c} />
          ))}
          <div className="ml-auto flex gap-2">
            <button type="button" disabled={busy || !draft.labelFr.trim()} onClick={onSubmit} className="rounded-md bg-lank px-3 py-1.5 text-xs font-semibold text-cream transition hover:bg-lank-600 disabled:opacity-50">
              {submitLabel}
            </button>
            <button type="button" onClick={cancel} className="rounded-md border border-lank/15 px-3 py-1.5 text-xs text-lank/70 hover:bg-paper">
              Annuler
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderMoveForm(node: ThemeNode) {
    const exclude = subtreeIds(node)
    const candidates = flattenTree(tree).filter(({ node: n }) => !exclude.has(n.id))
    return (
      <div className="mt-2 space-y-2 rounded-lg border border-lank/15 bg-paper p-3">
        <p className="text-xs text-lank/60">
          Déplacer « <span className="font-medium text-lank">{node.labelFr}</span> » sous :
        </p>
        <div className="flex items-center gap-2">
          <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} className="flex-1 rounded-md border border-lank/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-sitwon">
            <option value="">— Racine (domaine de tête) —</option>
            {candidates.map(({ node: c, depth }) => (
              <option key={c.id} value={c.id}>
                {'  '.repeat(depth)}
                {c.labelFr}
              </option>
            ))}
          </select>
          <button type="button" disabled={busy} onClick={() => doMove(node.id)} className="rounded-md bg-lank px-3 py-1.5 text-xs font-semibold text-cream hover:bg-lank-600 disabled:opacity-50">
            Déplacer
          </button>
          <button type="button" onClick={cancel} className="rounded-md border border-lank/15 px-3 py-1.5 text-xs text-lank/70 hover:bg-paper">
            Annuler
          </button>
        </div>
      </div>
    )
  }

  function Row({ node, siblings, index, depth }: { node: ThemeNode; siblings: ThemeNode[]; index: number; depth: number }) {
    const label = locale === 'en' ? node.labelEn : locale === 'ht' ? node.labelHt : node.labelFr
    const docs = docCounts[node.id] ?? 0
    return (
      <li>
        <div className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-paper ${node.active ? '' : 'opacity-50'}`} style={{ paddingLeft: depth * 18 + 8 }}>
          <span className="h-3 w-3 shrink-0 rounded-full border border-lank/15" style={{ backgroundColor: node.color ?? 'transparent' }} />
          <span className="text-sm font-medium text-lank">{label || node.labelFr}</span>
          <span className="font-mono text-[11px] text-lank/35">⟨{node.slug}⟩</span>
          {docs > 0 && <span className="rounded-full bg-sitwon-50 px-1.5 text-[10px] text-lank/60">{docs} doc</span>}
          {!node.active && <span className="rounded-full bg-lank/10 px-1.5 text-[10px] text-lank/60">archivé</span>}
          <span className="ml-auto flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button onClick={() => reorder(siblings, index, -1)} disabled={busy || index === 0} className="rounded px-1 text-lank/50 hover:bg-lank/10 disabled:opacity-30" title="Monter">↑</button>
            <button onClick={() => reorder(siblings, index, 1)} disabled={busy || index === siblings.length - 1} className="rounded px-1 text-lank/50 hover:bg-lank/10 disabled:opacity-30" title="Descendre">↓</button>
            <button onClick={() => startAdd(node.id)} className="rounded px-1.5 text-xs text-lank/60 hover:bg-lank/10" title="Ajouter un sous-thème">+ sous-thème</button>
            <button onClick={() => startEdit(node)} className="rounded px-1.5 text-xs text-lank/60 hover:bg-lank/10">Renommer</button>
            <button onClick={() => startMove(node)} className="rounded px-1.5 text-xs text-lank/60 hover:bg-lank/10">Déplacer</button>
            <button onClick={() => act({ action: 'update', id: node.id, active: !node.active }, node.active ? 'Thème archivé.' : 'Thème restauré.')} className="rounded px-1.5 text-xs text-lank/60 hover:bg-lank/10">
              {node.active ? 'Archiver' : 'Restaurer'}
            </button>
            <button onClick={() => remove(node)} className="rounded px-1.5 text-xs text-red-600 hover:bg-red-50">Supprimer</button>
          </span>
        </div>
        {editingId === node.id && renderDraftForm(() => submitEdit(node.id), 'Enregistrer')}
        {addingUnder === node.id && renderDraftForm(() => submitAdd(node.id), 'Créer le sous-thème')}
        {movingId === node.id && renderMoveForm(node)}
        {node.children.length > 0 && (
          <ul>
            {node.children.map((c, i) => (
              <Row key={c.id} node={c} siblings={node.children} index={i} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-lank">Législation — thèmes</h1>
          <p className="text-sm text-lank/55">Classez les textes (lois, décrets, arrêtés) par thèmes. La liste est librement modifiable.</p>
        </div>
        <button onClick={() => startAdd(null)} className="rounded-lg bg-lank px-3 py-2 text-sm font-semibold text-cream transition hover:bg-lank-600">
          + Nouveau domaine
        </button>
      </div>

      {msg && (
        <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${msg.kind === 'ok' ? 'bg-fey-50 text-lank/80' : 'bg-red-50 text-red-700'}`} role="status">
          {msg.text}
        </p>
      )}

      {addingUnder === null && renderDraftForm(() => submitAdd(null), 'Créer le domaine')}

      <div className="rounded-2xl border border-lank/10 bg-white p-3 shadow-card">
        {tree.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-lank/50">Aucun thème. Créez un premier domaine.</p>
        ) : (
          <ul>
            {tree.map((n, i) => (
              <Row key={n.id} node={n} siblings={tree} index={i} depth={0} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
