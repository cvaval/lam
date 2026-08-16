import Link from 'next/link'
import { PublicHeader } from '@/components/PublicHeader'
import type { PublicationData } from '@/lib/publications'
import type { LegalBlock } from '@/lib/legal'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'

function Blocks({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.t === 'h2') return <h2 key={i} id={b.id} className="mt-10 scroll-mt-24 font-serif text-2xl font-semibold text-ank first:mt-0">{b.s}</h2>
        if (b.t === 'h3') return <h3 key={i} className="mt-6 font-semibold text-ank">{b.s}</h3>
        if (b.t === 'p') return <p key={i} className="mt-4 text-[1.05rem] leading-relaxed text-ank/80">{b.s}</p>
        if (b.t === 'ul')
          return (
            // `bg-white` n'est pas décoratif : la puce Wouj vaut 5,43:1 sur blanc mais
            // 4,47:1 sur Koton — sous le seuil. La classe FIXE la surface au lieu de la
            // supposer, et le jour où ce bloc migre ailleurs, la puce reste lisible.
            <ul key={i} className="mt-3 list-disc space-y-2 bg-white pl-5 text-ank/80 marker:text-wouj">
              {b.items.map((it, k) => <li key={k} className="leading-relaxed">{it}</li>)}
            </ul>
          )
        return (
          <div key={i} className="mt-4 rounded-xl border border-liy border-l-4 border-l-wouj bg-pil p-4">
            {b.paras.map((p, k) => <p key={k} className="mb-2 text-sm leading-relaxed text-ank/80 last:mb-0">{p}</p>)}
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
    <div className="min-h-screen bg-koton">
      <PublicHeader locale={locale} t={t} width="max-w-3xl" back={{ href: `/${locale}/publications`, label: 'Publications' }} />

      <div className="border-b border-liy bg-white pb-12 pt-14">
        <div className="mx-auto max-w-3xl px-4">
          {/* Bascule FR/EN de l'ARTICLE — distincte du sélecteur d'interface : seul le
              corps du texte est traduit. L'état actif est en Wouj (AV-03) ; il était
              Chabon sur un bandeau Chabon, donc impossible à distinguer de l'inactif. */}
          <div className="mb-6 inline-flex overflow-hidden rounded-full border border-liy font-mono text-xs">
            <Link href={base} aria-current={!isEn ? 'true' : undefined} className={`inline-flex min-h-[44px] items-center px-4 transition ${!isEn ? 'bg-wouj font-semibold text-white' : 'text-grafit hover:bg-pil'}`}>FR</Link>
            <Link href={`${base}?lang=en`} aria-current={isEn ? 'true' : undefined} className={`inline-flex min-h-[44px] items-center px-4 transition ${isEn ? 'bg-wouj font-semibold text-white' : 'text-grafit hover:bg-pil'}`}>EN</Link>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-grafit">{isEn ? pub.kickerEn : pub.kicker}</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-ank lg:text-[2.6rem]">{isEn ? pub.titleEn : pub.titleFr}</h1>
          <div aria-hidden="true" className="mt-5 h-1 w-16 bg-wouj" />
          <p className="mt-5 font-mono text-xs text-grafit">
            {(isEn ? 'Published ' : 'Publié le ') + (isEn ? pub.dateEn : pub.date)} · {isEn ? 'By ' : 'Par '}{pub.author}
          </p>
        </div>
      </div>

      <div className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-14">
        <article className="font-serif">
          <Blocks blocks={isEn ? pub.bodyEn : pub.bodyFr} />
        </article>

        {isEn && pub.refsEn?.length ? (
          <section className="mt-12">
            <h2 className="font-serif text-xl font-semibold text-ank">References</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-6 text-sm text-ank/80 marker:text-ank/80">
              {pub.refsEn.map((r, i) => <li key={i} className="leading-relaxed">{r}</li>)}
            </ol>
          </section>
        ) : null}

        <div className="mt-10 flex items-center gap-4 rounded-2xl border border-liy border-l-4 border-l-wouj bg-white p-5">
          <div className="grid h-12 w-12 flex-none place-items-center rounded-full bg-chabon font-serif text-lg font-bold text-koton">CV</div>
          <div>
            <div className="font-semibold text-ank">{(isEn ? 'By ' : 'Par ') + pub.author}</div>
            <div className="font-mono text-xs text-ank/80">{(isEn ? 'Published ' : 'Publié le ') + (isEn ? pub.dateEn : pub.date)}</div>
          </div>
        </div>

 <Link href={`/${locale}/publications`} className="mt-10 inline-flex min-h-[44px] items-center font-sans text-sm font-semibold text-ank transition hover:text-chabon">
          ← {isEn ? 'All publications' : 'Toutes les publications'}
        </Link>
        </div>
      </div>

      <footer className="border-t border-chabon/10 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-ank/80">
          <span>© 2026 Lam · {t.brand.baseline}</span>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/publications`}>Publications</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/cgu`}>{t.legal.cgu}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/confidentialite`}>{t.legal.confidentialite}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/mentions-legales`}>{t.legal.mentions}</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
