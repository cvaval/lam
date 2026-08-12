import Link from 'next/link'
import { PublicHeader } from '@/components/PublicHeader'
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
    <div className="min-h-screen bg-koton">
      <PublicHeader locale={locale} t={t} width="max-w-5xl" back={{ href: `/${locale}`, label: t.legal.back }} />

      <div className="border-b border-liy bg-white pb-12 pt-14">
        <div className="mx-auto max-w-5xl px-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-grafit">{locale === 'en' ? 'Legal information' : locale === 'ht' ? 'Enfòmasyon legal' : 'Informations légales'}</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-ank lg:text-4xl">{doc.title}</h1>
          <div aria-hidden="true" className="mt-5 h-1 w-16 bg-wouj" />
          {doc.updated && <p className="mt-5 font-mono text-xs text-grafit">{t.legal.updated} : {doc.updated}</p>}
          <p className="mt-2 max-w-2xl text-xs text-grafit">{t.legal.frenchNote}</p>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 md:grid-cols-[230px_1fr]">
        <nav aria-label={t.legal.toc} className="md:sticky md:top-6 md:self-start">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ank/80">{t.legal.toc}</p>
          <ol className="space-y-1 text-sm">
            {toc.map((b) => (
              <li key={b.id}>
                <a href={`#${b.id}`} className="flex min-h-[44px] items-center rounded-r-md border-l-2 border-liy px-3 text-ank/80 outline-none ring-wouj transition hover:border-wouj hover:bg-white hover:text-wouj focus-visible:ring-2">
                  {b.s}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="max-w-2xl">
          {doc.intro?.map((p, i) => (
            <p key={`intro-${i}`} className="mb-4 leading-relaxed text-ank/80">{p}</p>
          ))}
          {doc.blocks.map((b, i) => {
            if (b.t === 'h2')
              return (
                <h2 key={i} id={b.id} className="mt-10 scroll-mt-24 font-serif text-xl font-semibold text-ank first:mt-0">
                  {b.s}
                </h2>
              )
            if (b.t === 'h3') return <h3 key={i} className="mt-6 font-semibold text-ank">{b.s}</h3>
            if (b.t === 'p') return <p key={i} className="mt-3 leading-relaxed text-ank/80">{b.s}</p>
            if (b.t === 'ul')
              return (
                <ul key={i} className="mt-3 list-disc space-y-2 pl-5 text-ank/80 marker:text-chabon">
                  {b.items.map((it, k) => (
                    <li key={k} className="leading-relaxed">{it}</li>
                  ))}
                </ul>
              )
            // warn
            return (
              <div key={i} className="mt-4 rounded-xl border border-chabon/40 border-l-4 border-l-chabon bg-pil p-4">
                {b.paras.map((p, k) => (
                  <p key={k} className="mb-2 text-sm leading-relaxed text-ank/80 last:mb-0">{p}</p>
                ))}
              </div>
            )
          })}
        </article>
      </div>

      <footer className="border-t border-chabon/10 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm">
          <span className="text-ank/80">© 2026 Lam · {t.brand.baseline}</span>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-grafit">
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-wouj" href={`/${locale}/cgu`}>{t.legal.cgu}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-wouj" href={`/${locale}/confidentialite`}>{t.legal.confidentialite}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-wouj" href={`/${locale}/mentions-legales`}>{t.legal.mentions}</Link>
            <a className="inline-flex min-h-[44px] items-center transition hover:text-wouj" href="mailto:legal@lam.ht">legal@lam.ht</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
