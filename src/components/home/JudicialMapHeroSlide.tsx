import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'

/**
 * Diapositive 2 — Carte judiciaire. Illustration VECTORIELLE légère (aucun
 * MapLibre dans le héros) ; la recherche s'effectue sur la page dédiée. La
 * totalité de la diapositive est un lien vers /juridictions. Aucun tarif.
 */
function MapVisual({ t }: { t: Dictionary }) {
  const j = t.judicial
  const rows = [
    { shape: 'circle', color: '#BEF264', label: j.peace, value: 'Section Est · Nord · Sud' },
    { shape: 'triangle', color: '#F4A823', label: j.firstInstance, value: 'TPI de Port-au-Prince' },
    { shape: 'square', color: '#4F8EF7', label: j.appeal, value: 'Cour d’appel de Port-au-Prince' },
    { shape: 'diamond', color: '#7C6F9B', label: j.cassation, value: j.nationalRecourse },
  ]
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-white/10 bg-[#23223f] p-5 shadow-2xl">
        <h3 className="font-serif text-lg font-semibold text-cream">Port-au-Prince</h3>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-cream/40">Ouest · Arr. de Port-au-Prince</p>
        <div className="mb-3 flex items-baseline gap-2 rounded-lg bg-paper px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-lank/50">{j.primaryPostalCode}</span>
          <span className="font-mono text-xl font-bold text-lank">HT6110</span>
        </div>
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-2.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-cream/85">
              <svg width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
                <g fill={r.color} stroke="#F6F4EE" strokeWidth="0.8">
                  {r.shape === 'circle' && <circle cx="6" cy="6" r="5" />}
                  {r.shape === 'triangle' && <polygon points="6,1 11,11 1,11" />}
                  {r.shape === 'square' && <rect x="1.5" y="1.5" width="9" height="9" />}
                  {r.shape === 'diamond' && <polygon points="6,0.5 11.5,6 6,11.5 0.5,6" />}
                </g>
              </svg>
              <span className="min-w-0 flex-1 truncate text-xs text-cream/60">{r.label}</span>
              <span className="truncate text-xs font-medium">{r.value}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute -bottom-6 -right-3 w-44 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-lank/5 sm:-right-6">
        <div className="font-serif text-2xl font-bold leading-none text-lank">149</div>
        <div className="mt-2 h-1 w-12 rounded-full bg-sitwon" />
        <div className="mt-2 text-sm font-semibold leading-snug text-lank">{t.judicial.commune}s</div>
        <div className="mt-1 font-mono text-[10px] text-lank/45">10 {t.judicial.department.toLowerCase()}s · 185 {t.judicial.peace.toLowerCase()}</div>
      </div>
    </div>
  )
}

export function JudicialMapHeroSlide({ locale, t }: { locale: Locale; t: Dictionary }) {
  const h = t.hero.map
  return (
    <Link
      href={`/${locale}/juridictions`}
      className="group block outline-none ring-sitwon focus-visible:ring-2"
      aria-label={`${h.title} — ${h.cta}`}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-y-10 gap-x-12 px-4 pb-8 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-sitwon">{h.eyebrow}</p>
          <h2 className="mt-5 font-serif text-4xl font-semibold leading-[1.05] text-cream lg:text-[3.2rem]">{h.title}</h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-cream/75">{h.description}</p>
          <span className="mt-7 inline-block rounded-full bg-sitwon px-6 py-3 text-sm font-semibold text-lank transition group-hover:bg-sitwon/90">
            {h.cta} →
          </span>
          <p className="mt-3 font-mono text-xs text-cream/45">🗺 {h.note}</p>
        </div>
        <div className="hidden pb-4 sm:block"><MapVisual t={t} /></div>
      </div>
    </Link>
  )
}
