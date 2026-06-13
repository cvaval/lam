'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { postJson } from '@/lib/http'

export function RedeemPromo({ t }: { t: Dictionary }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    setMsg(null)
    const res = await postJson('/api/account/redeem', { code })
    setBusy(false)
    if (res.ok) {
      setMsg({ ok: true, text: t.promo.redeemSuccess })
      setCode('')
      router.refresh()
    } else {
      setMsg({ ok: false, text: (t.promo.errors as Record<string, string>)[res.error ?? ''] ?? t.errors.invalidCredentials })
    }
  }

  return (
    <section className="rounded-2xl border border-lank/10 bg-white p-6 shadow-card">
      <h2 className="mb-3 text-sm font-semibold text-lank">{t.promo.redeemTitle}</h2>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t.promo.redeemPlaceholder}
          className="flex-1 rounded-lg border border-lank/15 bg-white px-3 py-2 font-mono text-sm tracking-widest outline-none focus:border-sitwon"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-lank px-4 py-2 text-sm font-semibold text-white hover:bg-lank-600 disabled:opacity-50"
        >
          {busy ? t.common.loading : t.promo.redeem}
        </button>
      </form>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-fey' : 'text-red-700'}`}>{msg.text}</p>}
    </section>
  )
}
