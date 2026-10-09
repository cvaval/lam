import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import type { NotaryProfile } from '@/lib/jurisdictions/data'
import { mentionAsPrinted } from '@/lib/jurisdictions/notaires-source'
import { dateLongue } from '@/lib/jurisdictions/notaires-format'
import { formatPhone } from '@/lib/jurisdictions/coordonnees'
import { notarySourceLine } from './NotariesSection'

/**
 * Corps de la page d'un notaire : identité, commune, juridiction (sans « TPI »), coordonnées de
 * l'étude — le SEUL endroit où elles s'affichent — et provenances en clair. Rendu serveur.
 */
export function NotaryProfileView({ p, locale, t }: { p: NotaryProfile; locale: Locale; t: Dictionary }) {
  const j = t.judicial
  const mention = mentionAsPrinted(p.mention)
  const signaler = `mailto:erreur@agora.ht?subject=${encodeURIComponent(`Notaire — ${p.name} (${p.id})`)}`
  return (
    <>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-ank">
        <span aria-hidden="true" className="mr-2">👤</span>{p.name}
        {mention && <span className="ml-2 font-mono text-base font-normal text-ank/80">{mention}</span>}
      </h1>
      <p className="mt-1 text-sm text-grafit">{j.notaryKind}</p>
      {p.printedName && (
        <p className="mt-1 text-xs text-ank/80">{j.notaryPrintedName} : « {p.printedName} »</p>
      )}

      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl border border-chabon/10 bg-white p-5 text-sm">
        <dt className="text-ank/80">{j.commune}</dt>
        <dd className="font-medium text-ank">
          {p.commune ? (
            <Link href={`/${locale}/juridictions?commune=${p.commune.id}`} className="underline underline-offset-2 hover:text-chabon">{p.commune.name}</Link>
          ) : (
            <>{p.sourceCommune} <span className="text-xs font-normal text-ank/80">({j.notariesPrintedCommune})</span></>
          )}
        </dd>
        {p.commune && (
          <>
            <dt className="text-ank/80">{j.department}</dt>
            <dd className="font-medium text-ank">{p.commune.department}</dd>
          </>
        )}
        {p.jurisdiction && (
          <>
            <dt className="text-ank/80">{j.notaryJurisdiction}</dt>
            <dd className="font-medium text-ank">
              <Link href={`/${locale}/juridictions/notaires#${p.jurisdiction.id}`} className="underline underline-offset-2 hover:text-chabon">{p.jurisdiction.label}</Link>
            </dd>
          </>
        )}
      </dl>

      <section aria-labelledby="ag-coordonnees" className="mt-5 rounded-2xl border border-chabon/10 bg-white p-5">
        <h2 id="ag-coordonnees" className="font-mono text-[11px] uppercase tracking-wider text-ank/80">{j.notaryContactsTitle}</h2>
        {p.contact ? (
          <>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {p.contact.address && (
                <>
                  <dt className="text-ank/80">{j.address}</dt>
                  <dd className="text-ank">{p.contact.address}</dd>
                </>
              )}
              {p.contact.phones.length > 0 && (
                <>
                  <dt className="text-ank/80">{j.notaryPhone}</dt>
                  <dd className="flex flex-col">
                    {p.contact.phones.map((tel) => (
                      <a key={tel} href={`tel:${tel}`} className="inline-flex min-h-[44px] items-center font-mono text-ank underline underline-offset-2 hover:text-chabon">
                        {formatPhone(tel)}
                      </a>
                    ))}
                  </dd>
                </>
              )}
              {p.contact.email && (
                <>
                  <dt className="text-ank/80">{j.notaryEmail}</dt>
                  <dd>
                    <a href={`mailto:${p.contact.email}`} className="inline-flex min-h-[44px] items-center break-all text-ank underline underline-offset-2 hover:text-chabon">
                      {p.contact.email}
                    </a>
                  </dd>
                </>
              )}
            </dl>
            {p.contact.upToDateOn && (
              <p className="mt-3 text-[12px] text-ank/80">{j.notaryContactsSource.replace('{date}', dateLongue(p.contact.upToDateOn, locale))}</p>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-grafit">{j.notaryNoContacts}</p>
        )}
      </section>

      <p className="mt-4 text-[12px] leading-relaxed text-ank/80">{notarySourceLine(p.provenance, locale, t)}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        {p.commune && (
          <Link href={`/${locale}/juridictions?commune=${p.commune.id}&layers=paix,tpi,appel,cassation,notaires`} className="inline-flex min-h-[44px] items-center font-medium text-ank underline underline-offset-2 hover:text-chabon">
            {j.notaryOnMap}
          </Link>
        )}
        <Link href={`/${locale}/juridictions/notaires`} className="inline-flex min-h-[44px] items-center text-ank underline underline-offset-2 hover:text-chabon">
          ← {j.notariesByJurisdiction}
        </Link>
        <a href={signaler} className="inline-flex min-h-[44px] items-center text-xs text-ank/80 underline underline-offset-2 hover:text-chabon">
          {j.notaryReportError}
        </a>
      </div>
    </>
  )
}
