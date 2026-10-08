import Link from 'next/link'
import { redirect } from 'next/navigation'
import '@/components/agora-portal.css'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { LoginForm } from '@/components/LoginForm'
import { dictFor } from '@/lib/i18n/server'
import { getCurrentUser, lireFinDeSession } from '@/lib/auth/session'
import { AvisSession } from '@/components/AvisSession'

export const dynamic = 'force-dynamic'

// Écran 1 — Accueil avec connexion intégrée (§05). Split 50/50, carte visible sans défilement.
export default async function LoginPage({ params, searchParams }: { params: { locale: string }; searchParams?: { motif?: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await getCurrentUser()
  if (user) redirect(`/${locale}/dashboard`)
  // Pourquoi la session précédente s'est terminée — lu sur la LIGNE que le cookie désigne
  // encore (nouvelle connexion ailleurs, administrateur…) ; l'URL n'est lue que pour
  // « inactivite ». Voir AvisSession. Meilleur effort : la page de connexion ne dépend de rien.
  const fin = await lireFinDeSession().catch(() => null)
  const motifUrl = typeof searchParams?.motif === 'string' ? searchParams.motif : null

  const tr = (fr: string, en: string, ht: string) => locale === 'en' ? en : locale === 'ht' ? ht : fr
  return <div className="agora-portal ag-secure-page"><header className="ag-header"><div className="ag-container ag-header-inner"><Link href={`/${locale}`} className="ag-brand" aria-label="Agora"><img src="/brand/agora/logo.png" alt="agora.ht" width="190" height="63"/></Link><div className="ag-language"><LocaleSwitcher current={locale}/></div></div></header><main className="ag-container ag-secure-grid"><section><p className="ag-eyebrow">{tr('Espace documentaire','Document workspace','Espas dokiman')}</p><h1>{tr('Vos sources juridiques, dans un espace sécurisé.','Your legal sources, in a secure workspace.','Sous jiridik ou yo, nan yon espas sekirize.')}</h1><p>{tr('Espace documentaire réservé aux utilisateurs autorisés. Connectez-vous pour consulter les textes et accéder aux services associés à votre compte.','Document workspace reserved for authorized users. Sign in to consult texts and access the services available to your account.','Espas dokiman rezève pou itilizatè otorize. Konekte pou konsilte tèks yo ak sèvis ki disponib pou kont ou.')}</p><Link className="ag-text-link" href={`/${locale}/juridictions`}>{tr('Explorer la carte judiciaire publique →','Explore the public judicial map →','Eksplore kat jidisyè piblik la →')}</Link></section><section className="ag-secure-card"><h2>{tr('Accès sécurisé','Secure access','Aksè sekirize')}</h2><div className="mt-6"><AvisSession locale={locale} fin={fin} motifUrl={motifUrl}/><LoginForm locale={locale} t={t}/></div><div className="ag-secure-help"><p>{tr('Vous avez besoin d’un accès ?','Need access?','Ou bezwen aksè?')}</p><Link className="ag-text-link" href={`/${locale}/register`}>{tr('Demander un accès','Request access','Mande aksè')}</Link><a href="mailto:legal@agora.ht">legal@agora.ht</a><p className="ag-small-note">{t.home.cardNote}</p></div></section></main><footer className="ag-container ag-secure-footer"><Link href={`/${locale}/cgu`}>{t.legal.cgu}</Link><Link href={`/${locale}/confidentialite`}>{t.legal.confidentialite}</Link><Link href={`/${locale}/mentions-legales`}>{t.legal.mentions}</Link></footer></div>
}
