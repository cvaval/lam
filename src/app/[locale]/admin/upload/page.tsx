import { UploadStudio } from '@/components/UploadStudio'
import { dictFor } from '@/lib/i18n/server'
import { requireCapability } from '@/lib/auth/guard'

export default async function AdminUploadPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  await requireCapability(locale, 'upload.publish')
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-lank">{t.cms.title}</h1>
      <UploadStudio locale={locale} t={t} />
    </div>
  )
}
