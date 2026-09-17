import Link from 'next/link'
import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { formatInstant } from '@/lib/i18n/format'
import { decrireAppareil } from '@/lib/auth/appareil'
import { prisma } from '@/lib/db'
import type { Locale } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * LOGS DE SÉCURITÉ — le journal d'audit, filtrable, avec l'ORIGINE de chaque événement.
 *
 * La page listait les 200 dernières lignes, toutes actions confondues, sans filtre ni détail :
 * le chiffre « Alertes scraping » de la vue d'ensemble menait nulle part, et une alerte se
 * lisait « SCRAPING_ALERT · — · ::1 » sans dire ni la règle franchie, ni le compte, ni
 * l'appareil. Désormais : filtres (action, compte, période), colonne Appareil (UA lu par
 * `decrireAppareil`), colonne Détail (la règle et sa limite, le motif, l'e-mail d'une tentative
 * sans compte…), et — sur les alertes de scraping — un cumul PAR ORIGINE (compte ou adresse).
 *
 * ⚠️ TOUTE HEURE EST EN HEURE DE PORT-AU-PRINCE (`formatInstant`), nommée une fois en tête.
 * ⚠️ PAGINATION BORNÉE. ⚠️ Aucune clé i18n nouvelle : libellés locaux, sauf ceux qui existent.
 */
const ACTION_COLOR: Record<string, string> = {
  LOGIN_FAIL: 'text-chabon',
  LOCKOUT: 'text-chabon',
  '2FA_FAIL': 'text-chabon',
  SCRAPING_ALERT: 'text-chabon',
  SESSION_EVICTED: 'text-chabon',
  ACCOUNT_ACTIVATED: 'text-vet',
  DOC_PUBLISHED: 'text-vet',
  DOC_DELETED: 'text-chabon',
  EXPORT: 'text-ank/80',
}
const L = {
  zone: { fr: 'Heures de Port-au-Prince', en: 'Port-au-Prince time', ht: 'Lè Pòtoprens' },
  action: { fr: 'Action', en: 'Action', ht: 'Aksyon' },
  toutes: { fr: 'Toutes les actions', en: 'All actions', ht: 'Tout aksyon' },
  compte: { fr: 'Compte', en: 'Account', ht: 'Kont' },
  tousComptes: { fr: 'Tous les comptes', en: 'All accounts', ht: 'Tout kont' },
  sansCompte: { fr: 'sans compte', en: 'no account', ht: 'san kont' },
  periode: { fr: 'Période', en: 'Period', ht: 'Peryòd' },
  jours: { fr: 'derniers jours', en: 'last days', ht: 'dènye jou' },
  tout: { fr: 'tout', en: 'all', ht: 'tout' },
  filtrer: { fr: 'Filtrer', en: 'Filter', ht: 'Filtre' },
  appareil: { fr: 'Appareil', en: 'Device', ht: 'Aparèy' },
  detail: { fr: 'Détail', en: 'Detail', ht: 'Detay' },
  nonReconnu: { fr: 'non reconnu', en: 'unrecognised', ht: 'pa rekonèt' },
  parOrigine: { fr: 'Alertes de scraping par origine', en: 'Scraping alerts by origin', ht: 'Alèt scraping pa orijin' },
  parOrigineSub: { fr: 'Une alerte est levée quand un frein de débit est franchi ; l’origine est le compte connecté, sinon l’adresse IP. « ::1 » est l’ordinateur de développement.', en: 'An alert is raised when a rate limit is exceeded; the origin is the signed-in account, else the IP address. “::1” is the development machine.', ht: 'Yon alèt leve lè yon limit vitès depase ; orijin lan se kont ki konekte a, sinon adrès IP a. « ::1 » se òdinatè devlopman an.' },
  alertes: { fr: 'alertes', en: 'alerts', ht: 'alèt' },
  alerte: { fr: 'alerte', en: 'alert', ht: 'alèt' },
  regle: { fr: 'règle', en: 'rule', ht: 'règ' },
  derniere: { fr: 'dernière', en: 'last', ht: 'dènye' },
  lignes: { fr: 'événements', en: 'events', ht: 'evènman' },
  page: { fr: 'page', en: 'page', ht: 'paj' },
  precedente: { fr: '← Précédente', en: '← Previous', ht: '← Anvan' },
  suivante: { fr: 'Suivante →', en: 'Next →', ht: 'Apre →' },
  retour: { fr: '← Vue d’ensemble', en: '← Overview', ht: '← Apèsi' },
} as const
const JOURS = [7, 30, 90, 365, 0] as const
const PAR_PAGE = 100
const PAGE_MAX = 100

