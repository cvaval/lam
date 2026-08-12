import Link from 'next/link'
import { dictFor } from '@/lib/i18n/server'
import { requireCapability } from '@/lib/auth/guard'
import { loadGaps } from '@/lib/moniteur/gaps'

export const dynamic = 'force-dynamic'

/**
 * Liste complète des numéros manquants du Moniteur, toutes années confondues
 * (numéros sautés + lettres sautées, par séquence régulière/spéciale).
 * Export CSV : /api/admin/moniteur/gaps
 */
export default async function MoniteurManquantsPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  await requireCapability(locale, 'corpus.manage')

  const gaps = await loadGaps()
  const total = gaps.reduce((s, y) => s + y.missing.length, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ank">{t.moniteur.missingAllTitle}</h1>
          <p className="mt-1 text-sm text-ank/80">{t.moniteur.missingHint}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/admin/moniteur`} className="text-sm text-ank/80 hover:text-ank">
            ← {t.moniteur.title}
          </Link>
          <a
            href="/api/admin/moniteur/gaps?format=csv"
            className="rounded-lg bg-chabon px-3 py-2 text-sm font-semibold text-white hover:bg-chabon"
          >
            ↓ {t.moniteur.missingCsv}
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-chabon/40 bg-pil px-5 py-4">
        <p className="font-mono text-3xl font-semibold tracking-tight text-ank">{total.toLocaleString('fr')}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-ank/80">{t.moniteur.missingTotal}</p>
      </div>

      {gaps.length === 0 && (
        <p className="rounded-2xl border border-chabon/10 bg-white p-8 text-center text-sm text-chabon">
          ✔ {t.moniteur.missingNone}
        </p>
      )}

      {gaps.map((y) => (
        <section key={y.year} className="rounded-2xl border border-chabon/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ank">
              <Link href={`/${locale}/admin/moniteur?annee=${y.year}`} className="hover:underline">
                {y.year}
              </Link>
            </h2>
            <span className="font-mono text-xs text-ank/80">{y.missing.length}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {y.missing.map((m) => (
              <span
                key={m.ref}
                title={m.reason === 'numero' ? t.moniteur.reasonNumero : t.moniteur.reasonSuffixe}
                className={`rounded-full border px-2.5 py-1 font-mono text-xs ${
                  m.reason === 'numero' ? 'border-chabon/50 bg-pil text-ank' : 'border-chabon/40 bg-pil text-chabon'
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
