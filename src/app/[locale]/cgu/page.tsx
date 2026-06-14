import { LegalDoc } from '@/components/LegalDoc'
import { CGU } from '@/lib/legal'
import { dictFor } from '@/lib/i18n/server'

// Page publique (hors espace authentifié) — Conditions Générales d'Utilisation.
export default function CguPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  return <LegalDoc doc={CGU} locale={locale} t={t} />
}
