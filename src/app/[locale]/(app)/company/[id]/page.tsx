import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Pastille } from '@/components/TypeBadge'
import { dictFor } from '@/lib/i18n/server'
import { formatDate } from '@/lib/i18n/format'
import { requireUser } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { can } from '@/lib/rbac'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { RateLimitNotice } from '@/components/RateLimitNotice'
import type { DocType } from '@/lib/types'

export default async function CompanyPage({ params }: { params: { locale: string; id: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)

  if (!(await guard({ action: 'doc', subject: user.id, ...LIMITS.doc }, { actorId: user.id }))) {
    return <RateLimitNotice t={t} />
  }

  // Index transversal réservé aux paliers Pro/Institution (§03).
  if (!can(user.role, 'index.companies')) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-soley/40 bg-soley-50 p-8 text-center">
        <p className="text-sm text-lank/75">{t.paywall.companyLocked}</p>
        <Link href={`/${locale}/account`} className="mt-3 inline-block rounded-lg bg-lank px-4 py-2 text-sm font-semibold text-white">
          {t.paywall.cta}
        </Link>
      </div>
    )
  }

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: { publications: { include: { document: true }, orderBy: { date: 'desc' } } },
  })
  if (!company) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="rounded-2xl border border-lank/10 bg-white p-6 shadow-card">
        <span className="rounded-full bg-lank px-2 py-0.5 text-[11px] font-semibold text-white">
          {t.search.companies.toUpperCase()}
        </span>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-lank">{company.name}</h1>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {company.rcNumber && <Field label="RC" value={company.rcNumber} />}
          {company.nif && <Field label="NIF" value={company.nif} />}
          {company.capital && <Field label={t.company.capital} value={company.capital} />}
          {company.address && <Field label={t.company.address} value={company.address} />}
        </dl>
      </header>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-lank/45">{t.doc.publications}</h2>
        <div className="space-y-2">
          {company.publications.map((p) => {
            const inner = (
              <div className="flex items-center justify-between rounded-xl border border-lank/10 bg-white px-4 py-3 shadow-card">
                <div className="flex items-center gap-2">
                  {p.document && <Pastille type={p.document.type as DocType} />}
                  <div>
                    <p className="text-sm font-medium text-lank">{p.label}</p>
                    <p className="text-xs text-lank/45">
                      {(t.company.kinds as Record<string, string>)[p.kind] ?? p.kind}
                      {p.moniteurRef ? ` · ${p.moniteurRef}` : ''}
                    </p>
                  </div>
                </div>
                {p.date && <span className="text-xs text-lank/40">{formatDate(locale, p.date)}</span>}
              </div>
            )
            return p.document ? (
              <Link key={p.id} href={`/${locale}/doc/${p.document.id}`} className="block">
                {inner}
              </Link>
            ) : (
              <div key={p.id}>{inner}</div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-lank/40">{label}</dt>
      <dd className="text-lank">{value}</dd>
    </div>
  )
}
