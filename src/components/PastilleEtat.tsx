import Link from 'next/link'
import type { Locale } from '@/lib/types'
import { classes, libelle, SITUATIONS, type Situation } from '@/lib/legislation/situations'

/**
 * LA pastille d'état — article, fiche, historique, citations. Une situation = une gamme = un libellé
 * (registre `src/lib/legislation/situations.ts`), partout.
 *
 * ⚠️ UNE PASTILLE N'EST UN LIEN QUE SI ELLE A UNE DESTINATION. 249 pastilles « modifié » du corpus
 * n'avaient rien à ouvrir (ni ancienne rédaction, ni acte) ; elles restent une étiquette, et leur
 * infobulle le dit (`title`).
 *
 * ⚠️ CIBLE TACTILE ET CLAVIER (repris de l'ancienne pastille d'`OfficialText`) : 11 px de texte font
 * 17 px de haut ; un pseudo-élément étend la zone cliquable à ~40 px sans écarter les lignes du
 * corpus ; anneau de focus encre.
 */
const BASE =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 align-middle ' +
  'text-[11px] font-semibold leading-[1.45] text-ank no-underline [print-color-adjust:exact]'
const LIEN =
  'relative after:absolute after:inset-x-0 after:-inset-y-[11px] after:content-[""] hover:underline ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chabon'

export function PastilleEtat({
  situation,
  locale = 'fr',
  label,
  title,
  href,
}: {
  situation: Situation
  locale?: Locale
  /** Libellé affiché, s'il diffère du registre (« Nouveau — Décret du 6 janvier 2016 »). */
  label?: string
  title?: string
  href?: string
}) {
  const g = classes(situation)
  const picto = SITUATIONS[situation].picto
  const cls = `${BASE} ${g.fond} ${g.filet}`
  const inner = (
    <>
      {picto && (
        <span aria-hidden className={`${g.texte} leading-none`}>
          {picto}
        </span>
      )}
      {label ?? libelle(situation, locale)}
    </>
  )
  if (!href)
    return (
      <span className={cls} title={title} data-situation={situation}>
        {inner}
      </span>
    )
  return href.startsWith('#') ? (
    <a href={href} className={`${cls} ${LIEN}`} title={title} data-situation={situation}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={`${cls} ${LIEN}`} title={title} data-situation={situation}>
      {inner}
    </Link>
  )
}
