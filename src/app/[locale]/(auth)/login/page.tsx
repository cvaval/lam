import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { LoginForm } from '@/components/LoginForm'
import { Pastille } from '@/components/TypeBadge'
import { dictFor } from '@/lib/i18n/server'
import { getCurrentUser } from '@/lib/auth/session'
import { DOC_TYPE_LIST } from '@/lib/brand'

export const dynamic = 'force-dynamic'

// Écran 1 — Accueil avec connexion intégrée (§05). Split 50/50, carte visible sans défilement.
export default async function LoginPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await getCurrentUser()
  if (user) redirect(`/${locale}/dashboard`)

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Gauche : promesse + 6 piliers */}
      <section className="flex flex-col justify-between bg-koton px-6 py-6 lg:px-14 lg:py-8">
        <header className="flex items-center justify-between gap-4">
          {/* Logo cliquable → page d'accueil (demande client). */}
 <Link href={`/${locale}`} aria-label="Accueil Lam"className="inline-flex min-h-[44px] items-center rounded-lg transition">
            <Logo size={30} />
          </Link>
          <nav className="hidden shrink-0 items-center gap-5 text-sm text-grafit md:flex">
            <span className="cursor-default hover:text-ank">{t.nav.features}</span>
            <span className="cursor-default hover:text-ank">{t.nav.pricing}</span>
            <span className="cursor-default hover:text-ank">{t.nav.about}</span>
            <LocaleSwitcher current={locale} />
          </nav>
        </header>

        <div className="max-w-xl py-10">
          <h1 className="font-serif text-4xl font-semibold leading-tight text-ank lg:text-5xl">{t.home.title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-grafit">{t.home.subtitle}</p>

          {/* ⚠️ RIEN N'EMPÊCHAIT LE TEXTE DE SORTIR DE SA CARTE. Un enfant de flex refuse par
              défaut de descendre sous la largeur de son contenu (`min-width: auto`) : à
              trois colonnes, « Marques de commerce & de fabrique » débordait du cadre blanc
              dès que la fonte rendait un peu plus large — police de repli le temps du
              chargement, taille de texte forcée par le lecteur, ou zoom du navigateur. Il
              n'y avait pas de défense, seulement une coïncidence de largeurs.

              Trois verrous : `min-w-0` autorise le retour à la ligne, `shrink-0` protège la
              pastille de l'écrasement, `break-words` coupe le mot qui ne tiendrait pas.

              ⚠️ MAIS COUPER UN MOT N'EST PAS UNE MISE EN PAGE : c'est le dernier recours.
              À deux colonnes sous 420 px, la carte tombait à 130 px et « jurisprudence » se
              brisait en « jurisprud / ence ». Les colonnes suivent donc la place réelle —
              une seule jusqu'à 420 px, deux ensuite, trois à partir de `md`. `break-words`
              ne sert plus qu'au cas qu'on n'a pas prévu. */}
          <ul className="mt-8 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3">
            {DOC_TYPE_LIST.map((m) => (
              <li
                key={m.type}
                className="flex items-start gap-2 rounded-xl border border-chabon/10 bg-white px-3 py-2.5 text-sm"
              >
                <Pastille type={m.type} className="mt-0.5 shrink-0" />
                <span className="min-w-0 break-words font-medium text-ank">
                  {m.label[locale].replace(/ haïtien.*$/i, '').replace(/^Index de la /, '')}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <footer className="text-xs text-ank/80">
          <nav className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/cgu`}>{t.legal.cgu}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/confidentialite`}>{t.legal.confidentialite}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/mentions-legales`}>{t.legal.mentions}</Link>
          </nav>
          {`Lam · ${t.brand.baseline} · ${t.common.poweredBy}`}
        </footer>
      </section>

      {/* Droite : carte de connexion */}
      <section className="flex items-center justify-center border-liy bg-white px-6 py-10 lg:border-l lg:px-14">
        <div className="w-full max-w-sm">
          <div className="mb-5 flex items-center justify-between lg:hidden">
            <LocaleSwitcher current={locale} />
          </div>
          <div className="w-full">
            <h2 className="font-serif text-2xl font-semibold text-ank">{t.home.signinTitle}</h2>
            <p className="mt-1 text-sm text-grafit">{t.home.signinSubtitle}</p>
            <div className="mt-6">
              <LoginForm locale={locale} t={t} />
            </div>
            <div className="mt-8 border-t border-liy pt-5 text-center">
              <Link
                href={`/${locale}/register`}
 className="inline-flex min-h-[44px] items-center rounded-lg border border-liy px-4 py-2 text-sm font-medium text-ank transition hover:border-chabon hover:text-chabon"
              >
                {t.nav.createAccount}
              </Link>
              <p className="mt-3 text-[11px] leading-relaxed text-grafit">{t.home.cardNote}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
