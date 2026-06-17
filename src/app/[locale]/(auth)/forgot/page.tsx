import { FruitMark } from '@/components/Logo'
import { BRAND } from '@/lib/brand'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { ForgotForm } from '@/components/ForgotForm'
import { dictFor } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

const TITLE = { fr: 'Mot de passe oublié', en: 'Forgot password', ht: 'Modpas bliye' }
const SUB = {
  fr: 'Saisissez votre adresse courriel pour recevoir un lien de réinitialisation.',
  en: 'Enter your email to receive a reset link.',
  ht: 'Mete imèl ou pou resevwa yon lyen pou reyinisyalize.',
}

export default function ForgotPage({ params }: { params: { locale: string } }) {
  const { locale } = dictFor(params.locale)
  return (
    <main className="flex min-h-screen items-center justify-center bg-lank px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-cream">
            <FruitMark size={26} tone="dark" />
            <span className="text-sm font-extrabold lowercase tracking-tight">{BRAND.wordmark}</span>
          </div>
          <LocaleSwitcher current={locale} />
        </div>
        <div className="rounded-2xl bg-white p-7 shadow-card">
          <div className="mb-5 flex flex-col items-center text-center">
            <FruitMark size={40} className="mb-2" />
            <h1 className="text-lg font-semibold text-lank">{TITLE[locale]}</h1>
            <p className="mt-1 text-xs leading-relaxed text-lank/55">{SUB[locale]}</p>
          </div>
          <ForgotForm locale={locale} />
        </div>
      </div>
    </main>
  )
}
