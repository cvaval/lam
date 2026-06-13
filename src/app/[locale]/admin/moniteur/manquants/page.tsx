import Link from 'next/link'
import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { loadGaps } from '@/lib/moniteur/gaps'

export const dynamic = 'force-dynamic'

/**
 * Liste complète des numéros manquants du Moniteur, toutes années confondues
 * (numéros sautés + lettres sautées, par séquence régulière/spéciale).
 * Export CSV : /api/admin/moniteur/gaps
 */
export default async function MoniteurManquantsPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  await requireAdmin(locale)

  const gaps = await loadGaps()
  const total = gaps.reduce((s, y) => s + y.missing.length, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-lank">{t.moniteur.missingAllTitle}</h1>
          <p className="mt-1 text-sm text-lank/55">{t.moniteur.missingHint}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/admin/moniteur`} className="text-sm text-lank/55 hover:text-lank">
            ← {t.moniteur.title}
          </Link>
          <a
            href="/api/admin/moniteur/gaps?format=csv"
            className="rounded-lg bg-lank px-3 py-2 text-sm font-semibold text-white hover:bg-lank-600"
          >
            ↓ {t.moniteur.missingCsv}
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-soley/40 bg-soley-50 px-5 py-4">
        <p className="font-mono text-3xl font-semibold tracking-tight text-lank">{total.toLocaleString('fr')}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-lank/55">{t.moniteur.missingTotal}</p>
      </div>

      {gaps.length === 0 && (
        <p className="rounded-2xl border border-lank/10 bg-white p-8 text-center text-sm text-fey">
          ✔ {t.moniteur.missingNone}
        </p>
      )}

      {gaps.map((y) => (
        <section key={y.year} className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-lank">
              <Link href={`/${locale}/admin/moniteur?annee=${y.year}`} className="hover:underline">
                {y.year}
              </Link>
            </h2>
            <span className="font-mono text-xs text-lank/45">{y.missing.length}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {y.missing.map((m) => (
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
        </section>
      ))}
    </div>
  )
}
