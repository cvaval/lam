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
        <header className="flex items-center justify-between">
          {/* Logo cliquable → page d'accueil (demande client). */}
          <Link href={`/${locale}`} aria-label="Accueil Lam">
            <Logo size={30} />
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-grafit md:flex">
            <span className="cursor-default hover:text-ank">{t.nav.features}</span>
            <span className="cursor-default hover:text-ank">{t.nav.pricing}</span>
            <span className="cursor-default hover:text-ank">{t.nav.about}</span>
            <LocaleSwitcher current={locale} />
          </nav>
        </header>

        <div className="max-w-xl py-10">
          <h1 className="font-serif text-4xl font-semibold leading-tight text-ank lg:text-5xl">{t.home.title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-grafit">{t.home.subtitle}</p>

          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {DOC_TYPE_LIST.map((m) => (
              <li
                key={m.type}
                className="flex items-center gap-2 rounded-xl border border-chabon/10 bg-white px-3 py-2.5 text-sm"
              >
                <Pastille type={m.type} />
                <span className="font-medium text-ank">{m.label[locale].replace(/ haïtien.*$/i, '').replace(/^Index de la /, '')}</span>
              </li>
            ))}
          </ul>
        </div>

        <footer className="text-xs text-ank/80">
          <nav className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link className="hover:text-ank" href={`/${locale}/cgu`}>{t.legal.cgu}</Link>
            <Link className="hover:text-ank" href={`/${locale}/confidentialite`}>{t.legal.confidentialite}</Link>
            <Link className="hover:text-ank" href={`/${locale}/mentions-legales`}>{t.legal.mentions}</Link>
          </nav>
          {`Lam · ${t.brand.baseline} · ${t.common.poweredBy}`}
        </footer>
      </section>

      {/* Droite : carte de connexion */}
      <section className="flex items-center justify-center bg-chabon px-6 py-10 lg:px-14">
        <div className="w-full max-w-sm">
          <div className="mb-5 flex items-center justify-between lg:hidden">
            <LocaleSwitcher current={locale} />
          </div>
          <div className="rounded-2xl bg-white p-7">
            <h2 className="text-xl font-semibold text-ank">{t.home.signinTitle}</h2>
            <p className="mt-1 text-sm text-grafit">{t.home.signinSubtitle}</p>
            <div className="mt-6">
              <LoginForm locale={locale} t={t} />
            </div>
            <div className="mt-6 border-t border-chabon/10 pt-4 text-center">
              <Link
                href={`/${locale}/register`}
                className="inline-block rounded-lg border border-chabon/15 px-4 py-2 text-sm font-medium text-ank hover:bg-koton"
              >
                {t.nav.createAccount}
              </Link>
              <p className="mt-3 text-[11px] leading-relaxed text-ank/80">{t.home.cardNote}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
