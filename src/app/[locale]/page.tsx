import { redirect } from 'next/navigation'
import { resolveLocale } from '@/lib/i18n/config'
import { getCurrentUser } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function LocaleRoot({ params }: { params: { locale: string } }) {
  const locale = resolveLocale(params.locale)
  const user = await getCurrentUser()
  redirect(`/${locale}/${user ? 'dashboard' : 'login'}`)
}
