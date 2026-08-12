import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { RegisterForm } from '@/components/RegisterForm'
import { dictFor } from '@/lib/i18n/server'

export default function RegisterPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  return (
    <main className="flex min-h-screen items-center justify-center bg-koton px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex items-center justify-between">
          <Logo size={28} />
          <LocaleSwitcher current={locale} />
        </div>
        <div className="rounded-2xl bg-white p-7">
          <h1 className="text-xl font-semibold text-ank">{t.register.title}</h1>
          <p className="mt-1 mb-5 text-sm text-grafit">{t.register.subtitle}</p>
          <RegisterForm t={t} />
          <div className="mt-5 border-t border-chabon/10 pt-4 text-center text-sm">
            <Link href={`/${locale}/login`} className="text-grafit hover:text-ank">
              ← {t.nav.login}
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
