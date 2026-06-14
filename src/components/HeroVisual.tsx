import { FruitMark } from '@/components/Logo'

/**
 * Illustration du héros : maquette « Index du Moniteur » (recomposée à la marque,
 * vectorielle/Tailwind — nette à toute taille, sûre en mode sombre). Décorative.
 * Pour utiliser un visuel exporté à la place, déposer le PNG dans public/ et
 * remplacer ce composant par <Image …/>.
 */
const YEARS = [
  { y: '1984', a: '42 actes' },
  { y: '1985', a: '51 actes' },
  { y: '1986', a: '68 actes' },
  { y: '1987', a: 'Constitution · 90 actes', hot: true },
  { y: '1988', a: '47 actes' },
  { y: '1989', a: '39 actes' },
  { y: '1990', a: '55 actes' },
]

export function HeroVisual() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
      {/* Fenêtre */}
      <div className="rounded-2xl border border-white/10 bg-[#23223f] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          </div>
          <FruitMark size={22} tone="dark" />
        </div>
        <h3 className="font-serif text-lg font-semibold text-cream">Index du Moniteur</h3>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-cream/40">Par année de publication · 1804 → 2026</p>
        <p className="mb-2 font-mono text-[10px] text-cream/30">⋮ 1804 – 1983</p>
        <ul className="space-y-1.5">
          {YEARS.map((r) => (
            <li
              key={r.y}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                r.hot ? 'border-l-4 border-sitwon bg-paper text-lank' : 'border-white/10 text-cream/85'
              }`}
            >
              <span className="font-semibold">{r.y}</span>
              <span className={`text-xs ${r.hot ? 'font-medium text-lank/70' : 'text-cream/45'}`}>{r.a}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 font-mono text-[10px] text-cream/30">⋮ 1991 – 2026</p>
      </div>

      {/* Carte « vérifié » flottante (1987 — Constitution) */}
      <div className="absolute -bottom-6 -right-3 w-52 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-lank/5 sm:-right-6">
        <div className="font-serif text-3xl font-bold leading-none text-lank">1987</div>
        <div className="mt-2 h-1 w-12 rounded-full bg-sitwon" />
        <div className="mt-2 text-sm font-semibold leading-snug text-lank">Constitution de la République d'Haïti</div>
        <div className="mt-1 font-mono text-[10px] text-lank/45">Le Moniteur · 29 mars 1987</div>
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-sitwon px-2 py-0.5 text-[10px] font-bold text-lank">✓ DOKIMAN VERIFYE</div>
      </div>
    </div>
  )
}
