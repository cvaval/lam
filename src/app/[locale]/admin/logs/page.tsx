import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { formatDate } from '@/lib/i18n/format'
import { prisma } from '@/lib/db'

const ACTION_COLOR: Record<string, string> = {
  LOGIN_FAIL: 'text-chabon',
  LOCKOUT: 'text-chabon',
  '2FA_FAIL': 'text-chabon',
  SCRAPING_ALERT: 'text-chabon',
  ACCOUNT_ACTIVATED: 'text-vet',
  DOC_PUBLISHED: 'text-vet',
  DOC_DELETED: 'text-chabon',
  EXPORT: 'text-ank/80',
}

export default async function AdminLogsPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  await requireAdmin(locale)
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { actor: { select: { email: true } } },
  })


  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ank">{t.admin.logs}</h1>
      <div className="overflow-hidden rounded-2xl border border-chabon/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-chabon/10 bg-koton text-left text-[11px] uppercase tracking-wide text-ank/80">
              <th className="px-4 py-3 font-semibold">{t.admin.logDate}</th>
              <th className="px-4 py-3 font-semibold">{t.admin.logAction}</th>
              <th className="px-4 py-3 font-semibold">{t.admin.logActor}</th>
              <th className="px-4 py-3 font-semibold">{t.admin.logIp}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-chabon/5">
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ank/80">
                  {t.admin.noLogs}
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-koton/50">
                <td className="px-4 py-2.5 font-mono text-xs text-ank/80">{formatDate(locale, l.createdAt, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td className={`px-4 py-2.5 font-mono text-xs font-medium ${ACTION_COLOR[l.action] ?? 'text-grafit'}`}>
                  {l.action}
                </td>
                <td className="px-4 py-2.5 text-xs text-grafit">{l.actor?.email ?? '—'}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-ank/80">{l.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
