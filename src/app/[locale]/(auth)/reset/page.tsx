import { FruitMark } from '@/components/Logo'
import { BRAND } from '@/lib/brand'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { ResetForm } from '@/components/ResetForm'
import { dictFor } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

const TITLE = { fr: 'Nouveau mot de passe', en: 'New password', ht: 'Nouvo modpas' }
const NOTOKEN = {
  fr: 'Lien invalide. Veuillez refaire une demande de réinitialisation.',
  en: 'Invalid link. Please request a new reset.',
  ht: 'Lyen pa valab. Tanpri refè yon demann reyinisyalizasyon.',
}
const BACK = { fr: 'Mot de passe oublié', en: 'Forgot password', ht: 'Modpas bliye' }

export default function ResetPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { token?: string }
}) {
  const { locale } = dictFor(params.locale)
  const token = (searchParams.token ?? '').trim()
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
          </div>
          {token ? (
            <ResetForm locale={locale} token={token} />
          ) : (
            <div className="space-y-4">
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{NOTOKEN[locale]}</p>
              <a href={`/${locale}/forgot`} className="block text-center text-xs text-lank/55 hover:text-lank">
                {BACK[locale]}
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
