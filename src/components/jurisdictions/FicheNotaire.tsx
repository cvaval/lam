import { Mail, MapPin, Pencil, Phone } from 'lucide-react'
import type { Locale } from '@/lib/types'
import type { FicheNotairePublique } from '@/lib/jurisdictions/fiche-notaire'
import { lienDemande } from '@/lib/jurisdictions/fiche-notaire'
import { mentionAsPrinted } from '@/lib/jurisdictions/notaires-source'
import { dateLongue } from '@/lib/jurisdictions/notaires-format'
import { formatPhone } from '@/lib/jurisdictions/format-telephone'
import type { LibellesFiche } from './fiche-libelles'
import { BadgeConfirme } from './BadgeConfirme'
import { CopierAdresse } from './CopierAdresse'

/**
 * LE contenu de la fiche d'un notaire (visuel validé du 18 oct. 2026) — UN SEUL composant, rendu
 * dans la FENÊTRE MODALE de l'annuaire et de la carte comme dans la PAGE DE REPLI (sans JavaScript,
 * lien direct ancien) : jamais deux implémentations qui divergent.
 *
 *  - identité : le nom réel ; la coche et « Confirmé » SEULEMENT si une confirmation valide existe
 *    (`confirmedOn`, décidé par le serveur) ; la COMMUNE DE COMMISSION (jamais confondue avec
 *    l'adresse de l'étude ni la juridiction) ; la date « Informations confirmées le … » ;
 *  - un petit CRAYON à droite de l'identité (demande de modification ou de confirmation de TOUTE la
 *    fiche) — jamais un grand bouton, jamais de bloc « Votre demande » ni d'état d'attente ;
 *  - « Coordonnées de l'étude » dans une zone OUVERTE (séparateurs légers, sans cadre) : adresse et
 *    sa copie, chaque téléphone (`tel:`, « Appeler »), chaque courriel (`mailto:`, « Écrire ») —
 *    rien de tronqué, les lignes absentes masquées, une seule phrase quand il n'y a rien.
 */
export function FicheNotaire({
  fiche, locale, l, demandes, niveau = 3, prefixe = 'ag-fiche',
}: {
  fiche: FicheNotairePublique
  locale: Locale
  l: LibellesFiche
  /** Formulaire des tiers ouvert : le crayon s'affiche. */
  demandes: boolean
  /** Niveau du titre portant le nom : 3 dans la modale (titre « Notaire » en h2), 2 sur la page (h1). */
  niveau?: 2 | 3
  /** Préfixe des identifiants (uniques dans la page). */
  prefixe?: string
}) {
  const Nom = `h${niveau}` as 'h2' | 'h3'
  const Section = `h${niveau + 1}` as 'h3' | 'h4'
  const mention = mentionAsPrinted(fiche.mention)
  const c = fiche.contact
  const ligne = 'flex items-start gap-4 py-4'
  const icone = 'mt-0.5 h-5 w-5 shrink-0 text-[#152E38]'
  const etiquette = 'text-[14px] font-semibold text-[#152E38]'
  // `!underline` : la feuille du portail retire le soulignement de tous les liens.
  const action = 'inline-flex min-h-[44px] shrink-0 items-center text-[14px] font-medium text-[#9B422C] !underline underline-offset-4 hover:text-[#152E38]'

  return (
    <div className="font-sans">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Nom id={`${prefixe}-nom`} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-serif text-[26px] font-semibold leading-tight text-[#152E38] sm:text-[28px]">
            <span className="[overflow-wrap:anywhere]">{fiche.name}</span>
            {mention && <span className="font-mono text-base font-normal text-[#52656B]">{mention}</span>}
            {fiche.confirmedOn && <BadgeConfirme libelle={l.badge} infobulle={l.infobulle} taille="h-[22px] w-[22px]" />}
          </Nom>
          <p className="mt-2 text-[15px] text-[#52656B]">
            {l.commission} :{' '}
            {fiche.commune ? fiche.commune.name : l.communeImprimee.replace('{name}', fiche.sourceCommune)}
          </p>
          {fiche.printedName && <p className="mt-0.5 text-[12px] text-[#52656B]">{l.nomImprime} : « {fiche.printedName} »</p>}
          {fiche.confirmedOn && (
            <p className="mt-0.5 text-[13px] text-[#52656B]">{l.confirmeesLe.replace('{date}', dateLongue(fiche.confirmedOn, locale))}</p>
          )}
        </div>
        {demandes && (
          // Discret, mais une vraie cible : 44 × 44 px, nommé, focus visible (règle globale).
          <a
            href={lienDemande(locale, { notaire: fiche.id })}
            aria-label={l.crayon}
            title={l.crayon}
            className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#52656B] transition hover:bg-[#E9EDE7] hover:text-[#152E38]"
          >
            <Pencil aria-hidden="true" className="h-5 w-5" />
          </a>
        )}
      </div>

      <section aria-labelledby={`${prefixe}-coordonnees`} className="mt-7">
        <Section id={`${prefixe}-coordonnees`} className="font-serif text-[21px] font-semibold text-[#152E38]">{l.coordonnees}</Section>
        {c ? (
          <ul className="mt-2 divide-y divide-[#D7DCD7]">
            {c.address && (
              <li className={ligne}>
                <MapPin aria-hidden="true" className={icone} />
                <div className="min-w-0 flex-1">
                  <p className={etiquette}>{l.adresse}</p>
                  <p id={`${prefixe}-adresse`} className="mt-0.5 text-[15px] text-[#52656B] [overflow-wrap:anywhere]">{c.address}</p>
                </div>
                <CopierAdresse adresse={c.address} cibleId={`${prefixe}-adresse`} l={{ copier: l.copier, copiee: l.copiee, repli: l.copieRepli }} />
              </li>
            )}
            {c.phones.length > 0 && (
              <li className={ligne}>
                <Phone aria-hidden="true" className={icone} />
                <div className="min-w-0 flex-1">
                  <p className={etiquette}>{l.telephone}</p>
                  <ul className="mt-0.5">
                    {c.phones.map((tel) => (
                      <li key={tel} className="flex flex-wrap items-center justify-between gap-x-4">
                        <span className="text-[15px] text-[#9B422C]">{formatPhone(tel)}</span>
                        <a href={`tel:${tel}`} aria-label={`${l.appelerLe} ${formatPhone(tel)}`} className={action}>{l.appeler}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            )}
            {c.emails.length > 0 && (
              <li className={ligne}>
                <Mail aria-hidden="true" className={icone} />
                <div className="min-w-0 flex-1">
                  <p className={etiquette}>{l.courriel}</p>
                  <ul className="mt-0.5">
                    {c.emails.map((courriel) => (
                      <li key={courriel} className="flex flex-wrap items-center justify-between gap-x-4">
                        <span className="min-w-0 text-[15px] text-[#9B422C] [overflow-wrap:anywhere]">{courriel}</span>
                        <a href={`mailto:${courriel}`} aria-label={`${l.ecrireA} ${courriel}`} className={action}>{l.ecrire}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            )}
          </ul>
        ) : (
          <p className="mt-3 text-[15px] text-[#52656B]">{l.aucune}</p>
        )}
      </section>
    </div>
  )
}
