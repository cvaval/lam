'use client'

import { useState, type ReactNode } from 'react'
import type { Locale } from '@/lib/types'
import { classes, libelle, LIBELLES_REPLI, SITUATIONS, type Situation } from '@/lib/legislation/situations'

/**
 * LE gabarit de repli du lecteur — jurisprudence, annotations, ancienne rédaction, texte abrogé,
 * législation connexe de chaque nature, notes « sic », navigation. Avant le 17 oct. 2026, sept
 * gabarits coexistaient (rayons, chevrons ▸/▾ et ▾/▴, « afficher »/« Afficher », compteurs, focus).
 *
 * Fermé par défaut ; en-tête dans la gamme de la situation, barre gauche de 3 px ; contenu sur blanc
 * (charte : « tout texte juridique se lit sur blanc ») ; `data-nocopy` (exclu de « Copier l'article ») ;
 * bouton avec `aria-expanded` et anneau de focus ; libellés traduits.
 */
export function Repli({
  situation,
  locale = 'fr',
  titre,
  compteur,
  id,
  defautOuvert = false,
  children,
}: {
  situation: Situation
  locale?: Locale
  /** Titre affiché, s'il diffère du registre (« Ancienne version (1987) » pour la Constitution). */
  titre?: string
  compteur?: number
  /** Ancre du repli (`hist-art-N` quand il remplace l'entrée d'historique de bas de page). */
  id?: string
  defautOuvert?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defautOuvert)
  const g = classes(situation)
  const picto = SITUATIONS[situation].picto
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr
  return (
    <div
      id={id}
      data-nocopy
      data-situation={situation}
      className={`mt-2.5 scroll-mt-24 overflow-hidden rounded-r-lg border border-l-[3px] border-chabon/10 ${g.barre} bg-white [print-color-adjust:exact]`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs ${g.fond} transition hover:brightness-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-chabon`}
      >
        <span aria-hidden className="select-none text-ank">
          {open ? '▾' : '▸'}
        </span>
        {picto && (
          <span aria-hidden className={`${g.texte} leading-none`}>
            {picto}
          </span>
        )}
        <span className="font-semibold text-ank">{titre ?? libelle(situation, locale)}</span>
        {compteur !== undefined && compteur > 0 && (
          <span className={`rounded-full border ${g.filet} bg-white px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-ank`}>{compteur}</span>
        )}
        <span className="ml-auto text-[11px] font-medium text-ank">{open ? lt(LIBELLES_REPLI.masquer) : lt(LIBELLES_REPLI.afficher)}</span>
      </button>
      {open && <div className="border-t border-chabon/10 bg-white px-4 py-3">{children}</div>}
    </div>
  )
}
