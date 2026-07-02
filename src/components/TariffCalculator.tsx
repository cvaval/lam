'use client'

import { useMemo, useState } from 'react'
import { tariffLabel } from '@/lib/tarif-format'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { TariffRow } from './TariffTable'

// Analyse un taux « 10 % » / « 3,5 % » / « Exonéré » → fraction (0.10) ; 0 sinon.
function pct(s: string | null): number {
  if (!s) return 0
  const m = s.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*%/)
  return m ? Number(m[1]) / 100 : 0
}
// Accise : soit un pourcentage AD VALOREM (« 10 % »), soit un montant SPÉCIFIQUE par unité
// (« 25,00 G/gallon », « 0,025 G/livre »). L'ad valorem se calcule sur la valeur en douane ;
// le spécifique reste quantité × montant (hors valeur en douane).
function parseAccise(s: string | null): { kind: 'pct'; v: number } | { kind: 'fixed'; v: number; unit: string } | { kind: 'none' } {
  if (!s) return { kind: 'none' }
  const fixed = s.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*G\s*\/\s*(\w+)/i)
  if (fixed) return { kind: 'fixed', v: Number(fixed[1]), unit: fixed[2] }
  if (s.includes('%')) return { kind: 'pct', v: pct(s) }
  return { kind: 'none' }
}
// Saisie FR : point = séparateur de milliers (retiré), virgule = décimale ; borné à 0.
const num = (s: string) => Math.max(0, Number((s ?? '').replace(/[\s.]/g, '').replace(/,/g, '.')) || 0)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Math.round(n * 100) / 100)

/**
 * Modale d'estimation des droits et taxes à l'import pour une position tarifaire.
 * TOUTES les charges ad valorem sont calculées sur la VALEUR EN DOUANE (choix produit) ;
 * TPI et taxe environnementale (TPE) ne s'appliquent qu'aux véhicules.
 */
export function TariffCalculator({ row, t, onClose }: { row: TariffRow; t: Dictionary; onClose: () => void }) {
  const [valeur, setValeur] = useState('')
  const [qty, setQty] = useState('')
  // Véhicule : détecté AUTOMATIQUEMENT pour le chapitre 87 (véhicules) du SH → TPI ajoutée
  // d'office. L'utilisateur peut forcer/annuler (override) ; sinon la détection par code prime.
  const vehicleByCode = /^87/.test((row.code ?? '').replace(/\D/g, ''))
  const [vehicleOverride, setVehicleOverride] = useState<boolean | null>(null)
  const vehicle = vehicleOverride ?? vehicleByCode
  // « Plus de 7 ans » (→ TPE 25 %) : coché par défaut pour le chapitre 87 (à décocher pour
  // un véhicule récent — l'âge ne se déduit pas du tarif). Override manuel possible.
  const [vehicleOldOverride, setVehicleOldOverride] = useState<boolean | null>(null)
  const vehicleOld = vehicleOldOverride ?? vehicleByCode
  const acc = useMemo(() => parseAccise(row.accises), [row.accises])

  const V = num(valeur)
  const Q = num(qty)
  const acciseMissing = acc.kind === 'fixed' && Q <= 0
  const daaAmt = acc.kind === 'pct' ? V * acc.v : acc.kind === 'fixed' ? Q * acc.v : 0

  // Chaque charge = taux × valeur en douane (sauf accise spécifique = quantité × montant).
  const charges: { label: string; amt: number; show: boolean; missing?: boolean }[] = [
    { label: `${t.tarifs.calcDd}${row.dd ? ` (${row.dd})` : ''}`, amt: V * pct(row.dd), show: true },
    { label: `${t.tarifs.calcDaa}${row.accises ? ` (${row.accises})` : ''}`, amt: daaAmt, show: acc.kind !== 'none', missing: acciseMissing },
    { label: t.tarifs.calcFv, amt: V * 0.06, show: true },
    { label: t.tarifs.calcTca, amt: V * 0.1, show: true },
    { label: t.tarifs.calcTt, amt: V * 0.1, show: true },
    { label: t.tarifs.calcCfgdct, amt: V * 0.02, show: true },
    { label: t.tarifs.calcDs, amt: V * 0.02, show: true },
    { label: t.tarifs.calcTpi, amt: V * 0.2, show: vehicle },
    { label: t.tarifs.calcTpe, amt: V * 0.25, show: vehicle && vehicleOld },
  ]
  const shown = charges.filter((c) => c.show)
  const total = shown.reduce((s, c) => s + (c.missing ? 0 : c.amt), 0)
  const grand = V + total

  const Line = ({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) => (
    <div className={`flex items-center justify-between gap-4 py-1.5 ${strong ? 'border-t border-lank/15 pt-2 font-semibold text-lank' : 'text-lank/80'}`}>
      <span className="text-sm">{label}</span>
      <span className="shrink-0 tabular-nums text-sm">{value}</span>
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
              <span className="font-mono">{row.code}</span> — {tariffLabel(row.designation).label}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t.tarifs.close} className="rounded-lg px-2 py-1 text-lank/50 hover:bg-paper">✕</button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-lank/60">{t.tarifs.calcValeurDouane}</span>
            <input
              type="text" inputMode="decimal" value={valeur} onChange={(e) => setValeur(e.target.value)} autoFocus
              placeholder="0" className="mt-1 w-full rounded-lg border border-lank/15 px-3 py-2 text-sm tabular-nums outline-none focus:border-kannel"
            />
          </label>
          {acc.kind === 'fixed' && (
            <label className="block">
              <span className="text-xs font-medium text-lank/60">{t.tarifs.quantity} ({acc.unit}) *</span>
              <input type="text" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums outline-none focus:border-kannel ${acciseMissing ? 'border-brim' : 'border-lank/15'}`} />
            </label>
          )}
          <div className="flex flex-col gap-2 text-sm text-lank/80">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={vehicle} onChange={(e) => setVehicleOverride(e.target.checked)} /> {t.tarifs.calcVehicle}
              {vehicleByCode && <span className="text-xs text-lank/45">{t.tarifs.calcVehicleAuto}</span>}
            </label>
            {vehicle && (
              <label className="ml-6 inline-flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" checked={vehicleOld} onChange={(e) => setVehicleOldOverride(e.target.checked)} /> {t.tarifs.calcVehicleOld}
                {vehicleByCode && <span className="text-xs text-lank/45">{t.tarifs.calcVehicleOldHint}</span>}
              </label>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-lank/10 bg-paper px-4 py-2">
          {shown.map((c) => (
            <Line key={c.label} label={c.label} value={c.missing ? `— (${t.tarifs.quantity} ?)` : `${fmt(c.amt)} HTG`} />
          ))}
          <Line label={t.tarifs.calcTotal} value={`${fmt(total)} HTG`} strong />
          <Line label={t.tarifs.calcGrand} value={`${fmt(grand)} HTG`} strong />
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-lank/50">{t.tarifs.calcDisclaimer}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-lank/45">{t.tarifs.calcSituational}</p>
      </div>
    </div>
  )
}
