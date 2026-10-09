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

/**
 * Le nom (lien vers la page du notaire), puis le marqueur (« (PDD) », « PD/CMM ») — affiché,
 * jamais interprété — et, s'il y a une fiche, une mention discrète « coordonnées ». Les
 * coordonnées elles-mêmes ne s'affichent QUE sur la page du notaire.
 */
export function NotaryName({ n, locale, t }: { n: NotaryView; locale: Locale; t: Dictionary }) {
  const m = mentionAsPrinted(n.mention)
  return (
    <>
      <Link href={`/${locale}/juridictions/notaires/${n.id}`} className="underline-offset-2 hover:text-chabon hover:underline">
        {n.fullName}
      </Link>
      {m && <span className="ml-1 font-mono text-[11px] text-ank/80">{m}</span>}
      {n.hasContact && <span className="ml-1.5 text-[11px] text-ank/70">· {t.judicial.notaryContactBadge}</span>}
      {n.addedByEditors && <span className="ml-1.5 text-[11px] text-ank/70">· {t.judicial.notaryAddedBadge}</span>}
    </>
  )
}

/** Lien DISCRET vers le formulaire des tiers — rendu seulement quand il est ouvert. */
export function lienDemande(locale: Locale, params: { notaire?: string; type?: 'inscription' }): string {
  const qs = params.notaire ? `?notaire=${params.notaire}` : params.type ? `?type=${params.type}` : ''
  return `/${locale}/juridictions/notaires/demande${qs}`
}

/**
 * Section « Notaires (N) » de la fiche d'une commune — rendu SERVEUR, lisible sans JavaScript.
 * Elle n'est PAS filtrée par les couches de la carte (les filtres gouvernent la carte, pas la
 * fiche). Une commune sans notaire le dit en toutes lettres : la section n'est jamais vide.
 */
export function NotariesSection({
  notaires, provenance, tpiId, locale, t, demandes = false,
}: { notaires: NotaryView[]; provenance: NotaryProvenance | null; tpiId: string | null; locale: Locale; t: Dictionary; demandes?: boolean }) {
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
              <li key={n.id}><NotaryName n={n} locale={locale} t={t} /></li>
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
        {demandes && (
          <p className="text-[12px] text-ank/80">
            <Link href={lienDemande(locale, { type: 'inscription' })} className="inline-flex min-h-[44px] items-center underline underline-offset-2 transition hover:text-chabon">
              {j.notaryRequestLinkListing}
            </Link>
          </p>
        )}
      </div>
    </section>
  )
}
