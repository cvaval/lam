import { UploadStudio } from '@/components/UploadStudio'
import { dictFor } from '@/lib/i18n/server'
import { requireCapability } from '@/lib/auth/guard'

export default async function AdminUploadPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  await requireCapability(locale, 'upload.publish')
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ank">{t.cms.title}</h1>
        <p className="mt-1 text-sm text-ank/80">{t.cms.intro}</p>
      </div>
      <UploadStudio locale={locale} t={t} />
    </div>
  )
}
