import Link from 'next/link'
import { PublicHeader } from '@/components/PublicHeader'
import { PUBLICATIONS } from '@/lib/publications'
import { dictFor } from '@/lib/i18n/server'

// Page publique — répertoire des publications.
export default function PublicationsPage({ params }: { params: { locale: string } }) {
  const { locale, t } = dictFor(params.locale)
  const en = locale === 'en'
  const ht = locale === 'ht'
  const heading = en ? 'Publications' : ht ? 'Piblikasyon' : 'Publications'
  const sub = en
    ? 'Developments in Haitian law and updates to the Platform, newest first.'
    : ht
    ? 'Nouvote dwa ayisyen an ak evolisyon Platfòm nan, pi resan an anvan.'
    : "Les nouveautés du droit haïtien et les évolutions de la Plateforme, de la plus récente à la plus ancienne."
  const more = en ? 'Read more' : ht ? 'Aprann plis' : 'En savoir plus'

  return (
    <div className="min-h-screen bg-koton">
      <PublicHeader locale={locale} t={t} width="max-w-4xl" back={{ href: `/${locale}`, label: t.legal.back }} />

      <div className="border-b border-liy bg-white pb-12 pt-14">
        <div className="mx-auto max-w-4xl px-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-grafit">{en ? 'News & analysis' : ht ? 'Aktyalite & analiz' : 'Actualités & analyses'}</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-ank">{heading}</h1>
          <div aria-hidden="true" className="mt-5 h-1 w-16 bg-wouj" />
          <p className="mt-5 max-w-2xl text-grafit">{sub}</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-10">
        {PUBLICATIONS.map((p) => (
          <article key={p.slug} className="border-b border-liy py-8 first:pt-0 last:border-0">
            <p className="font-mono text-xs uppercase tracking-wide text-ank/80">{en ? p.dateEn : p.date} · {p.author}</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold leading-snug text-ank">
              <Link href={`/${locale}/publications/${p.slug}`} className="transition hover:text-chabon">{en ? p.titleEn : p.titleFr}</Link>
            </h2>
            <p className="mt-2 max-w-3xl text-grafit">{en ? p.summaryEn : p.summaryFr}</p>
 <Link href={`/${locale}/publications/${p.slug}`} className="mt-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-ank transition hover:text-chabon">{more} →</Link>
          </article>
        ))}
      </div>

      <footer className="border-t border-chabon/10 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-ank/80">
          <span>© 2026 Lam · {t.brand.baseline}</span>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/cgu`}>{t.legal.cgu}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/confidentialite`}>{t.legal.confidentialite}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/mentions-legales`}>{t.legal.mentions}</Link>
            <a className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href="mailto:legal@lam.ht">legal@lam.ht</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
