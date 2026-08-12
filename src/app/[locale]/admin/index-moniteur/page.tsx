import { requireCapability } from '@/lib/auth/guard'
import { dictFor } from '@/lib/i18n/server'
import { IndexMoniteurEditor } from '@/components/IndexMoniteurEditor'
import type { Locale } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Écran Master Admin — saisie / correction manuelle de l'Index du Moniteur (§08).
export default async function AdminIndexMoniteurPage({ params }: { params: { locale: string } }) {
  const { locale } = dictFor(params.locale)
  const user = await requireCapability(locale, 'corpus.manage')
  return <IndexMoniteurEditor locale={locale as Locale} peutSupprimer={user.role === 'MASTER_ADMIN'} />
}
