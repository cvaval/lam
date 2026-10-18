'use client'

import { useState } from 'react'
import { CocheConfirme } from './CocheConfirme'

/**
 * La coche « Confirmé » et son infobulle « Informations confirmées par le notaire. » — affichée
 * SEULEMENT au survol, au focus clavier ou au toucher (bascule), jamais en permanence. La coche est
 * un vrai bouton : nommé (le texte de l'infobulle), atteignable au clavier ; Échap referme
 * l'infobulle sans fermer la fenêtre modale qui la contient. L'infobulle n'est jamais le seul accès
 * à l'information : le libellé « Confirmé » est écrit à côté, et la date sous le nom.
 */
export function InfobulleConfirme({ texte, taille = 'h-5 w-5' }: { texte: string; taille?: string }) {
  const [survol, setSurvol] = useState(false)
  const [focus, setFocus] = useState(false)
  const [epingle, setEpingle] = useState(false)
  const visible = survol || focus || epingle
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={texte}
        onMouseEnter={() => setSurvol(true)}
        onMouseLeave={() => setSurvol(false)}
        onFocus={() => setFocus(true)}
        onBlur={() => { setFocus(false); setEpingle(false) }}
        onClick={() => setEpingle((x) => !x)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && visible) {
            e.stopPropagation()
            setSurvol(false); setEpingle(false); setFocus(false)
          }
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full outline-offset-2"
      >
        <CocheConfirme className={taille} />
      </button>
      {visible && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-max max-w-[15rem] -translate-x-1/2 rounded-md bg-[#152E38] px-2.5 py-1.5 font-sans text-[12px] font-normal leading-snug text-white shadow-sm"
        >
          {texte}
        </span>
      )}
    </span>
  )
}
