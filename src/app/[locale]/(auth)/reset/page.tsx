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
    <main className="flex min-h-screen items-center justify-center bg-chabon px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-koton">
            <FruitMark size={26} tone="dark" />
            <span className="text-sm font-extrabold lowercase tracking-tight">{BRAND.wordmark}</span>
          </div>
          <LocaleSwitcher current={locale} />
        </div>
        <div className="rounded-2xl bg-white p-7">
          <div className="mb-5 flex flex-col items-center text-center">
            <FruitMark size={40} className="mb-2" />
            <h1 className="text-lg font-semibold text-ank">{TITLE[locale]}</h1>
          </div>
          {token ? (
            <ResetForm locale={locale} token={token} />
          ) : (
            <div className="space-y-4">
              <p role="alert" className="flex items-start gap-2 rounded-lg border-l-2 border-wouj bg-pil px-3 py-2 text-sm text-wouj"><span aria-hidden="true">⚠</span><span>{NOTOKEN[locale]}</span></p>
 <a href={`/${locale}/forgot`} className="inline-flex min-h-[44px] w-full items-center justify-center text-xs text-grafit transition hover:text-chabon">
                {BACK[locale]}
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
