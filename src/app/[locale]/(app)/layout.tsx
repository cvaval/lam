import { TopBar } from '@/components/TopBar'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { trustedDeviceDaysLeft } from '@/lib/auth/devices'

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
        <p className="border-t border-lank/10 pt-4 text-center text-[11px] leading-relaxed text-lank/45">
          {t.doc.unofficialNote}
        </p>
      </footer>
    </div>
  )
}
