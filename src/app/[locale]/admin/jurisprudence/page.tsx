import { requireEditor } from '@/lib/auth/guard'
import { dictFor } from '@/lib/i18n/server'
import { JurisprudenceAdmin } from '@/components/JurisprudenceAdmin'
import type { Locale } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Écran rédactionnel — versement ET appareil éditorial des décisions (master admin ET éditeur).
export default async function AdminJurisprudencePage({ params }: { params: { locale: string } }) {
  const { locale } = dictFor(params.locale)
  await requireEditor(locale)
  return <JurisprudenceAdmin locale={locale as Locale} />
}
