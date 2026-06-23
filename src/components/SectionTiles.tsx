'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Pastille } from './TypeBadge'
import { COLOR_CLASSES } from '@/lib/brand'
import { postJson } from '@/lib/http'
import type { DocType, Locale } from '@/lib/types'

export interface SectionTile {
  type: DocType
  slug: string
  num: number
  color: keyof typeof COLOR_CLASSES
  label: string
  feature: string
  newCount: number
}

export interface SectionTilesLabels {
  whatsNew: string
  newEntries: string
  reorderHint: string
  moved: string
  position: string
  of: string
  saveError: string
}

const DRAG_SLOP = 6 // px avant d'engager le glisser (évite un déplacement sur simple tap/clic)

/**
 * Tuiles d'accès rapide RÉORGANISABLES par glisser-déposer (souris, tactile et clavier).
 * L'ordre est sauvegardé côté compte (/api/account/section-order) → il suit l'utilisateur
 * sur n'importe quelle machine. Les nouveaux onglets ajoutés plus tard apparaissent à la fin
 * (voir orderTypes côté serveur). La poignée (⠿) seule déclenche le glisser : le reste de la
 * tuile reste un lien normal (clic = ouvrir, balayage = défiler la page sur mobile).
 *
 * Accessibilité : poignée = bouton avec libellé contextuel (rubrique + position), flèches du
 * clavier pour déplacer, région live polie qui annonce chaque déplacement. Robustesse : un
 * seul pointeur actif à la fois (pas de corruption au multi-touch) ; échec d'enregistrement →
 * retour au dernier ordre confirmé + annonce.
 */
