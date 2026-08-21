import type { Dictionary } from '@/lib/i18n/dictionaries'
import { TEXTES } from '@/lib/delais/textes'

/**
 * § 6.2, état VIDE — l'encart pédagogique. Il n'y a rien à calculer : on montre alors la
 * règle elle-même.
 *
 * Trois choses, et rien d'autre :
 *  1. **l'article 987 cité intégralement** — la règle de computation, pas son résumé ;
 *  2. **l'exemple travaillé de l'arrêt Germeil**, avec sa mention « historique » : la borne
 *     du § 4.3 interdit de le rejouer dans l'outil, et un exemple qu'on ne peut pas
 *     reproduire doit le dire, sans quoi l'utilisatrice croira à une panne ;
 *  3. **la phrase qui cadre l'outil**, y compris ce qu'il NE connaît PAS (les arrêtés de
 *     chômage). Un outil qui tait ses limites les fait découvrir au pire moment.
 *
 * ⚠️ **LA MENTION « Information documentaire, non officielle… » N'EST PAS ICI.** Elle l'était,
 * et les deux pages hôtes la portent déjà dans leur pied — `/{locale}/delais` et
 * `(app)/outils/delais` : sur l'état vide, les deux lignes se suivaient à l'identique. C'est
 * le pied de page qui a la bonne place typographique ; un encart pédagogique n'est pas un
 * pied. Si cet encart est un jour rendu ailleurs, c'est à la page hôte de porter `disclaimer`,
 * pas à lui de le reprendre.
 */
export function DelaiPedagogie({ t }: { t: Dictionary }) {
  const d = t.delais
  const art987 = TEXTES['cpc-987']

  return (
    <aside aria-labelledby="delai-pedagogie" className="flex flex-col gap-4">
      <section className="rounded-xl border border-liy bg-white p-5">
        <h2 id="delai-pedagogie" className="border-l-[3px] border-wouj pl-3 font-sans text-lg font-semibold text-ank">
          {d.emptyTitle}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-grafit">{d.frameworkNote}</p>
        <h3 className="mt-4 text-sm font-semibold text-ank">{art987.reference}</h3>
        <p className="mt-1 whitespace-pre-line font-serif text-sm leading-relaxed text-ank">{art987.texte}</p>
        <p className="mt-1 text-xs text-grafit">{art987.source}</p>
      </section>

      <section className="rounded-xl border border-liy bg-white p-5">
        <h3 className="font-sans text-sm font-semibold text-ank">{d.emptyGermeilTitle}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ank">{d.emptyGermeilBody}</p>
        {/* La mention est ÉCRITE, jamais une pastille : l'exemple ne se rejoue pas. */}
        <p className="mt-2 text-xs font-medium text-ank">{d.emptyGermeilHistorical}</p>
      </section>
    </aside>
  )
}
