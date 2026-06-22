'use client'

import { useRef, useState } from 'react'
import type { Locale } from '@/lib/types'

const LBL = {
  placeholder: { fr: 'Filtrer ce tableau…', en: 'Filter this table…', ht: 'Filtre tablo sa a…' },
  rows: { fr: 'lignes', en: 'rows', ht: 'liy' },
} as const

// Repli d'accents simple (client) : « réserve » trouvable en tapant « reserve ».
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Filtre client d'un tableau : masque les lignes (<tr> du <tbody>) dont le texte ne
 * contient pas la saisie. Opère sur le DOM déjà rendu (OfficialText est serveur) en
 * remontant au <figure> parent via closest() (pas d'id global → robuste à plusieurs
 * tableaux/composants sur la page). Aucune donnée modifiée. Affiche « n/total lignes ».
 *
 * Recalcule le zébrage (.zebra) sur les seules lignes VISIBLES après filtrage, sinon
 * l'alternance suivrait l'index DOM d'origine (deux lignes voisines même teinte).
 */
export function TableFilter({ total, locale }: { total: number; locale: Locale }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [shown, setShown] = useState(total)
  function apply(value: string) {
    const q = fold(value.trim())
    const fig = inputRef.current?.closest('figure')
    const rows = fig ? Array.from(fig.querySelectorAll<HTMLElement>('tbody tr')) : []
    let vis = 0
    for (const tr of rows) {
      const match = !q || fold(tr.textContent ?? '').includes(q)
      tr.style.display = match ? '' : 'none'
      // Pas de filtre actif → restaurer le zébrage serveur (1 ligne DOM sur 2) ;
      // filtre actif → zébrer selon le rang des lignes visibles.
      if (!q) tr.classList.toggle('zebra', rows.indexOf(tr) % 2 === 1)
      else if (match) {
        tr.classList.toggle('zebra', vis % 2 === 1)
        vis += 1
      }
    }
    setShown(q ? vis : total)
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        ref={inputRef}
        type="text"
        onChange={(e) => apply(e.target.value)}
        placeholder={LBL.placeholder[locale] ?? LBL.placeholder.fr}
        aria-label={LBL.placeholder[locale] ?? LBL.placeholder.fr}
        className="w-36 rounded-md border border-lank/15 bg-white px-2 py-1 text-xs text-lank outline-none focus:border-sitwon sm:w-44"
      />
      <span aria-live="polite" aria-atomic="true" className="whitespace-nowrap text-[11px] text-lank/45">
        {shown}/{total} {LBL.rows[locale] ?? LBL.rows.fr}
      </span>
    </span>
  )
}
