import { redirect } from 'next/navigation'
import { FruitMark } from '@/components/Logo'
import { BRAND } from '@/lib/brand'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { VerifyForm } from '@/components/VerifyForm'
import { dictFor } from '@/lib/i18n/server'
import { getCurrentUser, getPendingSession } from '@/lib/auth/session'
import { beginEnrollment } from '@/lib/auth/service'
import { isSensitiveRole } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

// Écran 2 — Double authentification (§06). Le fruit 7-points remplace l'icône cadenas.
export default async function VerifyPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  const pending = await getPendingSession()
  if (!pending) {
    // Déjà pleinement authentifié → dashboard ; sinon retour au login.
    const user = await getCurrentUser()
    redirect(user ? `/${locale}/dashboard` : `/${locale}/login`)
  }

  const enroll = !pending.user.totpEnabled
  const enrollment = enroll ? await beginEnrollment() : null
  const sensitive = isSensitiveRole(pending.user.role)

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
            <h1 className="text-lg font-semibold text-lank">{t.verify.title}</h1>
          </div>
          <VerifyForm locale={locale} t={t} enroll={enroll} qr={enrollment?.qr ?? null} sensitive={sensitive} />
        </div>
      </div>
    </main>
  )
}
