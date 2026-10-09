import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import type { NotaryProfile } from '@/lib/jurisdictions/data'
import { mentionAsPrinted } from '@/lib/jurisdictions/notaires-source'
import { dateLongue } from '@/lib/jurisdictions/notaires-format'
import { formatPhone } from '@/lib/jurisdictions/coordonnees'
import { DEFAULT_LAYERS, serializeLayers } from '@/lib/jurisdictions/layers'
import { notarySourceLine } from './NotariesSection'

/**
 * Corps de la page d'un notaire : identité, commune, juridiction (sans « TPI »), coordonnées de
 * l'étude — le SEUL endroit où elles s'affichent — et provenances en clair. Rendu serveur.
 */
export function NotaryProfileView({ p, locale, t }: { p: NotaryProfile; locale: Locale; t: Dictionary }) {
  const j = t.judicial
  const mention = mentionAsPrinted(p.mention)
  const signaler = `mailto:erreur@agora.ht?subject=${encodeURIComponent(`Notaire — ${p.name} (${p.id})`)}`
  // L'adresse mène à la CARTE JUDICIAIRE de la plateforme (choix de Me Vaval, 9 oct. 2026 : pas
  // de carte tierce), centrée sur la commune du notaire, couche « notaires » allumée. Agora ne
  // géolocalise aucune adresse : la carte montre la COMMUNE, où se trouve le 👤 — le nom
  // accessible du lien le dit.
  const surLaCarte = p.commune
    ? `/${locale}/juridictions?commune=${p.commune.id}&layers=${serializeLayers([...DEFAULT_LAYERS, 'notaires'])}`
    : null
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
            {/* Libellés CENTRÉS sur leur rangée : les boutons font 44 px de haut (cible tactile),
                un libellé calé en haut se retrouvait décalé par rapport au numéro. Sur téléphone,
                le libellé passe AU-DESSUS de sa valeur, qui prend toute la largeur. */}
            <dl className="mt-3 grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-4 sm:gap-y-3">
              {p.contact.address && (
                <>
                  <dt className="text-xs text-ank/80 sm:text-sm">{j.address}</dt>
                  <dd>
                    {surLaCarte && p.commune ? (
                      <Link
                        href={surLaCarte}
                        title={`${j.notaryOpenAddress} ${p.commune.name}`}
                        aria-label={`${p.contact.address} — ${j.notaryOpenAddress} ${p.commune.name}`}
                        className="inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-xl border border-chabon/20 bg-white px-4 py-2 text-sm text-ank transition hover:border-chabon hover:bg-pil"
                      >
                        <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
                        <span>{p.contact.address}</span>
                      </Link>
                    ) : (
                      <span className="text-ank">{p.contact.address}</span>
                    )}
                  </dd>
                </>
              )}
              {p.contact.phones.length > 0 && (
                <>
                  <dt className="mt-2 text-xs text-ank/80 sm:mt-0 sm:text-sm">{j.notaryPhone}</dt>
                  <dd className="flex flex-wrap gap-2">
                    {/* `tel:` : un toucher compose le numéro sur un téléphone ; sur ordinateur, le
                        système propose l'application d'appel. Bouton visible — la feuille du
                        portail retire le soulignement de tous les liens. */}
                    {p.contact.phones.map((tel) => (
                      <a
                        key={tel}
                        href={`tel:${tel}`}
                        aria-label={`${j.notaryCall} ${formatPhone(tel)}`}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-chabon/20 bg-white px-4 font-mono text-sm text-ank transition hover:border-chabon hover:bg-pil"
                      >
                        <Phone aria-hidden="true" className="h-4 w-4 shrink-0" />
                        {formatPhone(tel)}
                      </a>
                    ))}
                  </dd>
                </>
              )}
              {p.contact.email && (
                <>
                  <dt className="mt-2 text-xs text-ank/80 sm:mt-0 sm:text-sm">{j.notaryEmail}</dt>
                  <dd>
                    <a
                      href={`mailto:${p.contact.email}`}
                      aria-label={`${j.notaryWrite} ${p.contact.email}`}
                      className="inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-full border border-chabon/20 bg-white px-4 text-sm text-ank transition hover:border-chabon hover:bg-pil"
                    >
                      <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span className="[overflow-wrap:anywhere]">{p.contact.email}</span>
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
          <Link href={surLaCarte!} className="inline-flex min-h-[44px] items-center font-medium text-ank underline underline-offset-2 hover:text-chabon">
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
