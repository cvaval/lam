import Link from 'next/link'
import { HeroVisual } from '@/components/HeroVisual'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'

/**
 * Diapositive 1 — Législation. La TOTALITÉ de la diapositive est un lien vers le
 * portail de connexion ; le « bouton » est purement visuel (pas de contrôle
 * imbriqué). Aucune indication tarifaire.
 */
export function LegislationHeroSlide({ locale, t }: { locale: Locale; t: Dictionary }) {
  const h = t.hero.legislation
  return (
    <Link
      href={`/${locale}/login`}
      className="group block outline-none ring-sitwon focus-visible:ring-2"
      aria-label={`${h.title} — ${h.cta}`}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-y-10 gap-x-12 px-4 pb-8 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-sitwon">{h.eyebrow}</p>
          <h1 className="mt-5 font-serif text-4xl font-semibold leading-[1.05] text-cream lg:text-[3.2rem]">{h.title}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-cream/75">{h.description}</p>
          <span className="mt-7 inline-block rounded-full bg-sitwon px-6 py-3 text-sm font-semibold text-lank transition group-hover:bg-sitwon/90">
            {h.cta} →
          </span>
          <p className="mt-3 font-mono text-xs text-cream/45">🔒 {h.note}</p>
        </div>
        <div className="hidden pb-4 sm:block"><HeroVisual /></div>
      </div>
    </Link>
  )
}
