import type { ReactNode } from 'react'
import type { Locale } from '@/lib/types'
import { classes, libelle, SITUATIONS, type Situation } from '@/lib/legislation/situations'

/**
 * LE bandeau de note sous un intitulé de section. Il disait « ↪ Renvoi : » pour tout — irrégularités
 * du J.O., notes de consolidation, provenance, annexes éditoriales, rectifications, modifications par
 * un acte — alors qu'aucun des 30 bandeaux du corpus ne renvoyait à un article (17 oct. 2026). Il dit
 * désormais sa nature, dans la gamme de sa situation.
 */
export function BandeauSection({
  situation,
  locale = 'fr',
  titre,
  children,
}: {
  situation: Situation
  locale?: Locale
  /** Libellé, s'il diffère du registre (« Renvoi au Code »). */
  titre?: string
  children: ReactNode
}) {
  const g = classes(situation)
  const picto = SITUATIONS[situation].picto
  return (
    <p
      data-situation={situation}
      className={`mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded-r-md border-l-[3px] ${g.barre} ${g.fond} px-3 py-1.5 text-[11.5px] text-ank [print-color-adjust:exact]`}
    >
      <span className="font-bold uppercase tracking-wide text-ank">
        {picto && (
          <span aria-hidden className={`${g.texte} mr-1 normal-case`}>
            {picto}
          </span>
        )}
        {titre ?? libelle(situation, locale)}&nbsp;:
      </span>
      {children}
    </p>
  )
}
