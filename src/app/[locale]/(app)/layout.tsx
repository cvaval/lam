import Link from 'next/link'
import { TopBar } from '@/components/TopBar'
import { IdleTimer } from '@/components/IdleTimer'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { trustedDeviceDaysLeft } from '@/lib/auth/devices'
import { IDLE_TIMEOUT_MINUTES, IDLE_WARNING_SECONDS } from '@/lib/auth/session'

// Tout l'espace authentifié est rendu par requête (session/cookies).
export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)
  const daysLeft = await trustedDeviceDaysLeft(user.id)

  return (
    <div className="min-h-screen bg-paper">
      {/* Déconnexion automatique pour inactivité (§sécurité). */}
      <IdleTimer locale={locale} idleMinutes={IDLE_TIMEOUT_MINUTES} warningSeconds={IDLE_WARNING_SECONDS} />
      <TopBar
        locale={locale}
        t={t}
        name={user.name ?? ''}
        email={user.email}
        roleLabel={t.roles[user.role]}
        isAdmin={user.role === 'MASTER_ADMIN'}
      />
      {/* Rappel J-3 (§04) : appareil de confiance bientôt expiré. */}
      {daysLeft !== null && daysLeft <= 3 && (
        <div className="border-b border-soley/40 bg-soley-50 px-4 py-2 text-center text-xs text-lank">
          {t.verify.j3} ({daysLeft} {daysLeft > 1 ? 'jours' : 'jour'})
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      {/* Avertissement juridique permanent : seules les versions françaises font foi. */}
      <footer className="mx-auto max-w-6xl px-4 pb-6">
        <div className="border-t border-lank/10 pt-4">
          <nav className="mb-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[11px] text-lank/55">
            <Link className="hover:text-lank" href={`/${locale}/cgu`}>{t.legal.cgu}</Link>
            <Link className="hover:text-lank" href={`/${locale}/confidentialite`}>{t.legal.confidentialite}</Link>
            <Link className="hover:text-lank" href={`/${locale}/mentions-legales`}>{t.legal.mentions}</Link>
            <a className="hover:text-lank" href="mailto:legal@lam.ht">Contact</a>
          </nav>
          <p className="text-center text-[11px] leading-relaxed text-lank/45">{t.doc.unofficialNote}</p>
        </div>
      </footer>
    </div>
  )
}
