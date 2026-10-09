import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { AgoraPublicHeader } from '@/components/AgoraPublicHeader'
import '@/components/agora-portal.css'
import { dictFor } from '@/lib/i18n/server'
import { isLocale } from '@/lib/types'
import { getCommuneDirectory, getNotaryProfile } from '@/lib/jurisdictions/data'
import { demandesOuvertes } from '@/lib/jurisdictions/notaires-demandes'
import { NotaryRequestForm } from '@/components/jurisdictions/NotaryRequestForm'
import { libellesDemande } from '@/components/jurisdictions/notary-request-labels'

export const dynamic = 'force-dynamic'

const premier = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

/**
 * Demande d'un TIERS (chantier D) : proposer ou corriger les coordonnées d'un notaire, ou
 * signaler un notaire absent de la liste. Fonctionnalité DISCRÈTE — on n'y arrive que par les
 * liens de la page d'un notaire et de la liste — et FERMÉE par défaut : 404 tant que
 * `NOTARY_REQUESTS_ENABLED` ne vaut pas `true` (la cliente valide d'abord l'addition à la
 * politique de confidentialité). `noindex`.
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
  if (!demandesOuvertes()) notFound()
  const { locale, t } = dictFor(isLocale(params.locale) ? params.locale : 'fr')
  const j = t.judicial

  const envoyee = premier(searchParams.envoyee) === '1'
  const notaireId = premier(searchParams.notaire)
  const erreurs = premier(searchParams.erreur).split(',').filter(Boolean).slice(0, 20)
  const [profil, communes] = envoyee
    ? [null, []]
    : await Promise.all([notaireId ? getNotaryProfile(notaireId) : Promise.resolve(null), getCommuneDirectory()])
  const type = premier(searchParams.type) === 'inscription' && !profil ? 'inscription' : 'coordonnees'

  return (
    <div className="agora-portal min-h-screen bg-koton">
      <AgoraPublicHeader locale={locale} />

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6 md:px-8">
        <nav aria-label="Fil d’Ariane" className="text-sm text-ank/80">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href={`/${locale}/juridictions`} className="inline-flex min-h-[44px] items-center transition hover:text-chabon hover:underline">{j.breadcrumbHere}</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href={`/${locale}/juridictions/notaires`} className="inline-flex min-h-[44px] items-center transition hover:text-chabon hover:underline">{j.notaries}</Link></li>
          </ol>
        </nav>

        {envoyee ? (
          <section role="status" className="mt-4 rounded-2xl border border-chabon/10 bg-white p-6">
            <h1 className="font-serif text-2xl font-semibold text-ank">{j.notaryRequestSentTitle}</h1>
            <p className="mt-2 leading-relaxed text-grafit">{j.notaryRequestSent}</p>
          </section>
        ) : (
          <>
            <h1 className="mt-3 font-serif text-3xl font-semibold text-ank">{j.notaryRequestTitle}</h1>
            <p className="mt-2 leading-relaxed text-grafit">{j.notaryRequestIntro}</p>
            <NotaryRequestForm
              locale={locale}
              l={libellesDemande(t)}
              renderedAt={Date.now()}
              notary={profil ? { id: profil.id, name: profil.name, communeName: profil.commune?.name ?? null } : null}
              communes={communes.map((c) => ({ id: c.id, name: c.name, department: c.department }))}
              erreurs={erreurs}
              type={type}
            />
          </>
        )}

        <p className="mt-8">
          <Link href={`/${locale}/juridictions/notaires`} className="inline-flex min-h-[44px] items-center text-sm font-medium text-ank underline underline-offset-2 transition hover:text-chabon">
            ← {j.notaryRequestBack}
          </Link>
        </p>
      </main>
    </div>
  )
}
