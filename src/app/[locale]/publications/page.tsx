import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
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
    <div className="min-h-screen bg-paper">
      <header className="border-b border-lank/10 bg-lank">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href={`/${locale}`} aria-label="Lam"><Logo size={28} tone="dark" /></Link>
          <div className="flex items-center gap-4">
            <LocaleSwitcher current={locale} />
            <Link href={`/${locale}`} className="rounded-full border border-cream/30 px-4 py-1.5 text-sm font-medium text-cream hover:bg-white/10">
              ← {t.legal.back}
            </Link>
          </div>
        </div>
      </header>

      <div className="bg-lank pb-12 pt-8 text-cream">
        <div className="mx-auto max-w-4xl px-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-soley">{en ? 'News & analysis' : ht ? 'Aktyalite & analiz' : 'Actualités & analyses'}</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight">{heading}</h1>
          <p className="mt-3 max-w-2xl text-cream/70">{sub}</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-10">
        {PUBLICATIONS.map((p) => (
          <article key={p.slug} className="border-b border-lank/10 py-7 first:pt-0">
            <p className="font-mono text-xs uppercase tracking-wide text-lank/45">{p.date} · {p.author}</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold leading-snug text-lank">
              <Link href={`/${locale}/publications/${p.slug}`} className="hover:text-fey">{p.titleFr}</Link>
            </h2>
            <p className="mt-2 max-w-3xl text-lank/70">{p.summaryFr}</p>
            <Link href={`/${locale}/publications/${p.slug}`} className="mt-3 inline-block text-sm font-semibold text-fey hover:underline">{more} →</Link>
          </article>
        ))}
      </div>

      <footer className="border-t border-lank/10 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-lank/55">
          <span>© 2026 Lam · {t.brand.baseline}</span>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link className="hover:text-lank" href={`/${locale}/cgu`}>{t.legal.cgu}</Link>
            <Link className="hover:text-lank" href={`/${locale}/confidentialite`}>{t.legal.confidentialite}</Link>
            <Link className="hover:text-lank" href={`/${locale}/mentions-legales`}>{t.legal.mentions}</Link>
            <a className="hover:text-lank" href="mailto:legal@lam.ht">legal@lam.ht</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
