'use client'

import { useState } from 'react'
import type { RichCell } from '@/lib/doc/richblocks'
import type { Locale } from '@/lib/types'

const LBL = {
  copy: { fr: 'Copier', en: 'Copy', ht: 'Kopye' },
  copied: { fr: 'Copié', en: 'Copied', ht: 'Kopye' },
  title: { fr: 'Copier le tableau (collable dans Excel)', en: 'Copy table (paste into Excel)', ht: 'Kopye tablo a (kole nan Excel)' },
} as const

/**
 * Sérialise les lignes en grille TSV rectangulaire (collable tel quel dans
 * Excel/Sheets/Word). colSpan ET rowSpan sont développés en champs vides pour
 * conserver l'alignement des colonnes : un rowSpan occupe les cellules des lignes
 * suivantes (report par colonne), sinon les cellules fusionnées verticalement
 * décaleraient les colonnes vers la gauche. Affichage seul — aucune donnée modifiée.
 */
export function toTsv(rows: RichCell[][]): string {
  const grid: string[][] = []
  const carry: number[] = [] // carry[col] = lignes restantes occupées par un rowSpan au-dessus
  for (const row of rows) {
    const out: string[] = []
    let col = 0
    let ci = 0
    while (ci < row.length || col < carry.length) {
      if ((carry[col] ?? 0) > 0) {
        out[col] = '' // colonne occupée par un rowSpan d'une ligne précédente
        carry[col] -= 1
        col += 1
        continue
      }
      if (ci >= row.length) {
        col += 1
        continue
      }
      const c = row[ci++]
      const text = (c.text ?? '').replace(/[\t\n\r]+/g, ' ').trim()
      const cs = c.colSpan && c.colSpan > 1 ? c.colSpan : 1
      const rs = c.rowSpan && c.rowSpan > 1 ? c.rowSpan : 1
      for (let k = 0; k < cs; k++) {
        out[col] = k === 0 ? text : ''
        if (rs > 1) carry[col] = rs - 1
        col += 1
      }
    }
    grid.push(out)
  }
  const width = Math.max(0, ...grid.map((r) => r.length))
  return grid.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? '').join('\t')).join('\n')
}

/** Bouton « Copier » d'un tableau (îlot client dans OfficialText, composant serveur). */
export function TableActions({ rows, locale }: { rows: RichCell[][]; locale: Locale }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(toTsv(rows))
      setDone(true)
      setTimeout(() => setDone(false), 1800)
    } catch {
      /* presse-papiers indisponible (HTTP, permissions) */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      title={LBL.title[locale] ?? LBL.title.fr}
      aria-label={LBL.title[locale] ?? LBL.title.fr}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-lank/15 bg-white px-2 py-1 text-xs font-medium text-lank/70 transition hover:bg-lank-50 hover:text-lank"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        {done ? (
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" strokeLinecap="round" />
          </>
        )}
      </svg>
      {done ? (LBL.copied[locale] ?? LBL.copied.fr) : (LBL.copy[locale] ?? LBL.copy.fr)}
    </button>
  )
}
