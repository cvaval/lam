import { LegalDoc } from '@/components/LegalDoc'
import { CONFIDENTIALITE } from '@/lib/legal'
import { dictFor } from '@/lib/i18n/server'

// Page publique — Politique de confidentialité.
export default function ConfidentialitePage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  return <LegalDoc doc={CONFIDENTIALITE} locale={locale} t={t} />
}
