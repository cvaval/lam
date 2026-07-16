'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { DocType } from '@/lib/types'
import { postJson } from '@/lib/http'

/**
 * « M'alerter sur cette recherche » (§ alertes de veille) : transforme la
 * recherche courante (requête + type éventuel) en alerte — le cron quotidien
 * enverra les nouveaux documents correspondants par e-mail. Après création,
 * renvoie vers le compte où l'alerte se gère (pause / suppression).
 */
export function AlertButton({ q, type, locale, t }: { q: string; type?: DocType; locale: string; t: Dictionary }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'limit'>('idle')

  async function create() {
    setState('busy')
    const res = await postJson('/api/alerts', { q, type })
    if (res.ok) setState('done')
    else setState(res.error === 'alertLimit' ? 'limit' : 'idle')
  }

  if (state === 'done') {
    return (
      <Link href={`/${locale}/account`} className="inline-flex items-center gap-1.5 rounded-full border border-fey/40 bg-fey/10 px-3 py-1 text-xs font-medium text-fey">
        {t.alerts.created}
      </Link>
    )
  }
  if (state === 'limit') {
    return <span className="inline-flex items-center rounded-full border border-soley/40 bg-soley-50 px-3 py-1 text-xs text-lank">{t.alerts.limit}</span>
  }
  return (
    <button
      type="button"
      onClick={create}
      disabled={state === 'busy'}
      className="inline-flex items-center gap-1.5 rounded-full border border-lank/15 bg-white px-3 py-1 text-xs text-lank/60 transition hover:border-lank/40 disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t.alerts.create}
    </button>
  )
}
