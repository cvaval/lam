import Link from 'next/link'
import { Building2, Mail, Pencil, Phone } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import type { NotaryProfile } from '@/lib/jurisdictions/data'
import { mentionAsPrinted } from '@/lib/jurisdictions/notaires-source'
import { dateLongue } from '@/lib/jurisdictions/notaires-format'
import { formatPhone } from '@/lib/jurisdictions/coordonnees'
import { qsAnnuaire } from '@/lib/jurisdictions/annuaire-notaires'
import { lienDemande, notarySourceLine } from './NotariesSection'
import { BadgeConfirme, CocheConfirme } from './BadgeConfirme'

/**
 * Corps de la page d'un notaire (présentation du visuel validé du 18 oct. 2026) : titre « Notaire »,
 * puis une carte — le nom, la coche « Confirmé » SEULEMENT si le serveur l'autorise, la commune —
 * les coordonnées de l'étude (téléphones et courriel n'apparaissent qu'ici ; l'adresse aussi dans
 * l'annuaire), une petite icône CRAYON (demande de modification ou de confirmation — jamais un grand
 * bouton, jamais de bloc de suivi « Votre demande »), et la mention discrète de la confirmation.
 * Rendu serveur.
 */
export function NotaryProfileView({
  p, locale, t, demandes = false, retour = null,
}: {
  p: NotaryProfile; locale: Locale; t: Dictionary; demandes?: boolean
  /** Chemin de l'annuaire d'où l'on vient, sans la langue (`lireRetourAnnuaire`). */
  retour?: string | null
}) {
  const j = t.judicial
  const mention = mentionAsPrinted(p.mention)
  const signaler = `mailto:erreur@agora.ht?subject=${encodeURIComponent(`Notaire — ${p.name} (${p.id})`)}`
  // L'adresse mène à la CARTE JUDICIAIRE de la plateforme (choix de Me Vaval, 9 oct. 2026 : pas
  // de carte tierce) — l'onglet « Notaires » centré sur la commune du notaire, carte ouverte sur
  // téléphone (17 oct. 2026). Agora ne géolocalise aucune adresse : la carte montre la COMMUNE, où
  // se trouve le 👤 — le nom accessible du lien le dit.
  const surLaCarte = p.commune ? `/${locale}/juridictions?${qsAnnuaire({ commune: p.commune.id }, { carte: '1' })}` : null
  const annuaire = `/${locale}${retour ?? '/juridictions?vue=notaires'}#ag-annuaire`
  return (
    <>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-chabon">{j.notaryPageTitle}</h1>

      <section aria-labelledby="ag-notaire-nom" className="mt-5 rounded-xl border border-[#D7DCD7] bg-white p-5 sm:p-6">
        <h2 id="ag-notaire-nom" className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-serif text-2xl font-semibold text-chabon sm:text-[28px]">
          <span>{p.name}</span>
          {mention && <span className="font-mono text-base font-normal text-[#52656B]">{mention}</span>}
          {p.confirmedOn && <BadgeConfirme libelle={j.notaryConfirmedBadge} infobulle={j.notaryConfirmedTooltip} avecLibelle={false} />}
        </h2>
        <p className="mt-1 text-[15px] text-[#52656B]">{j.notaryKind}{p.commune ? ` · ${p.commune.name}` : ''}</p>
        {p.printedName && <p className="mt-1 text-xs text-[#52656B]">{j.notaryPrintedName} : « {p.printedName} »</p>}

        <div id="ag-coordonnees" className="mt-4 border-t border-[#D7DCD7] pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-lg font-semibold text-chabon">{j.notaryContactsTitle}</h3>
            {demandes && (
              // Discrète, mais une vraie cible : 44 × 44 px, nommée, focus visible (règle globale).
              <Link
                href={lienDemande(locale, { notaire: p.id })}
                aria-label={j.notaryEditRequest}
                title={j.notaryEditRequest}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#52656B] transition hover:bg-[#E9EDE7] hover:text-chabon"
              >
                <Pencil aria-hidden="true" className="h-[18px] w-[18px]" />
              </Link>
            )}
          </div>
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
                        <Building2 aria-hidden="true" className="h-4 w-4 shrink-0" />
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
              <p className="mt-3 text-[12px] text-ank/80">{(p.contact.viaRequest ? j.notaryContactsSourceRequest : j.notaryContactsSource).replace('{date}', dateLongue(p.contact.upToDateOn, locale))}</p>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-grafit">{j.notaryNoContacts}</p>
        )}
        </div>

        {p.confirmedOn && (
          // Mention DISCRÈTE et datée : la date est celle de la confirmation par le notaire.
          <div className="mt-4 flex items-start gap-3 rounded-lg bg-[#E9EDE7] px-4 py-3">
            <CocheConfirme className="mt-0.5 h-5 w-5" />
            <div>
              <p className="text-[15px] font-medium text-chabon">{j.notaryConfirmedNote}</p>
              <p className="text-[13px] text-[#52656B]">{j.notaryConfirmedOn.replace('{date}', dateLongue(p.confirmedOn, locale))}</p>
            </div>
          </div>
        )}
      </section>

      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-[#D7DCD7] bg-white p-5 text-sm">
        <dt className="text-[#52656B]">{j.annuaireCommission}</dt>
        <dd className="font-medium text-chabon">
          {p.commune ? (
            <Link href={`/${locale}/juridictions?commune=${p.commune.id}`} className="underline underline-offset-2 hover:text-[#9B422C]">{p.commune.name}</Link>
          ) : (
            <>{p.sourceCommune} <span className="text-xs font-normal text-[#52656B]">({j.notariesPrintedCommune})</span></>
          )}
        </dd>
        {p.commune && (
          <>
            <dt className="text-[#52656B]">{j.department}</dt>
            <dd className="font-medium text-chabon">{p.commune.department}</dd>
          </>
        )}
        {p.jurisdiction && (
          <>
            <dt className="text-[#52656B]">{j.notaryJurisdiction}</dt>
            <dd className="font-medium text-chabon">
              <Link href={`/${locale}/juridictions?vue=notaires&juridiction=${p.jurisdiction.id}#ag-annuaire`} className="underline underline-offset-2 hover:text-[#9B422C]">{p.jurisdiction.label}</Link>
            </dd>
          </>
        )}
      </dl>

      <p className="mt-4 text-[12px] leading-relaxed text-ank/80">
        {p.addedByEditors
          ? p.addedByEditors.verifiedOn
            ? j.notaryAddedSource.replace('{date}', dateLongue(p.addedByEditors.verifiedOn, locale))
            : j.notaryAddedSourceUndated
          : notarySourceLine(p.provenance, locale, t)}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        {p.commune && (
          <Link href={surLaCarte!} className="inline-flex min-h-[44px] items-center font-medium text-ank underline underline-offset-2 hover:text-chabon">
            {j.notaryOnMap}
          </Link>
        )}
        <Link href={annuaire} className="inline-flex min-h-[44px] items-center font-medium text-ank underline underline-offset-2 hover:text-chabon">
          ← {j.annuaireBack}
        </Link>
        <a href={signaler} className="inline-flex min-h-[44px] items-center text-xs text-ank/80 underline underline-offset-2 hover:text-chabon">
          {j.notaryReportError}
        </a>
      </div>
    </>
  )
}
