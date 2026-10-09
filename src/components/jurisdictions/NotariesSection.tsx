import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import type { NotaryProvenance, NotaryView } from '@/lib/jurisdictions/data'
import { mentionAsPrinted } from '@/lib/jurisdictions/notaires-source'
import { formatConsultations } from '@/lib/jurisdictions/notaires-format'

/** Ligne de provenance EN CLAIR — jamais d'URL brute, de fichier ni d'empreinte (9 oct. 2026). */
export function notarySourceLine(provenance: NotaryProvenance | null, locale: Locale, t: Dictionary): string {
  const dates = provenance ? formatConsultations(provenance.consultations, locale) : ''
  return dates ? t.judicial.notariesSource.replace('{dates}', dates) : t.judicial.notariesSourceUndated
}

/** Nom tel qu'imprimé, puis le marqueur (« (PDD) », « PD/CMM ») — affiché, jamais interprété. */
export function NotaryName({ n }: { n: NotaryView }) {
  const m = mentionAsPrinted(n.mention)
  return (
    <>
      {n.fullName}
      {m && <span className="ml-1 font-mono text-[11px] text-ank/80">{m}</span>}
    </>
  )
}

/**
 * Section « Notaires (N) » de la fiche d'une commune — rendu SERVEUR, lisible sans JavaScript.
 * Elle n'est PAS filtrée par les couches de la carte (les filtres gouvernent la carte, pas la
 * fiche). Une commune sans notaire le dit en toutes lettres : la section n'est jamais vide.
 */
export function NotariesSection({
  notaires, provenance, tpiId, locale, t,
}: { notaires: NotaryView[]; provenance: NotaryProvenance | null; tpiId: string | null; locale: Locale; t: Dictionary }) {
  const j = t.judicial
  return (
    <section aria-labelledby="ag-notaires-titre">
      <h3 id="ag-notaires-titre" className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ank/80">
        <span aria-hidden="true" className="mr-1">👤</span>
        {j.notaries} ({notaires.length})
      </h3>
      <div className="rounded-xl border border-chabon/10 bg-white p-4">
        {notaires.length === 0 ? (
          <p className="text-sm text-grafit">{j.notariesNone}</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm text-ank">
            {notaires.map((n) => (
              <li key={n.ordinal}><NotaryName n={n} /></li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-[12px] leading-relaxed text-ank/80">{notarySourceLine(provenance, locale, t)}</p>
        <Link
          href={`/${locale}/juridictions/notaires${tpiId ? `#${tpiId}` : ''}`}
          className="mt-1 inline-flex min-h-[44px] items-center text-xs font-medium text-ank underline underline-offset-2 transition hover:text-chabon"
        >
          {j.notariesByJurisdiction} →
        </Link>
      </div>
    </section>
  )
}
