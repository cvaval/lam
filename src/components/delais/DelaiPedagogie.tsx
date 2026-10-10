import type { ReactNode } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { TEXTES } from '@/lib/delais/textes'
import { DelaiAideImpression } from './DelaiAideImpression'

/**
 * LA COLONNE D'AIDE DU PORTAIL — trois blocs repliables, fermés par défaut (aperçu Agora,
 * 9 oct. 2026). Avant cette date : l'encart pédagogique de l'état vide, toujours déplié.
 *
 *  1. **« Avant de commencer : comment lire la date »** — `d.intro`, AU MOT PRÈS : la date la
 *     plus précoce, la prorogation de l'article 991 (acquise ou en réserve selon le Code), les
 *     lectures concurrentes. La note était sous le titre de la page ; elle ouvre désormais la
 *     colonne, à côté du point de départ. Filet terracotta : c'est la règle de prudence.
 *  2. **« Comment ce calculateur compte »** — la phrase qui cadre l'outil, y compris ce qu'il
 *     NE connaît PAS (les arrêtés de chômage), et **l'article 987 cité intégralement**, avec
 *     sa source. Son titre nomme la région (`delai-pedagogie`) : un seul titre, visible.
 *  3. **L'exemple travaillé de l'arrêt Germeil**, avec sa mention « historique » : la borne du
 *     § 4.3 interdit de le rejouer dans l'outil, et un exemple qu'on ne peut pas reproduire
 *     doit le dire, sans quoi l'utilisatrice croira à une panne.
 *
 * `<details>`/`<summary>` NATIFS : chaque bloc s'ouvre seul, au clavier comme à la souris, et
 * sans JavaScript. Le résumé ne contient que du texte — aucun contrôle imbriqué. À l'impression,
 * les trois blocs sont dépliés (`DelaiAideImpression`, et `calculateur.css` sans script).
 *
 * ⚠️ **LA MENTION « Information documentaire, non officielle… » N'EST PAS ICI.** La page hôte la
 * porte dans son pied (`(app)/outils/delais`) ; la reprendre ici la ferait lire deux fois.
 */
export function DelaiPedagogie({ t }: { t: Dictionary }) {
  const d = t.delais
  const art987 = TEXTES['cpc-987']

  return (
    <aside
      aria-labelledby="delai-pedagogie"
      className="ag-calculator-help flex flex-col gap-3 rounded-[10px] border border-liy bg-[#EEEFE8] p-5"
    >
      <DelaiAideImpression />

      <BlocAide titre={d.introTitle} filet>
        <p className="text-sm leading-relaxed text-ank">{d.intro}</p>
      </BlocAide>

      <BlocAide titre={d.emptyTitle} titreId="delai-pedagogie">
        <p className="text-sm leading-relaxed text-grafit">{d.frameworkNote}</p>
        <h3 className="mt-4 text-sm font-semibold text-ank">{art987.reference}</h3>
        <p className="mt-1 whitespace-pre-line font-serif text-sm leading-relaxed text-ank">{art987.texte}</p>
        <p className="mt-1 text-xs text-grafit">{art987.source}</p>
      </BlocAide>

      <BlocAide titre={d.emptyGermeilTitle}>
        <p className="text-sm leading-relaxed text-ank">{d.emptyGermeilBody}</p>
        {/* La mention est ÉCRITE, jamais une pastille : l'exemple ne se rejoue pas. */}
        <p className="mt-2 text-xs font-medium text-ank">{d.emptyGermeilHistorical}</p>
      </BlocAide>
    </aside>
  )
}

/**
 * Un bloc repliable. L'indicateur (▸ terracotta, pivoté à l'ouverture) remplace le marqueur natif,
 * dont la couleur ne se règle pas partout (Safari ignore `::marker` sur `<summary>`). Le focus
 * clavier est celui de la maison (globals.css, charte § 6) : rien n'est redéfini ici.
 */
function BlocAide({
  titre,
  titreId,
  filet = false,
  children,
}: {
  titre: string
  titreId?: string
  filet?: boolean
  children: ReactNode
}) {
  return (
    <details className={`group rounded-md border border-liy bg-white ${filet ? 'border-l-[3px] border-l-wouj' : ''}`}>
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2.5 px-4 py-3 text-sm font-semibold leading-snug text-ank [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="shrink-0 text-[11px] text-wouj transition-transform group-open:rotate-90 motion-reduce:transition-none">
          ▶
        </span>
        <span id={titreId}>{titre}</span>
      </summary>
      <div className="border-t border-liy px-4 pb-4 pt-3">{children}</div>
    </details>
  )
}
