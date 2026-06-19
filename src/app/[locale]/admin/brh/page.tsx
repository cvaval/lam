import Link from 'next/link'
import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { formatDate } from '@/lib/i18n/format'
import { findMissingCirculaires, parseCirculaireRef, type BrhSerie, type SerieGaps } from '@/lib/brh/gaps'
import { BrhCirculaireList, type BrhRow } from '@/components/BrhCirculaireList'

export const dynamic = 'force-dynamic'

/**
 * Circulaires BRH — liste triée par série/numéro/révision puis date, KPIs et
 * détection des numéros manquants sur les DEUX séries (Circulaires et
 * Lettres-Circulaires : trous internes + sous-séries de révisions N-M).
 * Export CSV : /api/admin/brh/gaps. Pendant de la page « Le Moniteur ».
 */
export default async function AdminBrhPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  await requireAdmin(locale)

  const docs = await prisma.document.findMany({
    where: { type: 'CIRCULAIRE_BRH' },
    select: { id: true, number: true, titleFr: true, publicationDate: true, effectiveDate: true, matiere: true },
    orderBy: { publicationDate: 'asc' },
  })

  // Documents sans couche texte exploitable (marqueur posé par scripts/import-brh.ts) —
  // candidats au re-téléversement via l'OCR IA du studio.
  const unusable = await prisma.document.findMany({
    where: { type: 'CIRCULAIRE_BRH', bodyOriginal: { startsWith: '[Document numérisé' } },
    select: { id: true, number: true, titleFr: true },
  })

  // Tri série puis base/révision puis date ; références non standard en fin de liste.
  const serieOrder = (s: BrhSerie | undefined) => (s === 'CIRCULAIRE' ? 0 : s === 'LETTRE' ? 1 : 2)
  const rows = docs
    .map((d) => ({ ...d, parsed: parseCirculaireRef(d.number) }))
    .sort((a, b) => {
      const so = serieOrder(a.parsed?.serie) - serieOrder(b.parsed?.serie)
      if (so) return so
      if (a.parsed && b.parsed) {
        if (a.parsed.base !== b.parsed.base) return a.parsed.base - b.parsed.base
        if ((a.parsed.rev ?? 0) !== (b.parsed.rev ?? 0)) return (a.parsed.rev ?? 0) - (b.parsed.rev ?? 0)
      }
      return (a.publicationDate?.getTime() ?? 0) - (b.publicationDate?.getTime() ?? 0)
    })

  // Lignes pour le composant de liste (vues par numéro / par année). Dates formatées
  // côté serveur ; année = publication, à défaut entrée en vigueur.
  const listRows: BrhRow[] = rows.map((d) => ({
    id: d.id,
    number: d.number,
    serie: d.parsed?.serie ?? null,
    base: d.parsed?.base ?? null,
    rev: d.parsed?.rev ?? null,
    titleFr: d.titleFr,
    matiere: d.matiere,
    pubLabel: formatDate(locale, d.publicationDate),
    effLabel: formatDate(locale, d.effectiveDate),
    // Valeurs triables (epoch ms, null = sans date) — tri par date côté client.
    pubTs: d.publicationDate?.getTime() ?? null,
    effTs: d.effectiveDate?.getTime() ?? null,
    year: (d.publicationDate ?? d.effectiveDate)?.getUTCFullYear() ?? null,
  }))

  const gaps = findMissingCirculaires(docs.map((d) => d.number))
  const reasonLabels = {
    numero: t.brh.reasonNumero,
    revision: t.brh.reasonRevision,
    originale: t.brh.reasonOriginale,
  }

  const series: { gaps: SerieGaps; label: string }[] = [
    { gaps: gaps.circulaires, label: t.brh.serieCirculaires },
    { gaps: gaps.lettres, label: t.brh.serieLettres },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-lank">{t.brh.title}</h1>
          <p className="mt-1 text-sm text-lank/55">{t.brh.subtitle}</p>
        </div>
        <a
          href="/api/admin/brh/gaps?format=csv"
          className="rounded-lg bg-lank px-3 py-2 text-sm font-semibold text-white hover:bg-lank-600"
        >
          ↓ {t.brh.missingCsv}
        </a>
      </div>

      {/* Une section par série : KPIs + numéros manquants (pastilles) */}
      {series.map(({ gaps: sg, label }) => {
        const count = docs.filter((d) => parseCirculaireRef(d.number)?.serie === sg.serie).length
        const range = sg.present.length ? `${sg.present[0]} → ${sg.present[sg.present.length - 1]}` : '—'
        return (
          <section key={sg.serie} className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-lank">{label}</h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: t.brh.total, value: String(count), alert: false },
                { label: t.brh.distinct, value: String(sg.present.length), alert: false },
                { label: t.brh.range, value: range, alert: false },
                { label: t.brh.missing, value: String(sg.missing.length), alert: sg.missing.length > 0 },
              ].map((k) => (
                <div
                  key={k.label}
                  className={`rounded-2xl border p-4 ${k.alert ? 'border-soley/40 bg-soley-50' : 'border-lank/10 bg-paper/40'}`}
                >
                  <p className="font-mono text-2xl font-semibold tracking-tight text-lank">{k.value}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-lank/45">{k.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-lank/45">{t.brh.missingHint}</p>
            {sg.missing.length === 0 ? (
              <p className="mt-3 text-sm text-fey">✔ {t.brh.missingNone}</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {sg.missing.map((m) => (
                  <span
                    key={m.ref}
                    title={reasonLabels[m.reason]}
                    className={`rounded-full border px-2.5 py-1 font-mono text-xs text-lank ${
                      m.reason === 'numero' ? 'border-soley/50 bg-soley-50' : 'border-lank/20 bg-paper'
                    }`}
                  >
                    {m.ref}
                  </span>
                ))}
              </div>
            )}
          </section>
        )
      })}

      {/* Documents non exploitables (numérisés sans couche texte) */}
      <section className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-lank">
          {t.brh.unusable} {unusable.length > 0 && <span className="text-soley-700">({unusable.length})</span>}
        </h2>
        <p className="mt-1 text-xs text-lank/45">{t.brh.unusableHint}</p>
        {unusable.length === 0 ? (
          <p className="mt-3 text-sm text-fey">✔ {t.brh.unusableNone}</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {unusable.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-sm">
                <span className="whitespace-nowrap rounded-full border border-soley/50 bg-soley-50 px-2.5 py-0.5 font-mono text-xs text-lank">
                  {d.number}
                </span>
                <Link href={`/${locale}/doc/${d.id}`} className="truncate text-lank hover:underline">
                  {d.titleFr}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Liste des circulaires — vues par numéro / par année */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-lank">{t.brh.list}</h2>
        <BrhCirculaireList
          rows={listRows}
          locale={locale}
          labels={{
            byNumber: t.brh.byNumber,
            byYear: t.brh.byYear,
            number: t.brh.number,
            pubDate: t.brh.pubDate,
            effDate: t.brh.effDate,
            matiere: t.brh.matiere,
            titleCol: t.brh.titleCol,
            none: t.brh.none,
            noDate: t.brh.noDate,
            count: t.brh.countSuffix,
          }}
        />
      </div>
    </div>
  )
}
