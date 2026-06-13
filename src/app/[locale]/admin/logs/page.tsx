import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { formatDate } from '@/lib/i18n/format'
import { prisma } from '@/lib/db'

const ACTION_COLOR: Record<string, string> = {
  LOGIN_FAIL: 'text-red-600',
  LOCKOUT: 'text-red-700',
  '2FA_FAIL': 'text-red-600',
  SCRAPING_ALERT: 'text-soley-700',
  ACCOUNT_ACTIVATED: 'text-fey',
  DOC_PUBLISHED: 'text-fey',
  DOC_DELETED: 'text-red-600',
  EXPORT: 'text-lank/70',
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
      <h1 className="text-xl font-semibold text-lank">{t.admin.logs}</h1>
      <div className="overflow-hidden rounded-2xl border border-lank/10 bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-lank/10 bg-paper text-left text-[11px] uppercase tracking-wide text-lank/45">
              <th className="px-4 py-3 font-semibold">{t.admin.logDate}</th>
              <th className="px-4 py-3 font-semibold">{t.admin.logAction}</th>
              <th className="px-4 py-3 font-semibold">{t.admin.logActor}</th>
              <th className="px-4 py-3 font-semibold">{t.admin.logIp}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-lank/5">
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-lank/40">
                  {t.admin.noLogs}
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-paper/50">
                <td className="px-4 py-2.5 font-mono text-xs text-lank/55">{formatDate(locale, l.createdAt, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td className={`px-4 py-2.5 font-mono text-xs font-medium ${ACTION_COLOR[l.action] ?? 'text-lank/70'}`}>
                  {l.action}
                </td>
                <td className="px-4 py-2.5 text-xs text-lank/60">{l.actor?.email ?? '—'}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-lank/40">{l.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
