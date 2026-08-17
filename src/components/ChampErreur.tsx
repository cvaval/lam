import type { ReactNode } from 'react'
import { IconErreur, IconAvertissement } from './icons'

/**
 * BLOC D'ERREUR — avenant AV-05, chapitre 1, article 6.
 *
 * « L'erreur de saisie et l'échec d'opération se rendent par un bandeau posé sur la SURFACE
 *   NEUTRE de son hôte, ouvert par le mot “Erreur —”, porté par un filet gauche Wouj de 3 px
 *   et un pictogramme circle-alert. Le rouge y est un trait et un signe, JAMAIS une nappe. »
 *
 * ⚠ Pourquoi pas de fond teinté. Un bandeau en Wouj Pal #FCE1E4 avait été proposé, puis
 * écarté : l'AV-04 art. 1 donne DÉJÀ cette teinte au surlignage étendu et au fond de
 * sélection. L'écart colorimétrique aurait été NUL — sur une page de résultats, une erreur et
 * un passage surligné seraient devenus le même objet, et un simple glisser-sélection aurait
 * fabriqué la forme du bandeau. Sur surface neutre, l'écart est de 12,9 sur Blan.
 *
 * ⚠ Pourquoi le mot compte plus que la couleur. Wouj et Vèt sont à 1,05:1 de luminance :
 * en daltonisme rouge-vert, une erreur et un succès sont le même signe. Le préfixe et le
 * pictogramme sont donc OBLIGATOIRES — retirez toute la couleur, ils subsistent à 8,53:1.
 *
 * Le `className` tient sur UNE LIGNE : le garde-fou de brand-accents.test.ts analyse ligne
 * à ligne, un attribut réparti sur plusieurs lignes lui échapperait.
 */
export function ChampErreur({
  id,
  prefixe,
  variante = 'erreur',
  surface = 'bg-white',
  children,
}: {
  /** À référencer par l'`aria-describedby` du champ fautif. */
  id?: string
  /** `t.common.erreur`, `t.common.echec` ou `t.common.avertissement` — jamais une chaîne nue. */
  prefixe: string
  /** `avertissement` : l'action reste possible, le ton est plus doux et l'icône un triangle. */
  variante?: 'erreur' | 'avertissement'
  /** Surface de l'hôte : `bg-white` en pleine page, `bg-pil` dans un panneau. Jamais une teinte. */
  surface?: string
  children: ReactNode
}) {
  const Pictogramme = variante === 'avertissement' ? IconAvertissement : IconErreur
  return (
    <p id={id} role={variante === 'avertissement' ? 'status' : 'alert'} className={`flex items-start gap-2.5 rounded-lg border-l-[3px] border-wouj ${surface} px-3 py-2 text-sm text-ank`}>
      <Pictogramme aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-wouj" strokeWidth={2} />
      <span>
        <b className="font-semibold">{prefixe}</b> {children}
      </span>
    </p>
  )
}
