import { LegalDoc } from '@/components/LegalDoc'
import { MENTIONS } from '@/lib/legal'
import { dictFor } from '@/lib/i18n/server'

// Page publique — Avertissement légal / mentions légales.
export default function MentionsPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  return <LegalDoc doc={MENTIONS} locale={locale} t={t} />
}