/** Le détail lisible d'une ligne d'audit — ce que `metaJson` porte, sans en inventer. */
function detailDe(action: string, metaJson: string | null): string {
  if (!metaJson) return ''
  let m: Record<string, unknown>
  try { m = JSON.parse(metaJson) } catch { return metaJson.slice(0, 80) }
  const parts: string[] = []
  if (typeof m.rule === 'string') parts.push(`${m.rule}${m.limit ? ` > ${m.limit}/${Number(m.windowMs) / 1000 || '?'} s` : ''}`)
  if (typeof m.rate === 'string') parts.push(m.rate)
  if (typeof m.email === 'string') parts.push(m.email)
  if (typeof m.motif === 'string') parts.push(m.motif)
  if (typeof m.appareil === 'string') parts.push(m.appareil)
  if (typeof m.quoi === 'string') parts.push(m.quoi)
  if (m.trustedDevice === true) parts.push('appareil de confiance')
  if (m.pending2fa === true) parts.push('en attente de 2FA')
  if (typeof m.reason === 'string') parts.push(m.reason)
  if (!parts.length) {
    const cles = Object.keys(m).filter((k) => !['sauvegarde', 'apres'].includes(k))
    if (cles.length) parts.push(cles.map((k) => `${k}: ${typeof m[k] === 'object' ? '…' : String(m[k]).slice(0, 40)}`).slice(0, 3).join(' · '))
  }
  void action
  return parts.join(' · ')
}

function lireFiltre(sp?: Record<string, string | string[] | undefined>) {
  const un = (k: string) => (typeof sp?.[k] === 'string' ? (sp![k] as string) : null)
  const jours = Number(un('jours'))
  const page = Number(un('page'))
  const action = un('action')
  return {
    action: action && /^[A-Z0-9_]{1,40}$/.test(action) ? action : null,
    compte: un('compte') || null,
    jours: (JOURS as readonly number[]).includes(jours) ? (jours as (typeof JOURS)[number]) : 30,
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, PAGE_MAX) : 1,
  }
}

