import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Pastille } from '@/components/TypeBadge'
import { prisma } from '@/lib/db'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { RateLimitNotice } from '@/components/RateLimitNotice'
import { canReadService } from '@/lib/access'
import { highlightRegex } from '@/lib/search/highlight'

export const dynamic = 'force-dynamic'

const MAX = 500

export default async function TarifsPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { q?: string | string[] }
}) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)

  // Accès par service (§03) : section réservée aux comptes ayant le service Tarifs douaniers.
  if (!canReadService(user, 'TARIF_DOUANIER')) redirect(`/${locale}/search?type=index`)

  // Anti-scraping (§09).
  if (!(await guard({ action: 'doc', subject: user.id, ...LIMITS.doc }, { actorId: user.id }))) {
    return <RateLimitNotice t={t} />
  }

  const rawQ = Array.isArray(searchParams?.q) ? searchParams.q[0] : searchParams?.q
  const q = (rawQ ?? '').trim().slice(0, 120)
  const where = q
    ? { OR: [{ code: { contains: q, mode: 'insensitive' as const } }, { designation: { contains: q, mode: 'insensitive' as const } }] }
    : {}

  const [total, rows, docCount] = await Promise.all([
    prisma.customsTariff.count({ where }),
    prisma.customsTariff.findMany({ where, orderBy: [{ chapter: 'asc' }, { position: 'asc' }, { code: 'asc' }], take: MAX }),
    prisma.document.count({ where: { type: 'TARIF_DOUANIER' } }),
  ])

  const hlRe = q ? highlightRegex([q]) : null
  const hl = (v: string) => {
    if (!hlRe || !v) return v
    const parts = v.split(hlRe)
    return parts.length <= 1 ? v : parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="hl">{p}</mark> : p))
  }
  const num = 'text-right tabular-nums whitespace-nowrap'

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Pastille type="TARIF_DOUANIER" />
            <h1 className="text-lg font-semibold text-lank">{t.tarifs.title}</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-lank/55">{t.tarifs.subtitle}</p>
        </div>
        <span className="hidden h-1.5 w-16 shrink-0 rounded-full bg-kannel sm:block" />
      </div>

      {/* Recherche dans la table (filtre GET local) */}
      <form action={`/${locale}/tarifs`} method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t.tarifs.searchPlaceholder}
          className="w-full rounded-xl border border-lank/15 bg-white px-4 py-2 text-sm text-lank outline-none focus:border-kannel"
        />
        <button type="submit" className="rounded-xl bg-kannel px-4 py-2 text-sm font-medium text-white hover:bg-kannel-600">
          {t.common.search}
        </button>
      </form>

      <p className="text-sm text-lank/55">
        {total.toLocaleString('fr')} {t.tarifs.results}
        {q && <> · « {q} »</>}
        {total > MAX && <span className="text-lank/40"> · {MAX} {t.tarifs.results} affichées</span>}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-lank/10 bg-white p-10 text-center text-lank/45">
          {q ? t.tarifs.empty : t.tarifs.emptyAll}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-lank/10 bg-white shadow-card">
          <table className="w-full border-collapse text-[13px] text-lank/90">
            <thead>
              <tr className="border-b border-lank/15 bg-kannel-50 text-left text-xs uppercase tracking-wide text-lank/60">
                <th scope="col" className="px-3 py-2 font-semibold">{t.tarifs.thCode}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{t.tarifs.thDesignation}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{t.tarifs.thUnite}</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">{t.tarifs.thDd}</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">{t.tarifs.thTca}</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">{t.tarifs.thAccises}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={i % 2 === 1 ? 'bg-[rgba(27,31,61,0.025)]' : ''}>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs font-medium text-lank">{hl(r.code)}</td>
                  <td className="px-3 py-1.5">
                    {hl(r.designation)}
                    {r.note && <span className="mt-0.5 block text-[11px] text-lank/45">{r.note}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-lank/70">{r.unite ?? '—'}</td>
                  <td className={`px-3 py-1.5 ${num}`}>{r.dd ?? '—'}</td>
                  <td className={`px-3 py-1.5 ${num}`}>{r.tca ?? '—'}</td>
                  <td className={`px-3 py-1.5 ${num}`}>{r.accises ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Corpus documentaire douanier */}
      <Link
        href={`/${locale}/search?type=tarifs`}
        className="flex items-center justify-between rounded-2xl border border-kannel/30 bg-kannel-50 px-5 py-4 transition hover:border-kannel/60"
      >
        <span>
          <span className="block font-semibold text-lank">{t.tarifs.docsTitle}</span>
          <span className="mt-0.5 block text-xs text-lank/55">{t.tarifs.docsSub}</span>
        </span>
        <span className="shrink-0 text-sm font-medium text-kannel-700">
          {docCount > 0 && <span className="mr-2 text-lank/45">{docCount}</span>}
          {t.tarifs.docsLink} →
        </span>
      </Link>
    </div>
  )
}
