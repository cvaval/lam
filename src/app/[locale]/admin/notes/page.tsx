import { requireEditor } from '@/lib/auth/guard'
import { dictFor } from '@/lib/i18n/server'
import { NotesModeration } from '@/components/NotesModeration'

export const dynamic = 'force-dynamic'

// File de modération des notes de lecteurs — master admin ET éditeur.
export default async function AdminNotesPage({ params }: { params: { locale: string } }) {
  const { locale } = dictFor(params.locale)
  await requireEditor(locale)
  return <NotesModeration locale={locale} />
}