export default async function AdminLogsPage({ params, searchParams }: { params: { locale: string }; searchParams?: Record<string, string | string[] | undefined> }) {
  const { locale, t } = dictFor(params.locale)
  await requireAdmin(locale)
  const lt = (o: { fr: string; en: string; ht: string }) => o[locale as Locale] ?? o.fr
  const f = lireFiltre(searchParams)
  const where = {
    ...(f.jours ? { createdAt: { gte: new Date(Date.now() - f.jours * 86_400_000) } } : {}),
    ...(f.action ? { action: f.action } : {}),
    ...(f.compte === 'sans' ? { actorId: null } : f.compte ? { actorId: f.compte } : {}),
  }
  const [total, logs, actions, comptes] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: PAR_PAGE, skip: (f.page - 1) * PAR_PAGE, include: { actor: { select: { email: true } } } }),
    prisma.auditLog.groupBy({ by: ['action'], _count: { _all: true }, orderBy: { action: 'asc' } }),
    prisma.user.findMany({ select: { id: true, email: true }, orderBy: { email: 'asc' } }),
  ])
  // Cumul par ORIGINE des alertes de scraping (période filtrée) : compte connecté, sinon adresse.
  const alertes = f.action === 'SCRAPING_ALERT' || !f.action
    ? await prisma.auditLog.findMany({ where: { ...where, action: 'SCRAPING_ALERT' }, select: { ip: true, createdAt: true, metaJson: true, actor: { select: { email: true } } }, orderBy: { createdAt: 'desc' }, take: 1000 })
    : []
  const origines = new Map<string, { n: number; derniere: Date; regles: Set<string> }>()
  for (const a of alertes) {
    const k = a.actor?.email ?? a.ip ?? '?'
    const e = origines.get(k) ?? { n: 0, derniere: a.createdAt, regles: new Set<string>() }
    e.n++
    if (a.createdAt > e.derniere) e.derniere = a.createdAt
    try { const m = JSON.parse(a.metaJson ?? '{}'); if (m.rule) e.regles.add(String(m.rule)); else if (m.rate) e.regles.add(String(m.rate)) } catch { /* méta illisible : rien à ajouter */ }
    origines.set(k, e)
  }
  const pages = Math.min(PAGE_MAX, Math.max(1, Math.ceil(total / PAR_PAGE)))
  const qs = (patch: Record<string, string | number | null>) => {
    const p = new URLSearchParams()
    const base: Record<string, string | number | null> = { action: f.action, compte: f.compte, jours: f.jours === 30 ? null : f.jours, page: f.page > 1 ? f.page : null, ...patch }
    for (const [k, v] of Object.entries(base)) if (v !== null && v !== '' && v !== undefined) p.set(k, String(v))
    const s = p.toString()
    return s ? `?${s}` : ''
  }
  const th = 'px-3 py-2.5 font-semibold'
  const td = 'px-3 py-2 align-top'

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/${locale}/admin`} className="text-xs text-chabon hover:underline">{lt(L.retour)}</Link>
        <h1 className="mt-1 text-xl font-semibold text-ank">{t.admin.logs}</h1>
        {/* Un événement est un INSTANT : heure de Port-au-Prince, nommée une fois. La page
            affichait l'UTC sans le dire — 19 h 49 pour une connexion faite à 15 h 49. */}
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-grafit">{lt(L.zone)}</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1 text-xs text-ank/80">{lt(L.action)}
          <select name="action" defaultValue={f.action ?? ''} className="rounded-lg border border-chabon/15 bg-white px-2 py-1.5 font-mono text-xs text-ank">
            <option value="">{lt(L.toutes)}</option>
            {actions.map((a) => <option key={a.action} value={a.action}>{a.action} ({a._count._all})</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ank/80">{lt(L.compte)}
          <select name="compte" defaultValue={f.compte ?? ''} className="rounded-lg border border-chabon/15 bg-white px-2 py-1.5 text-sm text-ank">
            <option value="">{lt(L.tousComptes)}</option>
            <option value="sans">{lt(L.sansCompte)}</option>
            {comptes.map((c) => <option key={c.id} value={c.id}>{c.email}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ank/80">{lt(L.periode)}
          <select name="jours" defaultValue={String(f.jours)} className="rounded-lg border border-chabon/15 bg-white px-2 py-1.5 text-sm text-ank">
            {JOURS.map((j) => <option key={j} value={j}>{j === 0 ? lt(L.tout) : `${j} ${lt(L.jours)}`}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-chabon px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">{lt(L.filtrer)}</button>
      </form>

      {/* ── Alertes de scraping : d'où elles viennent ── */}
      {origines.size > 0 && (
        <section aria-labelledby="origines" className="rounded-2xl border border-chabon/10 bg-white p-4">
          <h2 id="origines" className="text-sm font-semibold text-ank">{lt(L.parOrigine)} <span className="ml-1 font-normal text-grafit">({alertes.length})</span></h2>
          <p className="mb-3 mt-0.5 max-w-3xl text-xs text-ank/80">{lt(L.parOrigineSub)}</p>
          <ul className="flex flex-wrap gap-2">
            {[...origines.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, e]) => (
              <li key={k} className="rounded-xl border border-chabon/10 px-3 py-2 text-sm">
                <span className="font-mono text-ank">{k}</span>
                <span className="ml-2 font-mono text-xs text-grafit">{e.n} {e.n > 1 ? lt(L.alertes) : lt(L.alerte)}</span>
                <span className="block text-[11px] text-ank/80">{lt(L.regle)} : {[...e.regles].join(', ') || '—'} · {lt(L.derniere)} : {formatInstant(locale as Locale, e.derniere, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-x-auto rounded-2xl border border-chabon/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-chabon/10 bg-koton text-left text-[11px] uppercase tracking-wide text-ank/80">
              <th className={th}>{t.admin.logDate}</th>
              <th className={th}>{t.admin.logAction}</th>
              <th className={th}>{t.admin.logActor}</th>
              <th className={th}>{t.admin.logIp}</th>
              <th className={th}>{lt(L.appareil)}</th>
              <th className={th}>{lt(L.detail)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-chabon/5">
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ank/80">{t.admin.noLogs}</td>
              </tr>
            )}
            {logs.map((l) => {
              const a = decrireAppareil(l.userAgent)
              return (
                <tr key={l.id} className="hover:bg-koton/50">
                  <td className={`${td} font-mono text-xs text-ank/80`}>{formatInstant(locale as Locale, l.createdAt, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className={`${td} font-mono text-xs font-medium ${ACTION_COLOR[l.action] ?? 'text-grafit'}`}>
                    <Link href={qs({ action: l.action, page: null })} className="hover:underline">{l.action}</Link>
                  </td>
                  <td className={`${td} text-xs text-grafit`}>{l.actor?.email ?? '—'}</td>
                  <td className={`${td} font-mono text-xs text-ank/80`}>{l.ip ?? '—'}</td>
                  <td className={`${td} text-xs`}>{l.userAgent ? (a.reconnu ? a.libelle : <span className="text-ank/80" title={l.userAgent}>{lt(L.nonReconnu)} · {l.userAgent.slice(0, 24)}</span>) : '—'}</td>
                  <td className={`${td} text-xs text-ank/80`}>{detailDe(l.action, l.metaJson)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-grafit">
        <span>{total.toLocaleString('fr')} {lt(L.lignes)}</span>
        {pages > 1 && (
          <nav className="flex items-center gap-4" aria-label={lt(L.page)}>
            {f.page > 1 ? <Link href={qs({ page: f.page - 1 })} className="text-chabon hover:underline">{lt(L.precedente)}</Link> : <span />}
            <span>{lt(L.page)} {f.page} / {pages}</span>
            {f.page < pages ? <Link href={qs({ page: f.page + 1 })} className="text-chabon hover:underline">{lt(L.suivante)}</Link> : <span />}
          </nav>
        )}
      </div>
    </div>
  )
}
