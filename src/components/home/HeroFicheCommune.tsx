import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import { BRAND_COLORS as C } from '@/lib/brand-colors'

/**
 * La fiche de commune du héros — APERÇU de Port-au-Prince, telle que l'affichait l'accueil de Lam
 * (`JudicialMapHeroSlide`), rétablie dans le héros Agora à la demande de Me Vaval (8 oct. 2026).
 *
 * C'est un extrait RÉEL de la fiche (data/judicial-map/seed-v1.json, `commune-ouest-port-au-prince`),
 * pas une donnée : la fiche complète est sur /juridictions, où mène le lien. La couleur de la
 * pastille ne porte rien seule — le NOM du tribunal est juste à côté (règle de la charte).
 */
const COMMUNE_ID = 'commune-ouest-port-au-prince'

function CourtGlyph({ tone }: { tone: 'cassation' | 'appel' | 'tpi' | 'paix' }) {
  // Suit `COURT_STYLE` (/juridictions), palette du 9 oct. 2026 : paix bleu, TPI rouge, appel ardoise.
  const teinte = { cassation: C.chabon, appel: C.grafit, tpi: C.carteRouge, paix: C.ble }[tone]
  return (
    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${teinte}33` }}>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke={C.chabon} strokeWidth="2" strokeLinecap="round">
        <path d="M10 2.5 17.5 6.5H2.5L10 2.5Z" fill={C.chabon} fillOpacity="0.25" />
        <path d="M4.5 8.5v6M8.2 8.5v6M11.8 8.5v6M15.5 8.5v6" />
        <path d="M2.5 17.5h15" />
      </svg>
    </span>
  )
}

export function HeroFicheCommune({ locale, t }: { locale: Locale; t: Dictionary }) {
  const j = t.judicial
  const courts = [
    { tone: 'cassation' as const, name: j.cassation, detail: 'Rue Mgr Guilloux, près du Champ-de-Mars' },
    { tone: 'appel' as const, name: 'Cour d’appel de Port-au-Prince', detail: null },
    { tone: 'tpi' as const, name: 'Tribunal de première instance de Port-au-Prince', detail: null },
    { tone: 'paix' as const, name: 'Tribunal de paix — Section Est', detail: null },
    { tone: 'paix' as const, name: 'Tribunal de paix — Section Nord', detail: null },
    { tone: 'paix' as const, name: 'Tribunal de paix — Section Sud', detail: null },
  ]
  return (
    <Link href={`/${locale}/juridictions?commune=${COMMUNE_ID}`} className="ag-hero-fiche block rounded-md bg-white p-4 text-ank">
      <h3 className="font-serif text-xl font-semibold text-ank">Port-au-Prince</h3>
      <p className="mt-0.5 text-[11px] text-grafit">Ouest · Arrondissement de Port-au-Prince</p>
      <p className="mt-2.5 inline-flex items-baseline gap-1.5 rounded border border-liy-fonse bg-pil px-2.5 py-1">
        <span className="font-mono text-[9px] uppercase tracking-wider text-grafit">{j.primaryPostalCode}</span>
        <span className="font-mono text-xs font-bold text-ank">HT6110</span>
      </p>
      <ul className="mt-3 flex flex-col divide-y divide-liy">
        {courts.map((c) => (
          <li key={c.name} className="flex items-center gap-2.5 py-2">
            <CourtGlyph tone={c.tone} />
            <span className="min-w-0">
              <span className="block text-[12.5px] font-medium leading-tight text-ank">{c.name}</span>
              {c.detail && <span className="mt-0.5 block truncate text-[10.5px] text-grafit">{c.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
      <span className="mt-3 flex items-center justify-between rounded bg-chabon px-3.5 py-2.5 text-[12px] font-semibold text-white">
        {t.hero.map.openRecord}
        <span aria-hidden="true">→</span>
      </span>
    </Link>
  )
}
