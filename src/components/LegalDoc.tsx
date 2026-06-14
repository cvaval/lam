import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import type { LegalDocData } from '@/lib/legal'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'

/**
 * Rendu d'un document juridique du portail (CGU, confidentialité, mentions).
 * Public (hors espace authentifié). Texte = données structurées (src/lib/legal.ts),
 * échappé par React — aucune injection HTML. Sommaire ancré dérivé des titres h2.
 */
export function LegalDoc({ doc, locale, t }: { doc: LegalDocData; locale: Locale; t: Dictionary }) {
  const toc = doc.blocks.filter((b): b is Extract<LegalDocData['blocks'][number], { t: 'h2' }> => b.t === 'h2')

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-lank/10 bg-lank">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href={`/${locale}`} aria-label="Lam">
            <Logo size={28} tone="dark" />
          </Link>
          <div className="flex items-center gap-4">
            <LocaleSwitcher current={locale} />
            <Link href={`/${locale}`} className="rounded-full border border-cream/30 px-4 py-1.5 text-sm font-medium text-cream hover:bg-white/10">
              ← {t.legal.back}
            </Link>
          </div>
        </div>
      </header>

      <div className="bg-lank pb-12 pt-8 text-cream">
        <div className="mx-auto max-w-5xl px-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-soley">{locale === 'en' ? 'Legal information' : locale === 'ht' ? 'Enfòmasyon legal' : 'Informations légales'}</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight lg:text-4xl">{doc.title}</h1>
          {doc.updated && <p className="mt-4 font-mono text-xs text-cream/70">{t.legal.updated} : {doc.updated}</p>}
          <p className="mt-2 max-w-2xl text-xs text-cream/55">{t.legal.frenchNote}</p>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 md:grid-cols-[230px_1fr]">
        <nav aria-label={t.legal.toc} className="md:sticky md:top-6 md:self-start">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-lank/45">{t.legal.toc}</p>
          <ol className="space-y-1 text-sm">
            {toc.map((b) => (
              <li key={b.id}>
                <a href={`#${b.id}`} className="block rounded-r-md border-l-2 border-lank/10 px-3 py-1.5 text-lank/55 transition hover:border-sitwon hover:bg-white hover:text-lank">
                  {b.s}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="max-w-2xl">
          {doc.intro?.map((p, i) => (
            <p key={`intro-${i}`} className="mb-4 leading-relaxed text-lank/80">{p}</p>
          ))}
          {doc.blocks.map((b, i) => {
            if (b.t === 'h2')
              return (
                <h2 key={i} id={b.id} className="mt-10 scroll-mt-24 font-serif text-xl font-semibold text-lank first:mt-0">
                  {b.s}
                </h2>
              )
            if (b.t === 'h3') return <h3 key={i} className="mt-6 font-semibold text-lank">{b.s}</h3>
            if (b.t === 'p') return <p key={i} className="mt-3 leading-relaxed text-lank/80">{b.s}</p>
            if (b.t === 'ul')
              return (
                <ul key={i} className="mt-3 list-disc space-y-2 pl-5 text-lank/80 marker:text-sitwon">
                  {b.items.map((it, k) => (
                    <li key={k} className="leading-relaxed">{it}</li>
                  ))}
                </ul>
              )
            // warn
            return (
              <div key={i} className="mt-4 rounded-xl border border-soley/40 border-l-4 border-l-soley bg-soley-50 p-4">
                {b.paras.map((p, k) => (
                  <p key={k} className="mb-2 text-sm leading-relaxed text-lank/80 last:mb-0">{p}</p>
                ))}
              </div>
            )
          })}
        </article>
      </div>

      <footer className="border-t border-lank/10 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm">
          <span className="text-lank/45">© 2026 Lam · {t.brand.baseline}</span>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-lank/60">
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
