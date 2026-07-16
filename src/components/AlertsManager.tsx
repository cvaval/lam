'use client'

import { useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { AlertDto } from '@/lib/alerts'
import { DOC_TYPE_META } from '@/lib/brand'
import { formatDate } from '@/lib/i18n/format'
import { sendJson } from '@/lib/http'

/**
 * Gestion des alertes de veille sur la page compte : pause / réactivation et
 * suppression. La création se fait depuis la page de recherche (AlertButton).
 */
export function AlertsManager({ initial, locale, t }: { initial: AlertDto[]; locale: string; t: Dictionary }) {
  const [alerts, setAlerts] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)

  async function toggle(a: AlertDto) {
    setBusy(a.id)
    const res = await sendJson(`/api/alerts/${a.id}`, 'PATCH', { active: !a.active })
    if (res.ok) setAlerts((xs) => xs.map((x) => (x.id === a.id ? { ...x, active: !a.active } : x)))
    setBusy(null)
  }

  async function remove(a: AlertDto) {
    setBusy(a.id)
    const res = await sendJson(`/api/alerts/${a.id}`, 'DELETE')
    if (res.ok) setAlerts((xs) => xs.filter((x) => x.id !== a.id))
    setBusy(null)
  }

  if (!alerts.length) {
    return <p className="text-sm text-lank/45">{t.alerts.empty}</p>
  }

  return (
    <ul className="divide-y divide-lank/5">
      {alerts.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
          <div className="min-w-0">
            <p className={`truncate font-medium ${a.active ? 'text-lank' : 'text-lank/40'}`}>
              « {a.label} »
              {!a.active && (
                <span className="ml-2 rounded-full bg-lank/5 px-2 py-0.5 text-[11px] font-normal text-lank/45">{t.alerts.paused}</span>
              )}
            </p>
            <p className="text-xs text-lank/45">
              {a.type ? DOC_TYPE_META[a.type].label[locale as 'fr' | 'en' | 'ht'] : t.alerts.everything}
              {' · '}
              {t.alerts.lastSent} :{' '}
              {a.lastNotifiedAt ? formatDate(locale as 'fr' | 'en' | 'ht', new Date(a.lastNotifiedAt)) : t.alerts.never}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => toggle(a)}
              disabled={busy === a.id}
              className="rounded-lg border border-lank/15 bg-white px-2.5 py-1 text-xs text-lank/60 hover:border-lank/40 disabled:opacity-60"
            >
              {a.active ? t.alerts.pause : t.alerts.resume}
            </button>
            <button
              type="button"
              onClick={() => remove(a)}
              disabled={busy === a.id}
              className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              {t.alerts.delete}
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
