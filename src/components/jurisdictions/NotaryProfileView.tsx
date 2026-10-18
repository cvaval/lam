import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import type { NotaryProfile } from '@/lib/jurisdictions/data'
import { dateLongue } from '@/lib/jurisdictions/notaires-format'
import { qsAnnuaire } from '@/lib/jurisdictions/annuaire-notaires'
import { versFichePublique } from '@/lib/jurisdictions/fiche-notaire'
import { notarySourceLine } from './NotariesSection'
import { FicheNotaire } from './FicheNotaire'
import { libellesFiche } from './fiche-libelles'

/**
 * PAGE DE REPLI d'un notaire (`/juridictions/notaires/{id}`) : lisible sans JavaScript, indexée,
 * adresse canonique de chaque notaire. Le CONTENU de la fiche est celui de la fenêtre modale
 * (`FicheNotaire`, un seul composant) ; la page y ajoute ce qui situe l'inscription — département,
 * juridiction de rattachement, provenance de la liste — et ses liens (carte, annuaire, erreur).
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
  const signaler = `mailto:erreur@agora.ht?subject=${encodeURIComponent(`Notaire — ${p.name} (${p.id})`)}`
  // La carte JUDICIAIRE de la plateforme (aucune carte tierce) : l'onglet « Notaires » centré sur la
  // COMMUNE de commission — aucune adresse n'est géolocalisée ; carte ouverte sur téléphone.
  const surLaCarte = p.commune ? `/${locale}/juridictions?${qsAnnuaire({ commune: p.commune.id }, { carte: '1' })}` : null
  const annuaire = `/${locale}${retour ?? '/juridictions?vue=notaires'}#ag-annuaire`
  return (
    <>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-chabon">{j.notaryPageTitle}</h1>

      <section aria-labelledby="ag-notaire-nom" className="mt-5 rounded-xl border border-[#D7DCD7] bg-white p-5 sm:p-8">
        <FicheNotaire fiche={versFichePublique(p)} locale={locale} l={libellesFiche(t)} demandes={demandes} niveau={2} prefixe="ag-notaire" />
        {p.contact?.upToDateOn && (
          <p className="mt-3 text-[12px] text-ank/80">{(p.contact.viaRequest ? j.notaryContactsSourceRequest : j.notaryContactsSource).replace('{date}', dateLongue(p.contact.upToDateOn, locale))}</p>
        )}
      </section>

      {/* La commune de commission est dans la fiche ; la page ajoute ce qui la situe. */}
      {(p.commune || p.jurisdiction) && (
      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-[#D7DCD7] bg-white p-5 text-sm">
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
      )}

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
