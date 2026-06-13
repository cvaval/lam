import Link from 'next/link'
import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/i18n/format'
import { loadGaps } from '@/lib/moniteur/gaps'

export const dynamic = 'force-dynamic'

interface EditionRow {
  number: string
  date: Date | null
  entries: number
  editionType: string
}

// Tri naturel des références d'édition (LM2018-35 < LM2018-110 ; X1 < X2 ; SP1 < SP17).
function refSortKey(ref: string): number {
  const m = ref.match(/(\d+)\s*$/)
  return m ? Number(m[1]) : 0
}

export default async function AdminMoniteurPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { annee?: string }
}) {
  const { locale, t } = dictFor(params.locale)
  await requireAdmin(locale)

  // Bornes d'années couvertes par le corpus (toutes sources confondues).
  const [minAgg, maxAgg] = await Promise.all([
    prisma.document.aggregate({ _min: { publicationDate: true }, where: { number: { not: null } } }),
    prisma.document.aggregate({ _max: { publicationDate: true }, where: { number: { not: null } } }),
  ])
  const minYear = minAgg._min.publicationDate?.getUTCFullYear() ?? 1900
  const maxYear = maxAgg._max.publicationDate?.getUTCFullYear() ?? new Date().getUTCFullYear()
  const years: number[] = []
  for (let y = maxYear; y >= minYear; y--) years.push(y)

  const year = Math.min(maxYear, Math.max(minYear, Number(searchParams.annee) || maxYear))
  const gte = new Date(Date.UTC(year, 0, 1))
  const lt = new Date(Date.UTC(year + 1, 0, 1))

  // Une édition = une référence (number) distincte ; nb d'entrées = publications indexées.
  const groups = await prisma.document.groupBy({
    by: ['number', 'editionType'],
    where: { number: { not: null }, publicationDate: { gte, lt } },
    _count: { _all: true },
    _min: { publicationDate: true },
  })

  const editions: EditionRow[] = groups
    .filter((g) => g.number)
    .map((g) => ({
      number: g.number!,
      date: g._min.publicationDate,
      entries: g._count._all,
      editionType: g.editionType ?? (/-SP/i.test(g.number!) ? 'SPECIALE' : 'REGULIERE'),
    }))
    .sort((a, b) => (a.date && b.date && a.date.getTime() !== b.date.getTime()
      ? a.date.getTime() - b.date.getTime()
      : refSortKey(a.number) - refSortKey(b.number)))

  const regulieres = editions.filter((e) => e.editionType !== 'SPECIALE')
  const speciales = editions.filter((e) => e.editionType === 'SPECIALE')
  const totalEntries = editions.reduce((s, e) => s + e.entries, 0)

  // Numéros manquants de l'année (numéros sautés + lettres sautées).
  const missing = (await loadGaps(year)).find((g) => g.year === year)?.missing ?? []


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-lank">{t.moniteur.title}</h1>
          <p className="mt-1 text-sm text-lank/55">{t.moniteur.subtitle}</p>
        </div>
        {/* Sélecteur d'année (GET — pas de JS requis) */}
        <form method="GET" className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-lank/45">{t.moniteur.year}</label>
          <select
            name="annee"
            defaultValue={String(year)}
            className="rounded-lg border border-lank/15 bg-white px-3 py-2 text-sm outline-none focus:border-sitwon"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-lank px-3 py-2 text-sm font-semibold text-white">
            {t.moniteur.show}
          </button>
        </form>
      </div>

      {/* Résumé de l'année */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: t.moniteur.regular, value: regulieres.length, alert: false },
          { label: t.moniteur.special, value: speciales.length, alert: false },
          { label: t.moniteur.indexedEntries, value: totalEntries, alert: false },
          { label: t.moniteur.missing, value: missing.length, alert: missing.length > 0 },
        ].map((k) => (
          <div
            key={k.label}
            className={`rounded-2xl border p-5 shadow-card ${k.alert ? 'border-soley/40 bg-soley-50' : 'border-lank/10 bg-white'}`}
          >
            <p className="font-mono text-3xl font-semibold tracking-tight text-lank">{k.value.toLocaleString('fr')}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-lank/45">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Numéros manquants de l'année */}
      <section className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-lank">
            {t.moniteur.missing} — {year}
          </h2>
          <Link href={`/${locale}/admin/moniteur/manquants`} className="text-xs font-semibold text-lank underline">
            {t.moniteur.missingLink} →
          </Link>
        </div>
        <p className="mt-1 text-xs text-lank/45">{t.moniteur.missingHint}</p>
        {missing.length === 0 ? (
          <p className="mt-3 text-sm text-fey">✔ {t.moniteur.missingNone}</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {missing.map((m) => (
              <span
                key={m.ref}
                title={m.reason === 'numero' ? t.moniteur.reasonNumero : t.moniteur.reasonSuffixe}
                className={`rounded-full border px-2.5 py-1 font-mono text-xs ${
                  m.reason === 'numero' ? 'border-soley/50 bg-soley-50 text-lank' : 'border-endeks/40 bg-endeks-50 text-endeks-700'
                }`}
              >
                {m.ref}
              </span>
            ))}
          </div>
        )}
      </section>

      <EditionTable title={`${t.moniteur.regular} — ${year}`} rows={regulieres} t={t} locale={locale} fmtDate={(d) => formatDate(locale as any, d)} />
      <EditionTable title={`${t.moniteur.special} — ${year}`} rows={speciales} t={t} locale={locale} fmtDate={(d) => formatDate(locale as any, d)} accent />
    </div>
  )
}

function EditionTable({
  title,
  rows,
  t,
  locale,
  fmtDate,
  accent = false,
}: {
  title: string
  rows: EditionRow[]
  t: ReturnType<typeof dictFor>['t']
  locale: string
  fmtDate: (d: Date | null) => string
  accent?: boolean
}) {
  return (
    <section>
      <h2 className={`mb-3 text-sm font-semibold ${accent ? 'text-endeks-700' : 'text-lank'}`}>{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-lank/10 bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-lank/10 bg-paper text-left text-[11px] uppercase tracking-wide text-lank/45">
              <th className="px-4 py-3 font-semibold">{t.moniteur.reference}</th>
              <th className="px-4 py-3 font-semibold">{t.moniteur.pubDate}</th>
              <th className="px-4 py-3 text-right font-semibold">{t.moniteur.entries}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-lank/5">
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-lank/40">
                  {t.moniteur.none}
                </td>
              </tr>
            )}
            {rows.map((e) => (
              <tr key={e.number} className="hover:bg-paper/50">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/${locale}/search?q=${encodeURIComponent(e.number)}`}
                    className="font-mono font-semibold text-lank hover:underline"
                  >
                    {e.number}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-lank/65">{fmtDate(e.date)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-lank/60">{e.entries}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
