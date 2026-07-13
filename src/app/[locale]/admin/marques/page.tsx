import { requireAdmin } from '@/lib/auth/guard'
import { dictFor } from '@/lib/i18n/server'
import { MarqueEditor } from '@/components/MarqueEditor'
import type { Locale } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Écran Master Admin — marques de fabrique et de commerce (nom + reproduction, §08).
export default async function AdminMarquesPage({ params }: { params: { locale: string } }) {
  const { locale } = dictFor(params.locale)
  await requireAdmin(locale)
  return <MarqueEditor locale={locale as Locale} />
}