export function SectionTiles({
  tiles,
  locale,
  labels,
}: {
  tiles: SectionTile[]
  locale: Locale
  labels: SectionTilesLabels
}) {
  const [order, setOrder] = useState<SectionTile[]>(tiles)
  const [dragType, setDragType] = useState<DocType | null>(null)
  const [status, setStatus] = useState('') // région live (lecteurs d'écran)

  const orderRef = useRef<SectionTile[]>(tiles)
  const committedRef = useRef<SectionTile[]>(tiles) // dernier ordre confirmé par le serveur
  const dragRef = useRef<DocType | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const engagedRef = useRef(false) // le seuil de glisser est-il franchi ?
  const movedRef = useRef(false) // un déplacement a-t-il eu lieu ?

  useEffect(() => { orderRef.current = order }, [order])

  // Resynchronise si la liste serveur change (droits d'accès, nouveaux onglets).
  const sig = tiles.map((t) => t.type).join(',')
  useEffect(() => {
    setOrder(tiles)
    committedRef.current = tiles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  function announce(msg: string) {
    // Re-déclenche l'annonce même si le texte est identique (espace insécable alterné).
    setStatus((prev) => (prev === msg ? msg + ' ' : msg))
  }
  function posLabel(tile: SectionTile, i: number, n: number) {
    return `${tile.label} ${labels.moved} — ${labels.position} ${i + 1} ${labels.of} ${n}`
  }

  async function save(next: SectionTile[]) {
    const r = await postJson('/api/account/section-order', { order: next.map((t) => t.type) })
    if (r.ok) {
      committedRef.current = next
    } else {
      // Échec (session expirée, erreur réseau/serveur) : on rétablit l'ordre confirmé.
      setOrder(committedRef.current)
      announce(labels.saveError)
    }
  }

  function moveOver(dragged: DocType, over: DocType) {
    setOrder((prev) => {
      const from = prev.findIndex((t) => t.type === dragged)
      const to = prev.findIndex((t) => t.type === over)
      if (from < 0 || to < 0 || from === to) return prev
      const copy = prev.slice()
      const [item] = copy.splice(from, 1)
      copy.splice(to, 0, item)
      return copy
    })
  }

  function onGripDown(e: React.PointerEvent, type: DocType) {
    if (dragRef.current) return // un seul glisser à la fois (anti multi-touch)
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = type
    pointerIdRef.current = e.pointerId
    startRef.current = { x: e.clientX, y: e.clientY }
    engagedRef.current = false
    movedRef.current = false
  }
  function onGripMove(e: React.PointerEvent) {
    if (!dragRef.current || e.pointerId !== pointerIdRef.current) return
    if (!engagedRef.current) {
      const s = startRef.current
      if (!s || Math.hypot(e.clientX - s.x, e.clientY - s.y) < DRAG_SLOP) return // sous le seuil
      engagedRef.current = true
      setDragType(dragRef.current)
    }
    const card = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest(
      '[data-tile]',
    ) as HTMLElement | null
    const over = card?.getAttribute('data-tile') as DocType | undefined
    if (!over || over === dragRef.current) return
    movedRef.current = true
    moveOver(dragRef.current, over)
  }
  function onGripUp(e: React.PointerEvent) {
    if (e.pointerId !== pointerIdRef.current) return
    const dragged = dragRef.current
    const wasDrag = !!dragged && movedRef.current
    dragRef.current = null
    pointerIdRef.current = null
    engagedRef.current = false
    setDragType(null)
    if (wasDrag && dragged) {
      const cur = orderRef.current
      const i = cur.findIndex((t) => t.type === dragged)
      if (i >= 0) announce(posLabel(cur[i], i, cur.length))
      void save(cur)
    }
  }

  // Réorganisation au clavier (accessibilité) : flèches pour déplacer la tuile focalisée.
  function onGripKey(e: React.KeyboardEvent, type: DocType) {
    const dir = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : 0
    if (!dir) return
    e.preventDefault()
    const cur = orderRef.current
    const i = cur.findIndex((t) => t.type === type)
    const j = i + dir
    if (i < 0) return
    if (j < 0 || j >= cur.length) {
      // Bord de liste : pas de déplacement, mais on annonce la position pour ne pas « gober » la touche.
      announce(posLabel(cur[i], i, cur.length))
      return
    }
    const copy = cur.slice()
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    setOrder(copy)
    announce(posLabel(copy[j], j, copy.length))
    void save(copy)
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {order.map((m, i) => (
        <div
          key={m.type}
          data-tile={m.type}
          className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-card transition ${
            dragType === m.type
              ? 'z-10 scale-[1.02] border-lank/40 shadow-lg ring-2 ring-lank/20'
              : 'border-lank/10 hover:-translate-y-0.5 hover:shadow-lg'
          }`}
        >
          <span className={`absolute inset-x-0 top-0 h-1 ${COLOR_CLASSES[m.color].dot}`} />
          {/* Poignée de réorganisation — seul élément qui déclenche le glisser (touch-none). */}
          <button
            type="button"
            aria-label={`${labels.reorderHint} — ${m.label} (${i + 1}/${order.length})`}
            title={labels.reorderHint}
            onPointerDown={(e) => onGripDown(e, m.type)}
            onPointerMove={onGripMove}
            onPointerUp={onGripUp}
            onPointerCancel={onGripUp}
            onKeyDown={(e) => onGripKey(e, m.type)}
            className="absolute right-1.5 top-1.5 z-20 touch-none cursor-grab rounded-md px-1.5 py-1 text-lank/30 transition hover:bg-paper hover:text-lank/70 active:cursor-grabbing"
          >
            <span aria-hidden className="text-base leading-none">⠿</span>
          </button>
          <Link href={`/${locale}/type/${m.slug}`} className="block">
            <div className="flex items-center justify-between pr-7">
              <span className="font-mono text-xs text-lank/40">0{m.num}</span>
              <span className="flex items-center gap-2">
                {m.newCount > 0 && (
                  <span
                    title={`${m.newCount.toLocaleString('fr')} ${labels.newEntries}`}
                    className="inline-flex h-5 items-center rounded-full bg-sitwon px-2 text-[10px] font-bold uppercase tracking-wide text-lank"
                  >
                    {labels.whatsNew}
                  </span>
                )}
                <Pastille type={m.type} />
              </span>
            </div>
            <h3 className="mt-3 font-semibold leading-snug text-lank">{m.label}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-lank/55">{m.feature}</p>
          </Link>
        </div>
      ))}
      {/* Annonces pour lecteurs d'écran (déplacements clavier/souris). */}
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {status}
      </span>
    </div>
  )
}
