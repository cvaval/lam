import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import type { PublicationData } from '@/lib/publications'
import type { LegalBlock } from '@/lib/legal'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'

function Blocks({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.t === 'h2') return <h2 key={i} id={b.id} className="mt-10 scroll-mt-24 font-serif text-2xl font-semibold text-lank first:mt-0">{b.s}</h2>
        if (b.t === 'h3') return <h3 key={i} className="mt-6 font-semibold text-lank">{b.s}</h3>
        if (b.t === 'p') return <p key={i} className="mt-4 text-[1.05rem] leading-relaxed text-lank/80">{b.s}</p>
        if (b.t === 'ul')
          return (
            <ul key={i} className="mt-3 list-disc space-y-2 pl-5 text-lank/80 marker:text-sitwon">
              {b.items.map((it, k) => <li key={k} className="leading-relaxed">{it}</li>)}
            </ul>
          )
        return (
          <div key={i} className="mt-4 rounded-xl border border-soley/40 border-l-4 border-l-soley bg-soley-50 p-4">
            {b.paras.map((p, k) => <p key={k} className="mb-2 text-sm leading-relaxed text-lank/80 last:mb-0">{p}</p>)}
          </div>
        )
      })}
    </>
  )
}

/** Article éditorial, rendu en FR ou EN selon `lang`. */
export function PublicationArticle({
  pub,
  locale,
  t,
  lang,
}: {
  pub: PublicationData
  locale: Locale
  t: Dictionary
  lang: 'fr' | 'en'
}) {
  const isEn = lang === 'en'
  const base = `/${locale}/publications/${pub.slug}`
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-lank/10 bg-lank">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href={`/${locale}`} aria-label="Lam"><Logo size={28} tone="dark" /></Link>
          <div className="flex items-center gap-4">
            <LocaleSwitcher current={locale} />
            <Link href={`/${locale}/publications`} className="rounded-full border border-cream/30 px-4 py-1.5 text-sm font-medium text-cream hover:bg-white/10">
              ← Publications
            </Link>
          </div>
        </div>
      </header>

      <div className="bg-lank pb-12 pt-8 text-cream">
        <div className="mx-auto max-w-3xl px-4">
          <div className="mb-5 inline-flex overflow-hidden rounded-full border border-cream/30 font-mono text-xs">
            <Link href={base} className={`px-4 py-1.5 ${!isEn ? 'bg-sitwon font-semibold text-lank' : 'text-cream/80 hover:bg-white/10'}`}>FR</Link>
            <Link href={`${base}?lang=en`} className={`px-4 py-1.5 ${isEn ? 'bg-sitwon font-semibold text-lank' : 'text-cream/80 hover:bg-white/10'}`}>EN</Link>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-soley">{isEn ? pub.kickerEn : pub.kicker}</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight lg:text-[2.6rem]">{isEn ? pub.titleEn : pub.titleFr}</h1>
          <p className="mt-5 font-mono text-xs text-cream/70">
            {(isEn ? 'Published ' : 'Publié le ') + (isEn ? pub.dateEn : pub.date)} · {isEn ? 'By ' : 'Par '}{pub.author}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12">
        <article>
          <Blocks blocks={isEn ? pub.bodyEn : pub.bodyFr} />
        </article>

        {isEn && pub.refsEn?.length ? (
          <section className="mt-12">
            <h2 className="font-serif text-xl font-semibold text-lank">References</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm text-lank/55 marker:text-lank/40">
              {pub.refsEn.map((r, i) => <li key={i} className="leading-relaxed">{r}</li>)}
            </ol>
          </section>
        ) : null}

        <div className="mt-10 flex items-center gap-4 rounded-2xl border border-lank/10 border-l-4 border-l-sitwon bg-white p-5">
          <div className="grid h-12 w-12 flex-none place-items-center rounded-full bg-lank font-serif text-lg font-bold text-sitwon">CV</div>
          <div>
            <div className="font-semibold text-lank">{(isEn ? 'By ' : 'Par ') + pub.author}</div>
            <div className="font-mono text-xs text-lank/50">{(isEn ? 'Published ' : 'Publié le ') + (isEn ? pub.dateEn : pub.date)}</div>
          </div>
        </div>

        <Link href={`/${locale}/publications`} className="mt-8 inline-block text-sm font-semibold text-fey hover:underline">
          ← {isEn ? 'All publications' : 'Toutes les publications'}
        </Link>
      </div>

      <footer className="border-t border-lank/10 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-lank/55">
          <span>© 2026 Lam · {t.brand.baseline}</span>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link className="hover:text-lank" href={`/${locale}/publications`}>Publications</Link>
            <Link className="hover:text-lank" href={`/${locale}/cgu`}>{t.legal.cgu}</Link>
            <Link className="hover:text-lank" href={`/${locale}/confidentialite`}>{t.legal.confidentialite}</Link>
            <Link className="hover:text-lank" href={`/${locale}/mentions-legales`}>{t.legal.mentions}</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
