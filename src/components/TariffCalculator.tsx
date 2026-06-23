'use client'

import { useMemo, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { TariffRow } from './TariffTable'

// Analyse un taux « 10 % » / « 3,5 % » / « Exonéré » → fraction (0.10) ; 0 sinon.
function pct(s: string | null): number {
  if (!s) return 0
  const m = s.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*%/)
  return m ? Number(m[1]) / 100 : 0
}
// Accise : pourcentage OU montant fixe (« 25,00 G/gallon », « 0,025 G/livre »).
function parseAccise(s: string | null): { kind: 'pct'; v: number } | { kind: 'fixed'; v: number; unit: string } | { kind: 'none' } {
  if (!s) return { kind: 'none' }
  const fixed = s.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*G\s*\/\s*(\w+)/i)
  if (fixed) return { kind: 'fixed', v: Number(fixed[1]), unit: fixed[2] }
  if (s.includes('%')) return { kind: 'pct', v: pct(s) }
  return { kind: 'none' }
}
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Math.round(n * 100) / 100)

/** Modale d'estimation des droits et taxes à l'import pour une position tarifaire. */
export function TariffCalculator({ row, t, onClose }: { row: TariffRow; t: Dictionary; onClose: () => void }) {
  const [cif, setCif] = useState('')
  const [qty, setQty] = useState('')
  const [acompte, setAcompte] = useState(true)
  const [bordereau, setBordereau] = useState(true)
  const acc = useMemo(() => parseAccise(row.accises), [row.accises])

  const C = Number(cif.replace(/\s/g, '').replace(',', '.')) || 0
  const Q = Number(qty.replace(/\s/g, '').replace(',', '.')) || 0
  const ddPct = pct(row.dd)
  const ddAmt = C * ddPct
  const base = C + ddAmt // valeur en douane majorée du droit de douane
  const tcaAmt = base * 0.1
  const acciseAmt = acc.kind === 'pct' ? base * acc.v : acc.kind === 'fixed' ? Q * acc.v : 0
  const acompteAmt = acompte ? C * 0.02 : 0
  const bordereauAmt = bordereau ? (ddAmt + tcaAmt + acciseAmt) * 0.01 : 0
  const total = ddAmt + tcaAmt + acciseAmt + acompteAmt + bordereauAmt
  const grand = C + total

  const Line = ({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) => (
    <div className={`flex items-center justify-between gap-4 py-1.5 ${strong ? 'border-t border-lank/15 pt-2 font-semibold text-lank' : 'text-lank/80'}`}>
      <span className="text-sm">{label}</span>
      <span className="tabular-nums text-sm">{value}</span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-lank/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.tarifs.calcTitle}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lank">{t.tarifs.calcTitle}</h2>
            <p className="mt-0.5 text-xs text-lank/55">
              <span className="font-mono">{row.code}</span> — {row.designation.replace(/^[-\s]+/, '')}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t.tarifs.close} className="rounded-lg px-2 py-1 text-lank/50 hover:bg-paper">✕</button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-lank/60">{t.tarifs.cifValue}</span>
            <input
              type="text" inputMode="decimal" value={cif} onChange={(e) => setCif(e.target.value)} autoFocus
              placeholder="0" className="mt-1 w-full rounded-lg border border-lank/15 px-3 py-2 text-sm tabular-nums outline-none focus:border-kannel"
            />
          </label>
          {acc.kind === 'fixed' && (
            <label className="block">
              <span className="text-xs font-medium text-lank/60">{t.tarifs.quantity} ({acc.unit})</span>
              <input type="text" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border border-lank/15 px-3 py-2 text-sm tabular-nums outline-none focus:border-kannel" />
            </label>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-lank/80">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={acompte} onChange={(e) => setAcompte(e.target.checked)} /> {t.tarifs.calcAcompte}</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={bordereau} onChange={(e) => setBordereau(e.target.checked)} /> {t.tarifs.calcBordereau}</label>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-lank/10 bg-paper px-4 py-2">
          <Line label={`${t.tarifs.thDd} (${row.dd ?? '—'})`} value={`${fmt(ddAmt)} HTG`} />
          <Line label={`${t.tarifs.thTca} (10 %)`} value={`${fmt(tcaAmt)} HTG`} />
          {acc.kind !== 'none' && <Line label={`${t.tarifs.thAccises} (${row.accises})`} value={`${fmt(acciseAmt)} HTG`} />}
          {acompte && <Line label={t.tarifs.calcAcompte} value={`${fmt(acompteAmt)} HTG`} />}
          {bordereau && <Line label={t.tarifs.calcBordereau} value={`${fmt(bordereauAmt)} HTG`} />}
          <Line label={t.tarifs.calcTotal} value={`${fmt(total)} HTG`} strong />
          <Line label={t.tarifs.calcGrand} value={`${fmt(grand)} HTG`} strong />
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-lank/50">{t.tarifs.calcDisclaimer}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-lank/45">{t.tarifs.calcSituational}</p>
      </div>
    </div>
  )
}
