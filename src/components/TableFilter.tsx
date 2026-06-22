'use client'

import { useState } from 'react'
import type { Locale } from '@/lib/types'

const LBL = {
  placeholder: { fr: 'Filtrer ce tableau…', en: 'Filter this table…', ht: 'Filtre tablo sa a…' },
  rows: { fr: 'lignes', en: 'rows', ht: 'liy' },
} as const

// Repli d'accents simple (client) : « réserve » trouvable en tapant « reserve ».
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Filtre client d'un tableau : masque les lignes (<tr> du <tbody>) dont le texte ne
 * contient pas la saisie. Opère sur le DOM déjà rendu (OfficialText est serveur) via
 * l'id du <figure> ; aucune donnée modifiée. Affiche « n/total lignes ».
 */
export function TableFilter({ figureId, total, locale }: { figureId: string; total: number; locale: Locale }) {
  const [shown, setShown] = useState(total)
  function apply(value: string) {
    const q = fold(value.trim())
    const fig = document.getElementById(figureId)
    const rows = fig ? Array.from(fig.querySelectorAll('tbody tr')) : []
    let n = 0
    for (const tr of rows) {
      const match = !q || fold(tr.textContent ?? '').includes(q)
      ;(tr as HTMLElement).style.display = match ? '' : 'none'
      if (match) n += 1
    }
    setShown(q ? n : total)
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="text"
        onChange={(e) => apply(e.target.value)}
        placeholder={LBL.placeholder[locale] ?? LBL.placeholder.fr}
        aria-label={LBL.placeholder[locale] ?? LBL.placeholder.fr}
        className="w-36 rounded-md border border-lank/15 bg-white px-2 py-1 text-xs text-lank outline-none focus:border-sitwon sm:w-44"
      />
      <span className="whitespace-nowrap text-[11px] text-lank/45">
        {shown}/{total} {LBL.rows[locale] ?? LBL.rows.fr}
      </span>
    </span>
  )
}
