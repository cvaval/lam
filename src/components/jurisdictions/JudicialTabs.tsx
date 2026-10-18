import Link from 'next/link'
import { Scale } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import type { VueCarte } from '@/lib/jurisdictions/layers'
import { qsAnnuaire } from '@/lib/jurisdictions/annuaire-notaires'

/**
 * Onglets « Juridictions » / « Notaires » de la carte judiciaire.
 *
 * SÉMANTIQUE : chaque onglet est une PAGE (URL partageable, rendu serveur, sans JavaScript) — d'où
 * une navigation (`<nav>` + liens, `aria-current="page"` sur l'onglet actif) et non le motif ARIA
 * `tablist`/`tab`, réservé aux panneaux permutés sur place (il imposerait les flèches au clavier et
 * mentirait à un lecteur d'écran sur ce que fait le lien). L'état actif se lit sans la couleur :
 * graisse, filet terre cuite et `aria-current`.
 *
 * La commune choisie suit l'utilisateur d'un onglet à l'autre (fiche de la commune ↔ ses notaires).
 */
export function JudicialTabs({ locale, t, vue, commune }: { locale: Locale; t: Dictionary; vue: VueCarte; commune: string | null }) {
  const j = t.judicial
  const base = `/${locale}/juridictions`
  const onglets = [
    { id: 'juridictions' as const, label: j.tabJurisdictions, href: commune ? `${base}?commune=${commune}` : base, icone: <Scale className="h-4 w-4" /> },
    { id: 'notaires' as const, label: j.tabNotaries, href: `${base}?${qsAnnuaire({ commune })}`, icone: '👤' as React.ReactNode },
  ]
  return (
    <nav aria-label={j.tabsLabel} className="mt-6 border-b border-[#D7DCD7]">
      <ul className="-mb-px flex gap-1">
        {onglets.map((o) => {
          const actif = o.id === vue
          return (
            <li key={o.id}>
              <Link
                href={o.href}
                aria-current={actif ? 'page' : undefined}
                className={`inline-flex min-h-[48px] items-center gap-2 rounded-t-lg border border-b-[3px] px-4 font-sans text-[15px] transition sm:px-5 ${
                  actif
                    ? 'border-[#D7DCD7] border-b-[#9B422C] bg-[#E9EDE7] font-semibold text-chabon'
                    : 'border-transparent border-b-transparent text-[#52656B] hover:border-b-[#D7DCD7] hover:text-chabon'
                }`}
              >
                <span aria-hidden="true">{o.icone}</span>
                {o.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
