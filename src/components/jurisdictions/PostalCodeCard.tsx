import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { CommuneRecord } from '@/lib/jurisdictions/data'

/**
 * Codes postaux d'une commune : le code PRINCIPAL domine visuellement ; les
 * compléments vivent sous « Autres zones postales ». Aucun code n'est déduit
 * d'une proximité géographique — uniquement ce que la source documente.
 */
export function PostalCodeCard({ postal, t }: { postal: CommuneRecord['postal']; t: Dictionary }) {
  const j = t.judicial
  if (!postal.primaryCode) return null
  return (
    <section aria-label={j.primaryPostalCode} className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
      <h3 className="font-mono text-[11px] uppercase tracking-wider text-lank/50">{j.primaryPostalCode}</h3>
      <p className="mt-1 font-mono text-3xl font-bold tracking-wide text-lank">{postal.primaryCode}</p>
      {postal.additionalCodes.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-medium text-lank/55">{j.otherPostalZones}</h4>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {postal.additionalCodes.map((code) => (
              <li key={code} className="rounded-md bg-lank-50 px-2 py-1 font-mono text-xs text-lank/75">{code}</li>
            ))}
          </ul>
        </div>
      )}
      {postal.scopeNote && <p className="mt-2 text-[11px] leading-relaxed text-lank/55">{postal.scopeNote}</p>}
    </section>
  )
}
