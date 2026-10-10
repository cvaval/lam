import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { AgoraPublicHeader } from '@/components/AgoraPublicHeader'
import '@/components/agora-portal.css'
import { dictFor } from '@/lib/i18n/server'
import { isLocale } from '@/lib/types'
import { getCommuneDirectory, getNotaryProfile } from '@/lib/jurisdictions/data'
import { demandesOuvertes } from '@/lib/jurisdictions/notaires-demandes'
import { ACTIONS_HUMAIN, clesTurnstile, langueTurnstile } from '@/lib/security/turnstile'
import { NotaryRequestForm } from '@/components/jurisdictions/NotaryRequestForm'
import { libellesDemande } from '@/components/jurisdictions/notary-request-labels'

export const dynamic = 'force-dynamic'

const premier = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

/**
 * Demande d'un TIERS (chantier D) : proposer ou corriger les coordonnées d'un notaire, ou
 * signaler un notaire absent de la liste. Fonctionnalité DISCRÈTE — on n'y arrive que par les
 * liens de la page d'un notaire et de la liste — et FERMÉE par défaut : 404 tant que
 * `NOTARY_REQUESTS_ENABLED` ne vaut pas `true` ou que les clés Turnstile manquent (la cliente
 * valide d'abord l'addition à la politique de confidentialité). `noindex`. La vérification
 * humaine (Turnstile) précède tout envoi ; la CSP de CETTE page seule l'autorise.
 *
 *  - `?notaire=<id>` : notaire visé (pré-sélection « coordonnées ») ;
 *  - `?type=inscription` : notaire absent de la liste ;
 *  - `?envoyee=1` : confirmation, la même dans tous les cas ;
 *  - `?erreur=a,b` : champs à reprendre (la saisie n'est pas renvoyée dans l'URL).
 */
export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const { t } = dictFor(params.locale)
  return { title: t.judicial.notaryRequestMetaTitle, robots: { index: false, follow: false } }
}

export default async function DemandeNotairePage({
  params, searchParams,
}: { params: { locale: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const cles = clesTurnstile()
  if (!demandesOuvertes() || !cles) notFound()
  const { locale, t } = dictFor(isLocale(params.locale) ? params.locale : 'fr')
  // Nonce de la requête (middleware) : le script de Cloudflare le porte, la CSP l'autorise.
  const nonce = headers().get('x-nonce') ?? undefined
  const j = t.judicial

  const envoyee = premier(searchParams.envoyee) === '1'
  const notaireId = premier(searchParams.notaire)
  const erreurs = premier(searchParams.erreur).split(',').filter(Boolean).slice(0, 20)
  const [profil, communes] = envoyee
    ? [null, []]
    : await Promise.all([notaireId ? getNotaryProfile(notaireId) : Promise.resolve(null), getCommuneDirectory()])
  const type = premier(searchParams.type) === 'inscription' && !profil ? 'inscription' : 'coordonnees'

  // Notaire choisi : « Mettre à jour les coordonnées d'un notaire ». Sans notaire, le parcours
  // d'origine (proposer des coordonnées OU signaler un notaire absent) garde ses textes.
  const titre = profil ? j.notaryRequestUpdateTitle : j.notaryRequestTitle
  const intro = profil ? j.notaryRequestUpdateIntro : j.notaryRequestIntro

  return (
    // `ag-notary-request-page` : styles LIMITÉS à cette page, dont la frise des monuments au bas
    // de la page (agora-portal.css). Le reste de la mise en forme est en classes utilitaires.
    <div className="agora-portal ag-notary-request-page bg-koton text-ank">
      <AgoraPublicHeader locale={locale} />

      <main className="mx-auto w-full max-w-3xl px-5 pb-10 pt-6 sm:px-8">
        <nav aria-label="Fil d’Ariane" className="text-body-sm text-grafit">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href={`/${locale}/juridictions`} className="inline-flex min-h-[44px] items-center transition hover:text-chabon hover:!underline">{j.breadcrumbHere}</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href={`/${locale}/juridictions/notaires`} className="inline-flex min-h-[44px] items-center transition hover:text-chabon hover:!underline">{j.notaries}</Link></li>
          </ol>
        </nav>

        {envoyee ? (
          <>
            <section role="status" className="mt-4 rounded-lg border border-liy bg-white p-6 sm:p-7">
              <h1 className="text-display-3 text-ank">{j.notaryRequestSentTitle}</h1>
              <p className="mt-3 text-body text-grafit">{j.notaryRequestSent}</p>
            </section>
            <p className="mt-6">
              <Link href={`/${locale}/juridictions/notaires`} className="inline-flex min-h-[44px] items-center text-body-sm font-medium text-ank !underline underline-offset-2 transition hover:text-chabon">
                ← {j.notaryRequestBack}
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-display-3 text-ank sm:text-display-2">{titre}</h1>
            <p className="mt-3 max-w-[62ch] text-body text-grafit">{intro}</p>
            <NotaryRequestForm
              locale={locale}
              l={libellesDemande(t)}
              renderedAt={Date.now()}
              notary={profil ? { id: profil.id, name: profil.name, communeId: profil.commune?.id ?? null } : null}
              communes={communes.map((c) => ({ id: c.id, name: c.name, department: c.department }))}
              erreurs={erreurs}
              type={type}
              verification={{ siteKey: cles.siteKey, action: ACTIONS_HUMAIN.notaryRequest, langue: langueTurnstile(locale), nonce }}
            />
          </>
        )}
      </main>

      {/* Pied de page TRANSPARENT : la frise se lit dessous. Le fil d'Ariane suffit au retour :
          pas de second lien « Retour » sous le formulaire. */}
      <footer>
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-4 text-body-sm text-ank sm:px-8">
          <span>© 2026 Agora</span>
          <nav className="flex flex-wrap gap-x-5">
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon hover:!underline" href={`/${locale}/cgu`}>{t.legal.cgu}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon hover:!underline" href={`/${locale}/confidentialite`}>{t.legal.confidentialite}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon hover:!underline" href={`/${locale}/mentions-legales`}>{t.legal.mentions}</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
